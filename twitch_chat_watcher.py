import socket
import time
import json
from pathlib import Path

# --- CONFIG ---
HOST = "irc.chat.twitch.tv"
PORT = 6667
NICK = "sigilforge"  # Your Twitch username
CHANNEL = "#sigilforge"  # Channel to watch (with #)
TOKEN = None  # Set your oauth token here or via secrets_store

try:
    from secrets_store import get_secret
    TOKEN = get_secret("twitch.token")
except Exception:
    pass
if not TOKEN:
    TOKEN = "oauth:YOUR_OAUTH_TOKEN_HERE"  # Replace with your token

LOG_PATH = Path("twitch_chat_log.json")

# --- IRC CONNECT ---
def connect():
    s = socket.socket()
    s.connect((HOST, PORT))
    s.send(f"PASS {TOKEN}\r\n".encode("utf-8"))
    s.send(f"NICK {NICK}\r\n".encode("utf-8"))
    s.send(f"JOIN {CHANNEL}\r\n".encode("utf-8"))
    return s

def watch_chat():
    s = connect()
    print(f"Connected to Twitch chat: {CHANNEL}")
    log = []
    try:
        while True:
            resp = s.recv(2048).decode("utf-8", errors="ignore")
            for line in resp.split("\r\n"):
                if line.startswith("PING"):
                    s.send("PONG :tmi.twitch.tv\r\n".encode("utf-8"))
                elif "PRIVMSG" in line:
                    parts = line.split("PRIVMSG", 1)
                    if len(parts) > 1:
                        user = line.split("!")[0][1:]
                        msg = parts[1].split(":", 1)[-1]
                        entry = {
                            "time": time.strftime("%Y-%m-%dT%H:%M:%S"),
                            "user": user,
                            "message": msg.strip()
                        }
                        print(f"[{entry['user']}] {entry['message']}")
                        log.append(entry)
                        if len(log) % 10 == 0:
                            LOG_PATH.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("Stopped.")
    finally:
        LOG_PATH.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
        s.close()

if __name__ == "__main__":
    watch_chat()
