#!/usr/bin/env python3
import os, re, io, sys, json, importlib.util
from pathlib import Path

ROOT = Path.cwd()
PACK = ROOT/"streamdaemon"
TOOLS = ROOT/"tools"
ALLOW_IMPORTS = (
    "veildaemon.apps.", "veildaemon.tts.", "veildaemon.hrm.",
    "veildaemon.persona", "veildaemon.apps.safety."
)
LEGACY = [
    (re.compile(r'from\s+event_bus\s+import'), 'from veildaemon.apps.bus.event_bus import'),
    (re.compile(r'\bimport\s+event_bus\b'), 'from veildaemon.apps.bus import event_bus'),
    (re.compile(r'from\s+stage_director\s+import'), 'from veildaemon.apps.stage.stage_director import'),
    (re.compile(r'\bimport\s+stage_director\b'), 'from veildaemon.apps.stage import stage_director'),
    (re.compile(r'from\s+daemon_tts\s+import'), 'from veildaemon.tts.manager import'),
    (re.compile(r'\bimport\s+daemon_tts\b'), 'from veildaemon.tts import manager as daemon_tts'),
]

changed = []
errors = []

def rewrite(path: Path) -> bool:
    s = path.read_text(encoding="utf-8", errors="ignore")
    o = s
    for pat, rep in LEGACY:
        s = pat.sub(rep, s)
    if s != o:
        path.write_text(s, encoding="utf-8", newline="\n")
        changed.append(str(path)); return True
    return False

def ensure_inits(pkg: Path):
    if not pkg.exists(): return
    for base, dirs, files in os.walk(pkg):
        basep = Path(base)
        if not (basep/ "__init__.py").exists():
            (basep / "__init__.py").write_text("", encoding="utf-8")

def bad_imports_in(path: Path) -> list[str]:
    out = []
    try:
        for m in re.findall(r'^\s*(?:from|import)\s+([a-zA-Z0-9_\.]+)', path.read_text(encoding="utf-8", errors="ignore"), flags=re.M):
            if m.startswith(("streamdaemon", "event_bus", "stage_director", "daemon_tts")):
                out.append(m)
            elif not m.startswith(ALLOW_IMPORTS) and m.split('.')[0] in {"veildaemon","streamdaemon"}:
                out.append(m)
    except Exception as e:
        out.append(f"PARSE_ERR:{e}")
    return out

def scan_and_fix_pack(pack_root: Path):
    if not pack_root.exists(): 
        print("[info] no streamdaemon/ found; skipping pack scan"); 
        return
    ensure_inits(pack_root)
    for base, _, files in os.walk(pack_root):
        for f in files:
            p = Path(base)/f
            if p.suffix==".py":
                rewrite(p)
                bad = bad_imports_in(p)
                if bad:
                    errors.append({"file": str(p), "bad_imports": bad})

def scan_tools(tools_root: Path):
    if not tools_root.exists(): 
        print("[info] no tools/ dir; skipping tools scan"); 
        return
    for p in tools_root.glob("*.py"):
        bad = bad_imports_in(p)
        if bad:
            errors.append({"file": str(p), "bad_imports": bad})

scan_and_fix_pack(PACK)
scan_tools(TOOLS)

print(json.dumps({"rewritten_files": changed, "lint_findings": errors}, indent=2))
