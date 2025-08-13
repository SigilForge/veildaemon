import warnings

warnings.warn(
    "persona_selector moved; run tools/persona_selector.py",
    DeprecationWarning,
    stacklevel=2,
)
from tools.persona_selector import *  # noqa: F401,F403
