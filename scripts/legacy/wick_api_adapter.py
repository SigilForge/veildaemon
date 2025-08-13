import warnings

warnings.warn(
    "wick_api_adapter moved; import veildaemon.apps.api.wick_api_adapter",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.api.wick_api_adapter import *  # noqa: F401,F403
