"""Compatibility shim for memory: use veildaemon.persona.* or veildaemon.apps.memory.*"""
import warnings

warnings.warn(
	"journal_manager shim is deprecated; import from veildaemon.persona.journal_manager",
	DeprecationWarning,
	stacklevel=2,
)
from veildaemon.persona.journal_manager import *  # noqa: F401,F403
