(function () {
  const api = window.HandlerState;
  let pendingTriggerId = "";

  function railNode() {
    return document.getElementById("trigger-rail");
  }

  function previewNode() {
    return document.getElementById("trigger-preview-panel");
  }

  function renderRail(state) {
    const rail = railNode();
    if (!rail) return;
    rail.textContent = "";
    const triggers = api.getTableTriggers(state);
    if (!triggers.length) {
      rail.append(emptyCopy("Apply a Needlepoint template to load table triggers."));
      return;
    }
    triggers.forEach((trigger) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pressure-button pressure-button--worse";
      button.dataset.triggerId = trigger.id;
      button.dataset.clockTarget = trigger.effects?.clock_target || "";
      button.classList.toggle("is-active", trigger.id === pendingTriggerId);
      button.title = trigger.hint ? `${trigger.label} — ${trigger.hint}` : trigger.label;
      button.innerHTML = `<em>${clockTargetLabel(trigger.effects?.clock_target)}</em><strong>${api.safeString(trigger.label, 140)}</strong>`;
      button.addEventListener("click", () => openPreview(trigger.id));
      rail.append(button);
    });
  }

  function clockTargetLabel(target) {
    if (target === "zone") return "Primary";
    if (target === "attention") return "Attention";
    if (target === "case") return "Case";
    if (target === "both") return "Both";
    return "Choice";
  }

  function emptyCopy(message) {
    const line = document.createElement("p");
    line.className = "trigger-empty-copy";
    line.textContent = message;
    return line;
  }

  function openPreview(triggerId) {
    pendingTriggerId = triggerId;
    const state = api.readState();
    const preview = api.previewTableTrigger(state, triggerId);
    const panel = previewNode();
    if (!preview || !panel) return;

    renderRail(state);
    panel.hidden = false;
    const title = panel.querySelector(".trigger-preview-title");
    const lines = panel.querySelector(".trigger-preview-lines");
    if (title) title.textContent = `Apply Trigger: ${preview.trigger.label}?`;
    if (!lines) return;
    lines.textContent = "";
    preview.lines.forEach((row) => {
      if (row.before === row.after) return;
      const item = document.createElement("li");
      item.innerHTML = `<span>${row.label}</span><strong>${row.before} -> ${row.after}</strong>`;
      lines.append(item);
    });
    if (!lines.children.length) {
      const item = document.createElement("li");
      item.innerHTML = "<span>Effect</span><strong>No visible meter change. Residue may still update.</strong>";
      lines.append(item);
    }
  }

  function closePreview() {
    pendingTriggerId = "";
    const panel = previewNode();
    if (panel) panel.hidden = true;
    renderRail(api.readState());
  }

  function applyPending() {
    if (!pendingTriggerId) return;
    const next = api.applyTableTrigger(api.readState(), pendingTriggerId);
    window.dispatchEvent(new CustomEvent("veildaemon:handler-trigger-applied", {
      detail: { triggerId: pendingTriggerId, state: next }
    }));
    closePreview();
  }

  function bindControls() {
    const applyButton = document.getElementById("trigger-apply");
    const cancelButton = document.getElementById("trigger-cancel");
    if (applyButton) applyButton.addEventListener("click", applyPending);
    if (cancelButton) cancelButton.addEventListener("click", closePreview);
  }

  function render(state) {
    renderRail(state || api.readState());
  }

  bindControls();
  render();
  window.addEventListener("veildaemon:handler-state-updated", () => render());
  window.HandlerTriggers = { render, closePreview, applyPending };
}());
