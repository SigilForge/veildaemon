(function () {
  const api = window.HandlerState;
  let lastStatus = "Select a core clue to track truth recovery.";

  function listNode() {
    return document.getElementById("clue-integrity-list");
  }

  function summaryNode() {
    return document.getElementById("clue-integrity-summary");
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

  function emptyCopy(message) {
    const line = document.createElement("p");
    line.className = "clue-integrity-empty";
    line.textContent = message;
    return line;
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
      button.disabled = !action.states.includes(clue.state);
      button.textContent = action.label;
      button.addEventListener("click", () => applyAction(clue.id, action.id));
      actions.append(button);
    });
  }

  function renderStatus(message) {
    const node = statusNode();
    if (!node) return;
    node.textContent = message || lastStatus;
  }

  function selectClue(clueId) {
    const state = api.readState();
    state.clueIntegrity.activeClueId = clueId;
    api.writeState(state);
    render(api.readState());
  }

  function applyAction(clueId, actionId) {
    const result = api.advanceClueState(api.readState(), clueId, actionId);
    lastStatus = result.message;
    if (!result.ok) {
      renderStatus(result.message);
      return;
    }
    api.writeState(result.state, "CLUE UPDATED");
    window.dispatchEvent(new CustomEvent("veildaemon:handler-clue-updated", {
      detail: { state: result.state, message: result.message }
    }));
    render(result.state);
  }

  function render(state) {
    if (!document.getElementById("clue-integrity-list")) return;
    renderSummary(state);
    renderList(state);
    renderDetail(state);
    renderStatus(lastStatus);
  }

  window.HandlerClueIntegrity = { render };
  window.addEventListener("veildaemon:handler-state-updated", () => render(api.readState()));
}());