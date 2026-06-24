(function () {
  const storageKey = "veildaemon.handlerDashboard.v1";

  const canonTerminology = {
    ui: {
      gm: "Handler",
      player: "Operator",
      module: "Needlepoint",
      adventure: "Field Assignment",
      sessionReport: "After Action Report"
    },
    sourceAliases: {
      gmGuide: "Cradlepoint GM Guide 1.5",
      gmToolbox: "CRADLEPOINT GM TOOLBOX",
      playerHandouts: "CRADLEPOINT PLAYER HANDOUTS"
    }
  };

  const sceneStates = [
    { name: "Stable", cue: "Baseline. Pressure is present but manageable." },
    { name: "Echoed", cue: "Things repeat. Rooms answer sideways." },
    { name: "Recursive", cue: "Patterns layer. The same truth returns." },
    { name: "Breached", cue: "Reality frays. Costs become visible." },
    { name: "Collapse", cue: "Control fails. The room becomes the threat." }
  ];

  const attentionStates = ["Unseen", "Observed", "Focused", "Witnessed", "Mythic"];
  const loopFields = ["Need", "Lure", "Pressure", "Gift", "Violence", "Exit"];

  const templates = [
    {
      id: "blank",
      name: "Blank Handler Dashboard",
      data: {}
    },
    {
      id: "needlepoint",
      name: "Needlepoint Runtime",
      data: {
        session: {
          title: "Field Assignment",
          caseTitle: "Needlepoint",
          location: "Active scene",
          safeSceneLabel: "Pressure scene active"
        },
        sceneState: {
          current: "Stable",
          primaryConsequence: "The room answers what the Operators do through feeling."
        },
        primaryClock: {
          name: "Pressure Clock",
          segments: 6,
          current: 0,
          ticksWhen: "Operators ignore the lure, split attention, escalate, or feed the Need.",
          midpointEvent: "The room changes in a visible ordinary way.",
          fullClockEvent: "The entity or Zone acts openly.",
          stabilizer: "Observe, ground, name the truth, leave, or change the pattern."
        },
        entityLoop: {
          Need: "What the entity or Zone must have to remain in pressure.",
          Lure: "What draws Operators in or keeps them engaged.",
          Pressure: "What happens when the Need is ignored.",
          Gift: "What truth, power, or resource it offers in exchange.",
          Violence: "What happens if the Need is denied or blocked.",
          Exit: "What satisfies, breaks, redirects, or contains the loop."
        },
        roomAnswer: {
          object: "Door, light, receipt, voicemail, elevator, mirror, coffee cup",
          emotionalInput: "Fear, hunger, denial, grief, awe, refusal, hope",
          consequence: "A normal object behaves as if it understood the feeling."
        }
      }
    },
    {
      id: "veilcorp-intake",
      name: "VeilCorp Intake",
      data: {
        session: {
          title: "Intake Session",
          caseTitle: "VeilCorp Intake",
          location: "First contact location",
          safeSceneLabel: "Intake pressure rising"
        },
        sceneState: {
          current: "Echoed",
          primaryConsequence: "Observation creates relevance."
        },
        primaryClock: {
          name: "Intake Exposure Clock",
          segments: 6,
          current: 1,
          ticksWhen: "Operators over-explain, deny the obvious, draw public attention, or repeat the pattern.",
          midpointEvent: "Records, devices, or bystanders begin noticing the same detail.",
          fullClockEvent: "VeilCorp contact becomes unavoidable and the scene answers back.",
          stabilizer: "Limit exposure, verify assumptions, connect to an anchor, or leave cleanly."
        },
        entityLoop: {
          Need: "Classification before contact spreads.",
          Lure: "Answers, recognition, help, and the feeling of being seen.",
          Pressure: "The more they look, the more the signal treats them as relevant.",
          Gift: "A route, warning, contact point, or impossible confirmation.",
          Violence: "Exposure, attention, misclassification, or public residue.",
          Exit: "Accept intake boundaries, stabilize, and choose the next case route."
        },
        attention: {
          current: "Observed",
          residue: "A record updates too early.",
          followsHome: "A public system predicts what they almost said."
        },
        roomAnswer: {
          object: "Phone lock screen",
          emotionalInput: "The fear that someone already knows",
          consequence: "A notification arrives with no sender and the correct case label."
        }
      }
    }
  ];

  const defaultState = {
    version: 1,
    createdAt: "",
    updatedAt: "",
    playerViewEnabled: false,
    session: {
      title: "",
      caseTitle: "",
      location: "",
      safeSceneLabel: ""
    },
    sceneState: {
      current: "Stable",
      primaryConsequence: ""
    },
    primaryClock: {
      name: "",
      segments: 6,
      current: 0,
      ticksWhen: "",
      midpointEvent: "",
      fullClockEvent: "",
      stabilizer: ""
    },
    secondaryClock: {
      enabled: false,
      name: "",
      segments: 6,
      current: 0,
      liveDecision: ""
    },
    entityLoop: {
      Need: "",
      Lure: "",
      Pressure: "",
      Gift: "",
      Violence: "",
      Exit: ""
    },
    attention: {
      current: "Unseen",
      residue: "",
      followsHome: ""
    },
    roomAnswer: {
      object: "",
      emotionalInput: "",
      consequence: ""
    },
    roll: {
      attribute: 0,
      skill: 0,
      modifier: 0,
      advantage: false,
      disadvantage: false
    },
    players: [
      {
        id: "operator-1",
        name: "Operator 1",
        stability: "",
        harm: "",
        misfire: "",
        voidBreach: "",
        anchors: "",
        emotionalState: "",
        relationshipPressure: ""
      }
    ],
    handlerNotes: {
      privateNotes: "",
      clueList: "",
      consequenceQueue: "",
      residueLog: ""
    },
    canonTerminology
  };

  let state = readState();

  function nowStamp() {
    return new Date().toISOString();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeString(value, max = 3000) {
    return String(value || "").trim().slice(0, max);
  }

  function safeNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
  }

  function mergeDeep(base, patch) {
    const output = clone(base);
    if (!patch || typeof patch !== "object") return output;
    Object.keys(patch).forEach((key) => {
      if (patch[key] && typeof patch[key] === "object" && !Array.isArray(patch[key]) && output[key] && typeof output[key] === "object") {
        output[key] = mergeDeep(output[key], patch[key]);
      } else {
        output[key] = patch[key];
      }
    });
    return output;
  }

  function normalizeState(value) {
    const now = nowStamp();
    const merged = mergeDeep(defaultState, value && typeof value === "object" ? value : {});
    return {
      ...merged,
      version: 1,
      createdAt: safeString(merged.createdAt) || now,
      updatedAt: safeString(merged.updatedAt) || now,
      playerViewEnabled: Boolean(merged.playerViewEnabled),
      session: normalizeTextObject(merged.session, defaultState.session),
      sceneState: {
        current: normalizeChoice(merged.sceneState.current, sceneStates.map((item) => item.name), "Stable"),
        primaryConsequence: safeString(merged.sceneState.primaryConsequence, 220)
      },
      primaryClock: normalizeClock(merged.primaryClock),
      secondaryClock: {
        ...normalizeClock(merged.secondaryClock),
        enabled: Boolean(merged.secondaryClock.enabled),
        liveDecision: safeString(merged.secondaryClock.liveDecision, 180)
      },
      entityLoop: normalizeTextObject(merged.entityLoop, defaultState.entityLoop),
      attention: {
        current: normalizeChoice(merged.attention.current, attentionStates, "Unseen"),
        residue: safeString(merged.attention.residue, 180),
        followsHome: safeString(merged.attention.followsHome, 180)
      },
      roomAnswer: normalizeTextObject(merged.roomAnswer, defaultState.roomAnswer),
      roll: normalizeRoll(merged.roll),
      players: normalizePlayers(merged.players),
      handlerNotes: normalizeTextObject(merged.handlerNotes, defaultState.handlerNotes),
      canonTerminology
    };
  }

  function normalizeTextObject(value, shape) {
    const source = value && typeof value === "object" ? value : {};
    return Object.keys(shape).reduce((next, key) => {
      next[key] = safeString(source[key], 3000);
      return next;
    }, {});
  }

  function normalizeChoice(value, choices, fallback) {
    return choices.includes(value) ? value : fallback;
  }

  function normalizeClock(clock) {
    const source = clock && typeof clock === "object" ? clock : {};
    const segments = safeNumber(source.segments, 4, 8, 6);
    return {
      name: safeString(source.name, 100),
      segments,
      current: safeNumber(source.current, 0, segments, 0),
      ticksWhen: safeString(source.ticksWhen, 180),
      midpointEvent: safeString(source.midpointEvent, 500),
      fullClockEvent: safeString(source.fullClockEvent, 500),
      stabilizer: safeString(source.stabilizer, 160)
    };
  }

  function normalizeRoll(roll) {
    const source = roll && typeof roll === "object" ? roll : {};
    return {
      attribute: safeNumber(source.attribute, 0, 8, 0),
      skill: safeNumber(source.skill, 0, 8, 0),
      modifier: safeNumber(source.modifier, -10, 10, 0),
      advantage: Boolean(source.advantage) && !Boolean(source.disadvantage),
      disadvantage: Boolean(source.disadvantage)
    };
  }

  function normalizePlayers(players) {
    const list = Array.isArray(players) ? players : [];
    return list.slice(0, 8).map((player, index) => ({
      id: safeString(player.id, 80) || `operator-${index + 1}`,
      name: safeString(player.name, 80) || `Operator ${index + 1}`,
      stability: safeString(player.stability, 80),
      harm: safeString(player.harm, 120),
      misfire: safeString(player.misfire, 180),
      voidBreach: safeString(player.voidBreach, 180),
      anchors: safeString(player.anchors, 180),
      emotionalState: safeString(player.emotionalState, 160),
      relationshipPressure: safeString(player.relationshipPressure, 180)
    }));
  }

  function readState() {
    try {
      return normalizeState(JSON.parse(window.localStorage.getItem(storageKey)));
    } catch (error) {
      return normalizeState(null);
    }
  }

  function writeState() {
    state.updatedAt = nowStamp();
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setStatus("LOCAL SAVED");
    } catch (error) {
      setStatus("STORAGE REFUSED", true);
    }
  }

  function setStatus(message, isError) {
    const node = document.getElementById("storage-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", Boolean(isError));
  }

  function getPath(path) {
    return path.split(".").reduce((value, key) => value && value[key], state);
  }

  function setPath(path, value) {
    const parts = path.split(".");
    let target = state;
    while (parts.length > 1) {
      const key = parts.shift();
      target[key] = target[key] && typeof target[key] === "object" ? target[key] : {};
      target = target[key];
    }
    target[parts[0]] = value;
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
    templates.forEach((template) => {
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
    sceneStates.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-state-button";
      button.classList.toggle("is-active", state.sceneState.current === item.name);
      button.dataset.value = item.name;
      button.innerHTML = `<strong>${item.name}</strong><span>${item.cue}</span>`;
      button.addEventListener("click", () => {
        state.sceneState.current = item.name;
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
    loopFields.forEach((field) => {
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
        </div>
        <label>Relationship Pressure<input data-player="${index}" data-field="relationshipPressure" maxlength="180" /></label>
      `;
      grid.append(card);
    });

    grid.querySelectorAll("[data-player]").forEach((input) => {
      const index = Number(input.dataset.player);
      const field = input.dataset.field;
      input.value = state.players[index][field] || "";
      input.addEventListener("input", () => {
        state.players[index][field] = safeString(input.value, 180);
        writeState();
      });
    });

    grid.querySelectorAll("[data-remove-player]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.removePlayer);
        state.players.splice(index, 1);
        if (!state.players.length) state.players.push(normalizePlayers([{}])[0]);
        writeState();
        renderPlayers();
      });
    });
  }

  function syncForm() {
    document.querySelectorAll("[name]").forEach((input) => {
      if (input.id === "template-picker") return;
      const value = getPath(input.name);
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
      setPath(input.name, value);
    });
    const toggle = document.getElementById("player-view-toggle");
    state.playerViewEnabled = Boolean(toggle && toggle.checked);
    state = normalizeState(state);
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
    setText("player-view-clock", publicClockLabel());
    setText("player-view-consequence", state.sceneState.primaryConsequence || state.attention.residue || "WATCH THE ROOM");
  }

  function publicClockLabel() {
    const name = state.primaryClock.name || "Active Clock";
    return `${name} ${state.primaryClock.current}/${state.primaryClock.segments}`;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = safeString(value, 220) || "UNSET";
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
        relationshipPressure: ""
      });
      writeState();
      renderPlayers();
    });
  }

  function bindDataControls() {
    const applyTemplate = document.getElementById("apply-template");
    const picker = document.getElementById("template-picker");
    if (applyTemplate && picker) applyTemplate.addEventListener("click", () => {
      const template = templates.find((item) => item.id === picker.value) || templates[0];
      state = normalizeState(mergeDeep(state, template.data));
      syncForm();
      writeState();
      renderDynamic();
      renderPlayers();
      setStatus(`${template.name.toUpperCase()} LOADED`);
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
        state = normalizeState(JSON.parse(await file.text()));
        writeState();
        renderAll();
        setStatus("IMPORT ACCEPTED");
      } catch (error) {
        setStatus("IMPORT REFUSED", true);
      } finally {
        importInput.value = "";
      }
    });

    const resetButton = document.getElementById("reset-dashboard");
    if (resetButton) resetButton.addEventListener("click", () => {
      if (!window.confirm("Reset the local Handler dashboard in this browser?")) return;
      state = normalizeState(null);
      try {
        window.localStorage.removeItem(storageKey);
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
    renderTemplates();
    fillSelect("attention.current", attentionStates);
    renderLoopFields();
    syncForm();
    renderPlayers();
    renderDynamic();
  }

  bindForm();
  bindDataControls();
  renderAll();
}());
