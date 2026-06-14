(function () {
  const stage = document.querySelector(".alert-stage");
  const card = document.getElementById("alert-card");
  const eyebrow = document.getElementById("alert-eyebrow");
  const headline = document.getElementById("alert-headline");
  const detail = document.getElementById("alert-detail");
  const stamp = document.getElementById("alert-stamp");
  const clock = document.getElementById("alert-time");
  const sound = document.getElementById("alert-sound");

  const state = {
    config: null,
    queue: [],
    playing: false,
    seen: new Set(),
  };

  function text(template, payload) {
    return String(template || "").replace(/\{(\w+)\}/g, (_, key) => {
      const value = payload[key];
      return value === undefined || value === null || value === "" ? "UNKNOWN" : String(value);
    });
  }

  function nowStamp() {
    return new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function normalizeAlert(alert) {
    const config = state.config || {};
    const types = config.types || {};
    const typeConfig = types[alert.type] || types.follow || {};
    const payload = {
      user: alert.user || alert.username || alert.from || "UNKNOWN OBSERVER",
      count: alert.count || alert.viewers || alert.bits || 1,
      months: alert.months || alert.cumulativeMonths || 1,
      level: alert.level || alert.hypeLevel || 1,
      amount: alert.amount || "UNSPECIFIED SUPPORT",
    };

    return {
      id: alert.id || `${Date.now()}-${Math.random()}`,
      eyebrow: text(alert.eyebrow || typeConfig.eyebrow, payload),
      headline: text(alert.headline || typeConfig.headline, payload),
      detail: text(alert.detail || typeConfig.detail, payload),
      stamp: text(alert.stamp || typeConfig.stamp, payload),
      durationMs: Number(alert.durationMs || config.durationMs || 7200),
    };
  }

  async function loadConfig() {
    const response = await fetch("../../config/stream-alerts.json", { cache: "no-store" });
    state.config = await response.json();

    if (state.config.sound && state.config.sound.enabled && state.config.sound.src) {
      sound.src = state.config.sound.src;
    }
  }

  async function poll() {
    try {
      const response = await fetch("/api/alerts/next", { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.json();
      const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
      alerts.forEach((alert) => {
        const normalized = normalizeAlert(alert);
        if (!state.seen.has(normalized.id)) {
          state.seen.add(normalized.id);
          state.queue.push(normalized);
        }
      });
      playNext();
    } catch (error) {
      console.warn("Alert queue unreachable", error);
    }
  }

  function playNext() {
    if (state.playing || state.queue.length === 0) return;

    const alert = state.queue.shift();
    state.playing = true;
    eyebrow.textContent = alert.eyebrow;
    headline.textContent = alert.headline;
    detail.textContent = alert.detail;
    stamp.textContent = alert.stamp;
    clock.textContent = nowStamp();

    card.classList.remove("is-active");
    stage.classList.remove("is-active");
    window.requestAnimationFrame(() => {
      card.classList.add("is-active");
      stage.classList.add("is-active");
      if (sound.src) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
      }
    });

    window.setTimeout(() => {
      card.classList.remove("is-active");
      stage.classList.remove("is-active");
      state.playing = false;
      window.setTimeout(playNext, 450);
    }, alert.durationMs);
  }

  window.veilAlert = function veilAlert(alert) {
    state.queue.push(normalizeAlert(alert || { type: "follow" }));
    playNext();
  };

  loadConfig()
    .catch((error) => {
      console.warn("Alert config unavailable", error);
      state.config = {};
    })
    .finally(() => {
      poll();
      window.setInterval(poll, Number((state.config && state.config.pollMs) || 1800));
    });
})();
