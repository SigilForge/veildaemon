"""
🜏 VeilDaemon – daemon_shell.py (Integrated Shell)
Menu-driven CLI for speaking to the daemon and analyzing glyph logs.
"""

from daemon_tts import say
from daemon_brain import ask_daemon
from glyph_engine import encode_glyph, log_glyph


def send_whisper():
    import sounddevice as sd
    from vosk import Model, KaldiRecognizer
    import queue
    import json

    q = queue.Queue()
    model = Model("vosk-model-small-en-us-0.15")
    recognizer = KaldiRecognizer(model, 16000)

    def callback(indata, frames, time, status):
        if status:
            print(status)
        q.put(bytes(indata))

    print("🎙️ Daemon is listening... (press Ctrl+C to stop)")
    with sd.RawInputStream(samplerate=16000, blocksize=8000, dtype="int16",
                           channels=1, callback=callback):
        try:
            while True:
                data = q.get()
                if recognizer.AcceptWaveform(data):
                    result = json.loads(recognizer.Result())
                    text = result.get("text", "")
                    if text:
                        print(f"[you] {text}")
                        try:
                            response = ask_daemon("whisper", text)
                            say(response)
                            print(f"[daemon] {response}")
                            log_glyph(encode_glyph("🕯️", "⁻"))  # Default log
                        except Exception as e:
                            print(f"❌ Daemon failed to respond: {e}")
                        break
        except KeyboardInterrupt:
            print("\n🛑 Stopped listening.")


def tell_story():
    prompt = "Tell me a story about a forgotten dream."
    try:
        response = ask_daemon("story", prompt)
        say(response)
        print(f"[daemon 📖] {response}")
        log_glyph(encode_glyph("🌙", "✨"))
    except Exception as e:
        print(f"❌ Story failed: {e}")


def send_direct():
    user_input = input("\n🗣️ Type your message to the daemon: ")
    try:
        response = ask_daemon("whisper", user_input)
        say(response)
        print(f"[daemon] {response}")
        log_glyph(encode_glyph("💬"))
    except Exception as e:
        print(f"❌ Direct send failed: {e}")


def analyze_glyph_log():
    try:
        from glyph_logic import print_analysis
        print_analysis(10)
    except Exception as e:
        print(f"❌ Analysis failed: {e}")


def main_menu():
    print("\n🜏 VeilDaemon Shell – Choose a function:")
    print("1. Whisper to Daemon (voice)")
    print("2. Tell me a story")
    print("3. Send a message")
    print("4. Analyze glyph log")
    print("5. Exit")

    choice = input("➤ ")

    if choice == "1":
        send_whisper()
    elif choice == "2":
        tell_story()
    elif choice == "3":
        send_direct()
    elif choice == "4":
        analyze_glyph_log()
    elif choice == "5":
        print("🫧 Closing shell...")
        exit()
    else:
        print("❓ Invalid option.")


if __name__ == "__main__":
    while True:
        main_menu()
