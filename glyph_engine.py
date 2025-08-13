import warnings

warnings.warn(
    "glyph_engine moved; import veildaemon.apps.memory.glyph_engine",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.memory.glyph_engine import *  # noqa: F401,F403
