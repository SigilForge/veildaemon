import warnings

warnings.warn(
    "edge_tts_test moved to tools/edge_tts_test.py",
    DeprecationWarning,
    stacklevel=2,
)
from tools.edge_tts_test import *  # noqa: F401,F403
