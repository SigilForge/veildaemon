"""
🌏 VeilDaemon – glyph_engine.py (Unified, Token-Safe)
Handles glyph encoding, modifiers, encrypted logging, and full metadata for all analysis and LLM access.
"""

import json
import os
from datetime import datetime
from typing import Optional

from cryptography.fernet import Fernet

# Paths
KEY_PATH = "glyphkey.key"
LOG_PATH = "memory_log.json.enc"

# Full glyph metadata from VEILDAEMON_GLYPH_ENCODERS
GLYPH_METADATA = {
    "GLYPH_00": {
        "symbol": "⚓",
        "name": "Anchor",
        "ring": 1,
        "meaning": "Grounding, return, safe base",
    },
    "GLYPH_01": {"symbol": "🛡️", "name": "Aegis", "ring": 1, "meaning": "Protection, shield, ward"},
    "GLYPH_02": {
        "symbol": "🪨",
        "name": "Stone",
        "ring": 1,
        "meaning": "Endurance, heaviness, pressure",
    },
    "GLYPH_03": {"symbol": "🕳️", "name": "Hollow", "ring": 1, "meaning": "Emptiness, numb, echo"},
    "GLYPH_04": {
        "symbol": "🌊",
        "name": "Flood",
        "ring": 1,
        "meaning": "Overwhelm, release, meltdown",
    },
    "GLYPH_05": {
        "symbol": "🔄",
        "name": "Loop",
        "ring": 1,
        "meaning": "Repeating, stuck, recursion",
    },
    "GLYPH_06": {"symbol": "🌀", "name": "Vortex", "ring": 1, "meaning": "Anxiety, pull, spiral"},
    "GLYPH_07": {
        "symbol": "🌌",
        "name": "Void",
        "ring": 1,
        "meaning": "Night, possibility, unknown",
    },
    "GLYPH_08": {"symbol": "🕯️", "name": "Clarity", "ring": 1, "meaning": "Insight, focus, ritual"},
    "GLYPH_09": {
        "symbol": "🪞",
        "name": "Mirror",
        "ring": 1,
        "meaning": "Reflection, self, identity",
    },
    "GLYPH_10": {
        "symbol": "🔥",
        "name": "Flare",
        "ring": 1,
        "meaning": "Activation, pain, breakthrough",
    },
    "GLYPH_11": {"symbol": "🌠", "name": "Wish", "ring": 1, "meaning": "Hope, dream, longing"},
    "GLYPH_12": {
        "symbol": "🎭",
        "name": "Mask",
        "ring": 2,
        "meaning": "Persona, masking, code-switch",
    },
    "GLYPH_13": {"symbol": "🔇", "name": "Mute", "ring": 2, "meaning": "Silence, shutdown, freeze"},
    "GLYPH_14": {
        "symbol": "💬",
        "name": "Dialogue",
        "ring": 2,
        "meaning": "Conversation, opening, consent",
    },
    "GLYPH_15": {"symbol": "🩸", "name": "Blood", "ring": 2, "meaning": "Wound, truth, cost"},
    "GLYPH_16": {"symbol": "🪙", "name": "Coin", "ring": 2, "meaning": "Value, worth, exchange"},
    "GLYPH_17": {
        "symbol": "🗣️",
        "name": "Voice",
        "ring": 2,
        "meaning": "Speaking up, signal, alert",
    },
    "GLYPH_18": {
        "symbol": "🫃",
        "name": "Juice",
        "ring": 2,
        "meaning": "Energy, nourishment, reward",
    },
    "GLYPH_19": {
        "symbol": "🦩",
        "name": "Puzzle",
        "ring": 2,
        "meaning": "Complexity, difference, fit",
    },
    "GLYPH_20": {
        "symbol": "🧵",
        "name": "Thread",
        "ring": 2,
        "meaning": "Connection, fate, timeline",
    },
    "GLYPH_21": {"symbol": "🖊️", "name": "Ink", "ring": 2, "meaning": "Writing, record, spell"},
    "GLYPH_22": {"symbol": "🗝️", "name": "Key", "ring": 2, "meaning": "Access, permission, unlock"},
    "GLYPH_23": {"symbol": "⌛", "name": "Sands", "ring": 2, "meaning": "Time, patience, decay"},
    "GLYPH_24": {"symbol": "🌫️", "name": "Fog", "ring": 3, "meaning": "Confusion, lost, ambiguity"},
    "GLYPH_25": {"symbol": "🌙", "name": "Dream", "ring": 3, "meaning": "Night, sleep, vision"},
    "GLYPH_26": {
        "symbol": "🚪",
        "name": "Door",
        "ring": 3,
        "meaning": "Threshold, change, boundary",
    },
    "GLYPH_27": {"symbol": "🛤️", "name": "Track", "ring": 3, "meaning": "Path, progress, journey"},
    "GLYPH_28": {
        "symbol": "🧭",
        "name": "Compass",
        "ring": 3,
        "meaning": "Direction, navigation, choice",
    },
    "GLYPH_29": {"symbol": "🧿", "name": "Beads", "ring": 3, "meaning": "Prayer, focus, anchor"},
    "GLYPH_30": {
        "symbol": "🪜",
        "name": "Ladder",
        "ring": 3,
        "meaning": "Ascent, progress, escape",
    },
    # Special/Combined
    "GLYPH_31": {
        "symbol": "🪞/🔁",
        "name": "Mirror/Loop",
        "ring": 4,
        "meaning": "Recursive reflection, memory",
    },
    "GLYPH_32": {
        "symbol": "🪞⁻",
        "name": "Broken Mirror",
        "ring": 4,
        "meaning": "Fragmentation, alternate self",
    },
    "GLYPH_33": {
        "symbol": "🌫️🔥",
        "name": "Fog/Flare",
        "ring": 4,
        "meaning": "Dissolution, catastrophic change",
    },
    "GLYPH_34": {
        "symbol": "⚓✨",
        "name": "Bright Anchor",
        "ring": 4,
        "meaning": "Renewed hope, stabilized base",
    },
    "GLYPH_35": {
        "symbol": "🛡️⬛",
        "name": "Shadow Shield",
        "ring": 4,
        "meaning": "Hidden defense, dissociation",
    },
}

# Emoji-to-ID mapping for use everywhere (auto-generated)
GLYPH_TOKENS = {meta["symbol"]: k for k, meta in GLYPH_METADATA.items()}

MODIFIERS: dict[str, str] = {
    "🔁": "MOD_LOOP",
    "⁻": "MOD_NEGATE",
    "🔥": "MOD_FLARE",
    "✨": "MOD_AMPLIFY",
    "⬛": "MOD_SHADOW",
}
# typing imported above


def encode_glyph(glyph: str, modifier: Optional[str] = None):
    mod_val = MODIFIERS.get(modifier) if modifier is not None else None
    return {
        "glyph": GLYPH_TOKENS.get(glyph, f"UNK_{glyph}"),
        "modifier": mod_val,
        "timestamp": datetime.now().isoformat(),
    }


def log_glyph(entry, path=LOG_PATH):
    key = load_key()
    fernet = Fernet(key)
    try:
        with open(LOG_PATH, "rb") as f:
            decrypted = fernet.decrypt(f.read())
            data = json.loads(decrypted)
    except FileNotFoundError:
        data = []
    except Exception:
        data = []

    data.append(entry)
    encrypted = fernet.encrypt(json.dumps(data, indent=2).encode())
    with open(LOG_PATH, "wb") as f:
        f.write(encrypted)
    print(
        f"📝 Logged glyph {entry['glyph']} with modifier {entry.get('modifier')} at {entry['timestamp']}"
    )


# Key management


def generate_key():
    key = Fernet.generate_key()
    with open(KEY_PATH, "wb") as key_file:
        key_file.write(key)
    print("🔐 New glyphkey.key generated.")


def load_key():
    if not os.path.exists(KEY_PATH):
        print("⚠️ No encryption key found. Generating...")
        generate_key()
    with open(KEY_PATH, "rb") as key_file:
        return key_file.read()
