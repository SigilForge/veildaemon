import warnings

warnings.warn(
    "cleanup moved; run tools/cleanup.py",
    DeprecationWarning,
    stacklevel=2,
)
try:
    from tools.cleanup import *  # noqa: F401,F403
except Exception:
    pass

if __name__ == "__main__":
    try:
        from tools.cleanup import main as _main
        _main()
    except Exception as e:
        raise SystemExit(f"Failed to run tools.cleanup: {e}")
