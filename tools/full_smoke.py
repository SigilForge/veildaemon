import os, sys, subprocess, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def run(cmd, env=None):
    print("$", " ".join(map(str, cmd)))
    return subprocess.run(cmd, env=env, check=False)


def main():
    env = os.environ.copy()
    # Ensure local editable install is used
    run([sys.executable, "-m", "pip", "install", "-e", str(ROOT / "veildaemon")], env=env)

    # Optional Ruff lint (SDK only); skip cleanly if not installed
    def run_or_skip_ruff(root: pathlib.Path) -> int:
        try:
            out = subprocess.run(
                [sys.executable, "-m", "ruff", "check", str(root / "veildaemon")],
                check=False,
                text=True,
                capture_output=True,
            )
            print(out.stdout or out.stderr)
            return out.returncode
        except Exception:
            print("[info] Ruff not installed; skipping lint.")
            return 0

    lint_rc = run_or_skip_ruff(ROOT)

    # SDK import smoke
    r1 = run([sys.executable, str(ROOT / "veildaemon" / "tests" / "test_imports.py")], env=env)

    # Root clean test (enforced)
    env["VD_ENFORCE_ROOT_CLEAN"] = "1"
    r2 = run([sys.executable, "-m", "pytest", "-q", str(ROOT / "tests" / "test_root_clean.py")], env=env)

    # Integration smoke (optional; will fail if pack not on PYTHONPATH)
    r3 = run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            str(ROOT / "tests" / "integration" / "test_streamdaemon_plugin.py"),
        ],
        env=env,
    )

    code = 0 if (lint_rc == 0 and r1.returncode == r2.returncode == r3.returncode == 0) else 1
    print(
        json.dumps(
            {
                "lint": lint_rc,
                "sdk_import": r1.returncode,
                "root_clean": r2.returncode,
                "pack_integration": r3.returncode,
            },
            indent=2,
        )
    )
    raise SystemExit(code)


if __name__ == "__main__":
    main()
