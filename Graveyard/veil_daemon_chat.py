# veil_daemon_glyphshell_voicecontrol.py
"""
🜏 VeilDaemon Glyphshell
With true interruptible voice playback using pydub + simpleaudio.
"""

import tkinter as tk
import tkinter.scrolledtext as scrolledtext
import threading
import json
from datetime import datetime
from pathlib import Path
import requests
import asyncio
from edge_tts import Communicate
from pydub import AudioSegment
from pydub.playback import _play_with_simpleaudio
import io

from wick_tracker import wick_status
from glyph_logic import analyze_glyphs
from glyph_engine import encode_glyph, log_glyph

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

MOD_NAMES = {
    "MOD_LOOP": "Loop",
    "MOD_NEGATE": "Negate",
    "MOD_FLARE": "Flare",
    "MOD_AMPLIFY": "Amplify",
    "MOD_SHADOW": "Shadow"
}

MOD_SYMBOLS = {
    "Loop": "🔁",
    "Negate": "⬛",
    "Flare": "🔥",
    "Amplify": "📣",
    "Shadow": "🌑"
}

# === CONFIGURATION ===
MODEL = "mistral-7b-custom"
OLLAMA_URL = "http://localhost:11434/v1/chat/completions"
CHARACTER_FILE = "Wednesday.txt"
LOG_FILE = "daemon_chat_log.json"
TTS_VOICE = "en-US-JennyNeural"
TTS_RATE = "+0%"

# === GLOBALS ===
is_muted = False
current_playback = None


def speak(text):
    global current_playback
    if is_muted:
        return

    async def stream():
        global current_playback
        communicate = Communicate(text=text, voice=TTS_VOICE, rate=TTS_RATE)
        audio_bytes = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_bytes += chunk["data"]
        if audio_bytes:
            audio = AudioSegment.from_file(
                io.BytesIO(audio_bytes), format="mp3")
            current_playback = _play_with_simpleaudio(audio)

    def thread():
        try:
            asyncio.run(stream())
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(stream())

    threading.Thread(target=thread).start()


def load_persona():
    try:
        with open(CHARACTER_FILE, "r", encoding="utf-8") as f:
            return f.read()
    except:
        return ""


def get_local_ai_response(prompt, history):
    messages = []
    system_prompt = load_persona()
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    for entry in history[-8:]:
        messages.append({"role": entry["role"], "content": entry["message"]})
    messages.append({"role": "user", "content": prompt})
    try:
        response = requests.post(
            OLLAMA_URL, json={"model": MODEL, "messages": messages, "stream": False})
        result = response.json()
        return result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"Error talking to daemon: {e}"


def log_event(role, message):
    entry = {"time": datetime.now().isoformat(), "role": role,
             "message": message}
    logs = []
    if Path(LOG_FILE).exists():
        logs = json.loads(Path(LOG_FILE).read_text())
    logs.append(entry)
    Path(LOG_FILE).write_text(json.dumps(logs, indent=2))


class GlyphDaemonShell:
    def __init__(self, root):
        self.root = root
        self.root.title("VeilDaemon — Glyphshell [Wednesday]")
        self.root.geometry("720x600")
        self.root.configure(bg='black')

        self.conversation = []

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

        self.refresh_glyphs()
        self.update_wick()

        self.insert_chat(
            "wednesday", "🜏 Wednesday is online. Type your message below.")
        log_event("wednesday", "Daemon awakened.")

    def insert_chat(self, role, message):
        self.chat_log.configure(state='normal')
        tag = "user" if role == "user" else "wednesday"
        prefix = "You: " if role == "user" else "Wednesday: "
        self.chat_log.insert(tk.END, prefix + message + "\n", tag)
        self.chat_log.configure(state='disabled')
        self.chat_log.see(tk.END)
        log_event(role, message)

    def refresh_glyphs(self):
        result = analyze_glyphs(10)
        self.glyph_box.configure(state='normal')
        self.glyph_box.delete(1.0, tk.END)
        if result["status"] == "ok":
            for g, m, t in result["timeline"]:
                g_name = GLYPH_NAMES.get(g, g)
                m_name = MOD_NAMES.get(m, "") if m else ""
                mod_symbol = MOD_SYMBOLS.get(m_name, "")
                line = f"{g_name} {mod_symbol} — {t[-8:-3]}"
                self.glyph_box.insert(tk.END, line + "\n")
        self.glyph_box.configure(state='disabled')

    def update_wick(self):
        w = wick_status()
        self.wick_label.config(text=f"🕯️ Wick Level: {w}/16")

    def send_message(self, event=None):
        user_input = self.entry_var.get().strip()
        if not user_input:
            return
        self.insert_chat("user", user_input)
        self.conversation.append({"role": "user", "message": user_input})
        self.entry_var.set("")
        threading.Thread(target=self.get_response, args=(user_input,)).start()

    def get_response(self, prompt):
        self.root.after(0, lambda: self.insert_chat("wednesday", "…"))
        response = get_local_ai_response(prompt, self.conversation)
        self.root.after(0, lambda: self.insert_chat("wednesday", response))
        self.conversation.append({"role": "assistant", "message": response})
        speak(response)
        self.refresh_glyphs()
        self.update_wick()

    def shhh(self):
        global is_muted, current_playback
        is_muted = not is_muted
        if current_playback:
            current_playback.stop()
            current_playback = None
        state = "muted" if is_muted else "unmuted"
        self.insert_chat("wednesday", f"🔇 Daemon {state}.")
        log_glyph(encode_glyph("🔇"))


if __name__ == "__main__":
    print("🜏 Glyphshell initializing...")
    root = tk.Tk()
    app = GlyphDaemonShell(root)
    root.mainloop()
