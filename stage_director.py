"""Compatibility shim for StageDirector: use veildaemon.stage_director.StageDirector.

This file remains temporarily to avoid breaking legacy imports.
"""
import warnings

warnings.warn(
	"stage_director shim is deprecated; import from veildaemon.stage_director instead",
	DeprecationWarning,
	stacklevel=2,
)

from veildaemon.stage_director import *  # noqa: F401,F403
