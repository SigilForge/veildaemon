"""
Encrypted secrets store for VeilDaemon.

Uses cryptography.Fernet with the existing glyph_engine key management.
Secrets are stored in secrets.json.enc as a JSON object and decrypted at runtime.

Public API:
- get_secret(path: str, default: Optional[str] = None) -> Optional[str]
- set_secret(path: str, value: str) -> None
- load_all() -> Dict[str, Any]

Notes:
- The encryption key file glyphkey.key must exist locally (auto-generated on first use).
- Do NOT commit glyphkey.key or secrets.json.enc. Both are user-local.

Streaming vs OAuth (clarity):
- "twitch.stream.key" is the broadcast Stream Key for the SigilForge channel only. It is NOT used for API/IRC.
- "twitch.access.token" and "twitch.refresh.token" are OAuth tokens used by the bot to read/discover data on the Knoxmortis account (Helix/IRC sniffing, discovery, rotation, etc.).
- "twitch.nick" is the IRC username the bot connects as (often "sigilforge" for on-air features); OAuth can belong to a different account used for discovery (Knoxmortis).

Dev-only tooling:
- Trainer/ingestion scripts (shadow mining, Twitch ingestion, caption merging, workday loop) are development tools and not part of the shipped bot. See docs/dev-tools.md.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet

# Reuse key management from glyph_engine
try:
    from glyph_engine import load_key
except Exception:
    # Fallback: local key file next to this module
    def load_key() -> bytes:
        key_path = Path("glyphkey.key")
        if not key_path.exists():
            key = Fernet.generate_key()
            key_path.write_bytes(key)
        return key_path.read_bytes()


SECRETS_PATH = Path("secrets.json.enc")


def _read_encrypted() -> Dict[str, Any]:
    if not SECRETS_PATH.exists():
        return {}
    key = load_key()
    f = Fernet(key)
    try:
        data = f.decrypt(SECRETS_PATH.read_bytes())
        return json.loads(data)
    except Exception:
        return {}


def _write_encrypted(data: Dict[str, Any]) -> None:
    key = load_key()
    f = Fernet(key)
    payload = json.dumps(data, indent=2).encode()
    SECRETS_PATH.write_bytes(f.encrypt(payload))


def _dig_get(obj: Dict[str, Any], path: str) -> Optional[Any]:
    cur: Any = obj
    for part in path.split('.'):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _dig_set(obj: Dict[str, Any], path: str, value: Any) -> None:
    parts = path.split('.')
    cur = obj
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def get_secret(path: str, default: Optional[str] = None) -> Optional[str]:
    """Get a secret by dot-path. Falls back to environment variables when matching names.

    Example dot-paths and env fallbacks:
      - "openai.api.key" -> env OPENAI_API_KEY
      - "elevenlabs.api.key" -> env ELEVENLABS_API_KEY
      - "twitch.token" -> env TWITCH_TOKEN (legacy)
      - "twitch.access.token" -> env TWITCH_ACCESS_TOKEN
      - "google.oauth.client_config" -> no env fallback (JSON blob)
    """
    data = _read_encrypted()
    val = _dig_get(data, path)
    if val is not None:
        return val

    # Simple env fallbacks for common keys
    env_map = {
        "openai.api.key": "OPENAI_API_KEY",
        "anthropic.api.key": "ANTHROPIC_API_KEY",
        "hf.api.token": "HUGGINGFACE_HUB_TOKEN",
        # ElevenLabs
        "elevenlabs.api.key": "ELEVENLABS_API_KEY",
        # Twitch (support both legacy and current paths)
        "twitch.token": "TWITCH_TOKEN",  # legacy
        "twitch.access.token": "TWITCH_ACCESS_TOKEN",
        "twitch.client.id": "TWITCH_CLIENT_ID",
        "twitch.client.secret": "TWITCH_CLIENT_SECRET",
    "twitch.nick": "TWITCH_NICK",
    "twitch.refresh.token": "TWITCH_REFRESH_TOKEN",
    # Broadcast stream key for SigilForge (not used for API/IRC)
    "twitch.stream.key": "TWITCH_STREAM_KEY",
    }
    env_name = env_map.get(path)
    if env_name:
        return os.getenv(env_name, default)

    # Light-weight compatibility: if caller asked for one Twitch token path
    # but only the other env var is present, bridge it.
    if path == "twitch.access.token":
        return os.getenv("TWITCH_TOKEN", default)
    if path == "twitch.token":
        return os.getenv("TWITCH_ACCESS_TOKEN", default)
    return default


def set_secret(path: str, value: Any) -> None:
    data = _read_encrypted()
    _dig_set(data, path, value)
    _write_encrypted(data)


def load_all() -> Dict[str, Any]:
    return _read_encrypted()


if __name__ == "__main__":
    # Simple CLI: python secrets_store.py set openai.api.key sk-xxx
    import sys
    if len(sys.argv) >= 3 and sys.argv[1] == "set":
        path = sys.argv[2]
        value = sys.argv[3] if len(sys.argv) > 3 else ""
        set_secret(path, value)
        print(f"Set secret {path} ✓")
    elif len(sys.argv) >= 3 and sys.argv[1] == "get":
        path = sys.argv[2]
        print(get_secret(path))
    elif len(sys.argv) >= 2 and sys.argv[1] == "status":
        # Grouped status output for quick clarity on roles/ownership
        sections = {
            "LLM providers": [
                "openai.api.key",
                "anthropic.api.key",
                "hf.api.token",
            ],
            "TTS": [
                "elevenlabs.api.key",
            ],
            "Streaming (SigilForge)": [
                "twitch.stream.key",  # broadcast key, not used for API/IRC
                "twitch.nick",
            ],
            "Twitch OAuth (bot reads Knoxmortis)": [
                "twitch.client.id",
                "twitch.client.secret",
                "twitch.access.token",
                "twitch.refresh.token",
            ],
            "Legacy/compat": [
                "twitch.token",
            ],
        }
        data = load_all()

        def has_key(p: str) -> bool:
            cur = data
            for part in p.split('.'):  # dot path dive
                if not isinstance(cur, dict) or part not in cur:
                    return False
                cur = cur[part]
            return bool(cur)

        for title, keys in sections.items():
            print(f"\n[{title}]")
            for k in keys:
                print(f"{k}: {'SET' if has_key(k) else 'unset'}")
    else:
        print("Usage:\n  python secrets_store.py set <path> <value>\n  python secrets_store.py get <path>\n  python secrets_store.py status")
