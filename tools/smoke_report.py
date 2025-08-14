#!/usr/bin/env python3
"""
tools/smoke_report.py — SDK + StreamDaemon triage
- Finds your private pack (STREAMDAEMON_PATH or sibling folder guess)
- compileall: syntax errors
- optional ruff: static issues (if installed)
- runs SDK import smoke + optional pack integration probe
- writes JSON + text reports to ./reports/
"""
import os, sys, json, time, compileall, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"; REPORTS.mkdir(exist_ok=True)


def find_pack():
    env = os.environ.get("STREAMDAEMON_PATH")
    if env and Path(env).exists():
        return Path(env)
    guesses = [
        ROOT.parent / "streamdaemon-pack",
        ROOT / "streamdaemon",            # inside repo (ignored by git)
        ROOT.parent / "StreamDaemon",     # you do you
    ]
    for g in guesses:
        if g.exists():
            return g
    return None


def run(cmd, cwd=None, env=None):
    print("$", " ".join(map(str, cmd)))
    return subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True)


def write_report(name, data):
    p = REPORTS / name
    if isinstance(data, (dict, list)):
        p.write_text(json.dumps(data, indent=2), encoding="utf-8")
    else:
        p.write_text(data, encoding="utf-8")
    return str(p)


def triage_compile(paths):
    fails = []
    for p in paths:
        if not p or not p.exists():
            continue
        ok = compileall.compile_dir(str(p), maxlevels=10, quiet=1)
        if not ok:
            fails.append(str(p))
    return fails


def triage_ruff(paths):
    try:
        out = run([sys.executable, "-m", "ruff", "check", *[str(p) for p in paths if p and p.exists()]])
        return {"returncode": out.returncode, "stdout": out.stdout, "stderr": out.stderr}
    except Exception as e:
        return {"returncode": -1, "stdout": "", "stderr": f"ruff not available ({e})"}


def sdk_import_smoke():
    test = ROOT / "veildaemon" / "tests" / "test_imports.py"
    if not test.exists():
        return {"returncode": 0, "stdout": "no test_imports.py", "stderr": ""}
    out = run([sys.executable, str(test)])
    return {"returncode": out.returncode, "stdout": out.stdout, "stderr": out.stderr}


def pack_integration_smoke(pack):
    # minimal probe without pytest dependency
    try:
        sys.path.insert(0, str(pack))
        import importlib
        mod = importlib.import_module("streamdaemon.plugins")
        assert hasattr(mod, "register"), "streamdaemon.plugins.register(app) missing"
        return {"returncode": 0, "stdout": "plugins.register present", "stderr": ""}
    except Exception as e:
        return {"returncode": 1, "stdout": "", "stderr": f"{type(e).__name__}: {e}"}


def main():
    # ensure editable SDK installed
    run([sys.executable, "-m", "pip", "install", "-e", str(ROOT / "veildaemon")])
    pack = find_pack()
    paths = [ROOT / "veildaemon", pack, ROOT / "tools", ROOT / "scripts"]
    comp_fail = triage_compile(paths)
    ruff_res = triage_ruff(paths)
    sdk_smoke = sdk_import_smoke()
    pack_smoke = pack_integration_smoke(pack) if pack else {"returncode": 2, "stderr": "pack not found", "stdout": ""}

    summary = {
        "sdk_import": sdk_smoke["returncode"],
        "pack_integration": pack_smoke["returncode"],
        "compile_fail_dirs": comp_fail,
        "ruff_rc": ruff_res["returncode"],
        "pack_path": str(pack) if pack else None,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    write_report("ruff.txt", ruff_res["stdout"] or ruff_res["stderr"])
    write_report("sdk_smoke.txt", sdk_smoke["stdout"] + "\n" + sdk_smoke["stderr"])
    write_report("pack_smoke.txt", (pack_smoke["stdout"] or "") + "\n" + (pack_smoke["stderr"] or ""))
    write_report("summary.json", summary)
    print(json.dumps(summary, indent=2))
    print(f"Reports in: {REPORTS}")


if __name__ == "__main__":
    main()
