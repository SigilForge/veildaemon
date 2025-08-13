#!/usr/bin/env python3
import os, shutil
from pathlib import Path

ROOT = Path.cwd()
TRASH = ROOT/".trash"
BIN_EXT = {".png",".jpg",".jpeg",".ico",".exe",".dll",".so",".mp4",".wav",".mp3",".npy",".pt",".onnx",".bin",".db",".gguf",".zip",".7z",".rar"}
IGNORE_DIRS = {".git",".venv","venv","dist","build","__pycache__",".pytest_cache",".mypy_cache"}

TRASH.mkdir(exist_ok=True)

def iter_files():
    for base, dirs, files in os.walk(ROOT):
        # prune trash and ignored dirs
        rel = Path(base).relative_to(ROOT)
        if any(seg in IGNORE_DIRS or seg == ".trash" for seg in rel.parts):
            dirs[:] = []
            continue
        for f in files:
            yield Path(base)/f

moved = []
converted = []

for p in iter_files():
    rel = p.relative_to(ROOT)
    if rel.parts and rel.parts[0] in ("veildaemon","streamdaemon",".github",".vscode","tools","scripts","tests","config",".githooks"):
        pass
    # quarantine big tracked binaries not under models/outputs/data/logs
    if p.suffix.lower() in BIN_EXT and rel.parts[:1] not in (("models",),("outputs",),("data",),("logs",)):
        dst = TRASH/rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(p), str(dst))
        moved.append(str(rel))
        continue
    # normalize EOL for text-y files
    if p.suffix.lower() in (".md",".py",".yml",".yaml",".txt"):
        try:
            s = p.read_text(encoding="utf-8", errors="ignore")
            if "\r\n" in s or "\r" in s:
                p.write_text(s.replace("\r\n","\n").replace("\r","\n"), encoding="utf-8", newline="\n")
                converted.append(str(rel))
        except Exception:
            pass

print({"quarantined": moved[:50], "converted_eol": converted[:100]})
print("NOTE: quarantined files moved to .trash/. Review then delete or relocate to models/outputs/data.")
