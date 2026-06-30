(function () {
  const api = window.HandlerState;
  let lastStatus = "Select a core clue to track truth recovery.";
  let pendingClueId = "";
  let pendingActionId = "";

  function listNode() {
    return document.getElementById("clue-integrity-list");
  }

  function summaryNode() {
    return document.getElementById("clue-integrity-summary");
  }

  function trackerNode() {
    return document.getElementById("clue-status-tracker");
  }

  function detailNode() {
    return document.getElementById("clue-integrity-detail");
  }

  function actionsNode() {
    return document.getElementById("clue-integrity-actions");
  }

  function statusNode() {
    return document.getElementById("clue-integrity-status");
  }

  function activePanelNode() {
    return document.getElementById("clue-integrity-active");
  }

  function previewNode() {
    return document.getElementById("clue-preview-panel");
  }

  function emptyCopy(message) {
    const line = document.createElement("p");
    line.className = "clue-integrity-empty";
    line.textContent = message;
    return line;
  }

  function clueShortLabel(clue, index) {
    const text = api.safeString(clue.clue, 80);
    const words = text.split(/\s+/).slice(0, 4).join(" ");
    return words.length < text.length ? `${words}…` : words;
  }

  function renderStatusTracker(state) {
    const node = trackerNode();
    if (!node) return;
    node.textContent = "";
    const clues = state.clueIntegrity?.clues || [];
    if (!clues.length) {
      node.append(emptyCopy("No core clues loaded."));
      return;
    }

    clues.forEach((clue, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "clue-status-chip";
      chip.classList.toggle("is-active", clue.id === state.clueIntegrity.activeClueId);
      chip.dataset.clueId = clue.id;
      chip.setAttribute("role", "listitem");
      chip.setAttribute("aria-label", `Core clue ${index + 1}: ${api.clueIntegrityStateLabel(clue.state)}`);
      chip.innerHTML = `
        <em>Clue ${index + 1}</em>
        <strong>${clueShortLabel(clue, index)}</strong>
        <span class="clue-state-badge clue-state-${clue.state}">${api.clueIntegrityStateLabel(clue.state)}</span>
      `;
      chip.addEventListener("click", () => selectClue(clue.id));
      node.append(chip);
    });
  }

  function renderSummary(state) {
    const node = summaryNode();
    if (!node) return;
    const summary = api.getClueIntegritySummary(state);
    node.textContent = "";
    if (!summary.total) {
      node.append(emptyCopy("Apply a Needlepoint template to load core clues."));
      return;
    }

    const counts = summary.counts;
    const parts = [
      ["Discovered", counts.discovered],
      ["Secured", counts.secured],
      ["Archived", counts.archived],
      ["Contaminated", counts.contaminated],
      ["Rerouted", counts.rerouted],
      ["Unknown", counts.unknown]
    ].filter(([, count]) => count > 0);

    const line = document.createElement("p");
    line.className = "clue-integrity-counts";
    line.textContent = parts.length
      ? parts.map(([label, count]) => `${label} ${count}`).join(" // ")
      : `${summary.total} core clues ready.`;
    node.append(line);
  }

  function renderList(state) {
    const list = listNode();
    if (!list) return;
    list.textContent = "";
    const clues = state.clueIntegrity?.clues || [];
    if (!clues.length) {
      list.append(emptyCopy("No core clues loaded."));
      return;
    }

    clues.forEach((clue, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clue-integrity-card";
      button.classList.toggle("is-active", clue.id === state.clueIntegrity.activeClueId);
      button.dataset.clueId = clue.id;
      button.innerHTML = `
        <em>Core Clue ${index + 1}</em>
        <strong>${api.safeString(clue.clue, 180)}</strong>
        <span class="clue-state-badge clue-state-${clue.state}">${api.clueIntegrityStateLabel(clue.state)}</span>
      `;
      button.addEventListener("click", () => selectClue(clue.id));
      list.append(button);
    });
  }

  function renderDetail(state) {
    const panel = activePanelNode();
    const detail = detailNode();
    const actions = actionsNode();
    if (!panel || !detail || !actions) return;

    const clue = state.clueIntegrity?.clues?.find((item) => item.id === state.clueIntegrity?.activeClueId);
    if (!clue) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    detail.textContent = "";
    const fields = [
      ["First Route", clue.firstRoute],
      ["Alternate Route", clue.alternateRoute],
      ["Failure Cost", clue.failureCost],
      ["Table Effect", clue.tableEffect],
      ["Handler Note", clue.handlerNote]
    ];
    fields.forEach(([label, value]) => {
      if (!value) return;
      const row = document.createElement("p");
      row.className = "clue-integrity-line";
      row.innerHTML = `<strong>${label}</strong><span>${api.safeString(value, 320)}</span>`;
      detail.append(row);
    });

    actions.textContent = "";
    api.clueIntegrityActions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.classList.toggle("primary", action.id === "discover" || action.id === "secure");
      button.classList.toggle("danger", action.id === "contaminate");
      button.classList.toggle("is-active", pendingClueId === clue.id && pendingActionId === action.id);
      button.disabled = !action.states.includes(clue.state);
      button.textContent = action.label;
      button.addEventListener("click", () => openPreview(clue.id, action.id));
      actions.append(button);
    });
  }

  function renderStatus(message) {
    const node = statusNode();
    if (!node) return;
    node.textContent = message || lastStatus;
  }

  function selectClue(clueId) {
    closePreview();
    const state = api.readState();
    state.clueIntegrity.activeClueId = clueId;
    api.writeState(state);
    render(api.readState());
  }

  function openPreview(clueId, actionId) {
    const state = api.readState();
    const preview = api.previewClueAction(state, clueId, actionId);
    const panel = previewNode();
    if (!preview || !panel) {
      renderStatus("Clue action unavailable.");
      return;
    }

    pendingClueId = clueId;
    pendingActionId = actionId;
    panel.hidden = false;
    const title = panel.querySelector(".trigger-preview-title");
    const lines = panel.querySelector(".trigger-preview-lines");
    if (title) title.textContent = `Apply ${preview.action.label}?`;
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
      item.innerHTML = "<span>Effect</span><strong>Clue state updates; runtime meters may stay flat.</strong>";
      lines.append(item);
    }
    render(state);
  }

  function closePreview() {
    pendingClueId = "";
    pendingActionId = "";
    const panel = previewNode();
    if (panel) panel.hidden = true;
    render(api.readState());
  }

  function applyPending() {
    if (!pendingClueId || !pendingActionId) return;
    const result = api.applyClueAction(api.readState(), pendingClueId, pendingActionId);
    lastStatus = result.message;
    if (!result.ok) {
      renderStatus(result.message);
      closePreview();
      return;
    }
    api.writeState(result.state, "CLUE UPDATED");
    window.dispatchEvent(new CustomEvent("veildaemon:handler-clue-updated", {
      detail: { state: result.state, message: result.message }
    }));
    closePreview();
    render(result.state);
  }

  function bindControls() {
    const applyButton = document.getElementById("clue-apply");
    const cancelButton = document.getElementById("clue-cancel");
    if (applyButton) applyButton.addEventListener("click", applyPending);
    if (cancelButton) cancelButton.addEventListener("click", closePreview);
  }

  function renderModuleReadouts(state) {
    const summary = api.getClueIntegritySummary(state);
    const progress = document.getElementById("module-clue-progress");
    const active = document.getElementById("module-clue-active");
    const nextClue = document.getElementById("module-clue-next");
    if (!progress && !active && !nextClue) return;

    const counts = summary.counts;
    const progressParts = [
      counts.secured ? `${counts.secured} secured` : "",
      counts.archived ? `${counts.archived} archived` : "",
      counts.contaminated ? `${counts.contaminated} contaminated` : "",
      counts.rerouted ? `${counts.rerouted} rerouted` : "",
      counts.discovered ? `${counts.discovered} discovered` : "",
      counts.unknown ? `${counts.unknown} unknown` : ""
    ].filter(Boolean);

    if (progress) {
      progress.textContent = summary.total
        ? `${progressParts.join(" // ")} (${summary.total} core)`
        : "Apply a Needlepoint template to load core clues.";
    }
    if (active) {
      active.textContent = summary.active
        ? `${api.clueIntegrityStateLabel(summary.active.state)} — ${api.safeString(summary.active.clue, 180)}`
        : "No active clue selected.";
    }
    if (nextClue) {
      nextClue.textContent = api.safeString(state.caseFile.nextClue, 220) || "No clue staged.";
    }
  }

  function render(state) {
    if (!document.getElementById("clue-integrity-list")) return;
    renderStatusTracker(state);
    renderSummary(state);
    renderList(state);
    renderDetail(state);
    renderStatus(lastStatus);
    renderModuleReadouts(state);
  }

  bindControls();
  window.HandlerClueIntegrity = { render, closePreview, applyPending };
  window.addEventListener("veildaemon:handler-state-updated", () => render(api.readState()));
  if (document.getElementById("clue-integrity-list")) render(api.readState());
}());