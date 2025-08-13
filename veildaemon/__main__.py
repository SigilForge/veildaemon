"""Package entrypoint: runs the console shell."""

from veildaemon.apps.orchestrator.shell import main

if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
