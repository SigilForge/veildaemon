import warnings

warnings.warn(
    "persona_selector_bound_voice moved; run tools/persona_selector_bound_voice.py",
    DeprecationWarning,
    stacklevel=2,
)
from tools.persona_selector_bound_voice import *  # noqa: F401,F403
