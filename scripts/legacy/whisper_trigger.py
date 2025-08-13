"""
🜏 VeilDaemon – whisper_trigger.py (Vosk Version)
Live mic input to detect distress triggers using offline STT.
"""

import queue
import sounddevice as sd
import json
from vosk import Model, KaldiRecognizer

# Constants
TRIGGER_MAP = {
    "i'm fine": ("🩸", None),
    "please stop": ("🛡️", "⬛"),
    "i'm tired": ("🧃", None),
    "go away": ("🧩", "⁻"),
    "nothing": ("🔇", None)
}


def listen_for_triggers():
    try:
        # Path to your Vosk model folder
        model = Model("vosk-model-small-en-us-0.15")
    except Exception as e:
        print("🛑 Vosk model not found or failed to load.")
        return None

    q = queue.Queue()

    def callback(indata, frames, time, status):
        if status:
            print(status)
        q.put(bytes(indata))

    with sd.RawInputStream(samplerate=16000, blocksize=8000, dtype='int16',
                           channels=1, callback=callback):
        print("🎧 Listening...")
        rec = KaldiRecognizer(model, 16000)
        while True:
            data = q.get()
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                text = result.get("text", "").lower().strip()
                if text:
                    print(f"[whisper] heard: {text}")
                    for phrase in TRIGGER_MAP:
                        if phrase in text:
                            return TRIGGER_MAP[phrase]
