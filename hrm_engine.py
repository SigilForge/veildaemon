"""HRM Engine (lightweight shim)

- Loads logic packs via pack_loader
- Evaluates incoming text/events and emits actions
- Ready to be swapped with hrm_core integration later
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List
from pack_loader import load_all_packs
import random
import re
from collections import deque
import difflib
from knowledge_store import KnowledgeStore
from task_store import TaskStore

@dataclass
class HRMAction:
    kind: str  # 'ritual' | 'glyph' | 'voice_prompt'
    value: Any

class HRMEngine:
    def __init__(self) -> None:
        self.logic_packs: List[Dict[str, Any]] = []
        self.knowledge = KnowledgeStore()
        # Select task backend: env HRM_TASK_STORE=sqlite|json (default sqlite)
        try:
            import os as _os
            backend = (_os.environ.get("HRM_TASK_STORE", "sqlite") or "sqlite").lower()
            if backend in ("sqlite", "sql", "db"):
                try:
                    from task_store_sqlite import TaskStoreSQL  # type: ignore
                    self.tasks = TaskStoreSQL()
                except Exception:
                    self.tasks = TaskStore()
            else:
                self.tasks = TaskStore()
        except Exception:
            self.tasks = TaskStore()
        for p in load_all_packs():
            if p.type == "logic":
                self.logic_packs.append(p.content or {})
        # Merge thresholds/action hints (very simple for now)
        self.thresholds: Dict[str, Any] = {}
        self.default_actions: List[HRMAction] = []
    # Optional custom action hooks registered by packs or trainer
        self.custom_actions: Dict[str, Any] = {}
        # Dynamic policy rules injected via trainer feedback
        self.dynamic_rules: List[Dict[str, Any]] = []  # each: {'match': str, 'reply': str, 'glyph': optional}
        for lp in self.logic_packs:
            th = lp.get("thresholds") or {}
            self.thresholds.update(th)
            for a in lp.get("actions") or []:
                # normalize
                for k, v in a.items():
                    self.default_actions.append(HRMAction(kind=k, value=v))
        # Attempt to load persisted learned rules
        try:
            import os, json
            rules_path = os.environ.get("HRM_LEARNED_RULES_PATH", "StreamDaemon/hrm_learned_rules.json")
            if os.path.exists(rules_path):
                with open(rules_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        self.dynamic_rules = data
                        print(f"[HRMEngine] Loaded {len(self.dynamic_rules)} learned rules from {rules_path}")
        except Exception as e:
            print(f"[HRMEngine] Could not load learned rules: {e}")
        # Variation helpers
        self._reply_history: deque[str] = deque(maxlen=25)
        self._openers = [
            "Alright.", "Noted.", "Hear me.", "Okay.", "So.", "Quick note:", "Heads up.", "Listen.", "Mark this.", "Torch up." 
        ]
        self._closers = [
            "Back we go.", "Onward.", "We continue.", "We keep moving.", "Staying present.", "Focus holds.", "Veil intact." 
        ]
        self._synonyms = {
            "quick": ["swift", "brief", "short"],
            "welcome": ["greetings", "hail", "welcome"],
            "thanks": ["appreciate", "gratitude", "thank you"],
            "hydrate": ["water", "sip", "drink"],
            "calm": ["steady", "grounded", "even"],
            "mode": ["phase", "state", "layer"],
        }
        self._protected_words = {"crisis", "support", "resources", "link"}
        # Brand hook (consistent tag) and injection rate
        try:
            import os
            self._brand_hook = os.environ.get("HRM_BRAND_HOOK", "Veil intact.").strip()
            try:
                self._brand_hook_rate = float(os.environ.get("HRM_BRAND_HOOK_RATE", "0.35"))
            except Exception:
                self._brand_hook_rate = 0.35
        except Exception:
            self._brand_hook = "Veil intact."
            self._brand_hook_rate = 0.35

    def evaluate(self, text: str) -> List[HRMAction]:
        """Return actions based on simple heuristics.
        Later: replace with hrm_core policy inference.
        """
        raw = (text or "").strip()
        t = raw.lower()
        actions: List[HRMAction] = []
        # Quick intent: "what are we doing" / status
        if re.search(r"\b(what\s+are\s+we\s+doing|what's\s+the\s+plan|status\??|remind\s+me)\b", t):
            cur = self.tasks.get_current()
            if cur:
                line = f"Current task: {cur.get('text')}."
            else:
                # propose next or show recent events
                nxt = next((x for x in self.tasks.list_tasks(active_only=True, limit=1)), None)
                if nxt:
                    line = f"Next up: {nxt.get('text')}."
                else:
                    recent = self.tasks.recent_events(3)
                    if recent:
                        last = recent[-1]
                        line = f"Last event: {last.get('text')}"
                    else:
                        line = "No active tasks yet. Want me to set one?"
            actions.append(HRMAction('voice_prompt', self._vary_reply(line, t)))
            return actions
        # Dynamic rules first (highest priority)
        # Direct substring or regex match
        for rule in self.dynamic_rules:
            try:
                m = rule.get('match')
                if not m:
                    continue
                use_regex = bool(rule.get('regex'))
                matched = False
                if use_regex:
                    try:
                        if re.search(m, t):
                            matched = True
                    except Exception:
                        pass
                else:
                    if m in t:
                        matched = True
                if matched:
                    reply = self._render_reply_from_rule(rule, t)
                    if rule.get('glyph'):
                        actions.append(HRMAction('glyph', rule['glyph']))
                    if reply:
                        actions.append(HRMAction('voice_prompt', reply))
                    return actions
            except Exception:
                pass

        # Fuzzy fallback if no direct match: pick highest ratio above threshold, with knowledge bias
        best_rule = None
        best_score = 0.0
        for rule in self.dynamic_rules:
            m = rule.get('match')
            if not m or rule.get('regex'):
                continue
            try:
                score = difflib.SequenceMatcher(None, m, t).ratio()
            except Exception:
                score = 0.0
            # Bias by confidence if present
            conf = float(rule.get('confidence') or 0.0)
            score = score * (1.0 + min(conf, 1.0) * 0.15)
            if score > 0.78 and score > best_score:
                best_score = score
                best_rule = rule
        if best_rule:
            reply = self._render_reply_from_rule(best_rule, t)
            if best_rule.get('glyph'):
                actions.append(HRMAction('glyph', best_rule['glyph']))
            if reply:
                actions.append(HRMAction('voice_prompt', reply))
            return actions

        # Event hooks
        if t.startswith("[event_raid]"):
            actions.append(HRMAction("glyph", "🔥"))
            # Parse optional payload: "[EVENT_RAID] Name | game:XYZ"
            try:
                m = re.match(r"\[event_raid\]\s*(?P<who>[^|]+)?(?:\|\s*game:(?P<game>.+))?", raw, flags=re.IGNORECASE)
                who = (m.group('who') if m else '').strip() if m else ''
                game = (m.group('game') if m else '').strip() if m else ''
                # Learn observed game and fallback to knowledge if missing
                key = f"raider:{who.lower()}:game" if who else None
                try:
                    if game and key:
                        self.knowledge.set_fact(key, game, source="observed", confidence=0.8)
                    elif (not game) and key:
                        rec = self.knowledge.get(key)
                        if rec and rec.get("value"):
                            game = str(rec.get("value"))
                except Exception:
                    pass
                # Record event
                try:
                    self.tasks.record_event(f"Raid from {who}", tags=["raid"], game=game or None)
                except Exception:
                    pass
                base_lines = []
                if game:
                    base_lines = [
                        f"Welcome raiders—{who}. How was {game}? Torch up.",
                        f"Hail {who}! {game} treat you kind, or was it a gauntlet?",
                        f"Raid spotted from {who}. {game} runs always get the blood moving.",
                        f"Welcome in, {who}. Survive {game} alright? Quick highlight?",
                        f"Veil opens for {who}. {game} debrief while we pour tea?",
                    ]
                else:
                    base_lines = [
                        f"Welcome raiders—{who}. Torch up.",
                        f"Hail {who}! Pull up a chair.",
                        f"Raid spotted from {who}."
                    ]
                reply = random.choice(base_lines)
                actions.append(HRMAction("voice_prompt", self._vary_reply(reply, t)))
                return actions
            except Exception:
                pass
        if t.startswith("[event_sub]"):
            actions.append(HRMAction("glyph", "✨"))
            try:
                self.tasks.record_event("Sub event", tags=["sub"])
            except Exception:
                pass
        if t.startswith("[interrupt]"):
            actions.append(HRMAction("glyph", "🛡️"))
            actions.append(HRMAction("voice_prompt", "Interrupt honored. We slow down now."))
            try:
                self.tasks.record_event("Interrupt", tags=["interrupt"])
            except Exception:
                pass
            return actions
        # Meltdown-ish keywords
        meltdowns = ["overwhelm", "overwhelmed", "panic", "shut down", "meltdown", "yelling"]
        if any(k in t for k in meltdowns):
            # Use default actions from packs if present
            if self.default_actions:
                actions.extend(self.default_actions)
            else:
                # sensible defaults
                actions.append(HRMAction("glyph", "🕯"))
                actions.append(HRMAction("voice_prompt", "Grounding activated. Breathe with me."))
        # Lightweight task command parsing
        try:
            # e.g., "task: find the red key", "todo: open the gate"
            m = re.search(r"\b(task|todo)\s*:\s*(.+)$", raw, flags=re.IGNORECASE)
            if m:
                txt = m.group(2).strip()
                # include possible game context if known from knowledge for channel
                game = None
                rec = self.knowledge.get("channel:game")
                if rec and rec.get("value"):
                    game = str(rec.get("value"))
                created = self.tasks.add_task(txt, tags=["user"], game=game)
                actions.append(HRMAction("voice_prompt", self._vary_reply(f"Logged it: {created.get('text')}.", t)))
                return actions
            # e.g., "done: red key" or "complete: 12ab"
            m2 = re.search(r"\b(done|complete)\s*:\s*(.+)$", raw, flags=re.IGNORECASE)
            if m2:
                ident = m2.group(2).strip()
                comp = self.tasks.complete_task(ident)
                if comp:
                    actions.append(HRMAction("voice_prompt", self._vary_reply(f"Marked done: {comp.get('text')}.", t)))
                else:
                    actions.append(HRMAction("voice_prompt", self._vary_reply("Couldn't find that task.", t)))
                return actions
            # e.g., "export: obsidian C:\\Vault" (Windows path with spaces allowed)
            m3 = re.search(r"\bexport\s*:\s*obsidian\s+(.+)$", raw, flags=re.IGNORECASE)
            if m3:
                dest = m3.group(1).strip().strip('"')
                try:
                    path = self.tasks.export_obsidian(dest)
                    actions.append(HRMAction('voice_prompt', self._vary_reply(f"Exported notes to {path}.", t)))
                except Exception:
                    actions.append(HRMAction('voice_prompt', self._vary_reply("Export failed.", t)))
                return actions
        except Exception:
            pass

        return actions

    # --- Corrections and knowledge ---
    def correct_fact(self, key: str, value: str, by_owner: bool = True) -> bool:
        try:
            src = "owner" if by_owner else "mod"
            self.knowledge.set_fact(key, value, source=src)
            return True
        except Exception:
            return False

    def suggest_fact(self, key: str, value: str, by_chat: bool = True) -> bool:
        try:
            src = "chat" if by_chat else "observed"
            self.knowledge.suggest_fact(key, value, source=src)
            return True
        except Exception:
            return False

    # --- Dynamic policy update API ---
    def update_policy(self, trigger_phrase: str, improved_reply: str, glyph: str | None = None, confidence: float | None = None, source: str | None = None) -> None:
        """Add or replace a dynamic rule based on feedback/improvement.

        Args:
            trigger_phrase: lowercase substring to match in future evaluate() calls
            improved_reply: the target voice line to emit
            glyph: optional glyph to emit alongside
        """
        if not trigger_phrase or not improved_reply:
            return
        trig = trigger_phrase.lower().strip()
        # Replace existing
        for r in self.dynamic_rules:
            if r.get('match') == trig:
                r['reply'] = improved_reply.strip()
                if glyph:
                    r['glyph'] = glyph
                if confidence is not None:
                    r['confidence'] = float(confidence)
                if source:
                    r['source'] = source
                return
        # Auto glyph suggestion if missing
        auto_glyph = glyph or self._suggest_glyph(improved_reply)
        new_rule = {'match': trig, 'reply': improved_reply.strip(), 'glyph': auto_glyph}
        if confidence is not None:
            new_rule['confidence'] = float(confidence)
        if source:
            new_rule['source'] = source
        self.dynamic_rules.append(new_rule)

    def reload_rules(self, path: str | None = None) -> int:
        """Reload dynamic rules from disk; returns count loaded."""
        import os, json
        p = path or os.environ.get("HRM_LEARNED_RULES_PATH", "StreamDaemon/hrm_learned_rules.json")
        try:
            if os.path.exists(p):
                with open(p, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        self.dynamic_rules = data
                        return len(self.dynamic_rules)
        except Exception:
            pass
        return 0

    # --- Custom action registration ---
    def add_custom_action(self, name: str, fn: Any) -> bool:
        """Register a callable custom action. Stored but not auto-called yet.

        Packs may use this to attach behaviors. In this lightweight shim,
        we don't auto-invoke these; external engines can call them explicitly
        or future policy can reference them by name.
        """
        if not name or not callable(fn):
            return False
        try:
            self.custom_actions[name] = fn
            return True
        except Exception:
            return False

    # --- Variation + helpers ---
    def _vary_reply(self, base: str, context_text: str) -> str:
        if not base:
            return base
        original = base
        # Avoid repeating last reply verbatim
        if original in self._reply_history:
            base = self._light_paraphrase(base)
        # Occasionally prepend opener or append closer
        if random.random() < 0.35:
            base = f"{random.choice(self._openers)} {base}".strip()
        if random.random() < 0.35:
            base = f"{base} {random.choice(self._closers)}".strip()
        # Sometimes append the brand hook for consistency
        if self._brand_hook and random.random() < self._brand_hook_rate:
            if not base.endswith(self._brand_hook):
                base = f"{base} {self._brand_hook}".strip()
        # Ensure length reasonable
        base = base.strip()
        # Deduplicate whitespace
        base = re.sub(r'\s+', ' ', base)
        # Track history
        self._reply_history.append(base)
        return base

    def _render_reply_from_rule(self, rule: Dict[str, Any], context_text: str) -> str:
        """Pick a base reply from a rule (supports 'reply' str or list, or 'variants').
        Avoid immediate repeats; then apply variation and brand hook.
        """
        base: str = ""
        # Prefer 'variants' if present
        variants = rule.get('variants')
        if isinstance(variants, list) and variants:
            picks = variants[:]
        else:
            r = rule.get('reply')
            if isinstance(r, list) and r:
                picks = r[:]
            elif isinstance(r, str) and r:
                picks = [r]
            else:
                picks = []
        if picks:
            # Try a few times to avoid repeating recent exact reply
            tried = set()
            for _ in range(min(5, len(picks))):
                cand = random.choice(picks)
                if cand in tried:
                    continue
                tried.add(cand)
                if cand not in self._reply_history:
                    base = cand
                    break
            if not base:
                base = random.choice(picks)
        # Fallback to string if nothing available
        if not base:
            base = str(rule.get('reply') or '')
        return self._vary_reply(base, context_text)

    def _light_paraphrase(self, text: str) -> str:
        # Replace non-protected words with synonyms (one or two swaps)
        tokens = text.split()
        swaps = 0
        for i, tok in enumerate(tokens):
            raw = re.sub(r'[^A-Za-z]', '', tok).lower()
            if raw in self._protected_words:
                continue
            syns = self._synonyms.get(raw)
            if syns and random.random() < 0.4:
                repl = random.choice(syns)
                # Preserve capitalization
                if tok.istitle():
                    repl = repl.title()
                tokens[i] = repl
                swaps += 1
            if swaps >= 2:
                break
        return ' '.join(tokens)

    def _suggest_glyph(self, reply: str | None) -> str | None:
        if not reply:
            return None
        r = reply.lower()
        if any(k in r for k in ["raid", "torch", "welcome"]):
            return "🔥"
        if any(k in r for k in ["calm", "breathe", "ground"]):
            return "🕯"
        if any(k in r for k in ["hydrate", "water"]):
            return "💧"
        if any(k in r for k in ["quiet", "low-sensory", "soft"]):
            return "🌫"
        return None

    def emit_actions(self, actions: List[HRMAction]) -> List[str]:
        """Side-effect helpers; returns voice prompts to speak."""
        voice_lines: List[str] = []
        try:
            from glyph_engine import encode_glyph, log_glyph  # type: ignore
        except Exception:
            encode_glyph = None
            log_glyph = None
        for a in actions:
            if a.kind == "glyph" and encode_glyph and log_glyph:
                try:
                    log_glyph(encode_glyph(a.value))
                except Exception:
                    pass
            if a.kind == "voice_prompt":
                try:
                    s = str(a.value).strip()
                    # Drop spurious wake-word bleed like 'q/que/queue'
                    if re.fullmatch(r"(?i)(q|que|queue)[\W]*", s or ""):
                        continue
                    voice_lines.append(s)
                except Exception:
                    voice_lines.append(str(a.value))
        return voice_lines
