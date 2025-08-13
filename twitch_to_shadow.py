import warnings

warnings.warn(
    "twitch_to_shadow moved; import veildaemon.apps.watchers.twitch_to_shadow",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.watchers.twitch_to_shadow import *  # noqa: F401,F403
