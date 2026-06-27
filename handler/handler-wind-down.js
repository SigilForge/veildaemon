(function () {
  const api = window.HandlerState;
  let lastStatus = "Awaiting stabilization.";

  function railNode() {
    return document.getElementById("wind-down-rail");
  }

  function statusNode() {
    return document.getElementById("wind-down-status");
  }

  function renderRail() {
    const rail = railNode();
    if (!rail) return;
    rail.textContent = "";
    api.windDownMoves.forEach((move) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wind-down-button";
      button.dataset.windDownId = move.id;
      const deltaLabel = move.effect === "primary_resolve"
        ? "Set 0"
        : move.delta < 0
          ? `${move.delta}`
          : "Resolve";
      button.innerHTML = `<em>${api.windDownTargetLabel(move.target)} ${deltaLabel}</em><strong>${api.safeString(move.label, 140)}</strong><span>${api.safeString(move.guidance, 260)}</span>`;
      button.addEventListener("click", () => applyMove(move.id));
      rail.append(button);
    });
  }

  function renderStatus(message) {
    const node = statusNode();
    if (!node) return;
    node.textContent = message || lastStatus;
  }

  function applyMove(moveId) {
    const current = api.readState();
    const result = api.applyWindDownMove(current, moveId);
    lastStatus = result.message;
    renderStatus(lastStatus);
    window.dispatchEvent(new CustomEvent("veildaemon:handler-wind-down-applied", {
      detail: { moveId, message: result.message, state: result.state }
    }));
  }

  function render() {
    renderRail();
    renderStatus(lastStatus);
  }

  render();
  window.addEventListener("veildaemon:handler-state-updated", () => renderStatus(lastStatus));
  window.HandlerWindDown = { render, applyMove };
}());