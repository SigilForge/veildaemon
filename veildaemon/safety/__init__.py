"""Safety primitives: normalize, rewrite, quip bank, span mapping."""

from .normalize import normalize  # noqa: F401
from .quip_bank import QuipBank  # noqa: F401
from .rewrite import Flag, rewrite_safe  # noqa: F401
from .span_map import build_char_map, remap_spans  # noqa: F401

"""Safety modules: normalize, rewrite, span mapping."""
