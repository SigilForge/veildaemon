"""
Merge Twitch chat log with optional per-channel captions for context windows.
- Reads twitch_multi_chat_log.json (array of messages).
- Reads twitch_captions/{channel}.jsonl if present.
- Writes merged_chat_captions.json with messages + nearest-in-time caption snippets (best-effort since chat has TMI timestamps).

This is for analysis/offline inspection or for future mining improvements.
"""

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime

CHAT_LOG = Path("twitch_multi_chat_log.json")
OUT_PATH = Path("merged_chat_captions.json")
CAP_DIR = Path("twitch_captions")


def parse_ts(ms: int | str | None) -> int | None:
    if ms is None:
        return None
    try:
        return int(ms)
    except Exception:
        return None


def load_captions_for_channel(channel: str) -> list[dict]:
    p = CAP_DIR / f"{channel.lstrip('#')}.jsonl"
    if not p.exists():
        return []
    cues: list[dict] = []
    with p.open(encoding="utf-8") as f:
        for line in f:
            try:
                obj = eval(line.strip())  # from our jsonl writer using __repr__
                if isinstance(obj, dict) and obj.get("text"):
                    cues.append(obj)
            except Exception:
                continue
    return cues


def main():
    if not CHAT_LOG.exists():
        print("no twitch_multi_chat_log.json found")
        return
    msgs = json.loads(CHAT_LOG.read_text(encoding="utf-8"))

    # Index captions per channel
    captions: dict[str, list[dict]] = {}
    for ch in sorted({m.get("channel") for m in msgs if m.get("channel")}):
        captions[ch] = load_captions_for_channel(ch)

    merged = []
    for m in msgs:
        ch = m.get("channel")
        ts = parse_ts(m.get("tmi-sent-ts"))
        entry = dict(m)
        if ch and ts and captions.get(ch):
            # naive nearest caption by insertion order; captions have no true ms ts
            # we just take the last N lines for rough context
            last_lines = [c.get("text") for c in captions[ch][-5:]]
            entry["caption_context"] = " | ".join([x for x in last_lines if x])
        merged.append(entry)

    OUT_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(merged)} entries to {OUT_PATH}")


if __name__ == "__main__":
    main()
