import warnings

warnings.warn(
    "glyph_logic moved; import veildaemon.apps.memory.glyph_logic",
    DeprecationWarning,
    stacklevel=2,
)
from veildaemon.apps.memory.glyph_logic import *  # noqa: F401,F403
