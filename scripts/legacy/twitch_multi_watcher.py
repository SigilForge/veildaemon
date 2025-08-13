import warnings

warnings.warn(
    "twitch_multi_watcher moved; import veildaemon.apps.watchers.twitch_multi_watcher",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.watchers.twitch_multi_watcher import *  # noqa: F401,F403
