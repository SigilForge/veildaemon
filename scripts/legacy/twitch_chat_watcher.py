import warnings

warnings.warn(
    "twitch_chat_watcher moved; import veildaemon.apps.watchers.twitch_chat_watcher",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.watchers.twitch_chat_watcher import *  # noqa: F401,F403
