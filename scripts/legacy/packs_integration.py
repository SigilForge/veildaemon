"""Compatibility shim for packs integration: import veildaemon.apps.packs.packs_integration."""
import warnings

warnings.warn(
    "packs_integration moved; import veildaemon.apps.packs.packs_integration",
    DeprecationWarning,
    stacklevel=2,
)

from veildaemon.apps.packs.packs_integration import *  # noqa: F401,F403
