(function () {
  const api = window.HandlerState;
  let state = api.readState();

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

  function renderTemplates() {
    const picker = document.getElementById("template-picker");
    if (!picker) return;
    picker.textContent = "";
    api.templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      picker.append(option);
    });
  }

  function renderSceneButtons() {
    const row = document.getElementById("scene-state-row");
    if (!row) return;
    row.textContent = "";
    api.sceneStates.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-state-button";
      button.classList.toggle("is-active", state.sceneState.current === item.name);
      button.dataset.value = item.name;
      button.innerHTML = `<strong>${item.name}</strong><span>${item.cue}</span>`;
      button.addEventListener("click", () => {
        state.sceneState.current = item.name;
        state.activeEntity.sceneState = item.name;
        syncForm();
        writeState();
        renderDynamic();
      });
      row.append(button);
    });
  }

  function renderLoopFields() {
    const grid = document.getElementById("entity-loop-grid");
    if (!grid) return;
    grid.textContent = "";
    api.loopFields.forEach((field) => {
      const label = document.createElement("label");
      label.textContent = field;
      const textarea = document.createElement("textarea");
      textarea.name = `entityLoop.${field}`;
      textarea.rows = 3;
      label.append(textarea);
      grid.append(label);
    });
  }

  function renderClock(trackId, clock, enabled = true) {
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
        if (trackId === "primary-clock-track") {
          state.primaryClock.current = index === state.primaryClock.current ? index - 1 : index;
        } else {
          state.secondaryClock.current = index === state.secondaryClock.current ? index - 1 : index;
          state.secondaryClock.enabled = true;
        }
        syncForm();
        writeState();
        renderDynamic();
      });
      track.append(button);
    }
  }

  function renderPlayers() {
    const grid = document.getElementById("player-grid");
    if (!grid) return;
    grid.textContent = "";
    state.players.forEach((player, index) => {
      const card = document.createElement("article");
      card.className = "player-card";
      card.innerHTML = `
        <div class="player-head">
          <label>Operator<input data-player="${index}" data-field="name" maxlength="80" /></label>
          <button class="entry-remove no-print" type="button" data-remove-player="${index}">Remove</button>
        </div>
        <div class="field-grid two">
          <label>Stability<input data-player="${index}" data-field="stability" maxlength="80" /></label>
          <label>Harm<input data-player="${index}" data-field="harm" maxlength="120" /></label>
          <label>Misfire<input data-player="${index}" data-field="misfire" maxlength="180" /></label>
          <label>Void / Breach Notes<input data-player="${index}" data-field="voidBreach" maxlength="180" /></label>
          <label>Anchors<input data-player="${index}" data-field="anchors" maxlength="180" /></label>
          <label>Current Emotional State<input data-player="${index}" data-field="emotionalState" maxlength="160" /></label>
          <label>Primary Frequency<input data-player="${index}" data-field="primaryFrequency" maxlength="80" /></label>
          <label>Frequency Pips<input data-player="${index}" data-field="frequencyPips" maxlength="180" /></label>
        </div>
        <label>Relationship Pressure<input data-player="${index}" data-field="relationshipPressure" maxlength="180" /></label>
        <label>Equipment Summary<input data-player="${index}" data-field="equipment" maxlength="260" /></label>
        <p class="helper-copy">Last Imported: ${api.safeString(player.lastImported ? player.lastImported.slice(0, 10) : "", 80) || "Manual summary"}</p>
      `;
      grid.append(card);
    });

    grid.querySelectorAll("[data-player]").forEach((input) => {
      const index = Number(input.dataset.player);
      const field = input.dataset.field;
      input.value = state.players[index][field] || "";
      input.addEventListener("input", () => {
        state.players[index][field] = api.safeString(input.value, 180);
        writeState();
      });
    });

    grid.querySelectorAll("[data-remove-player]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.removePlayer);
        state.players.splice(index, 1);
        if (!state.players.length) state.players.push(api.normalizeState({ players: [{}] }).players[0]);
        writeState();
        renderPlayers();
      });
    });
  }

  function syncForm() {
    document.querySelectorAll("[name]").forEach((input) => {
      if (input.id === "template-picker") return;
      const value = api.getPath(state, input.name);
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else {
        input.value = value ?? "";
      }
    });
    const toggle = document.getElementById("player-view-toggle");
    if (toggle) toggle.checked = state.playerViewEnabled;
  }

  function collectForm() {
    document.querySelectorAll("[name]").forEach((input) => {
      if (input.id === "template-picker") return;
      let value = input.type === "checkbox" ? input.checked : input.value;
      if (input.type === "number" || input.tagName === "SELECT" && input.name.includes("segments")) value = Number(value);
      api.setPath(state, input.name, value);
    });
    const toggle = document.getElementById("player-view-toggle");
    state.playerViewEnabled = Boolean(toggle && toggle.checked);
    state = api.normalizeState(state);
  }

  function renderRoomAnswer() {
    const preview = document.getElementById("room-answer-preview");
    if (!preview) return;
    const object = state.roomAnswer.object || "ordinary object";
    const feeling = state.roomAnswer.emotionalInput || "emotional input";
    const consequence = state.roomAnswer.consequence || "consequence";
    preview.textContent = `${object} receives ${feeling}. Result: ${consequence}.`;
  }

  function renderPlayerView() {
    const panel = document.getElementById("player-view");
    if (!panel) return;
    panel.hidden = !state.playerViewEnabled;
    document.body.classList.toggle("is-player-view", state.playerViewEnabled);
    setText("player-view-title", state.session.safeSceneLabel || state.session.caseTitle || "Scene active.");
    setText("player-view-scene", state.session.safeSceneLabel || state.session.location || "UNSET");
    setText("player-view-state", state.sceneState.current);
    setText("player-view-clock", api.publicClockLabel(state));
    setText("player-view-consequence", state.sceneState.primaryConsequence || state.attention.residue || "WATCH THE ROOM");
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = api.safeString(value, 220) || "UNSET";
  }

  function renderDynamic() {
    renderSceneButtons();
    renderClock("primary-clock-track", state.primaryClock, true);
    renderClock("secondary-clock-track", state.secondaryClock, state.secondaryClock.enabled);
    renderRoomAnswer();
    renderPlayerView();
  }

  function bindForm() {
    document.querySelectorAll("#handler-form input, #handler-form textarea, #handler-form select").forEach((input) => {
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

    const advantage = document.querySelector('[name="roll.advantage"]');
    const disadvantage = document.querySelector('[name="roll.disadvantage"]');
    if (advantage && disadvantage) {
      advantage.addEventListener("change", () => {
        if (advantage.checked) disadvantage.checked = false;
        collectForm();
        writeState();
      });
      disadvantage.addEventListener("change", () => {
        if (disadvantage.checked) advantage.checked = false;
        collectForm();
        writeState();
      });
    }

    const playerToggle = document.getElementById("player-view-toggle");
    if (playerToggle) playerToggle.addEventListener("change", () => {
      state.playerViewEnabled = playerToggle.checked;
      writeState();
      renderPlayerView();
    });

    const printButton = document.getElementById("print-dashboard");
    if (printButton) printButton.addEventListener("click", () => window.print());

    const rollButton = document.getElementById("roll-button");
    if (rollButton) rollButton.addEventListener("click", rollTest);

    const addPlayer = document.getElementById("add-player");
    if (addPlayer) addPlayer.addEventListener("click", () => {
      const next = state.players.length + 1;
      state.players.push({
        id: `operator-${Date.now()}`,
        name: `Operator ${next}`,
        stability: "",
        harm: "",
        misfire: "",
        voidBreach: "",
        anchors: "",
        emotionalState: "",
        relationshipPressure: "",
        primaryFrequency: "",
        frequencyPips: "",
        equipment: "",
        sourceExportedAt: "",
        lastImported: "",
        sourceId: ""
      });
      writeState();
      renderPlayers();
    });
  }

  function bindDataControls() {
    const applyTemplate = document.getElementById("apply-template");
    const picker = document.getElementById("template-picker");
    if (applyTemplate && picker) applyTemplate.addEventListener("click", () => {
      const template = api.templates.find((item) => item.id === picker.value) || api.templates[0];
      state = api.normalizeState(api.mergeDeep(state, template.data));
      syncForm();
      writeState(`${template.name.toUpperCase()} LOADED`);
      renderDynamic();
      renderPlayers();
    });

    const exportButton = document.getElementById("export-case");
    if (exportButton) exportButton.addEventListener("click", () => {
      collectForm();
      writeState();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (state.session.caseTitle || "handler-dashboard").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      link.href = url;
      link.download = `veildaemon-${safeName || "handler-dashboard"}-${new Date().toISOString().slice(0, 10)}.json`;
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
        state = api.normalizeState(JSON.parse(await file.text()));
        writeState("IMPORT ACCEPTED");
        renderAll();
      } catch (error) {
        setStatus("IMPORT REFUSED", true);
      } finally {
        importInput.value = "";
      }
    });

    const resetButton = document.getElementById("reset-dashboard");
    if (resetButton) resetButton.addEventListener("click", () => {
      if (!window.confirm("Reset the local Handler dashboard in this browser?")) return;
      state = api.normalizeState(null);
      try {
        window.localStorage.removeItem(api.storageKey);
      } catch (error) {
        // Local cleanup is best effort.
      }
      renderAll();
      setStatus("LOCAL RESET");
    });
  }

  function rollTest() {
    collectForm();
    const mode = state.roll.advantage ? "ADVANTAGE" : state.roll.disadvantage ? "DISADVANTAGE" : "STANDARD";
    const dice = mode === "STANDARD" ? [rollDie(), rollDie(), rollDie()] : [rollDie(), rollDie(), rollDie(), rollDie()];
    const kept = keepDice(dice, mode);
    const total = kept.values.reduce((sum, value) => sum + value, 0) + state.roll.attribute + state.roll.skill + state.roll.modifier;
    const output = document.getElementById("roll-output");
    if (!output) return;
    if (mode === "STANDARD") {
      output.textContent = `3d6 ${dice.join(" + ")} + Attribute ${state.roll.attribute} + Skill ${state.roll.skill} + Modifier ${state.roll.modifier} = ${total}`;
      return;
    }
    output.textContent = `4d6 ${dice.join(" + ")} // ${mode} keep ${kept.values.join(" + ")} // + Attribute ${state.roll.attribute} + Skill ${state.roll.skill} + Modifier ${state.roll.modifier} = ${total}`;
  }

  function rollDie() {
    const cryptoSource = window.crypto || window.msCrypto;
    if (cryptoSource && typeof cryptoSource.getRandomValues === "function") {
      const values = new Uint32Array(1);
      do {
        cryptoSource.getRandomValues(values);
      } while (values[0] >= 4294967292);
      return (values[0] % 6) + 1;
    }
    return Math.floor(Math.random() * 6) + 1;
  }

  function keepDice(dice, mode) {
    if (mode === "ADVANTAGE") {
      const drop = Math.min(...dice);
      const dropIndex = dice.indexOf(drop);
      return { values: dice.filter((_, index) => index !== dropIndex) };
    }
    if (mode === "DISADVANTAGE") {
      const drop = Math.max(...dice);
      const dropIndex = dice.indexOf(drop);
      return { values: dice.filter((_, index) => index !== dropIndex) };
    }
    return { values: dice };
  }

  function renderAll() {
    state = api.readState();
    renderTemplates();
    fillSelect("attention.current", api.attentionStates);
    renderLoopFields();
    syncForm();
    renderPlayers();
    renderDynamic();
    setStatus("LOCAL READY");
  }

  async function init() {
    await api.loadTemplates();
    bindForm();
    bindDataControls();
    renderAll();
  }

  init();
}());
