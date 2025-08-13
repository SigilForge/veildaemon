import argparse
import json
import os
import socket
import ssl
import time
import urllib.parse
from pathlib import Path

from .twitch_auth import get_irc_token, get_nick, helix_get

HOST = "irc.chat.twitch.tv"
PORT = 6697  # TLS

TOKEN = get_irc_token() or "oauth:YOUR_OAUTH_TOKEN_HERE"
NICK = get_nick() or os.getenv("TWITCH_NICK") or "sigilforge"

CHANNELS = ["#xqc", "#pokimane", "#shroud", "#summit1g", "#ninja"]  # Fallback list
PER_CHANNEL_SECONDS = 600  # 10 minutes per channel by default
LOG_PATH = Path("twitch_multi_chat_log.json")


def connect(channel):
    raw = socket.create_connection((HOST, PORT))
    ctx = ssl.create_default_context()
    s = ctx.wrap_socket(raw, server_hostname=HOST)
    s.send(b"CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n")
    s.send(f"PASS {TOKEN}\r\n".encode("utf-8"))
    s.send(f"NICK {NICK}\r\n".encode("utf-8"))
    s.send(f"JOIN {channel}\r\n".encode("utf-8"))
    return s


def discover_channels(
    min_viewers: int = 75,
    limit: int = 10,
    language: str | None = None,
    max_viewers: int | None = 250,
) -> list[str]:
    params = {"first": "100"}
    if language:
        params["language"] = language
    url = "https://api.twitch.tv/helix/streams?" + urllib.parse.urlencode(params)
    try:
        data = helix_get(url, prefer_user=True)
        streams = data.get("data", [])
        picks = []
        for s in streams:
            vc = s.get("viewer_count", 0)
            login = s.get("user_login") or s.get("user_name")
            in_range = (
                isinstance(vc, int)
                and vc >= min_viewers
                and (max_viewers is None or vc <= max_viewers)
            )
            if login and in_range:
                picks.append("#" + login.lower())
                if len(picks) >= limit:
                    break
        return picks or CHANNELS
    except Exception:
        return CHANNELS


def _watch_pass(targets: list[str], debug: bool, inactivity_seconds: int) -> list[dict]:
    """Watch a list of channels once; skip a channel early if no chat for inactivity_seconds."""
    log: list[dict] = []
    for channel in targets:
        if debug:
            print(f"Connecting to {channel}...")
        try:
            s = connect(channel)
            s.settimeout(1.0)
        except Exception:
            if debug:
                print(f"[DBG] failed to connect {channel}")
            continue
        start = time.time()
        last_msg_time = time.time()
        while time.time() - start < PER_CHANNEL_SECONDS:
            # Early skip if no chat activity for inactivity_seconds
            if inactivity_seconds > 0 and (time.time() - last_msg_time) >= inactivity_seconds:
                if debug:
                    print(f"[DBG] inactive {channel} for {inactivity_seconds}s -> skipping")
                break
            try:
                data = s.recv(4096).decode("utf-8", errors="ignore")
                if not data:
                    # connection closed
                    break
            except socket.timeout:
                data = ""
            except Exception:
                break
            if not data:
                continue
            for line in data.split("\r\n"):
                if not line:
                    continue
                if line.startswith("PING"):
                    try:
                        s.send(b"PONG :tmi.twitch.tv\r\n")
                    except Exception:
                        pass
                    if debug:
                        print("[DBG] PING -> PONG")
                    continue
                if debug and (
                    "JOIN" in line
                    or "ROOMSTATE" in line
                    or "USERSTATE" in line
                    or "GLOBALUSERSTATE" in line
                ):
                    print("[DBG] " + line[:180])
                if " PRIVMSG #" in line:
                    try:
                        prefix, msg = line.split(" PRIVMSG ", 1)
                        channel_part, message = msg.split(" :", 1)
                        parts = prefix.split(";")
                        display = None
                        for p in parts:
                            if p.startswith("display-name="):
                                display = p.split("=", 1)[1]
                                break
                        chan = channel_part.split(" ")[0]
                        if display and message:
                            entry = {"channel": chan, "user": display, "message": message}
                            log.append(entry)
                            last_msg_time = time.time()
                            if debug:
                                print(f"[{chan}]{display}: {message[:140]}")
                    except Exception:
                        continue
        try:
            s.close()
        except Exception:
            pass
    return log


def watch_channels(
    debug: bool = False,
    min_viewers: int = 75,
    limit: int = 10,
    language: str | None = None,
    max_viewers: int | None = 250,
    inactivity_seconds: int = 45,
    rediscover_on_inactive: bool = True,
):
    targets = discover_channels(
        min_viewers=min_viewers, limit=limit, language=language, max_viewers=max_viewers
    )
    if debug:
        print(f"[DBG] rotating channels: {targets}")
    log = _watch_pass(targets, debug=debug, inactivity_seconds=inactivity_seconds)

    # If completely inactive, optionally rediscover once and try again
    if rediscover_on_inactive and not log:
        targets2 = discover_channels(
            min_viewers=min_viewers, limit=limit, language=language, max_viewers=max_viewers
        )
        if debug:
            print(f"[DBG] re-discovered channels: {targets2}")
        if targets2:
            log = _watch_pass(targets2, debug=debug, inactivity_seconds=inactivity_seconds)

    if log:
        try:
            existing = json.loads(LOG_PATH.read_text(encoding="utf-8")) if LOG_PATH.exists() else []
        except Exception:
            existing = []
        existing.extend(log)
        LOG_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            f"Saved {len(log)} messages from {len(set(x['channel'] for x in log))} channels to {LOG_PATH.name}"
        )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=int, default=PER_CHANNEL_SECONDS)
    ap.add_argument("--min-viewers", type=int, default=75)
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--language", type=str, default=None)
    ap.add_argument("--debug", action="store_true")
    ap.add_argument(
        "--max-viewers",
        type=int,
        default=250,
        help="Only consider streams with viewers <= this number (use 0 to disable)",
    )
    ap.add_argument(
        "--inactive-seconds",
        type=int,
        default=45,
        help="Skip a channel if no chat for this many seconds",
    )
    # Enabled by default; provide a flag to disable
    ap.add_argument(
        "--no-rediscover-on-inactive",
        dest="rediscover_on_inactive",
        action="store_false",
        help="Disable re-discovery on inactivity",
    )
    ap.set_defaults(rediscover_on_inactive=True)
    args = ap.parse_args()

    PER_CHANNEL_SECONDS = args.seconds
    watch_channels(
        debug=args.debug,
        min_viewers=args.min_viewers,
        limit=args.limit,
        language=args.language,
        max_viewers=(
            None if (hasattr(args, "max_viewers") and args.max_viewers == 0) else args.max_viewers
        ),
        inactivity_seconds=args.inactive_seconds,
        rediscover_on_inactive=args.rediscover_on_inactive,
    )
