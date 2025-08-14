from . import __version__


def main() -> int:
    print(f"veildaemon {__version__}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
