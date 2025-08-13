import warnings

warnings.warn(
    "auto_train_loop moved; run tools/auto_train_loop.py",
    DeprecationWarning,
    stacklevel=2,
)
try:
    from tools.auto_train_loop import *  # noqa: F401,F403
except Exception:
    pass

if __name__ == "__main__":
    try:
        from tools.auto_train_loop import main as _main
        _main()
    except Exception as e:
        raise SystemExit(f"Failed to run tools.auto_train_loop: {e}")
