(function () {
  const API_PATH = "/api/alerts/current";
  const FAST_POLL_MS = 1000;
  const IDLE_POLL_MS = 5000;
  const DEEP_IDLE_POLL_MS = 15000;
  const FAST_WINDOW_MS = 30000;
  const DEEP_IDLE_AFTER_MS = 300000;
  const EFFECT_MS = 1900;
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get("debug") === "1";
  const paused = params.get("paused") === "1";
  const testType = params.get("test");
  const pollOverride = Number(params.get("poll"));
  const forcedPollMs = Number.isFinite(pollOverride) && pollOverride > 0 ? pollOverride : null;
  const stage = document.querySelector(".fx-stage");
  const stamp = document.getElementById("fx-stamp");
  const debugPanel = document.getElementById("fx-debug");
  const debugFields = {
    api: document.getElementById("fx-debug-api"),
    polling: document.getElementById("fx-debug-polling"),
    status: document.getElementById("fx-debug-status"),
    lastPoll: document.getElementById("fx-debug-last-poll"),
    alert: document.getElementById("fx-debug-alert"),
    effect: document.getElementById("fx-debug-effect"),
    error: document.getElementById("fx-debug-error"),
  };

  const state = {
    queue: [],
    seen: new Set(),
    playing: false,
    pollTimer: null,
    pollInFlight: false,
    startedAt: Date.now(),
    lastAlertAt: null,
    currentPollInterval: paused ? 0 : forcedPollMs || FAST_POLL_MS,
    lastStatus: "pending",
    lastPoll: "never",
    lastAlert: null,
    lastEffect: "idle",
    lastError: "",
  };

  if (debugEnabled && debugPanel) {
    debugPanel.hidden = false;
  }

  function debugValue(value) {
    if (value === undefined || value === null || value === "") return "none";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  function apiUrl() {
    return `${API_PATH}?client=fx&holdMs=9000&maxAgeMs=120000&ts=${Date.now()}`;
  }

  function updateDebug() {
    if (!debugEnabled) return;
    debugFields.api.textContent = apiUrl();
    debugFields.polling.textContent = String(!paused);
    debugFields.status.textContent = String(state.lastStatus);
    debugFields.lastPoll.textContent = state.lastPoll;
    debugFields.alert.textContent = debugValue(state.lastAlert);
    debugFields.effect.textContent = state.lastEffect;
    debugFields.error.textContent = debugValue(state.lastError);
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
    if (paused) {
      state.currentPollInterval = 0;
      updateDebug();
      console.log("[VeilCorp alert FX] polling paused");
      return;
    }

    if (state.pollTimer) {
      window.clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }

    const delay = Number.isFinite(delayMs) ? delayMs : getCurrentPollInterval();
    state.currentPollInterval = delay;
    updateDebug();
    state.pollTimer = window.setTimeout(() => {
      state.pollTimer = null;
      poll();
    }, delay);
  }

  function normalizeType(type) {
    const raw = String(type || "generic").toLowerCase();
    if (raw.includes("gift")) return "gift-sub";
    if (raw.includes("hype_train") || raw.includes("hype-train")) return "hype-train";
    if (raw === "cheer") return "bits";
    if (raw === "tip") return "donation";
    return raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "generic";
  }

  function stampFor(type) {
    const normalized = normalizeType(type);
    const labels = {
      follow: "OBSERVER DETECTED",
      sub: "CLEARANCE UPGRADED",
      resub: "CONTINUITY CONFIRMED",
      "subscription-message": "CONTINUITY CONFIRMED",
      "gift-sub": "EXPOSURE TRANSFERRED",
      raid: "MASS ARRIVAL EVENT",
      bits: "SIGNAL OFFERING",
      "hype-train": "CASCADE RISING",
      donation: "FIELD FUNDING RECEIVED",
    };
    return labels[normalized] || "ATTENTION EVENT DETECTED";
  }

  function enqueue(alert) {
    const record = {
      id: alert.id || `fx-${Date.now()}-${Math.random()}`,
      type: alert.type || "generic",
      user: alert.user || alert.username || "",
      createdAt: alert.createdAt || new Date().toISOString(),
    };

    if (state.seen.has(record.id)) return;
    state.seen.add(record.id);
    state.queue.push(record);
    state.lastAlert = record;
    state.lastAlertAt = Date.now();
    console.log("[VeilCorp alert FX] received alert", record);
    updateDebug();
    playNext();
  }

  async function poll() {
    if (paused) {
      scheduleNextPoll();
      return;
    }

    if (state.pollInFlight) {
      scheduleNextPoll();
      return;
    }

    const url = apiUrl();
    state.pollInFlight = true;
    state.lastPoll = new Date().toISOString();
    state.lastError = "";
    updateDebug();
    console.log("[VeilCorp alert FX] polling", url);

    try {
      const response = await fetch(url, { cache: "no-store" });
      state.lastStatus = response.status;
      updateDebug();
      if (!response.ok) {
        state.lastError = `HTTP ${response.status}`;
        return;
      }

      const payload = await response.json();
      const alerts = payload.alert ? [payload.alert] : [];
      alerts.forEach(enqueue);
    } catch (error) {
      state.lastError = error && error.message ? error.message : String(error);
      state.lastStatus = "error";
      console.warn("[VeilCorp alert FX] feed unavailable", error);
      updateDebug();
    } finally {
      state.pollInFlight = false;
      scheduleNextPoll();
    }
  }

  function clearEffectClasses() {
    Array.from(stage.classList)
      .filter((name) => name === "is-firing" || name.startsWith("fx-"))
      .forEach((name) => stage.classList.remove(name));
  }

  function playNext() {
    if (state.playing || state.queue.length === 0) return;

    const alert = state.queue.shift();
    const type = normalizeType(alert.type);
    state.playing = true;
    state.lastEffect = type;
    stamp.textContent = stampFor(alert.type);
    clearEffectClasses();
    window.requestAnimationFrame(() => {
      stage.classList.add(`fx-${type}`, "is-firing");
      updateDebug();
    });

    window.setTimeout(() => {
      clearEffectClasses();
      state.playing = false;
      state.lastEffect = state.queue.length > 0 ? "queued" : "idle";
      updateDebug();
      window.setTimeout(playNext, 180);
    }, EFFECT_MS);
  }

  window.veilAlertFx = function veilAlertFx(alert) {
    enqueue(alert || { type: "follow" });
  };

  if (testType) {
    window.setTimeout(() => {
      enqueue({ type: testType, user: "FX_TEST", id: `fx-test-${Date.now()}` });
    }, 500);
  }

  if (paused) {
    state.lastEffect = "paused";
    updateDebug();
  } else {
    poll();
  }
})();
