import warnings

warnings.warn(
    "twitch_auth moved; import veildaemon.apps.watchers.twitch_auth",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.watchers.twitch_auth import *  # noqa: F401,F403
