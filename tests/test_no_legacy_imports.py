import pathlib

ROOT = pathlib.Path(".")

def _present(name: str) -> bool:
    return (ROOT / name).exists()


def test_no_root_shims():
    offenders = [n for n in ("event_bus.py","stage_director.py","daemon_tts.py") if _present(n)]
    assert not offenders, f"Legacy root shims present: {offenders}"
