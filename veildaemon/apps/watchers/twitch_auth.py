#!/usr/bin/env python3
"""
Centralized Twitch authentication utilities for VeilDaemon.

- Always reads credentials from secrets_store (with env fallbacks via secrets_store).
- Provides IRC token (oauth:...) and Nick for IRC/Chat.
- Provides Helix headers with automatic user-token preference, 401 refresh, and app-token fallback.
- Can refresh user tokens if refresh token + client creds are present.
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from typing import Dict, Optional
from urllib.error import HTTPError

try:
    from secrets_store import get_secret, set_secret
except Exception:  # very minimal fallback

    def get_secret(path: str, default: Optional[str] = None) -> Optional[str]:
        env_map = {
            "twitch.client.id": "TWITCH_CLIENT_ID",
            "twitch.client.secret": "TWITCH_CLIENT_SECRET",
            "twitch.access.token": "TWITCH_ACCESS_TOKEN",
            "twitch.token": "TWITCH_TOKEN",
            "twitch.nick": "TWITCH_NICK",
            "twitch.refresh.token": "TWITCH_REFRESH_TOKEN",
        }
        return os.getenv(env_map.get(path, ""), default)

    def set_secret(path: str, value: str) -> None:  # no-op fallback
        pass


HELIX = "https://api.twitch.tv/helix"
OAUTH = "https://id.twitch.tv/oauth2/token"
USER_AGENT = "VeilDaemon/1.0"

# low-memory cache for app token to avoid re-fetching
_APP_TOKEN: Optional[str] = None
_APP_TOKEN_TS: float = 0.0
_APP_TOKEN_TTL: float = 60 * 55  # ~55 minutes


def _strip_oauth(tok: Optional[str]) -> Optional[str]:
    if not tok:
        return tok
    return tok[6:] if tok.startswith("oauth:") else tok


essential_headers = {"User-Agent": USER_AGENT}


def get_client_id() -> Optional[str]:
    return get_secret("twitch.client.id")


def get_client_secret() -> Optional[str]:
    return get_secret("twitch.client.secret")


def get_user_token_bare() -> Optional[str]:
    # Prefer access.token; bridge legacy if present
    tok = get_secret("twitch.access.token") or get_secret("twitch.token")
    return _strip_oauth(tok)


def get_refresh_token() -> Optional[str]:
    return get_secret("twitch.refresh.token")


def get_nick() -> Optional[str]:
    return get_secret("twitch.nick")


def get_irc_token() -> Optional[str]:
    # IRC requires oauth: prefix
    tok = get_secret("twitch.token") or get_secret("twitch.access.token")
    bare = _strip_oauth(tok)
    return f"oauth:{bare}" if bare else None


def _post(url: str, form: Dict[str, str]) -> Dict:
    data = urllib.parse.urlencode(form).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("User-Agent", USER_AGENT)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_app_access_token(force: bool = False) -> Optional[str]:
    global _APP_TOKEN, _APP_TOKEN_TS
    now = time.time()
    if not force and _APP_TOKEN and (now - _APP_TOKEN_TS) < _APP_TOKEN_TTL:
        return _APP_TOKEN
    client_id = get_client_id()
    client_secret = get_client_secret()
    if not (client_id and client_secret):
        return None
    try:
        data = _post(
            OAUTH,
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials",
            },
        )
        _APP_TOKEN = data.get("access_token")
        _APP_TOKEN_TS = now
        return _APP_TOKEN
    except Exception:
        return None


def refresh_user_access_token() -> Optional[str]:
    client_id = get_client_id()
    client_secret = get_client_secret()
    refresh_token = get_refresh_token()
    if not (client_id and client_secret and refresh_token):
        return None
    try:
        data = _post(
            OAUTH,
            {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        new_access = data.get("access_token")
        new_refresh = data.get("refresh_token") or refresh_token
        if new_access:
            # Persist the updated tokens
            set_secret("twitch.access.token", new_access)
            if new_refresh:
                set_secret("twitch.refresh.token", new_refresh)
            return new_access
    except Exception:
        return None
    return None


def helix_headers(prefer_user: bool = True) -> Dict[str, str]:
    client_id = get_client_id()
    bearer: Optional[str] = None
    if prefer_user:
        bearer = get_user_token_bare()
    if not bearer:
        bearer = _get_app_access_token()
    if not (client_id and bearer):
        raise RuntimeError("Missing Twitch client_id or token")
    return {"Client-ID": client_id, "Authorization": f"Bearer {bearer}", **essential_headers}


def helix_get(url: str, prefer_user: bool = True, retry_on_401: bool = True) -> Dict:
    headers = helix_headers(prefer_user=prefer_user)
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        if e.code == 401 and retry_on_401:
            # Try refresh if we were using user; else try app token
            if prefer_user:
                new_tok = refresh_user_access_token()
                if new_tok:
                    headers = helix_headers(prefer_user=True)
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        return json.loads(resp.read().decode("utf-8"))
            # Fallback to app token
            headers = helix_headers(prefer_user=False)
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        raise
