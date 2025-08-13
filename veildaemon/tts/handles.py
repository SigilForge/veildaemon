from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class PlaybackHandle:
    utterance_id: str
    started_at: float
    _task: asyncio.Task | None
    _stopper: Optional[Callable[[], None]] = None

    def cancel(self) -> None:
        # Stop playback if possible, then cancel task
        try:
            if self._stopper:
                self._stopper()
        except Exception:
            pass
        t = self._task
        if t and not t.done():
            t.cancel()


class HandleRegistry:
    def __init__(self) -> None:
        self._by_id: dict[str, PlaybackHandle] = {}
        self._lock = asyncio.Lock()

    async def register(
        self,
        utterance_id: str,
        task: asyncio.Task | None,
        stopper: Optional[Callable[[], None]] = None,
    ) -> PlaybackHandle:
        h = PlaybackHandle(
            utterance_id=utterance_id, started_at=time.perf_counter(), _task=task, _stopper=stopper
        )
        async with self._lock:
            self._by_id[utterance_id] = h
        if task is not None:

            def _done(_):
                asyncio.create_task(self.remove(utterance_id))

            task.add_done_callback(_done)
        return h

    async def remove(self, utterance_id: str) -> None:
        async with self._lock:
            self._by_id.pop(utterance_id, None)

    async def cancel(self, utterance_id: str) -> bool:
        async with self._lock:
            h = self._by_id.get(utterance_id)
        if not h:
            return False
        h.cancel()
        return True
