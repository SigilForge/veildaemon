(function () {
  const api = window.HandlerState;
  let state = api.readState();
  const moduleName = document.body.dataset.handlerModule || "";

  function setStatus(message, isError) {
    const node = document.getElementById("storage-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", Boolean(isError));
  }

  function writeState(message) {
    try {
      state = api.writeState(state, message);
      setStatus(message || "LOCAL SAVED");
    } catch (error) {
      setStatus("STORAGE REFUSED", true);
    }
  }

  function syncForm() {
    document.querySelectorAll("[name]").forEach((input) => {
      const value = api.getPath(state, input.name);
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = value ?? "";
    });
  }

  function collectForm() {
    document.querySelectorAll("[name]").forEach((input) => {
      let value = input.type === "checkbox" ? input.checked : input.value;
      if (input.type === "number" || input.tagName === "SELECT" && input.name.includes("segments")) value = Number(value);
      api.setPath(state, input.name, value);
    });
    state = api.normalizeState(state);
  }

  function bindSimpleForm() {
    document.querySelectorAll("[name]").forEach((input) => {
      input.addEventListener("input", () => {
        collectForm();
        writeState();
        renderDynamic();
      });
      input.addEventListener("change", () => {
        collectForm();
        writeState();
        renderDynamic();
      });
    });
  }

  function fillSelect(name, values) {
    const select = document.querySelector(`[name="${name}"]`);
    if (!select) return;
    select.textContent = "";
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  }

  function renderClock(trackId, clock, path, enabled = true) {
    const track = document.getElementById(trackId);
    if (!track) return;
    track.textContent = "";
    track.classList.toggle("is-muted", !enabled);
    for (let index = 1; index <= clock.segments; index += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clock-segment";
      button.classList.toggle("is-filled", index <= clock.current && enabled);
      button.setAttribute("aria-label", `${trackId} segment ${index}`);
      button.addEventListener("click", () => {
        api.setPath(state, `${path}.current`, index === clock.current ? index - 1 : index);
        if (path === "secondaryClock") state.secondaryClock.enabled = true;
        state = api.normalizeState(state);
        syncForm();
        writeState();
        renderDynamic();
      });
      track.append(button);
    }
  }

  function renderNpcs() {
    const grid = document.getElementById("npc-grid");
    if (!grid) return;
    grid.textContent = "";
    state.npcs.forEach((npc, index) => {
      const card = document.createElement("article");
      card.className = "player-card";
      card.innerHTML = `
        <div class="player-head">
          <label>Name<input data-npc="${index}" data-field="name" maxlength="100" /></label>
          <button class="entry-remove no-print" type="button" data-remove-npc="${index}">Remove</button>
        </div>
        <div class="field-grid three">
          <label>Role<input data-npc="${index}" data-field="role" maxlength="100" /></label>
          <label>Pressure<input data-npc="${index}" data-field="pressure" maxlength="160" /></label>
          <label>Location<input data-npc="${index}" data-field="location" maxlength="120" /></label>
        </div>
        <fieldset class="flag-grid" data-npc-flags="${index}"></fieldset>
        <label>Notes<textarea data-npc="${index}" data-field="notes" rows="3"></textarea></label>
      `;
      grid.append(card);
      const flags = card.querySelector("[data-npc-flags]");
      api.npcFlags.forEach((flag) => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="checkbox" value="${flag}" ${npc.flags.includes(flag) ? "checked" : ""} /> ${flag}`;
        flags.append(label);
      });
    });

    grid.querySelectorAll("[data-npc]").forEach((input) => {
      const index = Number(input.dataset.npc);
      const field = input.dataset.field;
      input.value = state.npcs[index][field] || "";
      input.addEventListener("input", () => {
        state.npcs[index][field] = api.safeString(input.value, field === "notes" ? 1000 : 180);
        writeState();
      });
    });
    grid.querySelectorAll("[data-npc-flags]").forEach((fieldset) => {
      const index = Number(fieldset.dataset.npcFlags);
      fieldset.addEventListener("change", () => {
        state.npcs[index].flags = Array.from(fieldset.querySelectorAll("input:checked")).map((input) => input.value);
        writeState();
      });
    });
    grid.querySelectorAll("[data-remove-npc]").forEach((button) => {
      button.addEventListener("click", () => {
        state.npcs.splice(Number(button.dataset.removeNpc), 1);
        if (!state.npcs.length) state.npcs.push(api.normalizeState({ npcs: [{}] }).npcs[0]);
        writeState();
        renderNpcs();
      });
    });
  }

  function renderOperators() {
    const grid = document.getElementById("operator-grid");
    if (!grid) return;
    grid.textContent = "";
    state.players.forEach((operator, index) => {
      const card = document.createElement("article");
      card.className = "player-card";
      card.innerHTML = `
        <div class="player-head">
          <label>Operator<input data-operator="${index}" data-field="name" maxlength="80" /></label>
          <button class="entry-remove no-print" type="button" data-remove-operator="${index}">Remove</button>
        </div>
        <div class="field-grid two">
          <label>Stability Band<input data-operator="${index}" data-field="stability" maxlength="80" /></label>
          <label>Harm<input data-operator="${index}" data-field="harm" maxlength="120" /></label>
          <label>Misfire Risk<input data-operator="${index}" data-field="misfire" maxlength="180" /></label>
          <label>Anchor Note<input data-operator="${index}" data-field="anchors" maxlength="180" /></label>
          <label>Void / Breach Notes<input data-operator="${index}" data-field="voidBreach" maxlength="180" /></label>
          <label>Current Emotional State<input data-operator="${index}" data-field="emotionalState" maxlength="160" /></label>
        </div>
        <label>Relationship Pressure<input data-operator="${index}" data-field="relationshipPressure" maxlength="180" /></label>
      `;
      grid.append(card);
    });
    grid.querySelectorAll("[data-operator]").forEach((input) => {
      const index = Number(input.dataset.operator);
      const field = input.dataset.field;
      input.value = state.players[index][field] || "";
      input.addEventListener("input", () => {
        state.players[index][field] = api.safeString(input.value, 180);
        writeState();
      });
    });
    grid.querySelectorAll("[data-remove-operator]").forEach((button) => {
      button.addEventListener("click", () => {
        state.players.splice(Number(button.dataset.removeOperator), 1);
        if (!state.players.length) state.players.push(api.normalizeState({ players: [{}] }).players[0]);
        writeState();
        renderOperators();
      });
    });
  }

  function renderResidueLog() {
    const grid = document.getElementById("residue-grid");
    if (!grid) return;
    grid.textContent = "";
    state.residueLog.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "player-card";
      card.innerHTML = `
        <div class="player-head">
          <label>Scene<input data-residue="${index}" data-field="scene" maxlength="140" /></label>
          <button class="entry-remove no-print" type="button" data-remove-residue="${index}">Remove</button>
        </div>
        <div class="field-grid two">
          <label>Attention<select data-residue="${index}" data-field="attention">${api.attentionStates.map((value) => `<option>${value}</option>`).join("")}</select></label>
          <label>Residue<input data-residue="${index}" data-field="residue" maxlength="240" /></label>
          <label>Follows Home<input data-residue="${index}" data-field="followsHome" maxlength="240" /></label>
          <label>Consequence<input data-residue="${index}" data-field="consequence" maxlength="300" /></label>
        </div>
      `;
      grid.append(card);
    });
    grid.querySelectorAll("[data-residue]").forEach((input) => {
      const index = Number(input.dataset.residue);
      const field = input.dataset.field;
      input.value = state.residueLog[index][field] || "";
      input.addEventListener("input", () => {
        state.residueLog[index][field] = api.safeString(input.value, 300);
        writeState();
      });
      input.addEventListener("change", () => {
        state.residueLog[index][field] = api.safeString(input.value, 300);
        writeState();
      });
    });
    grid.querySelectorAll("[data-remove-residue]").forEach((button) => {
      button.addEventListener("click", () => {
        state.residueLog.splice(Number(button.dataset.removeResidue), 1);
        writeState();
        renderResidueLog();
      });
    });
  }

  function addNpcs() {
    const button = document.getElementById("add-npc");
    if (button) button.addEventListener("click", () => {
      state.npcs.push({ id: `npc-${Date.now()}`, name: "", role: "", pressure: "", location: "", flags: [], notes: "" });
      writeState();
      renderNpcs();
    });
  }

  function addOperators() {
    const button = document.getElementById("add-operator");
    if (button) button.addEventListener("click", () => {
      const next = state.players.length + 1;
      state.players.push({ id: `operator-${Date.now()}`, name: `Operator ${next}`, stability: "", harm: "", misfire: "", voidBreach: "", anchors: "", emotionalState: "", relationshipPressure: "" });
      writeState();
      renderOperators();
    });
  }

  function addResidue() {
    const button = document.getElementById("add-residue");
    if (button) button.addEventListener("click", () => {
      state.residueLog.unshift({ id: `residue-${Date.now()}`, scene: "", attention: state.attention.current, residue: "", followsHome: "", consequence: "" });
      writeState();
      renderResidueLog();
    });
  }

  function bindDataControls() {
    const exportButton = document.getElementById("export-case");
    if (exportButton) exportButton.addEventListener("click", () => {
      collectForm();
      writeState();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `veildaemon-handler-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
    const importInput = document.getElementById("import-case");
    if (importInput) importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      try {
        state = api.writeState(JSON.parse(await file.text()), "IMPORT ACCEPTED");
        renderAll();
      } catch (error) {
        setStatus("IMPORT REFUSED", true);
      } finally {
        importInput.value = "";
      }
    });
  }

  function renderPlayerView() {
    text("safe-scene", state.session.safeSceneLabel || state.session.location, "Scene pending.");
    text("safe-state", state.sceneState.current, "Stable");
    text("safe-clock", api.publicClockLabel(state), "Clock pending.");
    text("safe-consequence", state.sceneState.primaryConsequence || state.attention.residue, "Watch the room.");
  }

  function text(id, value, fallback) {
    const node = document.getElementById(id);
    if (node) node.textContent = api.safeString(value, 220) || fallback || "Unset";
  }

  function renderDynamic() {
    renderClock("primary-clock-track", state.primaryClock, "primaryClock", true);
    renderClock("secondary-clock-track", state.secondaryClock, "secondaryClock", state.secondaryClock.enabled);
    renderPlayerView();
    text("clock-warning", api.clockWarning(state.primaryClock), "No warning.");
  }

  function renderAll() {
    state = api.readState();
    fillSelect("attention.current", api.attentionStates);
    fillSelect("activeEntity.kind", ["Entity", "Zone"]);
    fillSelect("activeEntity.sceneState", api.sceneStates.map((item) => item.name));
    syncForm();
    renderDynamic();
    renderNpcs();
    renderOperators();
    renderResidueLog();
    setStatus("LOCAL READY");
  }

  bindSimpleForm();
  bindDataControls();
  addNpcs();
  addOperators();
  addResidue();
  renderAll();
  document.body.classList.add(`handler-module-${moduleName}`);
}());
