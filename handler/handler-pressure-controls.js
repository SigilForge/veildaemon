(function () {
  const api = window.HandlerState;

  function pressureRank(kind, value) {
    if (kind === "scene") return api.sceneStateRank[value] ?? 0;
    if (kind === "attention") return api.attentionStateRank[value] ?? 0;
    return Number(value) || 0;
  }

  function buildManualPressureChange(kind, before, after, extra = {}) {
    const beforeRank = pressureRank(kind, before);
    const afterRank = pressureRank(kind, after);
    const delta = kind === "primary-clock" || kind === "secondary-clock"
      ? Math.max(0, Number(after) - Number(before))
      : Math.max(0, afterRank - beforeRank);
    return {
      kind,
      before,
      after,
      delta,
      clockName: extra.clockName || "",
      label: extra.label || "",
      hint: extra.hint || "Manual Handler adjustment."
    };
  }

  function defaultOperatorIndices(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    return players.map((_, index) => index);
  }

  function applyPressureImmediate(state, change, hooks = {}) {
    const operatorIndices = change?.delta > 0 ? defaultOperatorIndices(state) : [];
    const next = api.applyManualPressureChange(state, change, { operatorIndices });
    const pendingMessage = window.HandlerPendingAlerts?.pendingStatusMessage(next) || "";
    if (typeof hooks.onApplied === "function") {
      hooks.onApplied(next, pendingMessage || "PRESSURE UPDATED");
    }
    return next;
  }

  function requestPressurePreview(state, change, hooks = {}) {
    if (!change || change.delta <= 0) {
      return { state: applyPressureImmediate(state, change, hooks), deferred: false };
    }
    if (window.HandlerTriggers && typeof window.HandlerTriggers.openManualPreview === "function") {
      const opened = window.HandlerTriggers.openManualPreview(change);
      if (opened) return { state, deferred: true };
    }
    return { state: applyPressureImmediate(state, change, hooks), deferred: false };
  }

  function clockSegmentChange(state, trackId, index, clock, clockName) {
    const isPrimary = trackId === "primary-clock-track";
    const kind = isPrimary ? "primary-clock" : "secondary-clock";
    const before = Number(clock.current) || 0;
    const after = index === before ? index - 1 : index;
    const change = buildManualPressureChange(kind, before, after, {
      clockName,
      label: `${clockName || (isPrimary ? "Primary Clock" : "Secondary Clock")} ${after > before ? "ticks" : "winds down"}`,
      hint: "Manual clock adjustment."
    });
    return { change, deferred: change.delta > 0 && Boolean(window.HandlerTriggers?.openManualPreview) };
  }

  function isPressureFieldName(name) {
    return name === "primaryClock.current"
      || name === "secondaryClock.current"
      || name === "attention.current";
  }

  window.HandlerPressureControls = {
    buildManualPressureChange,
    requestPressurePreview,
    applyPressureImmediate,
    clockSegmentChange,
    isPressureFieldName
  };
}());