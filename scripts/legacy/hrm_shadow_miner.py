import warnings

if not getattr(__builtins__, "_vd_shim_warned", False):
    warnings.warn(
        "Deprecated: run veildaemon.hrm.shadow_miner instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    try:
        __builtins__._vd_shim_warned = True  # type: ignore[attr-defined]
    except Exception:
        pass

from veildaemon.hrm.shadow_miner import *  # noqa: F401,F403
