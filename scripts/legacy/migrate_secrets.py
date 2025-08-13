"""
Migrate plaintext secrets into the encrypted store.

- Parses Hidden/Daemon Launch Process.txt and Daemon Launch Process.txt for known keys
- Optionally imports Google client_secret.json contents
- Writes to secrets.json.enc via secrets_store

Run:
  python migrate_secrets.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from secrets_store import set_secret

ROOT = Path(__file__).parent

LAUNCH_TXT_CANDIDATES = [
    ROOT / "Hidden" / "Daemon Launch Process.txt",
    ROOT / "Daemon Launch Process.txt",
]
CLIENT_SECRET_JSON = ROOT / "client_secret.json"


def parse_launch_text(p: Path) -> None:
    if not p.exists():
        return
    text = p.read_text(errors="ignore")
    pairs = {
        "openai.api.key": re.search(r"Open AI Key:\s*(.+)", text),
        "twitch.token": re.search(r"Twitch Stream Key:\s*(.+)", text),
        "twitch.secret": re.search(r"Secret:\s*(.+)", text),
        "twitch.access_token": re.search(r"Access Token:\s*(.+)", text),
    }
    for path, m in pairs.items():
        if m:
            val = m.group(1).strip()
            if val and val != "[REDACTED]":
                set_secret(path, val)
                print(f"✓ Imported {path}")


def import_client_secret_json() -> None:
    if CLIENT_SECRET_JSON.exists():
        try:
            data = json.loads(CLIENT_SECRET_JSON.read_text())
            set_secret("google.oauth.client_config", data)
            print("✓ Imported google.oauth.client_config")
        except Exception as e:
            print(f"⚠️ Failed to import client_secret.json: {e}")


if __name__ == "__main__":
    for p in LAUNCH_TXT_CANDIDATES:
        parse_launch_text(p)
    import_client_secret_json()
    print("Done. Now remove/redact plaintext files and keep secrets.json.enc local only.")
