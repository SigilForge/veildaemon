"""
Lightweight VTT watcher: fetches a WebVTT subtitle stream/URL for a given channel and saves segments.
- Works with Twitch if you can supply a URL for closed captions (e.g., via an extension or third-party restreamer).
- If the URL is a .vtt that updates over time, we poll and append new cues to a JSONL log per channel.

This is best-effort; Twitch doesn't expose captions uniformly. Provide URLs via --vtt-map in auto_train_loop.py.
"""

from __future__ import annotations

import argparse
import time
import urllib.request
from pathlib import Path


def fetch_text(url: str, timeout: float = 10.0) -> str | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return None


def parse_vtt(vtt_text: str) -> list[dict]:
    # Extremely simple parser: finds lines like "00:00:01.000 --> 00:00:03.000" and aggregates following text until blank
    cues = []
    lines = vtt_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if "-->" in line and ":" in line:
            start_end = line
            i += 1
            text_lines: list[str] = []
            while i < len(lines) and lines[i].strip():
                text_lines.append(lines[i].strip())
                i += 1
            cues.append({"timing": start_end, "text": " ".join(text_lines)})
        i += 1
    return cues


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--channel", required=True)
    ap.add_argument("--seconds", type=int, default=600)
    args = ap.parse_args()

    out = Path("twitch_captions")
    out.mkdir(exist_ok=True)
    log_path = out / f"{args.channel.lstrip('#')}.jsonl"

    seen = set()
    deadline = time.time() + args.seconds

    while time.time() < deadline:
        txt = fetch_text(args.url)
        if txt:
            cues = parse_vtt(txt)
            with log_path.open("a", encoding="utf-8") as f:
                for c in cues:
                    key = (c.get("timing"), c.get("text"))
                    if key in seen:
                        continue
                    seen.add(key)
                    f.write(
                        {
                            "channel": args.channel,
                            "timing": c.get("timing"),
                            "text": c.get("text", ""),
                        }.__repr__()
                        + "\n"
                    )
        time.sleep(5)


if __name__ == "__main__":
    main()
