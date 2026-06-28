(function () {
  const api = window.HandlerState;
  let lastStatus = "Awaiting stabilization.";
  let pendingMoveId = "";

  function railNode() {
    return document.getElementById("wind-down-rail");
  }

  function statusNode() {
    return document.getElementById("wind-down-status");
  }

  function previewNode() {
    return document.getElementById("wind-down-preview-panel");
  }

  function renderRail() {
    const rail = railNode();
    if (!rail) return;
    rail.textContent = "";
    api.getWindDownMoves(api.readState()).forEach((move) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "trigger-button";
      button.dataset.windDownId = move.id;
      button.classList.toggle("is-active", move.id === pendingMoveId);
      button.title = `${move.label} - ${move.guidance}`;
      button.innerHTML = `<em>${api.windDownTargetLabel(move.target)}</em><strong>${api.safeString(move.label, 140)}</strong>`;
      button.addEventListener("click", () => openPreview(move.id));
      rail.append(button);
    });
  }

  function renderStatus(message) {
    const node = statusNode();
    if (!node) return;
    node.textContent = message || lastStatus;
  }

  function renderPreview(moveId) {
    const panel = previewNode();
    const preview = api.previewWindDownMove ? api.previewWindDownMove(api.readState(), moveId) : null;
    if (!panel || !preview) return;

    panel.hidden = false;
    const title = panel.querySelector(".trigger-preview-title");
    const lines = panel.querySelector(".trigger-preview-lines");
    if (title) title.textContent = `Apply Wind Down: ${preview.move.label}?`;
    if (!lines) return;

    lines.textContent = "";
    preview.lines.forEach((row) => {
      const item = document.createElement("li");
      if (row.before === "") {
        item.innerHTML = `<span>${api.safeString(row.label, 80)}</span><strong>${api.safeString(row.after, 220)}</strong>`;
      } else {
        item.innerHTML = `<span>${api.safeString(row.label, 80)}</span><strong>${api.safeString(row.before, 80)} -> ${api.safeString(row.after, 80)}</strong>`;
      }
      lines.append(item);
    });
  }

  function openPreview(moveId) {
    pendingMoveId = moveId;
    renderRail();
    renderPreview(moveId);
  }

  function closePreview() {
    pendingMoveId = "";
    const panel = previewNode();
    if (panel) panel.hidden = true;
    renderRail();
  }

  function applyMove() {
    if (!pendingMoveId) return;
    const result = api.applyWindDownMove(api.readState(), pendingMoveId);
    lastStatus = result.message;
    renderStatus(lastStatus);
    window.dispatchEvent(new CustomEvent("veildaemon:handler-wind-down-applied", {
      detail: { moveId: pendingMoveId, message: result.message, state: result.state }
    }));
    closePreview();
  }

  function render() {
    renderRail();
    renderStatus(lastStatus);
    const panel = previewNode();
    if (panel) {
      const applyButton = panel.querySelector("#wind-down-apply");
      const cancelButton = panel.querySelector("#wind-down-cancel");
      if (applyButton && !applyButton.dataset.bound) {
        applyButton.dataset.bound = "1";
        applyButton.addEventListener("click", applyMove);
      }
      if (cancelButton && !cancelButton.dataset.bound) {
        cancelButton.dataset.bound = "1";
        cancelButton.addEventListener("click", closePreview);
      }
    }
  }

  render();
  window.addEventListener("veildaemon:handler-state-updated", () => {
    renderRail();
    if (pendingMoveId) renderPreview(pendingMoveId);
    renderStatus(lastStatus);
  });
  window.HandlerWindDown = { render, applyMove };
}());
