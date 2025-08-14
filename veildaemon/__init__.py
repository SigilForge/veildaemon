"""VeilDaemon core runtime public package.

Canonical imports live under this namespace, e.g.
- veildaemon.event_bus
- veildaemon.stage_director
- veildaemon.tts
- veildaemon.apps.*
"""

from . import (  # re-export pkgs
    apps,
    event_bus,
    hrm,
    persona,
    safety,
    scenes,
    stage_director,
    tts,
)

__all__ = [
    "apps",
    "event_bus",
    "hrm",
    "persona",
    "safety",
    "scenes",
    "stage_director",
    "tts",
]

# Optional: package version for quick introspection / CLI printing
try:  # Prefer installed metadata to avoid drifting from pyproject
    from importlib.metadata import version as _pkg_version  # Python 3.11+

    __version__ = _pkg_version("veildaemon")
except Exception:  # pragma: no cover - during editable/dev, fallback to declared version
    __version__ = "0.0.4"
