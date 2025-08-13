"""
wick_api_adapter.py

Lightweight HTTP adapter to fetch wick status from an external API
(e.g., Android app backend). Uses stdlib only.

Config sources (in order):
- Environment variables: WICK_API_BASE_URL, WICK_API_TOKEN
- secrets_store.get_secret keys: 'wick.api.base_url', 'wick.api.token'

Expected endpoint contract (flexible):
- GET {base_url}/wicks or {base_url}/status returns JSON like:
  {
    "wicks": 12,         # current wick count
    "delta": -1,         # optional, change since last event
    "reason": "...",    # optional
    "context": "..."    # optional
  }
We accept either path. First try '/wicks', then '/status'.
"""
from __future__ import annotations
from typing import Dict, Optional, Tuple
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import json
import os

try:
    from secrets_store import get_secret  # type: ignore
except Exception:
    def get_secret(key: str) -> Optional[str]:
        return None


def _get_config() -> Tuple[Optional[str], Optional[str]]:
    base = os.environ.get("WICK_API_BASE_URL") or get_secret("wick.api.base_url")
    token = os.environ.get("WICK_API_TOKEN") or get_secret("wick.api.token")
    return base, token


def fetch_wick_status(base_url: Optional[str] = None, token: Optional[str] = None) -> Optional[Dict]:
    """Fetch wick status JSON from API. Returns dict or None on failure."""
    base, tok = _get_config()
    base_url = base_url or base
    token = token or tok
    if not base_url:
        return None

    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    for path in ("/wicks", "/status"):
        url = base_url.rstrip("/") + path
        try:
            req = Request(url, headers=headers, method="GET")
            with urlopen(req, timeout=5) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                if isinstance(payload, dict):
                    return payload
        except (HTTPError, URLError, TimeoutError):
            continue
        except Exception:
            continue
    return None


if __name__ == "__main__":
    data = fetch_wick_status()
    print("API status:", data)
