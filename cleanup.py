#!/usr/bin/env python3
"""
VeilDaemon Cleanup Script 🜏
Usage:
    python cleanup.py --review
    python cleanup.py --auto
"""

import os
import sys
import json
import shutil
import time
import re
from pathlib import Path

# CONFIG
DAYS_OLD = 30
QUARANTINE_DIR = Path("quarantine")
SKIP_DIRS = {
    "__pycache__", "DB", "Graveyard", "model", "models",
    "venv311", "vosk-model-small-en-us-0.15"
}
REQUIRED_FILES = [
    "daemon_brain.py", "wick_tracker.py", "whisper_trigger.py",
    "glyph_engine.py", "glyph_logic.py", "veil_daemon_chat_bound.py"
]
REQUIRED_CONFIGS = [
    "veil.config", "client_secret.json", ".env"
]

mode_auto = "--auto" in sys.argv
mode_review = "--review" in sys.argv

if not (mode_auto or mode_review):
    print("Specify --auto to run or --review to preview.")
    sys.exit(1)

root = Path(__file__).parent


def age_days(path):
    return (time.time() - path.stat().st_mtime) / 86400


def quarantine(path):
    QUARANTINE_DIR.mkdir(exist_ok=True)
    dest = QUARANTINE_DIR / path.name
    shutil.move(str(path), dest)
    return dest


def purge_old_files():
    patterns = ["*.json", "*.enc", "*.db"]
    for pat in patterns:
        for file in root.rglob(pat):
            if any(skip in file.parts for skip in SKIP_DIRS):
                continue
            if file.is_file() and age_days(file) > DAYS_OLD:
                action = f"Quarantine old file: {file} ({age_days(file):.1f} days)"
                if mode_auto:
                    dest = quarantine(file)
                    print(f"🗑 {action} → {dest}")
                else:
                    print(f"[Would] {action}")


def pretty_json(file):
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
        file.write_text(json.dumps(
            data, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False


def format_files():
    for file in root.rglob("*.json"):
        if any(skip in file.parts for skip in SKIP_DIRS):
            continue
        if pretty_json(file):
            print(f"📜 Formatted JSON: {file}")
    try:
        import autopep8
        for file in root.rglob("*.py"):
            if any(skip in file.parts for skip in SKIP_DIRS):
                continue
            original = file.read_text(encoding="utf-8")
            fixed = autopep8.fix_code(original)
            if fixed != original:
                file.write_text(fixed, encoding="utf-8")
                print(f"📜 Formatted Python: {file}")
    except ImportError:
        print("⚠ autopep8 not installed; skipping Python format.")


def extract_glyphs():
    glyph_file = root / "glyph_logic.py"
    if not glyph_file.exists():
        print("❌ glyph_logic.py missing.")
        return set()
    text = glyph_file.read_text(encoding="utf-8")
    # Simple parse: match any quoted words after 'Rune' or in glyph mapping
    found = set(re.findall(r'"([A-Za-z]+)"', text))
    return found


def check_glyphs():
    found = extract_glyphs()
    if not found:
        return
    print(f"✅ Found {len(found)} glyph names in glyph_logic.py")
    # Optionally, check for duplicates or formatting anomalies
    duplicates = [g for g in found if list(found).count(g) > 1]
    if duplicates:
        print(f"⚠ Duplicate glyphs detected: {duplicates}")


def check_required_files():
    for f in REQUIRED_FILES:
        if not (root / f).exists():
            print(f"❌ Missing core file: {f}")
    for f in REQUIRED_CONFIGS:
        if not any((root / f).exists() or (root / f).is_file() for f in [Path(f)]):
            print(f"⚠ Config missing: {f}")


def main():
    print(f"🜏 VeilDaemon Cleanup ({'AUTO' if mode_auto else 'REVIEW'})")
    purge_old_files()
    format_files()
    check_glyphs()
    check_required_files()
    print("✨ Done.")


if __name__ == "__main__":
    main()
