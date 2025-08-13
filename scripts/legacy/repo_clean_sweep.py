#!/usr/bin/env python3
# repo_clean_sweep.py — nuclear broom for VeilDaemon repo
import os, re, io, sys, shutil, subprocess, json, hashlib, codecs
from pathlib import Path
CWD = Path.cwd()

# ---------- config ----------
DELETE_ROOT_SHIMS_NOW = False  # keep off by default; user can toggle
ALLOW_ROOT = {
  "README.md","ARCHITECTURE.md","NAV.md","CONTRIBUTING.md","LICENSE",
  ".gitignore",".gitattributes",".editorconfig",".vscode",".github",".githooks",
  "tools","scripts","tests","config",".env.example","streamdaemon","veildaemon",
}
TEMP_SHIMS = {"event_bus.py","stage_director.py","daemon_tts.py","journal_manager.py","knowledge_store.py","task_store.py","task_store_sqlite.py"}
BIN_EXT = {".png",".jpg",".jpeg",".ico",".exe",".dll",".so",".mp4",".wav",".mp3",".npy",".pt",".onnx",".bin",".db",".gguf",".zip",".7z",".rar"}
TEXT_EXT = {".md",".py",".yml",".yaml",".txt",".toml",".cfg",".ini"}
IGNORE_DIRS = {".git",".trash",".venv","venv","dist","build","__pycache__",".pytest_cache",".mypy_cache","outputs","models","data","logs","StreamDaemon","packs"}

LEGACY_IMPORTS = [
    (re.compile(r'from\s+event_bus\s+import'), 'from veildaemon.apps.bus.event_bus import'),
    (re.compile(r'\bimport\s+event_bus\b'), 'from veildaemon.apps.bus import event_bus'),
    (re.compile(r'from\s+stage_director\s+import'), 'from veildaemon.apps.stage.stage_director import'),
    (re.compile(r'\bimport\s+stage_director\b'), 'from veildaemon.apps.stage import stage_director'),
    (re.compile(r'from\s+daemon_tts\s+import'), 'from veildaemon.tts.manager import'),
    (re.compile(r'\bimport\s+daemon_tts\b'), 'from veildaemon.tts import manager as daemon_tts'),
]

SCRIPT_MAP = {
  "VeilDaemon_Launcher.py": "scripts/VeilDaemon_Launcher.py",
  "edge_tts_test.py": "scripts/edge_tts_test.py",
  "twitch_refresh_exchange.py": "scripts/twitch_refresh_exchange.py",
  "discover_captioned_channels.py": "scripts/discover_captioned_channels.py",
  "merge_chat_and_captions.py": "scripts/merge_chat_and_captions.py",
  "twitch_to_shadow.py": "scripts/twitch_to_shadow.py",
  "run_veil.bat": "scripts/run_veil.bat",
  "setup_venv_311.bat": "scripts/setup_venv_311.bat",
  "start_workday.bat": "scripts/start_workday.bat",
}

def run(cmd:list[str], check=True):
    print("$", " ".join(cmd))
    return subprocess.run(cmd, check=check)

def git_mv(src:Path, dst:Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        run(["git","mv",str(src),str(dst)])
    except Exception:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))

def normalize_text(path:Path):
    try:
        b = path.read_bytes()
        if b.startswith(codecs.BOM_UTF8):
            b = b[len(codecs.BOM_UTF8):]
        s = b.decode("utf-8","replace").replace("\r\n","\n").replace("\r","\n")
        path.write_text(s, encoding="utf-8", newline="\n")
        return True
    except Exception:
        return False

def rewrite_legacy_imports(path:Path):
    try:
        s = path.read_text(encoding="utf-8", errors="ignore")
        o = s
        for pat, rep in LEGACY_IMPORTS:
            s = pat.sub(rep, s)
        if s != o:
            path.write_text(s, encoding="utf-8", newline="\n")
            return True
    except Exception:
        pass
    return False

def ensure_inits(pkg:Path):
    if not pkg.exists(): return
    for base, dirs, files in os.walk(pkg):
        bp = Path(base)
        init = bp / "__init__.py"
        if not init.exists(): init.write_text("", encoding="utf-8")

trash_dir = CWD/".trash"
trash_dir.mkdir(exist_ok=True)

moved_scripts, trashed, deleted, normalized = [], [], [], []

# root sweep
for item in sorted(CWD.iterdir()):
    name = item.name
    if name in {".",".."}: continue
    if name in ALLOW_ROOT: continue
    if item.is_dir():
        dst = trash_dir/name
        shutil.move(str(item), str(dst))
        trashed.append(f"{name}/"); continue
    if DELETE_ROOT_SHIMS_NOW and name in TEMP_SHIMS:
        run(["git","rm","-f",name])
        deleted.append(name); continue
    if name in SCRIPT_MAP:
        git_mv(item, CWD/ SCRIPT_MAP[name]); moved_scripts.append(f"{name} -> {SCRIPT_MAP[name]}"); continue
    if item.suffix==".py":
        dst = CWD/"scripts"/"misc"/name
        git_mv(item, dst); moved_scripts.append(f"{name} -> scripts/misc/{name}"); continue
    if item.suffix.lower() in {".bat",".ps1",".cmd"}:
        dst = CWD/"scripts"/name
        git_mv(item, dst); moved_scripts.append(f"{name} -> scripts/{name}"); continue
    if item.suffix.lower() in BIN_EXT:
        dst = trash_dir/name
        shutil.move(str(item), str(dst)); trashed.append(name); continue
    if item.suffix.lower() in TEXT_EXT:
        if normalize_text(item): normalized.append(name)
    else:
        dst = trash_dir/name
        shutil.move(str(item), str(dst)); trashed.append(name)

# recurse sweep

def walk_files():
    for base, dirs, files in os.walk(CWD):
        rp = Path(base).relative_to(CWD)
        if any(seg in IGNORE_DIRS for seg in rp.parts):
            dirs[:] = []
        for f in files:
            yield Path(base)/f

more_trashed=[]
for p in walk_files():
    rel = p.relative_to(CWD)
    if p.suffix.lower() in BIN_EXT:
        top = rel.parts[0] if rel.parts else ""
        if top not in ("models","outputs","data","logs",".trash"):
            dst = trash_dir/rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(dst))
            more_trashed.append(str(rel))
    elif p.suffix.lower() in TEXT_EXT:
        normalize_text(p)

# imports and inits
changed=[]
pack = CWD/"streamdaemon"
tools = CWD/"tools"
ensure_inits(pack)
if pack.exists():
    for base, dirs, files in os.walk(pack):
        for f in files:
            pp = Path(base)/f
            if pp.suffix==".py" and rewrite_legacy_imports(pp):
                changed.append(str(pp.relative_to(CWD)))
if tools.exists():
    for p in tools.glob("*.py"):
        if rewrite_legacy_imports(p):
            changed.append(str(p.relative_to(CWD)))

# untrack pack if leaked

def git_ls(patterns:list[str])->list[str]:
    try:
        out = subprocess.check_output(["git","ls-files"]+patterns, text=True).strip().splitlines()
        return [x for x in out if x]
    except Exception:
        return []
leaked = git_ls(["streamdaemon","StreamDaemon","packs"])
if leaked:
    run(["git","rm","-r","--cached","streamdaemon","packs"], check=False)

# NAV + smoke
nav_gen = CWD/"tools"/"gen_nav.py"
if nav_gen.exists():
    run([sys.executable, str(nav_gen)], check=False)
if (CWD/"veildaemon").exists():
    run([sys.executable, "-m", "pip", "install", "-e", "veildaemon"], check=False)

tests = [CWD/"veildaemon"/"tests"/"test_imports.py", CWD/"test_imports.py"]
for t in tests:
    if t.exists():
        run([sys.executable, str(t)], check=False); break

root_clean = CWD/"tests"/"test_root_clean.py"
if root_clean.exists():
    env = os.environ.copy(); env["VD_ENFORCE_ROOT_CLEAN"]="1"
    try:
        subprocess.run([sys.executable,"-m","pytest","-q",str(root_clean)], check=True, env=env)
    except Exception:
        print("[WARN] root clean test failed — fix and rerun")

# stage & commit
subprocess.run(["git","add","-A"], check=False)

diff = subprocess.run(["git","diff","--cached","--name-only"], capture_output=True, text=True)
if diff.stdout.strip():
    subprocess.run(["git","commit","-m","chore(clean): root purge, pack/tools doctor, NAV refresh"], check=False)

print(json.dumps({
  "moved_scripts": moved_scripts,
  "trashed": trashed + more_trashed,
  "deleted_shims": deleted if DELETE_ROOT_SHIMS_NOW else [],
  "normalized_texts": normalized[:20],
  "rewritten_imports": changed,
  "leaked_pack_untracked": bool(leaked)
}, indent=2))
print("\nNOTE: Review .trash/ then delete or relocate assets to models/outputs/data.")
