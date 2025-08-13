"""HRM Engine and CoreContext moved under veildaemon.hrm.

This module gathers HRMEngine from root hrm_engine, and CoreContext
from root core_context for canonical imports: veildaemon.hrm.engine.
"""
from typing import Any

try:
    # try local package if already split
    from ._engine_impl import HRMEngine  # type: ignore
except Exception:
    from hrm_engine import HRMEngine  # type: ignore

try:
    from ._core_context_impl import CoreContext, bootstrap_core  # type: ignore
except Exception:
    from core_context import CoreContext, bootstrap_core  # type: ignore

__all__ = ["HRMEngine", "CoreContext", "bootstrap_core"]
