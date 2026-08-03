(function () {
  const api = window.HandlerState;
  const modeStorageKey = "veildaemon.handlerLiveMode.v1";
  const liveViewStorageKey = "veildaemon.handlerLiveView.v1";
  let state = api.readState();
  let dashboardMode = readDashboardMode();
  let liveView = readLiveView();

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

  const pressure = () => window.HandlerPressureControls;

  function applyPressureImmediate(change) {
    state = pressure().applyPressureImmediate(state, change, {
      onApplied: (next, message) => {
        state = next;
        syncForm();
        writeState(message);
        renderDynamic();
        renderPlayers();
        renderNpcs();
        renderTrackPromptQueue();
        if (window.HandlerTriggers) window.HandlerTriggers.render(state);
        notifyPendingAlerts();
      }
    });
  }

  function pressureHooks(alertOptions = null) {
    return {
      onApplied: (next, message) => {
        state = next;
        syncForm();
        writeState(message);
        renderDynamic();
        renderPlayers();
        renderNpcs();
        renderTrackPromptQueue();
        if (window.HandlerTriggers) window.HandlerTriggers.render(state);
        if (alertOptions) notifyPendingAlerts(alertOptions);
        else notifyPendingAlerts();
      }
    };
  }

  function requestPressurePreview(change) {
    if (!pressure()) {
      applyPressureImmediate(change);
      return false;
    }
    const result = pressure().requestPressurePreview(state, change, pressureHooks({ forceAlert: true, scrollToQueue: true }));
    state = result.state;
    return result.deferred;
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
        const before = state.sceneState.current;
        if (before === item.name) return;
        const change = pressure().buildManualPressureChange("scene", before, item.name, {
          label: `Scene State -> ${item.name}`,
          hint: "Manual scene escalation."
        });
        requestPressurePreview(change);
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
    const currentStep = api.safeString(entity.currentStep, 20);
    node.textContent = "";
    const title = document.createElement("p");
    title.innerHTML = `<strong>Active ${kind}</strong><span>${name}</span>`;
    node.append(title);

    const stepLine = document.createElement("p");
    stepLine.className = "entity-loop-step-readout";
    stepLine.textContent = currentStep ? `Loop step: ${currentStep}` : "Loop step: not started";
    node.append(stepLine);

    const advance = document.createElement("button");
    advance.type = "button";
    advance.className = "scene-timer-btn";
    advance.textContent = currentStep ? `Advance Entity (-> ${api.nextEntityLoopStep(currentStep)})` : "Advance Entity (-> Need)";
    advance.addEventListener("click", () => advanceEntityLoop());
    node.append(advance);
  }

  function advanceEntityLoop() {
    const nextStep = api.nextEntityLoopStep(state.activeEntity?.currentStep || "");
    state = {
      ...state,
      activeEntity: { ...state.activeEntity, currentStep: nextStep }
    };
    writeState(`ENTITY LOOP -> ${nextStep}`);
    renderActiveEntityReadout();

    const target = api.entityLoopConsequenceTarget(state, nextStep);
    if (!target) return;
    const change = pressure().buildManualPressureChange(target.kind, target.before, target.after, {
      clockName: target.clockName,
      label: target.label,
      hint: target.hint
    });
    requestPressurePreview(change);
  }

  function renderClock(trackId, clock, enabled = true) {
    const track = document.getElementById(trackId);
    if (!track) return;
    const segments = Math.max(1, Number(clock.segments) || 6);
    track.textContent = "";
    track.classList.toggle("is-muted", !enabled);
    track.style.setProperty("--clock-segments", String(segments));
    track.style.gridTemplateColumns = `repeat(${segments}, minmax(0, 1fr))`;
    for (let index = 1; index <= segments; index += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clock-segment";
      button.classList.toggle("is-filled", index <= clock.current && enabled);
      button.setAttribute("aria-label", `${trackId} segment ${index}`);
      button.addEventListener("click", () => {
        const isPrimary = trackId === "primary-clock-track";
        const before = isPrimary ? state.primaryClock.current : state.secondaryClock.current;
        const after = index === before ? index - 1 : index;
        const change = pressure().buildManualPressureChange(
          isPrimary ? "primary-clock" : "secondary-clock",
          before,
          after,
          {
            clockName: isPrimary ? state.primaryClock.name : state.secondaryClock.name,
            label: isPrimary
              ? `${state.primaryClock.name || "Primary Clock"} ${after > before ? "ticks" : "winds down"}`
              : `${state.secondaryClock.name || "Secondary Clock"} ${after > before ? "ticks" : "winds down"}`,
            hint: "Manual clock adjustment."
          }
        );
        requestPressurePreview(change);
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
        window.HandlerOperatorTrackers.renderBoard(
          trackerMount,
          state.players[index],
          index,
          state.players,
          trackerBoardOptions(index)
        );
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
          <button class="button ghost small no-print" type="button" data-promote-npc="${index}" hidden>Promote to Thread</button>
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
        window.HandlerNpcAnchor.renderAnchorBlock(card, npc, index, (result) => {
          state = result.state;
          writeState(result.message || "ANCHOR UPDATED");
          renderNpcs();
          renderDynamic();
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

    // Only shown where a live Weave-tagged Operation actually exists to promote INTO -- see
    // handler-clue-integrity.js's own promote button for the same reasoning (silently absent
    // rather than erroring on click when disconnected).
    const canPromote = Boolean(window.HandlerWeavePromote && window.VeilDaemonCellRemote?.isConnected?.());
    grid.querySelectorAll("[data-promote-npc]").forEach((button) => {
      button.hidden = !canPromote;
      if (!canPromote) return;
      button.addEventListener("click", () => {
        const index = Number(button.dataset.promoteNpc);
        const npc = state.npcs[index];
        if (!npc) return;
        const notes = [npc.role && `Role: ${npc.role}`, npc.pressure && `Pressure: ${npc.pressure}`, npc.location && `Location: ${npc.location}`, npc.notes]
          .filter(Boolean).join("\n");
        window.HandlerWeavePromote.open({
          kind: "npc_entity",
          title: npc.name || "Unnamed NPC",
          notes,
          sourceRef: `npc-${index}`,
          sourceOperationId: window.HandlerCellSync?.getLatestOperation?.()?.id || null,
          onDone: () => window.HandlerWeaveLivePanel?.refresh?.(),
        });
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
        window.HandlerNpcAnchor.renderAnchorBlock(card, npc, index, (result) => {
          state = result.state;
          writeState(result.message || "ANCHOR UPDATED");
          renderNpcSummary();
          renderDynamic();
        });
      }
      // The summary card, not the full edit grid (#npc-grid), is what's actually visible
      // during live play (body[data-handler-mode="live"] hides .npc-grid) -- this is the
      // real entry point a Handler reaches for mid-session, matching the one in renderNpcs()
      // for prep-mode editing.
      if (window.HandlerWeavePromote && window.VeilDaemonCellRemote?.isConnected?.()) {
        const promoteButton = document.createElement("button");
        promoteButton.type = "button";
        promoteButton.className = "button ghost small no-print";
        promoteButton.textContent = "Promote to Thread";
        promoteButton.addEventListener("click", () => {
          const notes = [npc.role && `Role: ${npc.role}`, npc.pressure && `Pressure: ${npc.pressure}`, npc.location && `Location: ${npc.location}`, npc.notes]
            .filter(Boolean).join("\n");
          window.HandlerWeavePromote.open({
            kind: "npc_entity",
            title: npc.name || "Unnamed NPC",
            notes,
            sourceRef: `npc-${index}`,
            sourceOperationId: window.HandlerCellSync?.getLatestOperation?.()?.id || null,
            onDone: () => window.HandlerWeaveLivePanel?.refresh?.(),
          });
        });
        card.append(promoteButton);
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

  function notifyPendingAlerts(options = {}) {
    if (!window.HandlerPendingAlerts) return null;
    const result = window.HandlerPendingAlerts.render(state, options);
    if (options.scrollToQueue && result?.count) {
      window.HandlerPendingAlerts.scrollToQueue();
    }
    return result;
  }

  function applyPromptState(nextState, message) {
    state = nextState;
    const pendingMessage = window.HandlerPendingAlerts?.pendingStatusMessage(state) || "";
    writeState(message || pendingMessage || "PROMPT UPDATED");
    renderTrackPromptQueue();
    renderPlayers();
    renderRiskStrip();
    notifyPendingAlerts({ forceAlert: Boolean(message) });
  }

  function queueTrackPrompt(payload) {
    const next = api.createTrackPrompt(state, payload);
    const created = next.trackPromptQueue?.[0];
    const message = created
      ? `PENDING: Tell ${created.operatorName} — ${created.track === "harm" ? "Harm" : "Stability"} ${created.delta > 0 ? "+" : ""}${created.delta}. Announce at table.`
      : "Operator track prompt queued.";
    state = next;
    writeState(message);
    renderTrackPromptQueue();
    renderPlayers();
    renderRiskStrip();
    notifyPendingAlerts({ forceAlert: true, scrollToQueue: true });
  }

  function trackerBoardOptions(playerIndex) {
    return {
      state,
      showQuickForm: false,
      onStateChange: applyPromptState,
      setStatusMessage: setStatus,
      onQueuePrompt: (payload) => {
        queueTrackPrompt({ ...payload, operatorIndex: playerIndex });
      }
    };
  }

  function driftPanelOptions() {
    return {
      onStateChange: applyDriftState,
      setStatusMessage: setStatus
    };
  }

  /** Fold a Handler-resolved Drift/Scar update into one player's operatorStatus and persist --
   * mirrors applyPromptState's shape, but Drift has no Track Prompt Queue equivalent since
   * there's no Operator-facing self-entry point to reconcile against. */
  function applyDriftState(playerIndex, nextOperatorStatus, message) {
    const player = state.players[playerIndex];
    if (!player) return;
    player.operatorStatus = nextOperatorStatus;
    writeState(message || "DRIFT UPDATED");
    renderPresentationDriftQueue();
  }

  /** A Load 6 Collapse can become resolvable at the table mid-play (a table trigger/misfire
   * just queued a Load-raising Track Prompt), so this lives alongside the Track Prompt Queue
   * in "live" mode -- not inside the roster editor (#player-grid), which is deliberately
   * hidden during live play so the Handler queues/resolves instead of silently editing. */
  function renderPresentationDriftQueue() {
    const mount = document.getElementById("presentation-drift-queue-mount");
    if (!mount || !window.HandlerPresentationDrift) return;
    mount.textContent = "";
    state.players.forEach((player, index) => {
      const card = document.createElement("article");
      card.className = "presentation-drift-panel-card";
      mount.append(card);
      window.HandlerPresentationDrift.renderPanel(card, player, index, driftPanelOptions());
    });
  }

  function renderTrackPromptQueue() {
    const mount = document.getElementById("track-prompt-queue-mount");
    if (mount && window.HandlerTrackPromptQueue) {
      window.HandlerTrackPromptQueue.renderQueue(mount, state, applyPromptState, setStatus);
    }
    renderPresentationDriftQueue();
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
    const presentationPressure = window.PresentationPressure;
    const catalogs = window.CradlepointCatalogs || {};
    players.slice(0, 3).forEach((player, index) => {
      const status = player.operatorStatus && typeof player.operatorStatus === "object" ? player.operatorStatus : player;
      const catalogKey = player.ontologyPresentationKey
        || (typeof catalogs.presentationKeyFromDisplayName === "function"
          ? catalogs.presentationKeyFromDisplayName(player.ontologyPresentation || status.ontologyPresentation)
          : "");
      const presentationSummary = presentationPressure && catalogKey
        ? presentationPressure.handlerSummaryText(status, catalogKey)
        : player.presentationPressureSummary || "";
      strip.append(riskChip(player.name || `Operator ${index + 1}`, [
        player.stabilityBand ? `Band ${player.stabilityBand}` : player.stability ? `Stability ${player.stability}` : "",
        player.harmBoxes !== undefined ? `Harm ${api.harmConditionFromBoxes(player.harmBoxes)}` : player.harm ? `Harm ${player.harm}` : "",
        presentationSummary,
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

  function sbField(label, value) {
    const field = document.createElement("div");
    field.className = "sb-field";
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value || "—";
    field.append(span, strong);
    return field;
  }

  function sbFieldRow(...fields) {
    const row = document.createElement("div");
    row.className = "sb-field-row";
    row.append(...fields);
    return row;
  }

  function sbSection(numeral, title) {
    const section = document.createElement("section");
    section.className = "sb-section";
    const h2 = document.createElement("h2");
    h2.textContent = `${numeral}. ${title}`;
    section.append(h2);
    return section;
  }

  function sbClockLine(label, clock) {
    if (!clock || !clock.segments) return null;
    const line = document.createElement("p");
    line.className = "sb-clock-line";
    const name = clock.name || "Unnamed";
    const warn = api.clockWarning(clock);
    line.textContent = `${label}: ${name} ${clock.current}/${clock.segments}${warn ? ` — ${warn}` : ""}`;
    return line;
  }

  /**
   * Handler-only reference sheet for the table, replacing a naive shrink of
   * the live interactive dashboard. Real clock names/events are fine here —
   * this is not a player-safe surface (see renderPlayerView for that).
   */
  function renderSessionBrief() {
    const host = document.getElementById("session-brief");
    if (!host) return;
    host.textContent = "";

    const header = document.createElement("header");
    header.className = "sb-header";
    const kicker = document.createElement("p");
    kicker.className = "sb-kicker";
    kicker.textContent = "VEILCORP // HANDLER SESSION BRIEF // TABLE REFERENCE";
    const h1 = document.createElement("h1");
    h1.textContent = state.session.title || state.session.caseTitle || "Untitled Session";
    header.append(kicker, h1);
    host.append(header);

    const sessionSection = sbSection("I", "SESSION");
    sessionSection.append(
      sbFieldRow(
        sbField("Case", state.session.caseTitle),
        sbField("Location", state.session.location),
        sbField("Scene State", state.sceneState.current)
      )
    );
    [sbClockLine("Primary Clock", state.primaryClock), sbClockLine("Secondary Clock", state.secondaryClock?.enabled ? state.secondaryClock : null)]
      .filter(Boolean)
      .forEach((line) => sessionSection.append(line));
    host.append(sessionSection);

    const operatorsSection = sbSection("II", "OPERATORS");
    const players = Array.isArray(state.players) ? state.players : [];
    if (players.length) {
      const list = document.createElement("ul");
      list.className = "sb-operator-list";
      players.forEach((player) => {
        const li = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = player.name || "Operator";
        const detail = document.createElement("span");
        detail.textContent = [
          player.stability || `${player.stabilityBand || ""} (${player.stabilityPoints ?? "?"}/10)`,
          player.harm || `Harm ${player.harmBoxes ?? 0}/5`,
          player.misfire,
          player.voidBreach
        ].filter(Boolean).join(" · ");
        li.append(name, detail);
        list.append(li);
      });
      operatorsSection.append(list);
    } else {
      const empty = document.createElement("p");
      empty.className = "sb-empty";
      empty.textContent = "No Operators recorded.";
      operatorsSection.append(empty);
    }
    host.append(operatorsSection);

    const npcsSection = sbSection("III", "NPC ROSTER");
    const npcs = (Array.isArray(state.npcs) ? state.npcs : []).filter((npc) => npc.name);
    if (npcs.length) {
      const list = document.createElement("ul");
      list.className = "sb-npc-list";
      npcs.forEach((npc) => {
        const li = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = [npc.name, npc.role].filter(Boolean).join(" — ");
        const detail = document.createElement("span");
        detail.textContent = [npc.location, npc.pressure, npc.notes].filter(Boolean).join(" · ");
        li.append(name, detail);
        list.append(li);
      });
      npcsSection.append(list);
    } else {
      const empty = document.createElement("p");
      empty.className = "sb-empty";
      empty.textContent = "No NPCs staged.";
      npcsSection.append(empty);
    }
    host.append(npcsSection);

    const footer = document.createElement("footer");
    footer.className = "sb-footer";
    footer.textContent = `Generated ${new Date().toLocaleString()} — Handler-only. Not for player view.`;
    host.append(footer);
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
    togglePlayerViewField("player-view-state", payload.sceneState);
    togglePlayerViewField("player-view-clock", payload.clockLabel);
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

  function renderSecondaryClockPanel() {
    const panel = document.getElementById("secondary-clock-panel");
    const details = document.getElementById("secondary-clock-details");
    if (!panel) return;
    const enabled = Boolean(state.secondaryClock.enabled);
    if (dashboardMode === "live") {
      panel.hidden = !enabled;
      if (details) details.open = true;
    } else if (dashboardMode === "prep") {
      panel.hidden = false;
    }
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = api.safeString(value, 220) || "UNSET";
  }

  function renderDynamic() {
    renderSceneButtons();
    renderClock("primary-clock-track", state.primaryClock, true);
    renderSecondaryClockPanel();
    renderClock("secondary-clock-track", state.secondaryClock, state.secondaryClock.enabled);
    renderRoomAnswer();
    renderTrackPromptQueue();
    renderRiskStrip();
    renderAttentionHint();
    renderActiveEntityReadout();
    renderPlayerView();
    if (window.HandlerTriggers) window.HandlerTriggers.render(state);
    if (window.HandlerWindDown) window.HandlerWindDown.render();
    if (window.HandlerCollapse) window.HandlerCollapse.render(api.readState());
    if (window.HandlerClueIntegrity) window.HandlerClueIntegrity.render();
    if (window.HandlerNav) window.HandlerNav.renderFieldLock();
    notifyPendingAlerts();
  }

  function applyTriggerState(nextState, message) {
    state = nextState;
    syncForm();
    const pendingMessage = window.HandlerPendingAlerts?.pendingStatusMessage(state) || "";
    const statusMessage = pendingMessage || message || "TRIGGER APPLIED";
    writeState(statusMessage);
    renderDynamic();
    renderPlayers();
    renderNpcs();
    renderTrackPromptQueue();
    if (window.HandlerTriggers) window.HandlerTriggers.render(state);
    notifyPendingAlerts({ forceAlert: true, scrollToQueue: Boolean(pendingMessage) });
  }

  function undoTriggerState(nextState, message) {
    state = nextState;
    syncForm();
    writeState(message || "TRIGGER UNDONE");
    renderDynamic();
    renderPlayers();
    renderNpcs();
    renderTrackPromptQueue();
    if (window.HandlerTriggers) window.HandlerTriggers.render(state);
    notifyPendingAlerts();
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
        if (window.HandlerPressureControls?.isPressureFieldName(input.name)) return;
        collectForm();
        writeState();
        renderDynamic();
      });
      input.addEventListener("change", () => {
        if (window.HandlerPressureControls?.isPressureFieldName(input.name)) return;
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
    if (printButton) printButton.addEventListener("click", () => {
      renderSessionBrief();
      window.print();
    });

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
      state.npcs.push({ id: `npc-${Date.now()}`, name: "", role: "", pressure: "", location: "", flags: [], notes: "", anchor: { enabled: false, label: "Anchor NPC", state: "idle" } });
      writeState();
      renderNpcs();
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
        window.localStorage.removeItem(api.getStorageKey());
      } catch (error) {
        // Local cleanup is best effort.
      }
      // A local reset zeroes session.pressureRound back to 0, but a still-active remote
      // Cell connection points at the SAME session row an Operator may already have
      // lastHandlerRound recorded against -- the next "End Pressure Round" would recompute
      // round 1 and push it again, which the Operator's strict must-be-greater guard then
      // silently drops as a repeat, not a new round. Dropping the connection here (same as
      // Close Connection) forces a genuinely new Cell to be opened instead of resuming a
      // stale one under a freshly-zeroed local counter.
      window.VeilDaemonCellRemote?.clearConnection();
      unsubscribeLobbyRollsIfAny();
      renderCellConnectStatus();
      renderSeatRoster([]);
      renderAll();
      setStatus("LOCAL RESET");
    });

    const freshStartButton = document.getElementById("fresh-start-operation");
    if (freshStartButton) freshStartButton.addEventListener("click", () => {
      // For a connected Cell, "Start Operation" is the correct fresh-start path -- it resets
      // this same set of fields (see transitionToNewOperation) AND opens a new server-side
      // Operation row, which is what keeps a still-connected Operator's own round guard from
      // silently dropping the next "End Pressure Round" (see reset-dashboard's handler above
      // for the exact failure mode a local-only reset would hit here instead).
      if (window.VeilDaemonCellRemote?.isConnected?.()) {
        setStatus("Connected to a Cell -- use Start Operation (Operation Lifecycle) for a fresh start instead.", true);
        return;
      }
      if (!window.confirm(
        "Fresh Start (Round 1)?\n\n"
        + "Resets: pressure round, clocks, Attention, Track Prompt queue, active Entity, Room Answer, session-end reward decisions, NPC roster, Entity library, and Clue Integrity (reseeded from the active Needlepoint).\n\n"
        + "Kept as-is: case title, Needlepoint choice, Handler notes, and case file."
      )) return;
      state = api.transitionToNewOperation(state, state.session?.operationId || "");
      writeState("Fresh start -- Round 1.");
      renderAll();
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
    renderSecondaryClockPanel();
    applyLiveViewFilter();
    writeDashboardMode(dashboardMode);
  }

  function bindDashboardMode() {
    document.querySelectorAll("[data-dashboard-mode]").forEach((button) => {
      button.addEventListener("click", () => applyDashboardMode(button.dataset.dashboardMode));
    });
  }

  /* Live focus mode: RUN / PRESSURE / REFERENCE. A second, narrower visibility
   * layer that only applies inside dashboardMode "live" -- it never decides
   * whether a panel exists in prep/archive (data-mode-panel above stays sole
   * authority for that). It only decides, among panels already shown for
   * "live", which the Handler is looking at right now. Every applyDashboardMode()
   * call recomputes data-mode-panel visibility fresh and then layers this
   * filter on top, so panels hidden by a previous live-view selection are
   * correctly un-hidden the moment dashboardMode changes away from "live".
   * See Docs/DESIGN_CONSTRAINTS.md "Handler live constraints" and the
   * 2026-08-03 live-focus-modes pass. */
  function readLiveView() {
    try {
      const value = window.localStorage.getItem(liveViewStorageKey);
      return ["run", "pressure", "reference"].includes(value) ? value : "run";
    } catch (error) {
      return "run";
    }
  }

  function writeLiveView(view) {
    try {
      window.localStorage.setItem(liveViewStorageKey, view);
    } catch (error) {
      // Live-view persistence is convenience only.
    }
  }

  function applyLiveViewFilter() {
    document.body.dataset.liveView = liveView;
    document.querySelectorAll("[data-live-toggle]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.liveToggle === liveView);
    });
    if (dashboardMode !== "live") return;
    document.querySelectorAll("[data-live-view]").forEach((panel) => {
      if (panel.hidden) return;
      const views = String(panel.dataset.liveView || "").split(/\s+/).filter(Boolean);
      if (views.length > 0 && !views.includes(liveView)) panel.hidden = true;
    });
  }

  function setLiveView(view) {
    liveView = ["run", "pressure", "reference"].includes(view) ? view : "run";
    writeLiveView(liveView);
    applyDashboardMode(dashboardMode);
  }

  function bindLiveView() {
    document.querySelectorAll("[data-live-toggle]").forEach((button) => {
      button.addEventListener("click", () => setLiveView(button.dataset.liveToggle));
    });
  }

  // Exposed so handler-pending-alerts.js's "Open Operator Queue" jump can switch into
  // PRESSURE before it scrolls -- Track Prompts lives there, and scrollIntoView on a
  // display:none panel is a silent no-op.
  window.HandlerLiveView = { setLiveView };

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

  function bindAttentionControl() {
    const select = document.querySelector('[name="attention.current"]');
    if (!select) return;
    select.addEventListener("change", () => {
      const before = state.attention.current;
      const after = select.value;
      if (before === after) return;
      const change = pressure().buildManualPressureChange("attention", before, after, {
        label: `Attention rises to ${after}`,
        hint: "Manual Attention adjustment."
      });
      if (requestPressurePreview(change)) {
        select.value = before;
      }
    });
  }

  function bindPressureInputs() {
    const primaryInput = document.querySelector('[name="primaryClock.current"]');
    const secondaryInput = document.querySelector('[name="secondaryClock.current"]');
    if (primaryInput) {
      primaryInput.addEventListener("change", () => {
        const before = state.primaryClock.current;
        const after = Math.max(0, Math.min(12, Number(primaryInput.value) || 0));
        if (after === before) return;
        const change = pressure().buildManualPressureChange("primary-clock", before, after, {
          clockName: state.primaryClock.name,
          label: `${state.primaryClock.name || "Primary Clock"} ${after > before ? `+${after - before}` : "winds down"}`,
          hint: "Manual clock input."
        });
        if (requestPressurePreview(change)) primaryInput.value = String(before);
      }, true);
    }
    if (secondaryInput) {
      secondaryInput.addEventListener("change", () => {
        const before = state.secondaryClock.current;
        const after = Math.max(0, Math.min(12, Number(secondaryInput.value) || 0));
        if (after === before) return;
        const change = pressure().buildManualPressureChange("secondary-clock", before, after, {
          clockName: state.secondaryClock.name,
          label: `${state.secondaryClock.name || "Secondary Clock"} ${after > before ? `+${after - before}` : "winds down"}`,
          hint: "Manual clock input."
        });
        if (requestPressurePreview(change)) secondaryInput.value = String(before);
      }, true);
    }
  }

  function renderAll() {
    state = api.readState();
    renderTemplates();
    fillSelect("attention.current", api.attentionStates);
    renderLoopFields();
    bindAttentionControl();
    bindPressureInputs();
    syncForm();
    renderPlayers();
    renderNpcs();
    renderDynamic();
    renderActionEconomyStrip();
    applyDashboardMode(dashboardMode);
    setStatus("LOCAL READY");
    if (window.HandlerNav) window.HandlerNav.render();
  }

  function bindTriggerBridge() {
    window.addEventListener("veildaemon:handler-trigger-applied", (event) => {
      if (!event.detail?.state) return;
      const tableCopy = api.safeString(event.detail.tableCopy, 2000);
      applyTriggerState(event.detail.state, tableCopy ? "TRIGGER APPLIED — table copy ready." : "TRIGGER APPLIED");
    });
    window.addEventListener("veildaemon:handler-trigger-undone", (event) => {
      if (!event.detail?.state) return;
      const label = api.safeString(event.detail.label, 140);
      undoTriggerState(event.detail.state, label ? `UNDONE: ${label}` : "TRIGGER UNDONE");
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

  function bindClueBridge() {
    window.addEventListener("veildaemon:handler-clue-updated", (event) => {
      if (!event.detail?.state) return;
      state = event.detail.state;
      syncForm();
      setStatus(event.detail.message || "CLUE UPDATED");
      renderDynamic();
    });
  }

  async function hydrateClues(reseed = false) {
    state = await api.hydrateClueIntegrity(state, { reseed });
    writeState(reseed ? "CORE CLUES LOADED" : "CLUES SYNCED");
    if (window.HandlerClueIntegrity) window.HandlerClueIntegrity.render();
  }

  function renderActionEconomyStrip() {
    const node = document.getElementById("action-economy-strip");
    const cell = window.VeilDaemonCellSync;
    const economy = window.VeilDaemonPressureRoundEconomy;
    if (!node || !cell || !economy) return;
    const bus = cell.read();
    const snapshot = bus.handler?.actionEconomy || { round: 0, budgets: {} };
    node.textContent = "";

    const header = document.createElement("p");
    header.className = "kicker";
    header.textContent = `ACTION ECONOMY — ROUND ${snapshot.round || state.session?.pressureRound || 1}`;
    node.append(header);

    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) {
      const empty = document.createElement("p");
      empty.className = "panel-note";
      empty.textContent = "No Operators seated yet.";
      node.append(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "action-economy-list";
    players.forEach((player) => {
      const key = player.sourceId || player.name;
      const budget = economy.budgetFor(snapshot, key);
      const item = document.createElement("li");
      const slots = economy.SLOTS
        .map((slot) => `${slot}${budget[slot] === false ? " (spent)" : ""}`)
        .join(" · ");
      item.textContent = `${api.safeString(player.name, 80) || "Operator"}: ${slots}`;
      list.append(item);
    });
    node.append(list);
  }

  async function handlerCellConnectGetToken() {
    const auth = window.VeilAuth;
    if (!auth) return null;
    if (!auth.getSession()) await auth.init();
    return auth.getSession()?.access_token || null;
  }

  /** Resolves the signed-in Handler's own account id and registers it with the active-
   * context engine (cell-sync-remote.js) -- unrelated to any Cell, but namespaces local
   * storage alongside cellId (handler-state.js's setActiveStorageScope) so two different
   * Handler accounts sharing a browser can never read each other's dashboard state. */
  async function ensureActiveHandlerId() {
    const auth = window.VeilAuth;
    const remote = window.VeilDaemonCellRemote;
    if (!auth || !remote) return null;
    if (!auth.getSession()) await auth.init();
    const user = auth.getUser();
    if (user?.id) {
      remote.setActiveHandlerId(user.id);
      // One-time, per-account: copy the pre-Multi-Cell global blob (if any) into whichever
      // Cell it actually belonged to, before anything reads/writes a namespaced key.
      window.HandlerState?.migrateLegacyGlobalStateIfNeeded?.(user.id);
    }
    return user?.id || null;
  }

  function renderCellConnectStatus(joinCode) {
    const status = document.getElementById("cell-connect-status");
    const openBtn = document.getElementById("cell-connect-open");
    const leaveBtn = document.getElementById("cell-connect-leave");
    if (!status) return;
    const connected = Boolean(window.VeilDaemonCellRemote?.isConnected());
    if (connected) {
      status.textContent = joinCode
        ? `CONNECTED — Cell Code ${joinCode}. Share this with Operators.`
        : "CONNECTED — live with Operators.";
    } else {
      status.textContent = "LOCAL — same-device sync only.";
    }
    if (openBtn) openBtn.hidden = connected;
    if (leaveBtn) leaveBtn.hidden = !connected;
  }

  // Lobby-wide, real-time roll feed (community vibe): merges each broadcast roll into the
  // SAME local rollFeed bus the existing roll-feed UI (renderRollFeed / refreshHint in
  // handler-cell-sync.js) already reads from, so that UI needs no changes of its own to show
  // cross-device rolls -- only where they come from (Realtime, not the same-device bus) is new.
  let unsubscribeLobbyRolls = null;

  function subscribeLobbyRollsIfConnected() {
    if (unsubscribeLobbyRolls) return;
    const remote = window.VeilDaemonCellRemote;
    if (!remote?.isConnected() || !remote.subscribeToSessionRolls) return;
    unsubscribeLobbyRolls = remote.subscribeToSessionRolls((row) => {
      const roll = row && row.roll && typeof row.roll === "object" ? row.roll : row;
      if (window.VeilDaemonCellSync?.publishOperatorRoll) window.VeilDaemonCellSync.publishOperatorRoll(roll);
      window.HandlerCellSync?.refreshHint?.();
    });
  }

  function unsubscribeLobbyRollsIfAny() {
    if (unsubscribeLobbyRolls) {
      unsubscribeLobbyRolls();
      unsubscribeLobbyRolls = null;
    }
  }

  // Cell-scoped typed event feed (chat, round_advanced, operation_archived, ...) -- same
  // one-subscription-per-connection pattern as the roll feed above, just a different table.
  let unsubscribeCellEvents = null;
  function subscribeCellEventsIfConnected() {
    if (unsubscribeCellEvents) return;
    const remote = window.VeilDaemonCellRemote;
    if (!remote?.isConnected() || !remote.subscribeToCellEvents) return;
    unsubscribeCellEvents = remote.subscribeToCellEvents(() => {
      window.HandlerCellSync?.renderChat?.();
    });
  }
  function unsubscribeCellEventsIfAny() {
    if (unsubscribeCellEvents) {
      unsubscribeCellEvents();
      unsubscribeCellEvents = null;
    }
  }

  // Live CONNECTED/DISCONNECTED presence -- purely client-derived, never written to
  // Postgres. Joining/leaving this channel never touches seat_status.
  let leavePresence = null;
  function joinPresenceIfConnected() {
    if (leavePresence) return;
    const remote = window.VeilDaemonCellRemote;
    if (!remote?.isConnected() || !remote.joinPresence) return;
    leavePresence = remote.joinPresence();
  }
  function leavePresenceIfAny() {
    if (leavePresence) {
      leavePresence();
      leavePresence = null;
    }
  }

  /** First-contact visibility: who has joined this Cell, and whether they've ever sent
   * real sheet state -- distinct from "0 seats matched" silence. hasRealSend is false for
   * the identity-only stub handleJoin seeds a seat with (see api/cell/[action].js), true
   * once the Operator's first deliberate Send to Cell lands. seatStatus (JOINED/LEFT/
   * REMOVED, durable) and the live Presence-derived connected dot are two SEPARATE facts --
   * never collapse them into one badge, that's exactly the conflation this pass exists to
   * undo. */
  function renderSeatRoster(seatRoster) {
    const list = document.getElementById("seat-roster-list");
    if (!list) return;
    const roster = Array.isArray(seatRoster) ? seatRoster : [];
    list.hidden = !roster.length;
    const remote = window.VeilDaemonCellRemote;
    list.innerHTML = roster.map((seat) => {
      const connected = remote?.isSeatConnected ? remote.isSeatConnected(seat.seatId) : false;
      const seatStatus = seat.seatStatus || "joined";
      return `
      <li class="seat-roster-item" data-seat-id="${seat.seatId}">
        <span class="seat-roster-item-name">${(seat.name || "Operator").replace(/[<>&]/g, "")}</span>
        <span class="seat-roster-item-status ${seat.hasRealSend ? "is-synced" : "is-pending"}">
          ${seat.hasRealSend ? "Synced" : "Joined — no Operator state received yet"}
        </span>
        <span class="seat-roster-presence-dot ${connected ? "is-connected" : "is-disconnected"}" title="${connected ? "Connected" : "Disconnected (seat retained)"}"></span>
        <span class="seat-roster-seat-status is-${seatStatus}">${seatStatus.toUpperCase()}</span>
        <button class="button ghost small seat-roster-inspect" type="button" data-seat-id="${seat.seatId}">Inspect Sheet</button>
      </li>
    `;
    }).join("");
    list.querySelectorAll(".seat-roster-inspect").forEach((btn) => {
      btn.addEventListener("click", () => inspectSeatBaseline(btn.getAttribute("data-seat-id")));
    });
  }

  /** Handler inspects a seated Operator's complete, immutable legal sheet baseline for the
   * current Operation -- a plain database read that works whether that Operator is
   * connected, disconnected, or has left, since none of it depends on a live connection. */
  async function inspectSeatBaseline(seatId) {
    const remote = window.VeilDaemonCellRemote;
    if (!remote?.isConnected()) return;
    const pulled = await remote.pullState().catch(() => null);
    const operationId = pulled?.operation?.id;
    if (!operationId) {
      window.alert("No Operation has started in this Cell yet -- there is no baseline to inspect.");
      return;
    }
    try {
      const data = await remote.getOperationBaseline(operationId, seatId);
      const sheet = data?.baseline?.sheet || {};
      window.alert(`Operation ${pulled.operation.sequence} baseline (read-only, published ${data.baseline.published_at}):\n\n${JSON.stringify(sheet, null, 2).slice(0, 4000)}`);
    } catch (error) {
      window.alert(error?.message || "No baseline published for this seat yet.");
    }
  }

  async function refreshSeatRoster() {
    const remote = window.VeilDaemonCellRemote;
    if (!remote?.isConnected()) return;
    const result = await remote.pullState().catch(() => null);
    // Keeps the active-context Operation id in sync with the server's authoritative value on
    // every pull (not just switchToCell's own explicit set) -- chat's topic is computed from
    // this at subscribe time, so a stale/missing id here would silently leave a reconnecting
    // client subscribed to the wrong (or "lobby") topic for an already-active Operation.
    remote.setActiveOperationId?.(result?.operation?.id || null);
    renderSeatRoster(result?.seatRoster || []);
  }

  function bindCellConnect() {
    const openBtn = document.getElementById("cell-connect-open");
    const leaveBtn = document.getElementById("cell-connect-leave");

    if (openBtn) {
      openBtn.addEventListener("click", async () => {
        const remote = window.VeilDaemonCellRemote;
        const auth = window.VeilAuth;
        if (!remote || !auth) return;
        if (!auth.getSession()) await auth.init();
        if (!auth.getUser()) {
          auth.showModal();
          return;
        }
        openBtn.disabled = true;
        try {
          const session = await remote.createSession(handlerCellConnectGetToken, {
            needlepoint: state.session?.title || state.session?.caseTitle || "",
            mission: state.session?.location || "",
            maxOperators: null,
          });
          renderCellConnectStatus(session.join_code);
          subscribeLobbyRollsIfConnected();
          subscribeCellEventsIfConnected();
          joinPresenceIfConnected();
          window.HandlerCellSync?.subscribeChatIfConnected?.();
          refreshSeatRoster();
          setStatus(`Cell opened — Code ${session.join_code}`);
        } catch (error) {
          setStatus(error?.message || "Could not open Cell.", true);
        } finally {
          openBtn.disabled = false;
        }
      });
    }

    if (leaveBtn) {
      leaveBtn.addEventListener("click", () => {
        window.VeilDaemonCellRemote?.clearConnection();
        unsubscribeLobbyRollsIfAny();
        unsubscribeCellEventsIfAny();
        window.HandlerCellSync?.unsubscribeChatIfAny?.();
        window.HandlerCellSync?.clearChatBuffer?.();
        leavePresenceIfAny();
        renderCellConnectStatus();
        renderSeatRoster([]);
        setStatus("Cell connection closed on this device (session stays open for Operators until Archived).");
      });
    }

    renderCellConnectStatus();
    bootstrapCellFromUrlOrPointer();
  }

  /** Shows a blocking failure state in the Connect dock -- deliberately never a toast that
   * disappears, since silently falling back to "just click Open Cell" would hide that a
   * specific, intended Cell couldn't be reached. Includes a link back to the Cells dashboard,
   * the only other place a Handler can find their Cells from. */
  function renderDeepLinkFailure(message) {
    const status = document.getElementById("cell-connect-status");
    if (status) {
      status.textContent = message;
      status.classList.add("is-error");
    }
    const dock = document.getElementById("cell-connect-dock");
    if (dock && !document.getElementById("cell-connect-dashboard-link")) {
      const link = document.createElement("a");
      link.id = "cell-connect-dashboard-link";
      link.className = "button ghost small";
      link.href = "../cells/";
      link.textContent = "Back to Cells dashboard";
      dock.append(link);
    }
    setStatus(message, true);
  }

  /** Multi-Cell entry point for the Live page on every load: a `?cell=<id>` URL param always
   * wins and is always attempted, regardless of what's stored locally. Only when no param is
   * present does this fall back to the per-Handler "last active Cell" pointer (written only
   * after a previous successful attach -- see persistActiveCellPointer). Fails closed: if the
   * target Cell can't be attached (not found, not owned), this shows a blocking error and
   * NEVER falls back to another source -- never silently retries the pointer after a failed
   * param, never auto-creates, never auto-redirects. As a last-resort compatibility path for
   * browsers that had a Cell connected before this pointer existed, falls back to the old
   * role-scoped restoreConnection() -- best-effort only, since that path was never ownership-
   * verified to begin with. */
  async function bootstrapCellFromUrlOrPointer() {
    const remote = window.VeilDaemonCellRemote;
    if (!remote || remote.isConnected()) return;
    const handlerId = await ensureActiveHandlerId();
    if (!handlerId) return; // not signed in yet -- the Open Cell button's own click handler gates sign-in
    const params = new URLSearchParams(window.location.search);
    const paramCellId = (params.get("cell") || "").trim();
    const targetCellId = paramCellId || readActiveCellPointer(handlerId);
    if (!targetCellId) {
      restoreLegacyConnectionIfPossible();
      return;
    }
    const result = await switchToCell(targetCellId);
    if (!result.ok) {
      renderDeepLinkFailure(paramCellId
        ? `CELL NOT FOUND OR NOT YOURS — the link for this Cell no longer works.`
        : `COULD NOT REOPEN YOUR LAST CELL — ${result.error || "it may have been closed."}`);
    }
  }

  /** Best-effort pickup of a pre-Multi-Cell role-scoped connection (see cell-sync-remote.js's
   * restoreConnection) -- never ownership-verified, unlike attachToCell/switchToCell, so this
   * is only reached when neither a `?cell=` param nor the new per-Handler pointer exists. */
  async function restoreLegacyConnectionIfPossible() {
    const remote = window.VeilDaemonCellRemote;
    const restored = remote.restoreConnection(handlerCellConnectGetToken, "handler");
    if (restored) {
      renderCellConnectStatus();
      subscribeLobbyRollsIfConnected();
      subscribeCellEventsIfConnected();
      joinPresenceIfConnected();
      // Chat's topic is scoped by (cellId, operationId); refreshSeatRoster's pull is what
      // learns the restored Cell's actual active Operation (setActiveOperationId as a side
      // effect) -- must resolve before subscribing chat, or a reconnect into an already-
      // active Operation would subscribe the wrong ("lobby") topic.
      await refreshSeatRoster();
      window.HandlerCellSync?.subscribeChatIfConnected?.();
    }
  }

  // Guards against two overlapping switchToCell calls (e.g. a fast double-click on two
  // different "Resume" cards): incremented at the START of every call, independent of the
  // active-context generation (which only bumps once a call's OWN attachToCell actually
  // succeeds). If a newer switchToCell has started by the time this call's attach resolves,
  // this call abandons its own steps 7-9 rather than clobbering the newer call's result --
  // the newer call owns rendering/subscribing from that point on.
  let latestSwitchAttempt = 0;

  /**
   * Multi-Cell switch orchestration -- sequential, single-focus: the Handler views one Cell
   * at a time (like browser tabs), never two simultaneously. Ordered exactly as the Multi-
   * Cell Handler Management plan specifies: flush A's pending sync, unsubscribe A's Realtime/
   * Presence, clear A's transient UI, point local storage at B's namespace, attach to B
   * (fails closed on ownership failure -- and it's this attach's own setConnection call that
   * atomically bumps the active-context generation the instant Cell B is confirmed, so
   * there's never a window where `connection` points at B but the generation still reflects
   * A or vice versa), subscribe B's Realtime/Presence, render B.
   *
   * Returns { ok, error? } rather than throwing -- callers (the Cells dashboard, the ?cell=
   * deep-link bootstrap) always need to render a failure state inline, not catch an exception.
   */
  async function switchToCell(cellId) {
    const remote = window.VeilDaemonCellRemote;
    if (!remote || !cellId) return { ok: false, error: "cellId is required." };
    const myAttempt = (latestSwitchAttempt += 1);
    const handlerId = await ensureActiveHandlerId();
    if (!handlerId) return { ok: false, error: "Not signed in." };
    if (myAttempt !== latestSwitchAttempt) return { ok: false, error: "Superseded by a later switch." };

    // 1. Flush Cell A's pending sync (no-op if nothing was connected).
    if (remote.isConnected() && window.HandlerCellSync?.flushOperationSync) {
      await window.HandlerCellSync.flushOperationSync();
    }
    if (myAttempt !== latestSwitchAttempt) return { ok: false, error: "Superseded by a later switch." };

    // 2. Unsubscribe Cell A's Realtime/Presence.
    unsubscribeLobbyRollsIfAny();
    unsubscribeCellEventsIfAny();
    window.HandlerCellSync?.unsubscribeChatIfAny?.();
    leavePresenceIfAny();
    // 3. Clear Cell A's transient UI.
    remote.clearCellEvents?.();
    window.HandlerCellSync?.clearChatBuffer?.();
    renderSeatRoster([]);

    // 4. Point local storage at Cell B's namespace before any local read/write on it.
    if (window.HandlerState?.setActiveStorageScope) {
      window.HandlerState.setActiveStorageScope(handlerId, cellId);
    }

    // 5. Attach to Cell B -- fails closed; never leaves an unowned/nonexistent Cell live.
    let attached;
    try {
      attached = await remote.attachToCell(handlerCellConnectGetToken, { cellId });
    } catch (error) {
      if (myAttempt === latestSwitchAttempt) renderCellConnectStatus();
      return { ok: false, error: error?.message || "Could not open that Cell (not found, or not yours)." };
    }
    if (myAttempt !== latestSwitchAttempt) return { ok: false, error: "Superseded by a later switch." };

    remote.setActiveOperationId?.(attached?.operation ? attached.operation.id : null);
    persistActiveCellPointer(handlerId, cellId);

    // 6-7. Subscribe Cell B's Realtime/Presence, then render.
    renderCellConnectStatus(attached?.session?.join_code);
    subscribeLobbyRollsIfConnected();
    subscribeCellEventsIfConnected();
    joinPresenceIfConnected();
    window.HandlerCellSync?.subscribeChatIfConnected?.();
    await refreshSeatRoster();
    if (window.HandlerCellSync?.renderOperationLifecycle) await window.HandlerCellSync.renderOperationLifecycle();
    if (window.HandlerCellSync?.renderChat) window.HandlerCellSync.renderChat();

    return { ok: true, session: attached?.session, operation: attached?.operation };
  }

  /** Cell-scoped "last active Cell" pointer -- separate from the role-scoped connection-
   * restore key, and only ever written AFTER a successful attach (never optimistically),
   * so a failed deep-link attempt can never corrupt what a future no-`?cell=`-param load
   * falls back to. */
  function activeCellPointerKey(handlerId) {
    return `veildaemon.handlerActiveCell.${handlerId}.v1`;
  }
  function persistActiveCellPointer(handlerId, cellId) {
    try {
      window.localStorage.setItem(activeCellPointerKey(handlerId), cellId);
    } catch (_error) {
      // Best-effort.
    }
  }
  function readActiveCellPointer(handlerId) {
    try {
      return window.localStorage.getItem(activeCellPointerKey(handlerId)) || "";
    } catch (_error) {
      return "";
    }
  }

  // Exposed for the Cells dashboard's deep-link navigation target (handler/live/?cell=<id>)
  // and its own bootstrap logic, and for direct test access.
  window.HandlerCellLifecycle = { switchToCell, ensureActiveHandlerId, readActiveCellPointer };

  function bindCellSync() {
    if (!window.HandlerCellSync?.bind) return;
    window.HandlerCellSync.bind({
      onAfter: (result) => {
        if (result?.state) state = result.state;
        syncForm();
        renderDynamic();
        renderPlayers();
        renderRiskStrip();
        renderTrackPromptQueue();
        renderActionEconomyStrip();
        notifyPendingAlerts({ forceAlert: true });
        if (window.HandlerTriggers) window.HandlerTriggers.render(state);
        if (result?.summary) setStatus(result.summary.split("\n")[0] || result.summary);
        refreshSeatRoster();
      }
    });
  }

  async function init() {
    await api.loadTemplates();
    bindForm();
    bindDataControls();
    bindDashboardMode();
    bindLiveView();
    bindTriggerBridge();
    bindWindDownBridge();
    bindCollapseBridge();
    bindClueBridge();
    bindCellSync();
    bindCellConnect();
    renderAll();
    await hydrateClues(false);
  }

  init();
}());
