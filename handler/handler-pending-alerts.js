(function () {
  const api = window.HandlerState;
  let lastPendingCount = 0;

  function pendingPrompts(state) {
    return (Array.isArray(state?.trackPromptQueue) ? state.trackPromptQueue : [])
      .filter((item) => item.status !== "Resolved");
  }

  function trackLabel(track) {
    return track === "harm" ? "Harm" : "Stability";
  }

  function deltaLabel(delta) {
    const value = Number(delta) || 0;
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}`;
  }

  function promptLine(prompt) {
    const status = prompt.status === "Announced"
      ? "announced — waiting on Operator sheet update"
      : "needs announcement at the table";
    return `${api.safeString(prompt.operatorName, 80)}: ${trackLabel(prompt.track)} ${deltaLabel(prompt.delta)} (${api.safeString(prompt.source, 80)}) — ${status}`;
  }

  function pendingStatusMessage(state) {
    const queue = pendingPrompts(state);
    if (!queue.length) return "";
    const unannounced = queue.filter((item) => item.status === "Pending").length;
    if (unannounced === queue.length) {
      return queue.length === 1
        ? "PENDING: 1 Operator update needs announcement at the table."
        : `PENDING: ${queue.length} Operator updates need announcement at the table.`;
    }
    return `${queue.length} pending — ${unannounced} still need announcement.`;
  }

  function render(state, options = {}) {
    const queue = pendingPrompts(state);
    const count = queue.length;
    const statusNode = document.getElementById("handler-pending-status");
    const banner = document.getElementById("handler-pending-banner");
    const copy = document.getElementById("handler-pending-banner-copy");
    const title = document.getElementById("handler-pending-banner-title");

    if (statusNode) {
      statusNode.textContent = count ? `${count} PENDING` : "CLEAR";
      statusNode.classList.toggle("is-urgent", count > 0);
    }

    if (!banner || !copy) {
      return { count, isNew: false, message: pendingStatusMessage(state) };
    }

    if (!count) {
      banner.hidden = true;
      banner.classList.remove("is-new");
      lastPendingCount = 0;
      return { count: 0, isNew: false, message: "" };
    }

    const isNew = count > lastPendingCount || Boolean(options.forceAlert);
    lastPendingCount = count;
    banner.hidden = false;
    banner.classList.toggle("is-new", isNew);
    if (title) {
      title.textContent = count === 1
        ? "1 Operator update pending at the table"
        : `${count} Operator updates pending at the table`;
    }
    const lines = queue.slice(0, 6).map(promptLine);
    if (queue.length > 6) lines.push(`+${queue.length - 6} more in queue below`);
    copy.textContent = lines.join("\n");

    return { count, isNew, message: pendingStatusMessage(state) };
  }

  function scrollToQueue() {
    const mount = document.getElementById("track-prompt-queue-mount");
    if (mount) mount.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindControls() {
    const jump = document.getElementById("handler-pending-jump");
    if (jump) jump.addEventListener("click", scrollToQueue);
  }

  bindControls();
  window.HandlerPendingAlerts = {
    render,
    scrollToQueue,
    pendingPrompts,
    promptLine,
    pendingStatusMessage
  };
}());