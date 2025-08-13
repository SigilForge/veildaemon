# wick_db.py
import warnings

warnings.warn(
	"wick_db shim is deprecated; import from veildaemon.apps.api.wick_db",
	DeprecationWarning,
	stacklevel=2,
)
from veildaemon.apps.api.wick_db import *  # noqa: F401,F403
