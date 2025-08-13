"""
Compatibility shim: legacy imports mapped to new TTS manager.

This file remains to avoid breaking older scripts that import `daemon_tts`.
Prefer importing from `veildaemon.tts.manager` directly.
"""

import warnings

warnings.warn(
	"daemon_tts is deprecated; import from veildaemon.tts.manager instead",
	DeprecationWarning,
	stacklevel=2,
)
from veildaemon.tts.manager import *  # noqa: F401,F403
