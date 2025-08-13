"""Compatibility shim for memory: use veildaemon.persona.* or veildaemon.apps.memory.*"""
import warnings

warnings.warn(
	"task_store shim is deprecated; import from veildaemon.persona.task_store",
	DeprecationWarning,
	stacklevel=2,
)
from veildaemon.persona.task_store import *  # noqa: F401,F403
