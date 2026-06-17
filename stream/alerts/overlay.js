(function () {
  const API_PATH = "/api/alerts/next";
  const FAST_POLL_MS = 1000;
  const IDLE_POLL_MS = 5000;
  const DEEP_IDLE_POLL_MS = 15000;
  const FAST_WINDOW_MS = 30000;
  const DEEP_IDLE_AFTER_MS = 300000;
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get("debug") === "1";
  const paused = params.get("paused") === "1";
  const pollOverride = Number(params.get("poll"));
  const forcedPollMs = Number.isFinite(pollOverride) && pollOverride > 0 ? pollOverride : null;
  const stage = document.querySelector(".alert-stage");
  const card = document.getElementById("alert-card");
  const eyebrow = document.getElementById("alert-eyebrow");
  const headline = document.getElementById("alert-headline");
  const detail = document.getElementById("alert-detail");
  const stamp = document.getElementById("alert-stamp");
  const clock = document.getElementById("alert-time");
  const sound = document.getElementById("alert-sound");
  const debugPanel = document.getElementById("debug-panel");
  const debugFields = {
    apiUrl: document.getElementById("debug-api-url"),
    polling: document.getElementById("debug-polling"),
    interval: document.getElementById("debug-interval"),
    lastPoll: document.getElementById("debug-last-poll"),
    status: document.getElementById("debug-status"),
    error: document.getElementById("debug-error"),
    alert: document.getElementById("debug-alert"),
    display: document.getElementById("debug-display"),
  };

  const state = {
    config: null,
    queue: [],
    playing: false,
    polling: false,
    pollInFlight: false,
    pollTimer: null,
    startedAt: Date.now(),
    lastAlertAt: null,
    currentPollInterval: paused ? 0 : forcedPollMs || FAST_POLL_MS,
    paused,
    seen: new Set(),
    lastAlert: null,
    lastError: "",
    lastStatus: "pending",
    lastPoll: "never",
    display: "idle",
  };

  if (debugEnabled && debugPanel) {
    debugPanel.hidden = false;
  }

  function debugValue(value) {
    if (value === undefined || value === null || value === "") return "none";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  function setDisplay(display) {
    state.display = display;
    updateDebug();
  }

  function updateDebug() {
    if (!debugEnabled) return;
    debugFields.apiUrl.textContent = `${API_PATH}?ts=${Date.now()}`;
    debugFields.polling.textContent = String(!state.paused);
    debugFields.interval.textContent = state.paused ? "paused" : `${state.currentPollInterval}ms`;
    debugFields.lastPoll.textContent = state.lastPoll;
    debugFields.status.textContent = String(state.lastStatus);
    debugFields.error.textContent = debugValue(state.lastError);
    debugFields.alert.textContent = debugValue(state.lastAlert);
    debugFields.display.textContent = state.display;
  }

  function getCurrentPollInterval() {
    if (forcedPollMs) return forcedPollMs;

    const now = Date.now();
    const lastActivityAt = state.lastAlertAt || state.startedAt;
    if (now - state.startedAt < FAST_WINDOW_MS) return FAST_POLL_MS;
    if (now - lastActivityAt < FAST_WINDOW_MS) return FAST_POLL_MS;
    if (now - lastActivityAt < DEEP_IDLE_AFTER_MS) return IDLE_POLL_MS;
    return DEEP_IDLE_POLL_MS;
  }

  function scheduleNextPoll(delayMs) {
    if (state.paused) {
      state.polling = false;
      state.currentPollInterval = 0;
      updateDebug();
      console.log("[VeilCorp alerts] polling paused");
      return;
    }

    if (state.pollTimer) {
      window.clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }

    const delay = Number.isFinite(delayMs) ? delayMs : getCurrentPollInterval();
    state.currentPollInterval = delay;
    updateDebug();
    console.log("[VeilCorp alerts] next poll scheduled", { delay });
    state.pollTimer = window.setTimeout(() => {
      state.pollTimer = null;
      poll();
    }, delay);
  }

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
    const response = await fetch("/config/stream-alerts.json", { cache: "no-store" });
    state.config = await response.json();

    if (state.config.sound && state.config.sound.enabled && state.config.sound.src) {
      sound.src = state.config.sound.src;
    }
  }

  async function poll() {
    if (state.paused) {
      scheduleNextPoll();
      return;
    }

    if (state.pollInFlight) {
      console.log("[VeilCorp alerts] poll skipped; request already in flight");
      scheduleNextPoll();
      return;
    }

    const apiUrl = `${API_PATH}?ts=${Date.now()}`;
    state.polling = true;
    state.pollInFlight = true;
    state.lastPoll = new Date().toISOString();
    state.lastError = "";
    updateDebug();
    console.log("[VeilCorp alerts] polling", apiUrl);

    try {
      const response = await fetch("/api/alerts/next?ts=" + Date.now(), { cache: "no-store" });
      state.lastStatus = response.status;
      updateDebug();
      if (!response.ok) {
        state.lastError = `HTTP ${response.status}`;
        console.warn("[VeilCorp alerts] poll failed", response.status);
        updateDebug();
        return;
      }

      const payload = await response.json();
      const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
      console.log("[VeilCorp alerts] poll response", {
        status: response.status,
        alerts: alerts.length,
        diagnostics: payload.diagnostics || null,
      });

      alerts.forEach((alert) => {
        const normalized = normalizeAlert(alert);
        if (!state.seen.has(normalized.id)) {
          state.seen.add(normalized.id);
          state.queue.push(normalized);
          state.lastAlert = normalized;
          state.lastAlertAt = Date.now();
          console.log("[VeilCorp alerts] received alert", normalized);
        }
      });
      if (alerts.length > 0) {
        updateDebug();
      }
      playNext();
    } catch (error) {
      state.lastError = error && error.message ? error.message : String(error);
      state.lastStatus = "error";
      updateDebug();
      console.warn("Alert queue unreachable", error);
    } finally {
      state.polling = false;
      state.pollInFlight = false;
      scheduleNextPoll();
    }
  }

  function playNext() {
    if (state.playing || state.queue.length === 0) return;

    const alert = state.queue.shift();
    state.playing = true;
    setDisplay(`playing ${alert.id}`);
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
      setDisplay(state.queue.length > 0 ? "queued" : "idle");
      window.setTimeout(playNext, 450);
    }, alert.durationMs);
  }

  window.veilAlert = function veilAlert(alert) {
    const normalized = normalizeAlert(alert || { type: "follow" });
    state.queue.push(normalized);
    state.lastAlert = normalized;
    state.lastAlertAt = Date.now();
    console.log("[VeilCorp alerts] manual alert", normalized);
    updateDebug();
    playNext();
  };

  loadConfig()
    .catch((error) => {
      console.warn("Alert config unavailable", error);
      state.config = {};
    })
    .finally(() => {
      if (state.paused) {
        setDisplay("paused");
      } else {
        poll();
      }
      updateDebug();
    });
})();
