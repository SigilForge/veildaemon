"""Compatibility shim for pack loader: import from veildaemon.apps.packs.pack_loader."""
import warnings

warnings.warn(
    "pack_loader moved; import veildaemon.apps.packs.pack_loader",
    DeprecationWarning,
    stacklevel=2,
)

from veildaemon.apps.packs.pack_loader import *  # noqa: F401,F403
