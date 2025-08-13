#!/usr/bin/env python3
"""
Fetch Piper voice model (.onnx) and config (.onnx.json) files using voices.json from Hugging Face.

Usage (Windows PowerShell):
  python tools/piper_fetch_voice.py --voice en_US-ljspeech-high --dest StreamDaemon/piper_models
  python tools/piper_fetch_voice.py --voice en_US-lessac-high --dest StreamDaemon/piper_models

Multiple voices:
  python tools/piper_fetch_voice.py --voice en_US-ljspeech-high en_US-lessac-high --dest StreamDaemon/piper_models

Notes:
 - We avoid heavy deps; only use stdlib + requests if available; otherwise fall back to urllib.
 - Validates MD5 against voices.json when possible.
 - Creates destination directory if missing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from typing import Dict, Any, Tuple

VOICES_JSON_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json"


def _http_get(url: str) -> bytes:
    try:
        import requests  # type: ignore
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        return r.content
    except Exception:
        from urllib.request import urlopen
        with urlopen(url) as resp:  # nosec - user provided URL to trusted HF domain
            return resp.read()


def _download_to(path: str, url: str, expected_md5: str | None = None) -> None:
    data = _http_get(url)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    if expected_md5:
        md5 = hashlib.md5(data).hexdigest()
        if md5 != expected_md5:
            os.remove(path)
            raise RuntimeError(f"MD5 mismatch for {os.path.basename(path)}: got {md5}, expected {expected_md5}")


def _load_voices_index() -> Dict[str, Any]:
    raw = _http_get(VOICES_JSON_URL)
    try:
        return json.loads(raw)
    except Exception as e:
        # Some CDNs may return text; ensure decode
        return json.loads(raw.decode("utf-8"))


def resolve_assets(voices_index: Dict[str, Any], key: str) -> Tuple[str, str, str, str]:
    """Return tuple of (onnx_rel, onnx_md5, json_rel, json_md5) for the voice key.

    Voices index maps keys like 'en_US-ljspeech-high' to a structure containing files.
    """
    entry = voices_index.get(key)
    if not entry or "files" not in entry:
        raise KeyError(f"Voice key not found in voices.json: {key}")
    files = entry["files"]
    # Prefer .onnx path and matching .onnx.json
    onnx_rel = None
    onnx_md5 = None
    json_rel = None
    json_md5 = None
    for rel, meta in files.items():
        if rel.endswith(".onnx"):
            onnx_rel = rel
            onnx_md5 = meta.get("md5_digest")
        elif rel.endswith(".onnx.json"):
            json_rel = rel
            json_md5 = meta.get("md5_digest")
    if not onnx_rel or not json_rel:
        raise KeyError(f"Asset paths incomplete for {key}; found onnx={onnx_rel}, json={json_rel}")
    return onnx_rel, (onnx_md5 or ""), json_rel, (json_md5 or "")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Download Piper voice models using voices.json")
    p.add_argument("--voice", nargs="+", required=True, help="One or more voice keys, e.g., en_US-ljspeech-high")
    p.add_argument("--dest", default="StreamDaemon/piper_models", help="Destination directory for assets")
    p.add_argument("--base", default="https://huggingface.co/rhasspy/piper-voices/resolve/main/", help="Base URL for files")
    p.add_argument("--force", action="store_true", help="Redownload even if files exist")
    args = p.parse_args(argv)

    dest = args.dest
    os.makedirs(dest, exist_ok=True)

    print("Fetching voices index…", flush=True)
    voices_index = _load_voices_index()

    ok = 0
    for key in args.voice:
        try:
            onnx_rel, onnx_md5, json_rel, json_md5 = resolve_assets(voices_index, key)
        except KeyError as e:
            print(f"[WARN] {e}")
            continue

        onnx_name = os.path.basename(onnx_rel)
        json_name = os.path.basename(json_rel)
        onnx_url = args.base.rstrip("/") + "/" + onnx_rel
        json_url = args.base.rstrip("/") + "/" + json_rel
        onnx_dst = os.path.join(dest, onnx_name)
        json_dst = os.path.join(dest, json_name)

        try:
            if os.path.exists(onnx_dst) and not args.force:
                print(f"[SKIP] {onnx_name} exists")
            else:
                print(f"Downloading {onnx_name}…")
                _download_to(onnx_dst, onnx_url, expected_md5=onnx_md5 or None)
            if os.path.exists(json_dst) and not args.force:
                print(f"[SKIP] {json_name} exists")
            else:
                print(f"Downloading {json_name}…")
                _download_to(json_dst, json_url, expected_md5=json_md5 or None)
            print(f"[OK] {key}")
            ok += 1
        except Exception as e:
            print(f"[FAIL] {key}: {e}")

        # Be gentle on HF
        time.sleep(0.5)

    print(f"Done. {ok}/{len(args.voice)} voices ready in {dest}")
    return 0 if ok == len(args.voice) else 2


if __name__ == "__main__":
    raise SystemExit(main())
