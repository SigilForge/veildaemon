import json
from pathlib import Path

CHAT_PATH = Path("twitch_multi_chat_log.json")
MERGED_CHAT_CAPTIONS = Path("merged_chat_captions.json")
SHADOW_PATH = Path("hrm_shadow_log.json")


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def main():
    # Prefer merged chat+captions if present
    source = MERGED_CHAT_CAPTIONS if MERGED_CHAT_CAPTIONS.exists() else CHAT_PATH
    chat = load_json(source, [])
    shadow = load_json(SHADOW_PATH, [])

    # Build a small seen set to avoid duplicates when re-running
    seen = set()
    for e in shadow:
        tid = e.get("twitch_id")
        if tid:
            seen.add(tid)

    added = 0
    for e in chat:
        # Expect {time, channel, user, message}
        time = e.get("time")
        channel = e.get("channel")
        user = e.get("user")
        msg = e.get("message")
        if not msg:
            continue
        tid = f"{time}|{channel}|{user}|{msg}"
        if tid in seen:
            continue
        inp = msg
        cap_ctx = e.get("caption_context") or e.get("caption")
        if cap_ctx:
            inp = f"[streamer] {cap_ctx}\n[chat] {msg}"
        shadow.append(
            {
                "twitch_id": tid,
                "input": inp,
                "hrm": "",
                "llm": "",
                "final": "",
                "feedback": "",
                "meta": {"twitch": e},
            }
        )
        seen.add(tid)
        added += 1

    SHADOW_PATH.write_text(json.dumps(shadow, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Added {added} new entries to {SHADOW_PATH}")


if __name__ == "__main__":
    main()
