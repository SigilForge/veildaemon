"""Compatibility shim for core_context: import from veildaemon.hrm.engine.

Prefer: from veildaemon.hrm.engine import CoreContext, bootstrap_core
"""
import warnings

warnings.warn(
    "core_context shim is deprecated; import from veildaemon.hrm.engine instead",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.hrm import engine as _hrm_engine  # noqa: F401
CoreContext = _hrm_engine.CoreContext  # type: ignore[attr-defined]
bootstrap_core = _hrm_engine.bootstrap_core  # type: ignore[attr-defined]
