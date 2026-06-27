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
    api.windDownMoves.forEach((move) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wind-down-button";
      button.dataset.windDownId = move.id;
      button.classList.toggle("is-active", move.id === pendingMoveId);
      button.title = `${move.label} — ${move.guidance}`;
      const deltaLabel = move.effect === "primary_resolve"
        ? "Set 0"
        : move.delta < 0
          ? `${move.delta}`
          : "Resolve";
      button.innerHTML = `<em>${api.windDownTargetLabel(move.target)} ${deltaLabel}</em><strong>${api.safeString(move.label, 140)}</strong><span>${api.safeString(move.guidance, 260)}</span>`;
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
    const move = api.findWindDownMove(moveId);
    if (!panel || !move) return;

    const current = api.readState();
    const result = api.applyWindDownMove(current, moveId);
    const title = panel.querySelector(".wind-down-preview-title");
    const lines = panel.querySelector(".wind-down-preview-lines");
    if (title) title.textContent = `Apply Wind Down: ${move.label}?`;
    if (!lines) return;

    lines.textContent = "";
    const rows = [];
    if (move.effect === "attention_delta") {
      rows.push({ label: "Attention", before: current.attention.current, after: result.state.attention.current });
    } else if (move.effect === "primary_delta") {
      rows.push({
        label: "Primary Clock",
        before: `${current.primaryClock.current}/${current.primaryClock.segments}`,
        after: `${result.state.primaryClock.current}/${result.state.primaryClock.segments}`
      });
    } else if (move.effect === "primary_resolve") {
      rows.push({
        label: "Primary Clock",
        before: `${current.primaryClock.current}/${current.primaryClock.segments}`,
        after: `0/${result.state.primaryClock.segments}`
      });
    } else if (move.effect === "case_delta") {
      if (current.secondaryClock.enabled) {
        rows.push({
          label: "Case Clock",
          before: `${current.secondaryClock.current}/${current.secondaryClock.segments}`,
          after: `${result.state.secondaryClock.current}/${result.state.secondaryClock.segments}`
        });
      } else {
        rows.push({
          label: "Effect",
          before: "",
          after: "CLEAN CLUE RECORDED — NO CLOCK REDUCED"
        });
      }
    }

    if (!rows.length) {
      rows.push({ label: "Effect", before: "", after: result.message });
    }

    rows.forEach((row) => {
      const item = document.createElement("li");
      if (row.before === "") {
        item.innerHTML = `<span>${api.safeString(row.label, 80)}</span><strong>${api.safeString(row.after, 220)}</strong>`;
      } else {
        item.innerHTML = `<span>${api.safeString(row.label, 80)}</span><strong>${api.safeString(row.before, 80)} -> ${api.safeString(row.after, 80)}</strong>`;
      }
      lines.append(item);
    });

    if (!lines.children.length) {
      const item = document.createElement("li");
      item.innerHTML = "<span>Effect</span><strong>No visible meter change. The scene still updates.</strong>";
      lines.append(item);
    }
    panel.hidden = false;
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
