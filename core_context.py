import warnings

if not getattr(__builtins__, "_vd_shim_warned", False):
    warnings.warn(
        "Deprecated: import CoreContext/bootstrap_core from veildaemon.hrm.engine",
        DeprecationWarning,
        stacklevel=2,
    )
    try:
        __builtins__._vd_shim_warned = True  # type: ignore[attr-defined]
    except Exception:
        pass

from veildaemon.hrm.engine import *  # noqa: F401,F403
