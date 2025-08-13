"""Core context abstraction allowing multiple heads (stream, offline CLI, future phone) to share same subsystems.

This keeps StreamDaemon (OBS head) thin and lets other front-ends plug in without
re‑instantiating engines or duplicating persistence logic.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import time, json, os, threading

# Import existing subsystems from StreamDaemon (treating them as core for now)
from hrm_engine import HRMEngine
from StreamDaemon.hrm_memory import HRMMemory
from StreamDaemon.hrm_feedback import HRMFeedback
from StreamDaemon.hrm_metrics import HRMMetrics
from StreamDaemon.hrm_moderation import HRMModeration

# Optional journaling (created below)
from journal_manager import JournalManager

@dataclass
class CoreContext:
    hrm: HRMEngine
    memory: HRMMemory
    feedback: HRMFeedback
    metrics: HRMMetrics
    moderation: HRMModeration
    journal: JournalManager
    veil_mode: str = "online"
    heads: Dict[str, Dict[str, Any]] = field(default_factory=dict)  # head_id -> capabilities
    lock: threading.RLock = field(default_factory=threading.RLock)

    def register_head(self, head_id: str, capabilities: Optional[Dict[str, Any]] = None) -> None:
        with self.lock:
            self.heads[head_id] = capabilities or {}

    def update_capabilities(self, head_id: str, capabilities: Dict[str, Any]) -> None:
        with self.lock:
            if head_id in self.heads:
                self.heads[head_id].update(capabilities)

    def evaluate(self, text: str) -> Dict[str, Any]:
        """Run moderation + HRM evaluation.
        Returns a structured dict containing moderation, actions, voice_lines.
        """
        mods = self.moderation.classify(text)
        allowed = self.moderation.filter(text)
        actions = []
        voice_lines: List[str] = []
        if allowed:
            try:
                actions = self.hrm.evaluate(text)
                voice_lines = self.hrm.emit_actions(actions)
                if voice_lines:
                    try:
                        print(f"[HRM voice] {voice_lines[0]}")
                    except Exception:
                        pass
                self.metrics.log("hrm_calls")
            except Exception:
                pass
        # Memory & journaling (only after processing)
        try:
            self.memory.add_event({"msg": text, "moderation": mods})
        except Exception:
            pass
        try:
            self.journal.append({
                "ts": time.time(),
                "text": text,
                "moderation": mods,
                "voice": voice_lines[:],
            })
        except Exception:
            pass
        return {
            "moderation": mods,
            "allowed": allowed,
            "actions": actions,
            "voice_lines": voice_lines,
        }

    def add_dynamic_rule(self, match: str, reply: str, glyph: Optional[str] = None) -> bool:
        try:
            before = len(self.hrm.dynamic_rules)
            self.hrm.update_policy(match, reply, glyph)
            after = len(self.hrm.dynamic_rules)
            if after > before:
                self.journal.append({"ts": time.time(), "event": "rule_added", "match": match, "reply": reply})
                return True
            return False
        except Exception:
            return False


def bootstrap_core(veil_mode: Optional[str] = None, journal_dir: Optional[str] = None) -> CoreContext:
    """Create a CoreContext using existing modules.

    veil_mode: influences moderation permissiveness (offline => loose) already handled in HRMModeration via env.
    journal_dir: override journal directory (else taken from config or default logs/journal).
    """
    veil_mode = (veil_mode or os.environ.get("VEIL_MODE") or "online").lower().strip()
    jm = JournalManager(journal_dir)
    ctx = CoreContext(
        hrm=HRMEngine(),
        memory=HRMMemory(),
        feedback=HRMFeedback(),
        metrics=HRMMetrics(),
        moderation=HRMModeration(),
        journal=jm,
        veil_mode=veil_mode,
    )
    try:
        loaded = ctx.hrm.reload_rules()
        if loaded:
            print(f"[Core] Loaded {loaded} dynamic HRM rules.")
    except Exception:
        pass
    return ctx
