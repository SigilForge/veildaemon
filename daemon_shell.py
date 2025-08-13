import warnings

if not getattr(__builtins__, "_vd_shim_warned", False):
    warnings.warn(
        "Deprecated: run veildaemon.apps.orchestrator.shell instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    try:
        __builtins__._vd_shim_warned = True  # type: ignore[attr-defined]
    except Exception:
        pass

from veildaemon.apps.orchestrator.shell import *  # noqa: F401,F403

if __name__ == "__main__":
    from veildaemon.apps.orchestrator.shell import main as _main
    raise SystemExit(_main())
