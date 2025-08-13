import warnings

warnings.warn(
    "merge_chat_and_captions moved; run tools/merge_chat_and_captions.py",
    DeprecationWarning,
    stacklevel=2,
)
try:
    from tools.merge_chat_and_captions import *  # noqa: F401,F403
except Exception:
    pass

if __name__ == "__main__":
    try:
        from tools.merge_chat_and_captions import main as _main
        _main()
    except Exception as e:
        raise SystemExit(f"Failed to run tools.merge_chat_and_captions: {e}")
