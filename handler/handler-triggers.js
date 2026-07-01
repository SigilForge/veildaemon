(function () {
  const api = window.HandlerState;
  let pendingTriggerId = "";
  let pendingOperatorIndices = new Set();

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
      button.className = "trigger-button";
      button.dataset.triggerId = trigger.id;
      button.dataset.clockTarget = trigger.effects?.clock_target || "";
      button.classList.toggle("is-active", trigger.id === pendingTriggerId);
      button.title = trigger.hint ? `${trigger.label} — ${trigger.hint}` : trigger.label;
      button.innerHTML = `<em>${clockTargetLabel(trigger.effects?.clock_target)}</em><strong>${api.safeString(trigger.label, 140)}</strong>`;
      button.addEventListener("click", () => openPreview(trigger.id));
      rail.append(button);
    });
    renderUndoBanner(state);
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

  function defaultOperatorIndices(state) {
    const players = Array.isArray(state.players) ? state.players : [];
    return players.map((_, index) => index);
  }

  function renderOperatorPicker(state, stabilityCost) {
    const announce = document.getElementById("trigger-stability-announce");
    const breakdown = document.getElementById("trigger-stability-breakdown");
    const chips = document.getElementById("trigger-operator-chips");
    const picker = document.getElementById("trigger-operator-picker");
    if (!picker || !chips) return;

    const players = Array.isArray(state.players) ? state.players : [];
    if (!stabilityCost?.damage || !players.length) {
      picker.hidden = true;
      if (announce) announce.textContent = "";
      if (breakdown) {
        breakdown.hidden = true;
        breakdown.textContent = "";
      }
      chips.textContent = "";
      pendingOperatorIndices = new Set();
      return;
    }

    picker.hidden = false;
    if (announce) {
      announce.textContent = stabilityCost.announce || `When this happens, characters in the area take ${stabilityCost.damage} Stability damage.`;
    }
    if (breakdown) {
      const text = api.safeString(stabilityCost.breakdownText, 800);
      if (text) {
        breakdown.hidden = false;
        breakdown.textContent = text;
      } else {
        breakdown.hidden = true;
        breakdown.textContent = "";
      }
    }

    if (!pendingOperatorIndices.size) {
      defaultOperatorIndices(state).forEach((index) => pendingOperatorIndices.add(index));
    }

    chips.textContent = "";
    chips.setAttribute("aria-label", "Who takes Stability damage");
    players.forEach((player, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "trigger-operator-chip";
      chip.dataset.operatorIndex = String(index);
      const selected = pendingOperatorIndices.has(index);
      chip.classList.toggle("is-selected", selected);
      chip.setAttribute("aria-pressed", selected ? "true" : "false");
      chip.textContent = api.safeString(player.name, 80) || `Operator ${index + 1}`;
      chip.addEventListener("click", () => {
        if (pendingOperatorIndices.has(index)) pendingOperatorIndices.delete(index);
        else pendingOperatorIndices.add(index);
        renderOperatorPicker(state, stabilityCost);
      });
      chips.append(chip);
    });

    let helper = picker.querySelector(".trigger-operator-helper");
    if (!helper) {
      helper = document.createElement("p");
      helper.className = "trigger-operator-helper";
      picker.append(helper);
    }
    helper.textContent = "Selected = in area. Tap to exclude.";
  }

  function renderUndoBanner(state) {
    const banner = document.getElementById("trigger-undo-banner");
    const copy = document.getElementById("trigger-table-copy");
    const label = document.getElementById("trigger-undo-label");
    if (!banner) return;
    const pkg = state?.triggerUndo;
    if (!pkg?.snapshot) {
      banner.hidden = true;
      if (copy) copy.textContent = "";
      if (label) label.textContent = "";
      return;
    }
    banner.hidden = false;
    if (label) label.textContent = `Last trigger: ${api.safeString(pkg.triggerLabel, 140) || "Applied"}`;
    if (copy) copy.textContent = api.safeString(pkg.tableCopy, 2000) || "Trigger applied.";
  }

  function openPreview(triggerId) {
    pendingTriggerId = triggerId;
    pendingOperatorIndices = new Set();
    const state = api.readState();
    const preview = api.previewTableTrigger(state, triggerId);
    const panel = previewNode();
    if (!preview || !panel) return;

    defaultOperatorIndices(state).forEach((index) => pendingOperatorIndices.add(index));
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
    renderOperatorPicker(state, preview.stabilityCost);
  }

  function closePreview() {
    pendingTriggerId = "";
    pendingOperatorIndices = new Set();
    const panel = previewNode();
    if (panel) panel.hidden = true;
    const picker = document.getElementById("trigger-operator-picker");
    if (picker) picker.hidden = true;
    renderRail(api.readState());
  }

  function applyPending() {
    if (!pendingTriggerId) return;
    const operatorIndices = Array.from(pendingOperatorIndices).sort((a, b) => a - b);
    const next = api.applyTableTrigger(api.readState(), pendingTriggerId, { operatorIndices });
    window.dispatchEvent(new CustomEvent("veildaemon:handler-trigger-applied", {
      detail: {
        triggerId: pendingTriggerId,
        state: next,
        operatorIndices,
        tableCopy: next.triggerUndo?.tableCopy || ""
      }
    }));
    closePreview();
  }

  function undoLastTrigger() {
    const result = api.undoLastTriggerPackage(api.readState());
    if (!result.ok) return;
    window.dispatchEvent(new CustomEvent("veildaemon:handler-trigger-undone", {
      detail: {
        state: result.state,
        label: result.label
      }
    }));
  }

  function bindControls() {
    const applyButton = document.getElementById("trigger-apply");
    const cancelButton = document.getElementById("trigger-cancel");
    const undoButton = document.getElementById("trigger-undo");
    if (applyButton) applyButton.addEventListener("click", applyPending);
    if (cancelButton) cancelButton.addEventListener("click", closePreview);
    if (undoButton) undoButton.addEventListener("click", undoLastTrigger);
  }

  function render(state) {
    renderRail(state || api.readState());
  }

  bindControls();
  render();
  window.addEventListener("veildaemon:handler-state-updated", () => render());
  window.HandlerTriggers = { render, closePreview, applyPending, undoLastTrigger };
}());