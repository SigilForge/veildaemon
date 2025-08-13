#!/usr/bin/env python3
import os, re, sys, json, hashlib
from pathlib import Path

ROOT = Path.cwd()
ALLOW_ROOT = {
  "README.md","ARCHITECTURE.md","NAV.md","CONTRIBUTING.md","LICENSE",
  ".gitignore",".gitattributes",".editorconfig",".vscode",".github",".githooks",
  "tools","scripts","tests","config",".env.example","streamdaemon",
  "event_bus.py","stage_director.py","daemon_tts.py",
  "journal_manager.py","knowledge_store.py","task_store.py","task_store_sqlite.py",
}
BIN_EXT = {".png",".jpg",".jpeg",".ico",".exe",".dll",".so",".mp4",".wav",".mp3",".npy",".pt",".onnx",".bin",".db",".gguf",".zip",".7z",".rar"}
IGNORE_DIRS = {".git",".venv","venv","dist","build","__pycache__",".pytest_cache",".mypy_cache","outputs","models","data","logs"}

def iter_files():
    for base, dirs, files in os.walk(ROOT):
        rel = Path(base).relative_to(ROOT)
        if any(seg in IGNORE_DIRS for seg in rel.parts): 
            dirs[:] = []
            continue
        for f in files:
            p = Path(base)/f
            yield p.relative_to(ROOT)

def sha1(p: Path, limit=2_000_000):
    try:
        if p.stat().st_size > limit: return None
        return hashlib.sha1(p.read_bytes()).hexdigest()[:12]
    except Exception:
        return None

root_py = []
bins = []
zeroes = []
conflicts = []
dupes_by_name = {}
dupes_by_hash = {}
bad_crlf = []
for p in iter_files():
    if p.suffix.lower() in BIN_EXT:
        bins.append(str(p)); continue
    if p.name.endswith((".orig",".rej",".bak",".tmp")):
        conflicts.append(str(p))
    if p.is_file() and p.stat().st_size == 0:
        zeroes.append(str(p))
    if p.suffix == ".py" and p.parts[:1] != ("veildaemon",) and p.parts[:1] != ("streamdaemon",):
        if len(p.parts) == 1 and p.name not in ALLOW_ROOT:
            root_py.append(str(p))
    if p.suffix.lower() in (".md",".py",".yaml",".yml"):
        try:
            b = (ROOT/p).read_bytes()
            if b.count(b"\r\n") > 0:
                bad_crlf.append(str(p))
        except Exception:
            pass
    dupes_by_name.setdefault(p.name, []).append(str(p))
    h = sha1(ROOT/p)
    if h: dupes_by_hash.setdefault(h, []).append(str(p))

dupe_names = {k:v for k,v in dupes_by_name.items() if len(v)>1 and not any(k.endswith(ext) for ext in BIN_EXT)}
dupe_hash  = {k:v for k,v in dupes_by_hash.items() if len(v)>1}

print(json.dumps({
  "root_python": root_py[:200],
  "conflicts_tmp": conflicts[:200],
  "zero_byte": zeroes[:200],
  "binaries_tracked": bins[:100],
  "bad_crlf": bad_crlf[:200],
  "dupes_by_name_count": len(dupe_names),
  "dupes_by_name_examples": dict(list(dupe_names.items())[:20]),
  "dupes_exact_hash_count": len(dupe_hash),
  "dupes_exact_hash_examples": list(dupe_hash.values())[:10]
}, indent=2))
