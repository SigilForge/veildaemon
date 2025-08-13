"""Lightweight schema guard for utterance plans.

Validates shape and basic types to keep StageDirector robust.
"""
from __future__ import annotations

from typing import Any, Dict, Tuple, Union


FieldType = Union[type, Tuple[type, ...]]
REQUIRED_FIELDS: Dict[str, FieldType] = {
    "utterance_id": str,
    "seq": int,
    "final": bool,
    "priority": int,
    "scene": str,
    "budget_ms": int,
    "expiry_ts": (float, int),
    "safe_mode": str,
    "beats": (list, tuple),
    "text": str,
}


def _is_instance(v: Any, t: FieldType) -> bool:
    if isinstance(t, tuple):
        return isinstance(v, t)
    return isinstance(v, t)


def validate_utterance_plan(plan: Any) -> bool:
    """Return True if plan matches required fields and rudimentary types.

    Any extra keys are allowed; only presence and basic typing are checked.
    """
    if not isinstance(plan, dict):
        return False
    for key, ftype in REQUIRED_FIELDS.items():
        if key not in plan:
            return False
        if not _is_instance(plan.get(key), ftype):
            return False
    return True


__all__ = ["validate_utterance_plan", "REQUIRED_FIELDS"]
