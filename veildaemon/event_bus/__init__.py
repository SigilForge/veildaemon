import asyncio
from typing import Any, Dict, List, Optional


class EventBus:
    """A tiny async pub/sub with latest snapshot per channel.

    - publish(channel, payload): fan-out to subscribers, update latest
    - subscribe(channel): returns an asyncio.Queue that will receive future events
    - latest(channel): returns the most recent payload or None
    """

    def __init__(self) -> None:
        self._subs: Dict[str, List[asyncio.Queue]] = {}
        self._latest: Dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def publish(self, channel: str, payload: Any) -> None:
        if not channel:
            return
        async with self._lock:
            self._latest[channel] = payload
            subs = list(self._subs.get(channel, []))
        # Don't hold the lock while putting
        for q in subs:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                try:
                    _ = q.get_nowait()
                except Exception:
                    pass
                try:
                    q.put_nowait(payload)
                except Exception:
                    pass

    async def subscribe(self, channel: str, maxsize: int = 32) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=maxsize)
        async with self._lock:
            self._subs.setdefault(channel, []).append(q)
        return q

    async def unsubscribe(self, channel: str, q: asyncio.Queue) -> None:
        async with self._lock:
            arr = self._subs.get(channel)
            if not arr:
                return
            try:
                arr.remove(q)
            except ValueError:
                pass

    async def latest(self, channel: str) -> Optional[Any]:
        async with self._lock:
            return self._latest.get(channel)
