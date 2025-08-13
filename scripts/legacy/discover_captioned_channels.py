import warnings

warnings.warn(
    "discover_captioned_channels moved; import veildaemon.apps.watchers.discover_captioned_channels",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.watchers.discover_captioned_channels import *  # noqa: F401,F403
