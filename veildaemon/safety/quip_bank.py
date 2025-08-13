import time
from collections import defaultdict, deque
from typing import Dict, List, Optional


class QuipBank:
    def __init__(self, data: Dict[str, Dict[str, List[Dict]]], no_repeat_s: int = 90) -> None:
        self.data = data or {}
        self.no_repeat_s = int(no_repeat_s)
        self._last_used: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=32)
        )  # key -> deque[(ts, idx)]

    def pick(self, scene: str, tone: str, max_words: int | None = None) -> Optional[str]:
        scene = scene or "Gaming"
        tone = tone or "banter"
        items = (self.data.get(scene) or {}).get(tone) or []
        if not items:
            return None
        now = time.monotonic()
        recent = self._last_used[f"{scene}:{tone}"]
        # prune old
        while recent and (now - recent[0][0]) > self.no_repeat_s:
            recent.popleft()
        recent_idxs = {idx for _, idx in recent}
        # pick first not-recent; fallback first
        for i, it in enumerate(items):
            if i not in recent_idxs:
                recent.append((now, i))
                txt = str(it.get("text") or "")
                if max_words and max_words > 0:
                    txt = " ".join(txt.split()[:max_words])
                return txt
        i = 0
        recent.append((now, i))
        txt = str(items[0].get("text") or "")
        if max_words and max_words > 0:
            txt = " ".join(txt.split()[:max_words])
        return txt
