# wick_obsidian.py
import warnings

warnings.warn(
	"wick_obsidian shim is deprecated; import from veildaemon.apps.api.wick_obsidian",
	DeprecationWarning,
	stacklevel=2,
)
from veildaemon.apps.api.wick_obsidian import *  # noqa: F401,F403
