"""VeilDaemon core runtime public package.

Canonical imports live under this namespace, e.g.
- veildaemon.event_bus
- veildaemon.stage_director
- veildaemon.tts
- veildaemon.apps.*
"""

from . import event_bus  # re-export pkg
from . import stage_director  # re-export pkg
from . import tts  # re-export pkg
from . import apps  # re-export pkg
from . import safety  # re-export pkg
from . import persona  # re-export pkg
from . import scenes  # re-export pkg
from . import hrm  # re-export pkg

__all__ = [
    'event_bus',
    'stage_director',
    'tts',
    'apps',
    'safety',
    'persona',
    'scenes',
    'hrm',
]

__version__ = '0.1.0'
