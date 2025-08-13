import warnings

warnings.warn(
    "twitch_vtt_watcher moved; import veildaemon.apps.watchers.twitch_vtt_watcher",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.watchers.twitch_vtt_watcher import *  # noqa: F401,F403
