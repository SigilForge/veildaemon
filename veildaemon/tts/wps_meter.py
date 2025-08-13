from __future__ import annotations

class WPSMeter:
    """Exponential moving average of words-per-second.
    alpha: smoothing factor in (0,1]; higher = more reactive.
    """

    def __init__(self, alpha: float = 0.3) -> None:
        self.alpha = max(0.01, min(1.0, float(alpha)))
        self._ema = None  # type: float | None

    @staticmethod
    def _count_words(text: str) -> int:
        return len([w for w in (text or "").strip().split() if w])

    def update(self, words: int, seconds: float) -> float:
        if seconds <= 0:
            return self._ema or 0.0
        wps = float(words) / float(seconds)
        if self._ema is None:
            self._ema = wps
        else:
            self._ema = self.alpha * wps + (1.0 - self.alpha) * self._ema
        return self._ema

    def get(self) -> float:
        return float(self._ema or 0.0)


def clamp_budget_ms(scene: str) -> tuple[int,int]:
    """Return (min_ms, max_ms) budget bounds for a scene.
    Scenes: karaoke, game, react, chat, boss.
    """
    s = (scene or "").lower()
    if s == "karaoke":
        return (400, 700)
    if s == "game":
        return (600, 1200)
    if s in ("react", "chat"):
        return (1200, 2000)
    if s in ("boss", "high-risk", "high_risk"):
        return (300, 500)
    # default conservative
    return (800, 1500)
