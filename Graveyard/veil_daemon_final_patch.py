
import tkinter as tk
import tkinter.scrolledtext as scrolledtext
import threading
import json
from datetime import datetime
from pathlib import Path
import requests
import asyncio
from edge_tts import Communicate
from wick_tracker import wick_status
from glyph_logic import analyze_glyphs
from glyph_engine import encode_glyph, log_glyph
from pydub import AudioSegment
from pydub.playback import _play_with_simpleaudio
import io

MODEL = "mistral-7b-custom"
OLLAMA_URL = "http://localhost:11434/v1/chat/completions"
LOG_FILE = "daemon_chat_log.json"
PERSONA_FILE = "current_persona.txt"
TTS_VOICE = "en-US-JennyNeural"

is_muted = False
current_playback = None


def speak(text):
    global current_playback
    if is_muted:
        return

    async def stream():
        global current_playback
        communicate = Communicate(text=text, voice=TTS_VOICE)
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


def stop_speaking():
    global current_playback
    if current_playback:
        current_playback.stop()
        current_playback = None


def load_persona():
    try:
        return Path(PERSONA_FILE).read_text(encoding="utf-8")
    except:
        return ""


def get_local_ai_response(prompt, history):
    strict_system_prompt = Path("current_persona.txt").read_text(
        encoding="utf-8").strip()

    strict_system_prompt += "\nYou are NOT helpful, chatty, verbose, or explanatory. "                             "Never reply as an assistant. Never use full names. "                             "Your answers must be brief, sarcastic, mythpunk, or emotionally distant."

    messages = [{"role": "system", "content": strict_system_prompt}]
    for entry in history[-4:]:
        messages.append({"role": entry["role"], "content": entry["message"]})
    messages.append({"role": "user", "content": prompt})

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": 0.4,
                    "max_tokens": 60
                }
            }
        )
        result = response.json()
        return result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"[Daemon Glitch] {e}"

    system_prompt = Path("current_persona.txt").read_text(
        encoding="utf-8").strip()

    messages = [{"role": "system", "content": system_prompt}]
    for entry in history[-6:]:
        messages.append({"role": entry["role"], "content": entry["message"]})
    messages.append({"role": "user", "content": prompt})

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": 0.5, "max_tokens": 100}
            }
        )
        result = response.json()
        return result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"[Daemon Glitch] {e}"


def log_event(role, message):
    entry = {"time": datetime.now().isoformat(), "role": role,
             "message": message}
    logs = []
    if Path(LOG_FILE).exists():
        logs = json.loads(Path(LOG_FILE).read_text())
    logs.append(entry)
    Path(LOG_FILE).write_text(json.dumps(logs, indent=2))


class DaemonShell:
    def __init__(self, root):
        self.root = root
        self.root.title("🜏 VeilDaemon Persona Shell")
        self.root.geometry("720x600")
        self.root.configure(bg="black")

        self.conversation = []

        self.chat_log = scrolledtext.ScrolledText(root, wrap=tk.WORD, font=("Consolas", 13),
                                                  bg="#1a1a1a", fg="#6be8fa", insertbackground="lime",
                                                  state='disabled', height=20)
        self.chat_log.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.entry_var = tk.StringVar()
        self.entry_box = tk.Entry(root, font=("Consolas", 13), textvariable=self.entry_var,
                                  bg="#222", fg="white", insertbackground="lime")
        self.entry_box.pack(fill=tk.X, padx=10, pady=5)
        self.entry_box.bind("<Return>", self.send_message)

        btn_frame = tk.Frame(root, bg="black")
        btn_frame.pack(pady=5)
        tk.Button(btn_frame, text="Send", font=("Consolas", 12), bg="#444", fg="white",
                  command=self.send_message).pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="Shhh", font=("Consolas", 12), bg="#800", fg="white",
                  command=self.toggle_mute).pack(side=tk.LEFT, padx=5)

        self.status_label = tk.Label(root, text="", font=(
            "Consolas", 12), fg="orange", bg="black")
        self.status_label.pack()

        self.update_status()
        self.insert_chat(
            "daemon", "🜏 Daemon ready. Persona loaded from current_persona.txt.")

    def insert_chat(self, role, msg):
        self.chat_log.configure(state='normal')
        prefix = "You: " if role == "user" else "Daemon: "
        self.chat_log.insert(tk.END, prefix + msg + "\n")
        self.chat_log.configure(state='disabled')
        self.chat_log.see(tk.END)
        log_event(role, msg)

    def update_status(self):
        wick = wick_status()
        self.status_label.config(text=f"🕯️ Wick Level: {wick}/16")

    def send_message(self, event=None):
        user_input = self.entry_var.get().strip()
        if not user_input:
            return
        self.insert_chat("user", user_input)
        self.conversation.append({"role": "user", "message": user_input})
        self.entry_var.set("")
        threading.Thread(target=self.get_response, args=(user_input,)).start()

    def get_response(self, prompt):
        self.root.after(0, lambda: self.insert_chat("daemon", "…"))
        response = get_local_ai_response(prompt, self.conversation)
        self.root.after(0, lambda: self.insert_chat("daemon", response))
        self.conversation.append({"role": "assistant", "message": response})
        speak(response)
        log_glyph(encode_glyph("💬"))
        self.update_status()

    def toggle_mute(self):
        global is_muted
        is_muted = not is_muted
        stop_speaking()
        state = "Muted" if is_muted else "Unmuted"
        self.insert_chat("daemon", f"🔇 Daemon {state}.")


if __name__ == "__main__":
    print("🜏 Daemon shell launching...")
    root = tk.Tk()
    app = DaemonShell(root)
    root.mainloop()
