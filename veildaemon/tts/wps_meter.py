from __future__ import annotations

from collections import defaultdict


class WPSMeter:
    """Exponential moving average of words-per-second.
    - Global EMA via update()/get()
    - Per-backend EMA via update_for()/get_for()
    alpha: smoothing factor in (0,1]; higher = more reactive.
    """

    def __init__(self, alpha: float = 0.3, default_wps: float = 3.5) -> None:
        self.alpha = max(0.01, min(1.0, float(alpha)))
        self._ema_global: float | None = None
        self._ema_by_backend: dict[str, float] = defaultdict(lambda: float(default_wps))

    @staticmethod
    def _count_words(text: str) -> int:
        return len([w for w in (text or "").strip().split() if w])

    def update(self, words: int, seconds: float) -> float:
        if seconds <= 0:
            return float(self._ema_global or 0.0)
        wps = float(words) / float(max(seconds, 1e-6))
        if self._ema_global is None:
            self._ema_global = wps
        else:
            self._ema_global = self.alpha * wps + (1.0 - self.alpha) * self._ema_global
        return self._ema_global

    def get(self) -> float:
        return float(self._ema_global or 0.0)

    def update_for(self, backend: str, words: int, seconds: float) -> float:
        if seconds <= 0:
            return self._ema_by_backend[backend]
        wps = float(words) / float(max(seconds, 1e-6))
        prev = self._ema_by_backend[backend]
        cur = self.alpha * wps + (1.0 - self.alpha) * prev
        self._ema_by_backend[backend] = cur
        return cur

    def get_for(self, backend: str, default: float = 3.5) -> float:
        return float(self._ema_by_backend.get(backend, default))


def clamp_budget_ms(scene: str) -> tuple[int, int]:
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


def cap_for_scene(scene_limits: dict, scene: str, risk: float, beats: list[str]) -> int:
    caps = scene_limits.get(scene, {}).get("cap_ms", {}) if isinstance(scene_limits, dict) else {}
    if risk >= 0.6:
        return int(caps.get("high_risk", 500))
    if isinstance(beats, (list, tuple)) and "dead_air" in beats:
        return int(caps.get("dead_air", 2000))
    return int(caps.get("default", 1200))


def estimate_budget_ms(
    *,
    words: int,
    backend: str,
    scene: str,
    risk: float,
    beats: list[str],
    meter: WPSMeter,
    scene_limits: dict,
    avg_wps: float = 3.5,
    hard_cap_ms: int = 2000,
) -> int:
    tts_wps = meter.get_for(backend, default=avg_wps)
    raw = 250.0 + (avg_wps / max(tts_wps, 0.1)) * float(max(1, words)) * 1000.0
    return int(min(hard_cap_ms, cap_for_scene(scene_limits, scene, float(risk), beats), raw))
