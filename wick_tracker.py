import warnings

warnings.warn(
    "wick_tracker moved; import veildaemon.apps.api.wick_tracker",
    DeprecationWarning,
    stacklevel=2,
)

from veildaemon.apps.api.wick_tracker import *  # noqa: F401,F403
