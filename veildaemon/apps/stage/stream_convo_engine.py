# Placeholder shim while refactor proceeds; real engine lives in StreamDaemon.
# Keep import path valid for smoke tests.

class StreamConvoEngine:  # pragma: no cover - placeholder
    def __init__(self, *args, **kwargs) -> None:
        raise RuntimeError("StreamConvoEngine is part of the StreamDaemon pack; not included in veildaemon core.")
