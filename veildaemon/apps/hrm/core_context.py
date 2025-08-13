"""Core HRM context facade for UI heads.

Re-exports bootstrap_core and CoreContext for canonical imports.
"""
from ...hrm.engine import CoreContext, bootstrap_core  # type: ignore

__all__ = ["CoreContext", "bootstrap_core"]
