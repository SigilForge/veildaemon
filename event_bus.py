"""Compatibility shim for EventBus: use veildaemon.event_bus.EventBus.

This file remains temporarily to avoid breaking legacy imports.
"""
import warnings

warnings.warn(
	"event_bus shim is deprecated; import from veildaemon.event_bus instead",
	DeprecationWarning,
	stacklevel=2,
)

from veildaemon.event_bus import *  # noqa: F401,F403
