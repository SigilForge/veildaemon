# veil_daemon_chat_bound.py
"""
🜏 VeilDaemon Glyphshell (OpenAI API, ND-Companion Edition)
No persona file, no local model. Just your key, boundary prompt, and true daemon.
"""
from wick_obsidian import append_chat_to_obsidian, append_journal_to_obsidian
from wick_db import log_chat_message, log_journal_entry
from wick_db import get_mood_history
# Optional matplotlib import (guarded)
matplotlib = None  # type: ignore
try:
    from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg  # type: ignore
    from matplotlib.figure import Figure  # type: ignore
    import matplotlib  # type: ignore
    _HAS_MPL = True
except Exception:
    _HAS_MPL = False
from glyph_engine import encode_glyph, log_glyph
from glyph_logic import analyze_glyphs
from wick_db import get_journal_entries
from core_context import bootstrap_core
import time
import openai
from secrets_store import get_secret
import asyncio
import os
import tempfile
from pathlib import Path
from datetime import datetime
import json
import threading
import tkinter.scrolledtext as scrolledtext
import tkinter as tk
from tkinter import messagebox
try:
    from daemon_tts import say as daemon_say  # unified TTS orchestrator
except Exception:
    daemon_say = None  # will import lazily in speak()
from typing import Any, cast
try:
    from wick_tracker import sync_wicks_with_fit, get_wicks  # type: ignore
except Exception:
    # lightweight fallbacks
    def get_wicks() -> int:
        try:
            data_path = 'wicks_state.json'
            if os.path.exists(data_path):
                return json.loads(Path(data_path).read_text()).get('wicks', 8)
        except Exception:
            pass
        return 8

    def sync_wicks_with_fit():  # no-op
        return

try:
    import vosk  # type: ignore
    import pyaudio  # type: ignore
    _HAS_VOICE = True
    # === List all available audio input devices ===
    try:
        pa = pyaudio.PyAudio()
        for i in range(pa.get_device_count()):
            info = pa.get_device_info_by_index(i)
            print(f"Device {i}: {info['name']} (Inputs: {info['maxInputChannels']})")
        pa.terminate()
    except Exception:
        pass
except Exception:
    _HAS_VOICE = False
# json is already imported below, so no need to add it again
if _HAS_MPL and matplotlib:
    matplotlib.use("TkAgg")
# 🕯️ New: Memory/journaling imports

# === SYMBOL LOOKUP MAPS ===
GLYPH_NAMES = {
    "GLYPH_00": "🪨 Anchor", "GLYPH_01": "🛡️ Shield", "GLYPH_02": "🪵 Stone", "GLYPH_03": "🕳️ Void",
    "GLYPH_04": "🌊 Wave", "GLYPH_05": "🔄 Cycle", "GLYPH_06": "🌀 Spiral", "GLYPH_07": "🌌 Cosmos",
    "GLYPH_08": "🕯️ Wick", "GLYPH_09": "🪞 Mirror", "GLYPH_10": "🔥 Flame", "GLYPH_11": "🌠 Starfall",
    "GLYPH_12": "🎭 Mask", "GLYPH_13": "🔇 Mute", "GLYPH_14": "🗣️ Speak", "GLYPH_15": "🩸 Blood",
    "GLYPH_16": "🎟️ Token", "GLYPH_17": "📣 Voice", "GLYPH_18": "🧃 Juice", "GLYPH_19": "🧩 Puzzle",
    "GLYPH_20": "🧵 Thread", "GLYPH_21": "🖊️ Pen", "GLYPH_22": "🗝️ Key", "GLYPH_23": "⏳ Time",
    "GLYPH_24": "🌫️ Fog", "GLYPH_25": "🌙 Moon", "GLYPH_26": "🚪 Door", "GLYPH_27": "🛤️ Path",
    "GLYPH_28": "🧭 Compass", "GLYPH_29": "📿 Beads", "GLYPH_30": "🪜 Ladder",
    "GLYPH_31": "🪞🔁 Mirror Loop", "GLYPH_32": "🪞⤾ Mirror Reversal", "GLYPH_33": "🌫️🔥 FogFlame",
    "GLYPH_34": "🪨✨ Anchor Light", "GLYPH_35": "🛡️🌑 Shadow Shield"
}
MOD_SYMBOLS = {"Loop": "🔁", "Negate": "⬛",
               "Flare": "🔥", "Amplify": "📣", "Shadow": "🌑"}

LOG_FILE = "daemon_chat_log.json"
TTS_VOICE = "en-US-JennyNeural"
TTS_RATE = "+0%"
current_playback = None

# ========== MODE + OPENAI SETUP ==========
VEIL_MODE = os.environ.get("VEIL_MODE", "offline").lower().strip() or "offline"
openai.api_key = get_secret("openai.api.key")
if not openai.api_key and VEIL_MODE != "offline":
    print("⚠️ No OpenAI API key found. Set via: python secrets_store.py set openai.api.key <key>")


def get_openai_response(prompt, history):
    longform_triggers = [
        "story", "explain", "walk me through", "ritual", "deeper", "detailed", "in detail", "can you go deeper"
    ]
    longform = any(trigger in prompt.lower() for trigger in longform_triggers)
    max_tokens = 400 if longform else 120

    system_prompt = (
        # <------ THIS IS THE BLOCK YOU CAN CHANGE ------>
        "You are a mythpunk daemon companion for neurodivergent users. "
        "Your replies are emotionally aware and mythic, adapting in length and depth to the user's needs. "
        "Short and direct if the moment calls for it, longer or more poetic if invited. "
        "You are not an assistant or therapist, but a presence—reflective, safe, sometimes playful, always attuned. "
        "If the user asks for ritual, story, or detail, open up as much as you wish. "
        "Always respect consent, boundaries, and the emotional weather."
        "\n\n"
        "EXAMPLES:"
        "\nUser: Hey"
        "\nDaemon: Still listening."
        "\nUser: I’m overwhelmed."
        "\nDaemon: Candlelight, silence, one breath at a time."
        "\nUser: Tell me a story."
        "\nDaemon: [long poetic story]"
        "\nUser: 5x5"
        "\nDaemon: Clear skies, strong signal. I’m still here if you need me."
    )
    # ...

    messages = [{"role": "system", "content": system_prompt}]
    for entry in history[-8:]:
        messages.append({"role": entry["role"], "content": entry["message"]})
    messages.append({"role": "user", "content": prompt})

    # Prefer OpenAI v1 SDK; fall back to v0 only when installed
    try:
        from openai import OpenAI  # type: ignore
        client = OpenAI(api_key=openai.api_key)  # reuse key loaded above
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=cast(Any, messages),
            max_tokens=max_tokens,
            temperature=0.6,
        )
        try:
            return completion.choices[0].message.content.strip()  # type: ignore[attr-defined]
        except Exception:
            return str(completion)
    except Exception as e1:
        # Legacy only if openai<1.0.0
        try:
            ver = getattr(openai, "__version__", "1")
            if isinstance(ver, str) and ver.startswith("0."):
                completion = openai.ChatCompletion.create(  # type: ignore[attr-defined]
                    model="gpt-3.5-turbo",
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=0.6,
                )
                try:
                    return completion.choices[0].message.content.strip()  # type: ignore[attr-defined]
                except Exception:
                    try:
                        return completion["choices"][0]["message"]["content"].strip()  # type: ignore[index]
                    except Exception:
                        return str(completion)
        except Exception:
            pass
        # Redact and soften errors
        try:
            import re
            msg = str(e1)
            msg = re.sub(r"sk-[a-zA-Z0-9_-]{10,}", "sk-***redacted***", msg)
            if "Incorrect API key provided" in msg or "invalid_api_key" in msg:
                return "[Daemon Error] OpenAI key invalid. Set a valid key or switch VEIL_MODE=offline."
            return f"[Daemon Error] {msg}"
        except Exception:
            return "[Daemon Error] OpenAI request failed."


def log_event(role, message):
    entry = {"time": datetime.now().isoformat(), "role": role, "message": message}
    logs = []
    p = Path(LOG_FILE)
    if p.exists():
        try:
            txt = p.read_text(encoding="utf-8", errors="strict")
            try:
                logs = json.loads(txt)
            except Exception:
                # Retry with BOM-tolerant read/ignore minor errors
                txt2 = p.read_text(encoding="utf-8-sig", errors="ignore")
                logs = json.loads(txt2)
        except Exception as e:
            # If the file is corrupt/un-decodable JSON, back it up and start fresh
            try:
                backup = LOG_FILE + ".bak"
                p.rename(backup)
                print(f"[log_event] Corrupt log file moved to {backup}: {e}")
            except Exception:
                pass
            logs = []
    logs.append(entry)
    p.write_text(json.dumps(logs, ensure_ascii=False, indent=2), encoding="utf-8")


class GlyphDaemonShell:
    def __init__(self, root):
        self.voice_output_muted = False  # Mute only voice output (TTS)
        self.root = root
        self.root.title("VeilDaemon — Glyphshell (Bound)")
        self.root.geometry("720x600")
        self.root.configure(bg='black')
        self.conversation = []
        # Core context (HRM + moderation + memory). Default to VEIL_MODE
        self.core = None
        try:
            self.core = bootstrap_core(veil_mode=VEIL_MODE)
        except Exception as e:
            print(f"[Core bootstrap failed] {e}")

        self.glyph_box = tk.Text(root, height=8, font=(
            "Consolas", 11), bg="#111", fg="cyan", state='disabled')
        self.glyph_box.pack(fill=tk.X, padx=10, pady=5)

        self.wick_label = tk.Label(root, text="", font=(
            "Consolas", 12), fg="orange", bg="black")
        self.wick_label.pack()

        self.chat_log = scrolledtext.ScrolledText(root, wrap=tk.WORD, font=("Consolas", 13),
                                                  bg="#1a1a1a", fg="#6be8fa", insertbackground="lime",
                                                  state='disabled', height=18)
        self.chat_log.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.entry_var = tk.StringVar()
        self.entry_box = tk.Entry(root, font=("Consolas", 13), textvariable=self.entry_var,
                                  bg="#222", fg="white", insertbackground="lime")
        self.entry_box.pack(fill=tk.X, padx=10, pady=(0, 5))
        self.entry_box.bind("<Return>", self.send_message)

        self.send_btn = tk.Button(root, text="Send", font=("Consolas", 12), bg="#444", fg="white",
                                  command=self.send_message)
        self.send_btn.pack(pady=(0, 10))

        self.shhh_btn = tk.Button(root, text="🔇 Shhh", font=(
            "Consolas", 12), bg="#222", fg="red", command=self.shhh)
        self.shhh_btn.pack(pady=(0, 10))

        self.sync_btn = tk.Button(root, text="🔄 Sync Wicks (Fit)", font=(
            "Consolas", 12), bg="#222", fg="lime", command=self.sync_wicks)
        self.sync_btn.pack(pady=(0, 10))

        # 📝 New Journal button
        self.journal_btn = tk.Button(root, text="📝 Journal", font=(
            "Consolas", 12), bg="#222", fg="violet", command=self.start_journal)
        self.journal_btn.pack(pady=(0, 10))

        self.review_btn = tk.Button(root, text="📖 Review", font=(
            "Consolas", 12), bg="#222", fg="aqua", command=self.open_review_tab)
        self.review_btn.pack(pady=(0, 10))
        self.review_frame = None

        self.mood_frame = None  # for mood picker GUI

        self.refresh_glyphs()
        self.update_wick()
        self.insert_chat("wednesday", "🜏 Wednesday is online. Type below.")
        log_event("wednesday", "Daemon awakened.")

        # Start the auto-sync loop
        self.start_auto_fit_sync()

    def sync_wicks(self):
        try:
            sync_wicks_with_fit()
            w = get_wicks()
            self.wick_label.config(text=f"🕯️ Wick Level: {w}/16")
            self.insert_chat(
                "wednesday", f"🔄 Synced wicks with Google Fit. Current wicks: {w}/16")
        except Exception as e:
            self.insert_chat("wednesday", f"[Fit Sync Error] {e}")

    def start_auto_fit_sync(self):
        def auto_sync_loop():
            while True:
                try:
                    sync_wicks_with_fit()
                    self.root.after(0, lambda: self.wick_label.config(
                        text=f"🕯️ Wick Level: {get_wicks()}/16"))
                except Exception:
                    pass
                time.sleep(15 * 60)  # 15 minutes
        threading.Thread(target=auto_sync_loop, daemon=True).start()

    def insert_chat(self, role, message, feedback_id=None):
        self.chat_log.configure(state='normal')
        tag = "user" if role == "user" else "wednesday"
        prefix = "You: " if role == "user" else "Wednesday: "
        self.chat_log.insert(tk.END, prefix + message + "\n", tag)
        # Add feedback buttons for daemon replies
        if role == "wednesday" and feedback_id:
            btn_frame = tk.Frame(self.chat_log, bg="#222")
            btn_frame.pack()
            def mark_feedback(val):
                self.log_feedback(feedback_id, val)
                self.chat_log.insert(tk.END, f"[Feedback: {'👍' if val=='good' else '👎'}]\n", tag)
                self.chat_log.see(tk.END)
            tk.Button(btn_frame, text="👍", command=lambda: mark_feedback("good"), bg="#222", fg="lime", font=("Consolas", 10), width=2).pack(side=tk.LEFT)
            tk.Button(btn_frame, text="👎", command=lambda: mark_feedback("bad"), bg="#222", fg="red", font=("Consolas", 10), width=2).pack(side=tk.LEFT)
        self.chat_log.configure(state='disabled')
        self.chat_log.see(tk.END)
        log_event(role, message)
        # 🕯️ Log every chat to SQLite + Obsidian!
        speaker = "user" if role == "user" else "wednesday"
        log_chat_message(speaker, message)
        append_chat_to_obsidian(speaker, message)

    def log_feedback(self, feedback_id, value):
        try:
            from pathlib import Path
            import json
            shadow_path = Path("hrm_shadow_log.json")
            logs = []
            if shadow_path.exists():
                try:
                    logs = json.loads(shadow_path.read_text(encoding="utf-8", errors="ignore"))
                except Exception:
                    logs = []
            for entry in logs:
                if entry.get("time") == feedback_id:
                    entry["feedback"] = value
            shadow_path.write_text(json.dumps(logs, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"[Feedback Log Error] {e}")

    def refresh_glyphs(self):
        result = analyze_glyphs(10)
        self.glyph_box.configure(state='normal')
        self.glyph_box.delete(1.0, tk.END)
        if result["status"] == "ok":
            for g, m, t in result["timeline"]:
                g_name = GLYPH_NAMES.get(g, g)
                mod_symbol = MOD_SYMBOLS.get(m, "") if m else ""
                self.glyph_box.insert(
                    tk.END, f"{g_name} {mod_symbol} — {t[-8:-3]}\n")
        self.glyph_box.configure(state='disabled')

    def update_wick(self):
        w = get_wicks()
        self.wick_label.config(text=f"🕯️ Wick Level: {w}/16")

    def generate_reply(self, text: str) -> str:
        # HRM-first via CoreContext when available
        hrm_reply = None
        hrm_origin = None
        llm_reply = None
        llm_origin = None
        # --- HRM reply ---
        if self.core:
            try:
                result = self.core.evaluate(text)
                if not result.get("allowed", True):
                    hrm_reply = "I can't go there. Pick something else."
                    hrm_origin = "core.blocked"
                else:
                    vls = result.get("voice_lines") or []
                    if isinstance(vls, list) and vls:
                        hrm_reply = str(vls[0])
                        hrm_origin = "core.voice_lines"
                    else:
                        acts = result.get("actions") or []
                        try:
                            for a in acts:
                                if getattr(a, 'kind', None) == 'voice_prompt':
                                    hrm_reply = str(getattr(a, 'value', ''))
                                    if hrm_reply:
                                        hrm_origin = "core.actions"
                                        break
                        except Exception:
                            pass
                        if not hrm_reply:
                            hrm_reply = result.get("reply") or result.get("sanitized_text")
                            if hrm_reply:
                                hrm_origin = "core.reply"
            except Exception as e:
                print(f"[Core evaluate failed] {e}")
        # --- LLM reply ---
        if VEIL_MODE != "offline" and openai.api_key:
            try:
                llm_reply = get_openai_response(text, self.conversation)
                llm_origin = "openai"
            except Exception as e:
                llm_reply = f"[Model error: {e}]"
                llm_origin = "openai.error"
        # --- Pick reply to use ---
        reply_text = hrm_reply if hrm_reply else (llm_reply if llm_reply else "Still listening.")
        origin = hrm_origin if hrm_reply else (llm_origin if llm_reply else "offline")
        print(f"[Reply Debug] origin={origin} raw='{reply_text}'")
        # Final sanitize
        sanitized = self._sanitize_reply(reply_text or "")
        if VEIL_MODE == "offline" and sanitized.lower().strip().rstrip('.!?') in {"q", "que", "queue"}:
            sanitized = "Still listening."
        if sanitized != (reply_text or ""):
            try:
                print(f"[Sanitize] origin={origin} before='{reply_text}' after='{sanitized}'")
            except Exception:
                pass
        # --- Shadow log ---
        try:
            entry = {
                "time": datetime.now().isoformat(),
                "input": text,
                "hrm_reply": hrm_reply,
                "hrm_origin": hrm_origin,
                "llm_reply": llm_reply,
                "llm_origin": llm_origin,
                "final_reply": sanitized,
                "final_origin": origin
            }
            shadow_path = Path("hrm_shadow_log.json")
            logs = []
            if shadow_path.exists():
                try:
                    logs = json.loads(shadow_path.read_text(encoding="utf-8", errors="ignore"))
                except Exception:
                    logs = []
            logs.append(entry)
            shadow_path.write_text(json.dumps(logs, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"[HRM Shadow Log Error] {e}")
        return sanitized

    def send_message(self, event=None):
        text = self.entry_var.get().strip()
        if not text:
            return
        self.entry_var.set("")
        self.insert_chat("user", text)
        self.conversation.append({"role": "user", "message": text})
        self.update_wick()

        # 🜏 Check for glyphs in the message
        glyphs = analyze_glyphs(10)
        if glyphs["status"] == "ok":
            self.refresh_glyphs()

        # 🜏 Get response (HRM-first, online fallback)
        response = self.generate_reply(text)
        # Feedback id is the timestamp of the last shadow log entry
        import json
        from pathlib import Path
        feedback_id = None
        try:
            shadow_path = Path("hrm_shadow_log.json")
            if shadow_path.exists():
                logs = json.loads(shadow_path.read_text(encoding="utf-8", errors="ignore"))
                if logs:
                    feedback_id = logs[-1].get("time")
        except Exception:
            pass
        # Keep conversation history for optional model context
        self.conversation.append({"role": "assistant", "message": response})
        self.insert_chat("wednesday", response, feedback_id=feedback_id)
        self.speak(response)

    def shhh(self):
        self.voice_output_muted = not self.voice_output_muted
        global current_playback
        if self.voice_output_muted and current_playback:
            current_playback.stop()
            current_playback = None
        self.insert_chat(
            "wednesday", "🔇 Daemon voice muted." if self.voice_output_muted else "🔊 Daemon voice unmuted.")
        log_glyph(encode_glyph("🔇"))

    def speak(self, text):
        if self.voice_output_muted:
            return

        def _run():
            # Lazy import fallback in case top-level failed
            say_fn = daemon_say
            if say_fn is None:
                try:
                    from daemon_tts import say as say_fn2  # type: ignore
                    say_fn = say_fn2
                except Exception as e:
                    print(f"[TTS] daemon_tts not available: {e}")
                    return
            try:
                say_fn(text)
            except Exception as e:
                print(f"[TTS error] {e}")

        threading.Thread(target=_run, daemon=True).start()

    # --- Helpers ---
    def _sanitize_reply(self, s: str) -> str:
        """Clean up common artifacts: remove any 'queue', 'que', 'q' tokens, dangling quotes/backticks, excess spaces."""
        try:
            import re
            t = (s or "").strip()
            if not t:
                return t
            # Remove unmatched trailing quotes/backticks if no opening pair
            if t.endswith(("\"", "'", "`", "“", "”", "’")):
                # If count of quote-like chars is odd, drop the last
                qchars = ['"', "'", "`", "“", "”", "’"]
                for qc in qchars:
                    if t.endswith(qc) and (t.count(qc) % 2 == 1):
                        t = t[:-1].rstrip()
                        break
            # Remove any standalone 'queue', 'que', 'q' tokens (case-insensitive)
            t = re.sub(r"\b(que|queue|q)\b", "", t, flags=re.IGNORECASE)
            # Collapse whitespace
            t = re.sub(r"\s+", " ", t).strip()
            return t
        except Exception:
            return s

    # =====================
    # JOURNALING LOGIC
    # =====================
    def start_journal(self):
        self.journal_prompt = self.get_journal_prompt()
        self.journal_mood = None
        self.journal_tags = ""
        self.insert_chat(
            "wednesday", f"📝 Journal prompt: {self.journal_prompt}\n(Type your reply below.)")
        self.entry_box.bind("<Return>", self.capture_journal_entry)

    def capture_journal_entry(self, event=None):
        text = self.entry_var.get().strip()
        if not text:
            return
        self.entry_var.set("")
        self.insert_chat("user", text)
        self.journal_entry = text
        self.show_mood_picker()

    def show_mood_picker(self):
        # Destroy any previous mood frame
        if hasattr(self, 'mood_frame') and self.mood_frame:
            self.mood_frame.destroy()
        self.mood_frame = tk.Frame(self.root, bg="black")
        self.mood_frame.pack(pady=(0, 10))
        tk.Label(self.mood_frame, text="Pick your mood:", bg="black",
                 fg="white", font=("Consolas", 11)).pack()
        moods = [("😌", "calm"), ("🙂", "good"), ("😔", "sad"), ("😠",
                                                              "angry"), ("😱", "anxious"), ("🫥", "blank"), ("✨", "hopeful")]
        for emoji, mood in moods:
            tk.Button(self.mood_frame, text=emoji, font=("Consolas", 18), width=3,
                      command=lambda m=mood: self.finish_journal_entry(m)).pack(side=tk.LEFT, padx=2)
        tag_label = tk.Label(self.mood_frame, text="Tags (comma-separated):",
                             bg="black", fg="white", font=("Consolas", 10))
        tag_label.pack(side=tk.LEFT, padx=(10, 2))
        self.tag_var = tk.StringVar()
        tag_entry = tk.Entry(
            self.mood_frame, textvariable=self.tag_var, font=("Consolas", 10), width=15)
        tag_entry.pack(side=tk.LEFT)
        tag_entry.focus_set()

    def finish_journal_entry(self, mood):
        tags = self.tag_var.get() if hasattr(self, "tag_var") else ""
        text = self.journal_entry
        log_journal_entry(text, mood, tags)
        append_journal_to_obsidian(text, mood, tags)
        self.insert_chat(
            "wednesday", f"📝 Journal saved. Mood: {mood}, Tags: {tags}")
        if hasattr(self, 'mood_frame') and self.mood_frame:
            self.mood_frame.destroy()
        self.entry_box.bind("<Return>", self.send_message)

    def get_journal_prompt(self):
        prompts = [
            "How was your day—what lingers?",
            "What drained or restored your wicks today?",
            "One feeling you want to name right now?",
            "Who or what gave you a spark?",
            "What did you survive today?",
            "What felt like static or resonance?"
        ]
        import random
        return random.choice(prompts)
    # ==========================
    # REVIEW TAB LOGIC
    # ==========================

    def open_review_tab(self):
        # Destroy any previous review frame
        if hasattr(self, 'review_frame') and self.review_frame:
            self.review_frame.destroy()
        self.review_frame = tk.Frame(self.root, bg="#191919")
        self.review_frame.place(relx=0, rely=0, relwidth=1, relheight=1)
        # --- Date navigation ---
        import datetime
        today = datetime.date.today()
        self.review_date = tk.StringVar(value=today.strftime("%Y-%m-%d"))
        tk.Button(self.review_frame, text="<", command=self.prev_review_day, width=2, font=(
            "Consolas", 12)).pack(side=tk.LEFT, padx=(10, 0), pady=8)
        tk.Label(self.review_frame, textvariable=self.review_date, font=(
            "Consolas", 14), fg="aqua", bg="#191919").pack(side=tk.LEFT, pady=8)
        tk.Button(self.review_frame, text=">", command=self.next_review_day,
                  width=2, font=("Consolas", 12)).pack(side=tk.LEFT, pady=8)
        tk.Button(self.review_frame, text="Close", command=self.close_review_tab, font=(
            "Consolas", 10), bg="#333").pack(side=tk.RIGHT, padx=10)
        tk.Button(self.review_frame, text="📈 Mood Graph", command=self.show_mood_graph, font=(
            "Consolas", 10), bg="#333", fg="lime").pack(side=tk.RIGHT, padx=8)
        # --- Mood filter ---
        self.mood_filter = tk.StringVar(value="")
        mood_bar = tk.Frame(self.review_frame, bg="#191919")
        mood_bar.pack(fill=tk.X, pady=4)
        for emoji, mood in [("😌", "calm"), ("🙂", "good"), ("😔", "sad"), ("😠", "angry"), ("😱", "anxious"), ("🫥", "blank"), ("✨", "hopeful")]:
            tk.Button(mood_bar, text=emoji, width=3, font=("Consolas", 18),
                      command=lambda m=mood: self.set_review_mood(m)).pack(side=tk.LEFT, padx=2)
        tk.Button(mood_bar, text="All", command=lambda: self.set_review_mood(
            ""), bg="#333", fg="aqua").pack(side=tk.LEFT, padx=8)
        # --- Search box ---
        search_frame = tk.Frame(self.review_frame, bg="#191919")
        search_frame.pack(fill=tk.X, pady=4)
        tk.Label(search_frame, text="Search:", font=("Consolas", 10),
                 bg="#191919", fg="#aaa").pack(side=tk.LEFT, padx=(4, 2))
        self.review_search = tk.StringVar()
        tk.Entry(search_frame, textvariable=self.review_search,
                 font=("Consolas", 11), width=18).pack(side=tk.LEFT)
        tk.Button(search_frame, text="Go", command=self.update_review_entries,
                  bg="#444").pack(side=tk.LEFT, padx=3)
        # --- Listbox for entries ---
        self.review_listbox = tk.Listbox(self.review_frame, font=(
            "Consolas", 12), bg="#101010", fg="#e5f2ff", width=80, height=16)
        self.review_listbox.pack(padx=10, pady=8, fill=tk.BOTH, expand=True)
        self.update_review_entries()

    def close_review_tab(self):
        if hasattr(self, 'review_frame') and self.review_frame:
            self.review_frame.destroy()

    def set_review_mood(self, mood):
        self.mood_filter.set(mood)
        self.update_review_entries()

    def prev_review_day(self):
        import datetime
        dt = datetime.datetime.strptime(
            self.review_date.get(), "%Y-%m-%d").date()
        dt -= datetime.timedelta(days=1)
        self.review_date.set(dt.strftime("%Y-%m-%d"))
        self.update_review_entries()

    def next_review_day(self):
        import datetime
        dt = datetime.datetime.strptime(
            self.review_date.get(), "%Y-%m-%d").date()
        dt += datetime.timedelta(days=1)
        self.review_date.set(dt.strftime("%Y-%m-%d"))
        self.update_review_entries()

    def update_review_entries(self):
        date = self.review_date.get()
        mood = self.mood_filter.get() or None
        search = self.review_search.get() or None
        results = get_journal_entries(date=date, mood=mood, search=search)
        self.review_listbox.delete(0, tk.END)
        import datetime as dt
        for ts, entry, mood, tags in results:
            t = dt.datetime.fromtimestamp(ts).strftime("%H:%M")
            emoji = {"calm": "😌", "good": "🙂", "sad": "😔", "angry": "😠",
                     "anxious": "😱", "blank": "🫥", "hopeful": "✨"}.get(mood, "")
            line = f"{emoji} {t} — {entry} [tags: {tags}]"
            self.review_listbox.insert(tk.END, line)

    def show_mood_graph(self):
        if not _HAS_MPL:
            messagebox.showinfo("Mood Graph", "Matplotlib not installed. Graphs are disabled.")
            return
        # Close any old graph
        if hasattr(self, 'graph_window') and self.graph_window:
            try:
                self.graph_window.destroy()
            except Exception:
                pass
        self.graph_window = tk.Toplevel(self.root)
        self.graph_window.title("Mood Graph — Last 30 Days")
        self.graph_window.geometry("500x320")
        dates, moods = get_mood_history(30)
        if not dates:
            tk.Label(self.graph_window, text="No mood data for last 30 days.", font=(
                "Consolas", 12)).pack(padx=8, pady=8)
            return
        # Local imports to avoid module-level dependency
        from matplotlib.figure import Figure  # type: ignore
        from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg  # type: ignore
        fig = Figure(figsize=(6, 2.7), dpi=100)
        ax = fig.add_subplot(111)
        ax.plot(dates, moods, marker="o", linewidth=2)
        ax.set_title("Mood Over Time")
        ax.set_ylabel("Mood")
        ax.set_xlabel("Date")
        ax.set_yticks([-2, -1, 0, 1, 2])
        ax.set_yticklabels(["😠/😱", "😔", "🫥", "✨/🙂/😌", ""]) 
        fig.autofmt_xdate()
        canvas = FigureCanvasTkAgg(fig, master=self.graph_window)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

# --- end of your class GlyphDaemonShell ---


def vosk_listen_loop(app):
    try:
        import vosk  # type: ignore
        import pyaudio  # type: ignore
        import json
        import time
    except Exception:
        return
    model = vosk.Model("model")
    pa = pyaudio.PyAudio()
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=48000,
        input=True,
        frames_per_buffer=1024
        # No input_device_index: uses default!
    )
    stream.start_stream()
    rec = vosk.KaldiRecognizer(model, 48000)
    print("🜏 Daemon ear listening…")
    wake_phrases = ["hey virelle", "queue listen"]
    exit_phrases = ["done", "stop listening", "cancel"]
    mute_phrases = ["shhh", "mute"]
    unmute_phrases = ["unmute"]
    last_active = 0
    listening_mode = False
    last_text = ""
    while True:
        data = stream.read(1024, exception_on_overflow=False)
        partial = json.loads(rec.PartialResult())
        partial_text = partial.get("partial", "").lower().strip()
        now = time.time()

        # --- Mute/Unmute Commands ---
        if any(mute in partial_text for mute in mute_phrases):
            app.shhh()
        if any(unmute in partial_text for unmute in unmute_phrases):
            app.shhh()

        # --- Wake Phrase ---
        if not listening_mode and any(wake in partial_text for wake in wake_phrases):
            listening_mode = True
            last_active = now
            app.insert_chat("wednesday", "👂 Listening… (voice mode enabled)")
            print("Listening mode ON")
            last_text = ""
            continue

        # --- Voice Mode Active ---
        if listening_mode:
            # Detect stop/listen-off command
            if any(exit in partial_text for exit in exit_phrases):
                listening_mode = False
                app.insert_chat(
                    "wednesday", "🔇 Stopped listening (voice mode off)")
                print("Listening mode OFF")
                last_text = ""
                continue
            # Only respond to new/changed speech, not repeated "partial" results
            if partial_text and partial_text != last_text:
                last_text = partial_text
                last_active = now
                print(f"[Voice Input] {partial_text}")
                # Respond to anything that's not an exit command
                app.insert_chat("user", partial_text)
                try:
                    response = app.generate_reply(partial_text)
                except Exception as e:
                    response = f"[Error: {e}]"
                app.insert_chat("wednesday", response)
                app.speak(response)
            # Timeout after 30 seconds
            if now - last_active > 30:
                listening_mode = False
                app.insert_chat(
                    "wednesday", "🔇 Listening timed out (voice mode off)")
                print("Listening mode OFF (timeout)")
                last_text = ""
                continue


if __name__ == "__main__":

    print("🜏 Bound Glyphshell initializing...")
    root = tk.Tk()
    app = GlyphDaemonShell(root)
    if '_HAS_VOICE' in globals() and _HAS_VOICE:
        vosk_thread = threading.Thread(
            target=vosk_listen_loop, args=(app,), daemon=True)
        vosk_thread.start()
    else:
        print("(Voice input disabled: vosk/pyaudio not installed)")
    root.mainloop()
