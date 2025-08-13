"""Compatibility shim: HRMEngine is available at veildaemon.hrm.engine.HRMEngine."""
import warnings

warnings.warn(
    "hrm_engine shim is deprecated; import HRMEngine from veildaemon.hrm.engine",
    DeprecationWarning,
    stacklevel=2,
)

from veildaemon.hrm.engine import *  # noqa: F401,F403
