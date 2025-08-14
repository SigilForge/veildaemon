#!/usr/bin/env python3
"""
Discover live Twitch channels that advertise captions/CC via tags.

- Uses Helix Get Streams and (fallback) Get Channel Information to read tags.
- Filters by keywords (default: captions, closed captions, subtitles, cc).
- Outputs a concise JSON list and can emit a starter vtt_map JSON with empty URLs.

Requirements: Twitch creds are managed by twitch_auth via secrets_store.
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
from typing import Dict, List, Optional

from .twitch_auth import helix_get

HELIX = "https://api.twitch.tv/helix"


def get_streams(language: Optional[str], first: int = 50, after: Optional[str] = None) -> Dict:
    qs = {"first": str(first)}
    if language:
        qs["language"] = language
    if after:
        qs["after"] = after
    url = f"{HELIX}/streams?{urllib.parse.urlencode(qs)}"
    return helix_get(url, prefer_user=True)


def get_channel_info_batch(user_ids: List[str]) -> Dict[str, Dict]:
    if not user_ids:
        return {}
    infos: Dict[str, Dict] = {}
    for i in range(0, len(user_ids), 100):
        batch = user_ids[i : i + 100]
        qs = "&".join([f"broadcaster_id={urllib.parse.quote(uid)}" for uid in batch])
        url = f"{HELIX}/channels?{qs}"
        data = helix_get(url, prefer_user=True)
        for item in data.get("data", []):
            infos[item.get("broadcaster_id")] = item
        time.sleep(0.15)
    return infos


def discover(
    min_viewers: int, limit: int, language: Optional[str], keywords: List[str]
) -> List[Dict]:
    results: List[Dict] = []
    after: Optional[str] = None
    while len(results) < limit:
        page = get_streams(language=language, first=100, after=after)
        streams = page.get("data", [])
        if not streams:
            break
        missing_tag_ids = [s for s in streams if not s.get("tags") and not s.get("tag_ids")]
        channel_info_map: Dict[str, Dict] = {}
        if missing_tag_ids:
            user_ids = [s.get("user_id") for s in missing_tag_ids if s.get("user_id")]
            channel_info_map = get_channel_info_batch(user_ids)
        for s in streams:
            vc = int(s.get("viewer_count", 0) or 0)
            if vc < min_viewers:
                continue
            login = s.get("user_login") or s.get("user_name")
            tags = s.get("tags")
            if not tags:
                ch = channel_info_map.get(s.get("user_id", ""), {})
                tags = ch.get("tags")
            tags = [t.lower() for t in (tags or [])]
            text = (" ".join(tags) + " " + (s.get("title") or "")).lower()
            if any(k in text for k in keywords):
                results.append(
                    {
                        "channel": f"#{login}",
                        "user_login": login,
                        "user_name": s.get("user_name"),
                        "viewer_count": vc,
                        "language": s.get("language"),
                        "title": s.get("title"),
                        "tags": tags,
                    }
                )
            if len(results) >= limit:
                break
        after = page.get("pagination", {}).get("cursor")
        if not after:
            break
        time.sleep(0.15)
    return results


def main():
    ap = argparse.ArgumentParser(description="Discover Twitch channels with CC-related tags")
    ap.add_argument("--min-viewers", type=int, default=75)
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--language", type=str, default="en")
    ap.add_argument("--keywords", type=str, default="captions,closed captions,subtitles,cc")
    ap.add_argument("--save", type=str, default="captioned_channels.json")
    ap.add_argument("--emit-vtt-map", type=str, default="config/vtt_map.candidates.json")
    args = ap.parse_args()

    keywords = [k.strip().lower() for k in args.keywords.split(",") if k.strip()]
    matches = discover(
        min_viewers=args.min_viewers,
        limit=args.limit,
        language=args.language,
        keywords=keywords,
    )

    print(json.dumps(matches, indent=2, ensure_ascii=False))
    if args.save:
        with open(args.save, "w", encoding="utf-8") as f:
            json.dump(matches, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(matches)} channels to {args.save}")
    if args.emit_vtt_map:
        vtt_map = {m["channel"]: "" for m in matches}
        with open(args.emit_vtt_map, "w", encoding="utf-8") as f:
            json.dump(vtt_map, f, indent=2)
        print(f"Wrote starter VTT map to {args.emit_vtt_map}")


if __name__ == "__main__":
    main()
