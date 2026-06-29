(function () {
  const api = window.HandlerState;
  const modeStorageKey = "veildaemon.handlerLiveMode.v1";
  let state = api.readState();
  let dashboardMode = readDashboardMode();

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
      if (window.HandlerNav) window.HandlerNav.renderSessionStrip();
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
        if (api.hasActiveNeedlepoint(state)) {
          state = api.applyNeedlepointSceneState(state);
        }
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
    renderActiveEntityReadout();
  }

  function renderActiveEntityReadout() {
    const node = document.getElementById("entity-active-readout");
    if (!node) return;
    const entity = state.activeEntity || {};
    const kind = api.safeString(entity.kind, 40) || "Zone";
    const name = api.safeString(entity.name, 120) || "Unnamed active Entity / Zone";
    node.textContent = "";
    const title = document.createElement("p");
    title.innerHTML = `<strong>Active ${kind}</strong><span>${name}</span>`;
    node.append(title);
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
        state = api.normalizeState(state);
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
        <div class="handler-operator-tracker-mount" data-player-trackers="${index}"></div>
        <div class="field-grid two">
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
      const trackerMount = card.querySelector(`[data-player-trackers="${index}"]`);
      if (window.HandlerOperatorTrackers) {
        window.HandlerOperatorTrackers.renderBoard(trackerMount, state.players[index], index, state.players, () => {
          state = api.normalizeState(state);
          writeState();
          renderPlayers();
          renderRiskStrip();
        });
      }
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

  function renderNpcs() {
    const grid = document.getElementById("npc-grid");
    renderNpcSummary();
    if (!grid) return;
    grid.textContent = "";
    state.npcs.forEach((npc, index) => {
      const card = document.createElement("article");
      card.className = "player-card npc-card";
      card.innerHTML = `
        <div class="player-head">
          <label>Name<input data-npc="${index}" data-field="name" maxlength="100" /></label>
          <button class="entry-remove no-print" type="button" data-remove-npc="${index}">Remove</button>
        </div>
        <div class="field-grid three">
          <label>Role<input data-npc="${index}" data-field="role" maxlength="100" /></label>
          <label>Pressure<textarea class="npc-pressure-field" data-npc="${index}" data-field="pressure" maxlength="160" rows="2"></textarea></label>
          <label>Location<input data-npc="${index}" data-field="location" maxlength="120" /></label>
        </div>
        <fieldset class="flag-grid" data-npc-flags="${index}"></fieldset>
        <label>Notes<textarea data-npc="${index}" data-field="notes" rows="3"></textarea></label>
      `;
      grid.append(card);
      if (window.HandlerNpcAnchor) {
        window.HandlerNpcAnchor.renderAnchorBlock(card, npc, index, (npcIndex, stateId) => {
          state.npcs[npcIndex].anchor = api.normalizeNpcAnchor({
            ...state.npcs[npcIndex].anchor,
            state: stateId
          });
          state = api.normalizeState(state);
          writeState();
          renderNpcs();
        });
      }
      const flags = card.querySelector("[data-npc-flags]");
      api.npcFlags.forEach((flag) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = flag;
        checkbox.dataset.npcFlag = flag;
        checkbox.checked = flag === "Anchor" ? Boolean(npc.anchor?.enabled) : npc.flags.includes(flag);
        label.append(checkbox, ` ${flag}`);
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
        renderNpcSummary();
      });
    });

    grid.querySelectorAll("[data-npc-flags]").forEach((fieldset) => {
      const index = Number(fieldset.dataset.npcFlags);
      fieldset.addEventListener("change", () => {
        const checked = Array.from(fieldset.querySelectorAll("input:checked")).map((input) => input.value);
        const anchorEnabled = checked.includes("Anchor");
        state.npcs[index].flags = checked;
        state.npcs[index].anchor = api.normalizeNpcAnchor({
          ...state.npcs[index].anchor,
          enabled: anchorEnabled
        });
        state = api.normalizeState(state);
        writeState();
        renderNpcs();
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

  function renderNpcSummary() {
    const summary = document.getElementById("npc-summary-grid");
    if (!summary) return;
    summary.textContent = "";
    const active = state.npcs
      .map((npc, index) => ({ npc, index }))
      .filter(({ npc }) => npc.name || npc.role || npc.pressure || npc.location || npc.notes || npc.anchor?.enabled)
      .slice(0, 5);
    if (!active.length) {
      summary.append(summaryCard("Roster", "No active NPCs logged.", "Prep can add people, pressure, and flags."));
      return;
    }
    active.forEach(({ npc, index }) => {
      const card = summaryCard(
        npc.name || "Unnamed NPC",
        [npc.role, npc.pressure, npc.location].filter(Boolean).join(" // ") || "No pressure logged.",
        npc.flags.join(" // ") || "No flags"
      );
      if (window.HandlerNpcAnchor) {
        window.HandlerNpcAnchor.renderAnchorBlock(card, npc, index, (npcIndex, stateId) => {
          state.npcs[npcIndex].anchor = api.normalizeNpcAnchor({
            ...state.npcs[npcIndex].anchor,
            state: stateId
          });
          state = api.normalizeState(state);
          writeState();
          renderNpcSummary();
        });
      }
      summary.append(card);
    });
  }

  function summaryCard(title, body, meta) {
    const card = document.createElement("article");
    card.className = "summary-card";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const p = document.createElement("p");
    p.textContent = body;
    const em = document.createElement("em");
    em.textContent = meta;
    card.append(strong, p, em);
    return card;
  }

  function renderRiskStrip() {
    const strip = document.getElementById("operator-risk-strip");
    if (!strip) return;
    strip.textContent = "";
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) {
      strip.append(riskChip("Operator", "No Operator summary imported."));
      return;
    }
    players.slice(0, 3).forEach((player, index) => {
      strip.append(riskChip(player.name || `Operator ${index + 1}`, [
        player.stabilityBand ? `Band ${player.stabilityBand}` : player.stability ? `Stability ${player.stability}` : "",
        player.harmBoxes !== undefined ? `Harm ${api.harmConditionFromBoxes(player.harmBoxes)}` : player.harm ? `Harm ${player.harm}` : "",
        player.misfire ? `Misfire ${player.misfire}` : "",
        player.voidBreach ? player.voidBreach : "",
        player.primaryFrequency ? `Freq ${player.primaryFrequency}` : ""
      ].filter(Boolean).join(" // ") || "No live risk flags."));
    });
  }

  function riskChip(label, value) {
    const chip = document.createElement("div");
    chip.className = "risk-chip";
    const title = document.createElement("span");
    title.textContent = label;
    const body = document.createElement("strong");
    body.textContent = value;
    chip.append(title, body);
    return chip;
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
    preview.textContent = "";
    const rawObject = api.safeString(state.roomAnswer.object, 130);
    const rawFeeling = api.safeString(state.roomAnswer.emotionalInput, 130);
    const rawConsequence = api.safeString(state.roomAnswer.consequence, 200);
    const object = rawObject || "ordinary detail not selected";
    const feeling = rawFeeling || "pressure not named yet";
    const consequence = rawConsequence || "no consequence chosen yet";
    const handlerMove = roomAnswerMove(rawObject, rawFeeling, rawConsequence);
    const playerLine = roomAnswerPlayerLine(rawObject, rawConsequence);
    [
      ["Object", object],
      ["Emotional input", feeling],
      ["Consequence", consequence],
      ["Handler move", handlerMove],
      ["Player-facing line", playerLine]
    ].forEach(([label, value]) => {
      const row = document.createElement("p");
      row.className = "room-answer-line";
      const strong = document.createElement("strong");
      strong.textContent = label;
      const span = document.createElement("span");
      span.textContent = value;
      row.append(strong, span);
      preview.append(row);
    });
  }

  function roomAnswerMove(object, feeling, consequence) {
    if (object && feeling && consequence) return `Make ${object} answer ${feeling} by revealing ${consequence}.`;
    if (!object && !feeling && !consequence) return "Choose one ordinary detail, one emotional pressure, and one consequence.";
    if (object && feeling) return `Let ${object} react to ${feeling}; choose the consequence it reveals.`;
    if (object && consequence) return `Use ${object} to reveal ${consequence}; name the pressure driving it.`;
    if (feeling && consequence) return `Let the room answer ${feeling} by revealing ${consequence}.`;
    if (object) return `Choose what pressure makes ${object} answer.`;
    if (feeling) return `Choose what ordinary detail answers ${feeling}.`;
    return `Choose what ordinary detail reveals ${consequence}.`;
  }

  function roomAnswerPlayerLine(object, consequence) {
    if (object && consequence) return `The ${object} changes first.`;
    if (object) return `The ${object} notices before anyone speaks.`;
    if (consequence) return `Something ordinary reveals ${consequence}.`;
    return "Something ordinary answers before anyone explains it.";
  }

  function renderPlayerView() {
    const panel = document.getElementById("player-view");
    if (!panel) return;
    panel.hidden = !state.playerViewEnabled;
    document.body.classList.toggle("is-player-view", state.playerViewEnabled);
    const payload = api.playerViewPayload(state);
    setText("player-view-title", payload.title);
    setText("player-view-scene", payload.scene);
    setText("player-view-instruction", payload.instruction);
    setText("player-view-consequence", payload.consequence || "WATCH THE ROOM");
    togglePlayerViewField("player-view-state", "");
    togglePlayerViewField("player-view-clock", "");
    togglePlayerViewField("player-view-consequence-wrap", payload.consequence);
  }

  function togglePlayerViewField(id, value) {
    const node = document.getElementById(id);
    if (!node) return;
    const row = node.closest("div");
    if (row) row.hidden = !value;
    node.textContent = api.safeString(value, 220);
  }

  function renderAttentionHint() {
    const hint = document.getElementById("attention-deterministic-hint");
    if (hint) hint.hidden = !api.hasActiveNeedlepoint(state);
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
    renderRiskStrip();
    renderAttentionHint();
    renderActiveEntityReadout();
    renderPlayerView();
    if (window.HandlerTriggers) window.HandlerTriggers.render(state);
    if (window.HandlerWindDown) window.HandlerWindDown.render();
    if (window.HandlerCollapse) window.HandlerCollapse.render(api.readState());
    if (window.HandlerNav) window.HandlerNav.renderFieldLock();
  }

  function applyTriggerState(nextState) {
    state = nextState;
    syncForm();
    writeState("TRIGGER APPLIED");
    renderDynamic();
    renderPlayers();
    renderNpcs();
  }

  function applyWindDownState(nextState, message) {
    state = nextState;
    syncForm();
    writeState(message || "WIND DOWN APPLIED");
    renderDynamic();
    renderPlayers();
    renderNpcs();
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
        stabilityPoints: 10,
        harmBoxes: 0,
        stabilityBand: "Calm",
        stability: "Calm (10/10)",
        harm: "Fine",
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

    const addNpc = document.getElementById("add-npc");
    if (addNpc) addNpc.addEventListener("click", () => {
      state.npcs.push({ id: `npc-${Date.now()}`, name: "", role: "", pressure: "", location: "", flags: [], notes: "", anchor: { enabled: false, label: "Anchor NPC", state: "with-operators" } });
      writeState();
      renderNpcs();
    });
  }

  function bindDataControls() {
    const applyTemplate = document.getElementById("apply-template");
    const picker = document.getElementById("template-picker");
    if (applyTemplate && picker) applyTemplate.addEventListener("click", () => {
      const template = api.templates.find((item) => item.id === picker.value) || api.templates[0];
      const base = template.id === "custom-campaign" ? api.defaultState : state;
      const merged = api.mergeDeep(base, template.data);
      if (template.data?.activeNeedlepoint) {
        merged.activeNeedlepoint = template.data.activeNeedlepoint;
      }
      state = api.normalizeState(merged);
      syncForm();
      writeState(`${template.name.toUpperCase()} LOADED`);
      renderDynamic();
      renderPlayers();
      renderNpcs();
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

  function readDashboardMode() {
    try {
      const value = window.localStorage.getItem(modeStorageKey);
      return ["live", "prep", "archive"].includes(value) ? value : "live";
    } catch (error) {
      return "live";
    }
  }

  function writeDashboardMode(mode) {
    try {
      window.localStorage.setItem(modeStorageKey, mode);
    } catch (error) {
      // Mode persistence is convenience only.
    }
  }

  function applyDashboardMode(mode) {
    dashboardMode = ["live", "prep", "archive"].includes(mode) ? mode : "live";
    document.body.dataset.handlerMode = dashboardMode;
    document.querySelectorAll("[data-dashboard-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.dashboardMode === dashboardMode);
    });
    document.querySelectorAll("[data-mode-panel]").forEach((panel) => {
      const modes = String(panel.dataset.modePanel || "").split(/\s+/).filter(Boolean);
      panel.hidden = modes.length > 0 && !modes.includes(dashboardMode);
    });
    writeDashboardMode(dashboardMode);
  }

  function bindDashboardMode() {
    document.querySelectorAll("[data-dashboard-mode]").forEach((button) => {
      button.addEventListener("click", () => applyDashboardMode(button.dataset.dashboardMode));
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

  function syncAttentionFromNeedlepoint() {
    collectForm();
    state = api.normalizeState(state);
    syncForm();
    writeState();
    renderDynamic();
  }

  function bindAttentionControl() {
    const select = document.querySelector('[name="attention.current"]');
    if (!select) return;
    select.addEventListener("change", syncAttentionFromNeedlepoint);
  }

  function renderAll() {
    state = api.readState();
    renderTemplates();
    fillSelect("attention.current", api.attentionStates);
    renderLoopFields();
    bindAttentionControl();
    syncForm();
    renderPlayers();
    renderNpcs();
    renderDynamic();
    applyDashboardMode(dashboardMode);
    setStatus("LOCAL READY");
    if (window.HandlerNav) window.HandlerNav.render();
  }

  function bindTriggerBridge() {
    window.addEventListener("veildaemon:handler-trigger-applied", (event) => {
      if (!event.detail?.state) return;
      applyTriggerState(event.detail.state);
    });
  }

  function bindWindDownBridge() {
    window.addEventListener("veildaemon:handler-wind-down-applied", (event) => {
      if (!event.detail?.state) return;
      applyWindDownState(event.detail.state, event.detail.message);
    });
  }

  function applyCollapseState(nextState, message) {
    state = nextState;
    syncForm();
    writeState(message || "STAGING SAVED");
    renderDynamic();
  }

  function bindCollapseBridge() {
    window.addEventListener("veildaemon:handler-collapse-updated", (event) => {
      if (!event.detail?.state) return;
      applyCollapseState(event.detail.state, event.detail.statusText);
    });
  }

  async function init() {
    await api.loadTemplates();
    bindForm();
    bindDataControls();
    bindDashboardMode();
    bindTriggerBridge();
    bindWindDownBridge();
    bindCollapseBridge();
    renderAll();
  }

  init();
}());
