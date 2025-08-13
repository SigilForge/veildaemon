"""
🜏 VeilDaemon – glyph_logic.py
Parses glyph history to extract emotional trends, energy ring imbalances, and symbolic meanings.
"""

import json
from collections import Counter
from cryptography.fernet import Fernet
from datetime import datetime

from glyph_engine import GLYPH_TOKENS, MODIFIERS, LOG_PATH, KEY_PATH

# Load the encryption key


def load_key():
    with open(KEY_PATH, "rb") as key_file:
        return key_file.read()

# Load and decrypt the glyph memory log


def load_glyph_log():
    try:
        key = load_key()
        with open(LOG_PATH, "rb") as f:
            data = json.loads(Fernet(key).decrypt(f.read()))
        return data
    except Exception as e:
        print(f"⚠️ Failed to load log: {e}")
        return []

# Classify each glyph into a Ring (I, II, III, Combo)


def classify_ring(glyph_token):
    if glyph_token.startswith("GLYPH_0") and int(glyph_token[-2:]) <= 11:
        return "I"
    elif int(glyph_token[-2:]) <= 23:
        return "II"
    elif int(glyph_token[-2:]) <= 30:
        return "III"
    else:
        return "Combo"

# Analyze the last N glyph entries


def analyze_glyphs(n=10):
    log = load_glyph_log()
    if not log:
        return {"status": "no data", "summary": "No glyphs have been logged yet."}

    recent = log[-n:]

    ring_counts = Counter()
    modifier_counts = Counter()
    timeline = []

    for entry in recent:
        glyph = entry.get("glyph", "UNKNOWN")
        modifier = entry.get("modifier", "None")
        ring = classify_ring(glyph)
        ring_counts[ring] += 1
        modifier_counts[modifier] += 1
        timeline.append((glyph, modifier, entry.get("timestamp", "?")))

    dominant_ring = ring_counts.most_common(1)[0][0]
    summary = f"Dominant emotional ring: {dominant_ring}. "
    if "MOD_NEGATE" in modifier_counts:
        summary += "Recent negation detected. "
    if "MOD_FLARE" in modifier_counts:
        summary += "Spikes of emotional flare. "
    if "MOD_LOOP" in modifier_counts:
        summary += "Looping thoughts or recursion. "

    return {
        "status": "ok",
        "dominant_ring": dominant_ring,
        "ring_counts": dict(ring_counts),
        "modifiers": dict(modifier_counts),
        "timeline": timeline,
        "summary": summary
    }

# Helper: Pretty print state


def print_analysis(n=10):
    result = analyze_glyphs(n)
    if result["status"] != "ok":
        print(result["summary"])
        return

    print(f"\n🧿 Glyph Analysis – last {n} entries")
    print("———————————————")
    for g, m, t in result["timeline"]:
        print(f"{t}: {g}  [{m}]")
    print("———————————————")
    print(result["summary"])
