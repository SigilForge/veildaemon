(function () {
  const API_PATH = "/api/alerts/next";
  const FAST_POLL_MS = 1000;
  const IDLE_POLL_MS = 5000;
  const DEEP_IDLE_POLL_MS = 15000;
  const FAST_WINDOW_MS = 30000;
  const DEEP_IDLE_AFTER_MS = 300000;
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get("debug") === "1";
  const debugPoll = params.get("debugPoll") === "1";
  const paused = params.get("paused") === "1" || (debugEnabled && !debugPoll);
  const muted = params.get("mute") === "1";
  const soundTest = params.get("soundtest") === "1";
  const soundTestType = params.get("sound") || "follow";
  const pollOverride = Number(params.get("poll"));
  const forcedPollMs = Number.isFinite(pollOverride) && pollOverride > 0 ? pollOverride : null;
  const volumeOverride = Number(params.get("volume"));
  const requestedVolumeScale = Number.isFinite(volumeOverride) && volumeOverride > 1 ? volumeOverride / 100 : volumeOverride;
  const globalVolumeScale = Number.isFinite(requestedVolumeScale) ? Math.max(0, Math.min(requestedVolumeScale, 1)) : 1;
  const stage = document.querySelector(".alert-stage");
  const card = document.getElementById("alert-card");
  const eyebrow = document.getElementById("alert-eyebrow");
  const headline = document.getElementById("alert-headline");
  const detail = document.getElementById("alert-detail");
  const stamp = document.getElementById("alert-stamp");
  const clock = document.getElementById("alert-time");
  const debugPanel = document.getElementById("debug-panel");
  const debugTestSound = document.getElementById("debug-test-sound");
  const debugFields = {
    apiUrl: document.getElementById("debug-api-url"),
    polling: document.getElementById("debug-polling"),
    interval: document.getElementById("debug-interval"),
    lastPoll: document.getElementById("debug-last-poll"),
    status: document.getElementById("debug-status"),
    error: document.getElementById("debug-error"),
    alert: document.getElementById("debug-alert"),
    display: document.getElementById("debug-display"),
    soundFile: document.getElementById("debug-sound-file"),
    soundLoaded: document.getElementById("debug-sound-loaded"),
    globalVolume: document.getElementById("debug-global-volume"),
    alertVolume: document.getElementById("debug-alert-volume"),
    audioError: document.getElementById("debug-audio-error"),
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
    selectedSoundFile: "",
    soundLoaded: false,
    soundVolume: 0,
    lastAudioError: "",
    display: "idle",
  };
  const activeAudio = new Set();
  const audioBuffers = new Map();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioContext = null;

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
    debugFields.soundFile.textContent = debugValue(state.selectedSoundFile);
    debugFields.soundLoaded.textContent = String(state.soundLoaded);
    debugFields.globalVolume.textContent = muted ? "muted" : String(globalVolumeScale);
    debugFields.alertVolume.textContent = state.selectedSoundFile ? String(state.soundVolume) : "waiting for alert";
    debugFields.audioError.textContent = debugValue(state.lastAudioError);
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

  function soundForAlert(alertType, explicitSoundKey) {
    const config = state.config || {};
    const types = config.types || {};
    const soundConfig = config.sound || {};
    const soundKey = explicitSoundKey || alertType;
    const typeConfig = types[soundKey] || types[alertType] || {};
    const fallback = soundConfig.fallback || {};
    return {
      src: typeConfig.sound && typeConfig.sound.src ? typeConfig.sound.src : fallback.src || "",
      volume: Number(typeConfig.sound && typeConfig.sound.volume !== undefined ? typeConfig.sound.volume : fallback.volume || 0.45),
    };
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
    const sound = soundForAlert(alert.type, alert.soundKey);
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
      soundSrc: alert.soundSrc || sound.src,
      soundVolume: Number(alert.soundVolume !== undefined ? alert.soundVolume : sound.volume),
    };
  }

  async function loadConfig() {
    const response = await fetch("/config/stream-alerts.json", { cache: "no-store" });
    state.config = await response.json();
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
    playSound(alert);

    card.classList.remove("is-active");
    stage.classList.remove("is-active");
    window.requestAnimationFrame(() => {
      card.classList.add("is-active");
      stage.classList.add("is-active");
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

  function playSoundTest() {
    const testAlert = normalizeAlert({ type: soundTestType, id: `soundtest-${Date.now()}` });
    state.lastAlert = testAlert;
    console.log("[VeilCorp alerts] sound test", testAlert);
    playSound(testAlert);
  }

  function getAudioContext() {
    if (!AudioContextClass) return null;
    if (!audioContext) audioContext = new AudioContextClass();
    return audioContext;
  }

  async function loadAudioBuffer(src) {
    if (audioBuffers.has(src)) return audioBuffers.get(src);

    const response = await fetch(`${src}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Sound fetch failed with HTTP ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const context = getAudioContext();
    if (!context) throw new Error("Web Audio is unavailable in this browser.");

    const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
    audioBuffers.set(src, buffer);
    return buffer;
  }

  async function playSound(alert) {
    state.selectedSoundFile = alert.soundSrc || "";
    state.soundVolume = muted ? 0 : Math.max(0, Math.min(Number(alert.soundVolume || 0), 1)) * globalVolumeScale;
    state.soundLoaded = false;
    state.lastAudioError = "";

    if (muted || !state.selectedSoundFile) {
      if (muted) {
        state.lastAudioError = "Muted by ?mute=1";
        console.log("[VeilCorp alerts] sound muted", state.selectedSoundFile);
      }
      updateDebug();
      return;
    }

    if (AudioContextClass) {
      try {
        const context = getAudioContext();
        if (context.state === "suspended") {
          await context.resume();
        }

        const buffer = await loadAudioBuffer(state.selectedSoundFile);
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.value = state.soundVolume;
        source.connect(gain);
        gain.connect(context.destination);
        source.start(0);
        state.soundLoaded = true;
        state.lastAudioError = "";
        console.log("[VeilCorp alerts] web audio playing", {
          src: state.selectedSoundFile,
          volume: state.soundVolume,
          contextState: context.state,
        });
        updateDebug();
        return;
      } catch (error) {
        state.lastAudioError = `Web Audio failed: ${error && error.message ? error.message : String(error)}`;
        console.warn("[VeilCorp alerts] web audio failed; trying HTML audio", state.lastAudioError);
        updateDebug();
      }
    }

    const player = new Audio();
    activeAudio.add(player);

    const cleanup = () => {
      activeAudio.delete(player);
    };

    player.preload = "auto";
    player.muted = false;
    player.volume = state.soundVolume;
    player.src = state.selectedSoundFile;

    player.addEventListener("canplaythrough", () => {
      state.soundLoaded = true;
      updateDebug();
    }, { once: true });
    player.addEventListener("error", () => {
      state.soundLoaded = false;
      state.lastAudioError = `Unable to load ${state.selectedSoundFile}`;
      console.warn("[VeilCorp alerts] sound unavailable", state.selectedSoundFile);
      updateDebug();
      cleanup();
    }, { once: true });
    player.addEventListener("ended", cleanup, { once: true });

    console.log("[VeilCorp alerts] sound play attempt", {
      src: state.selectedSoundFile,
      volume: state.soundVolume,
    });

    try {
      player.load();
    } catch (error) {
      state.lastAudioError = error && error.message ? error.message : String(error);
      console.warn("[VeilCorp alerts] sound load skipped", state.lastAudioError);
    }
    updateDebug();
    player.play()
      .then(() => {
        state.soundLoaded = true;
        console.log("[VeilCorp alerts] sound playing", state.selectedSoundFile);
        updateDebug();
      })
      .catch((error) => {
        state.lastAudioError = error && error.message ? error.message : String(error);
        console.warn("[VeilCorp alerts] sound play failed", state.lastAudioError);
        updateDebug();
        cleanup();
      });
  }

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
      if (soundTest) {
        window.setTimeout(() => {
          playSoundTest();
        }, 750);
      }
      if (debugTestSound) {
        debugTestSound.addEventListener("click", playSoundTest);
      }
      updateDebug();
    });
})();
