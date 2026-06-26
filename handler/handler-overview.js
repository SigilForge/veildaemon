(function () {
  const api = window.HandlerState;
  let state = api.readState();

  function text(id, value, fallback = "Unset") {
    const node = document.getElementById(id);
    if (node) node.textContent = api.safeString(value, 260) || fallback;
  }

  function setStatus(message, isError) {
    const node = document.getElementById("storage-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", Boolean(isError));
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

  function renderOverview() {
    state = api.readState();
    text("overview-scene-state", state.sceneState.current, "Stable");
    text("overview-primary-clock", api.publicClockLabel(state), "0/6");
    text("overview-loop-summary", `${state.entityLoop.Need || "Need pending"} / ${state.entityLoop.Pressure || "Pressure pending"} / ${state.entityLoop.Exit || "Exit pending"}`);
    text("overview-room-answer", roomAnswer());

    renderNpcs();
    text("overview-entity-active", state.activeEntity.name || state.session.location || "No active Entity or Zone.");
    text("overview-entity-pressure", state.entityLoop.Pressure, "Pressure pending.");
    text("overview-entity-exit", state.entityLoop.Exit, "Exit pending.");
    text("overview-entity-state", state.activeEntity.sceneState || state.sceneState.current, "Stable");

    text("overview-clock-primary", api.publicClockLabel(state), "0/6");
    text("overview-clock-secondary", state.secondaryClock.enabled ? `${state.secondaryClock.name || "Secondary Clock"} ${state.secondaryClock.current}/${state.secondaryClock.segments}` : "Disabled");
    text("overview-clock-warning", api.clockWarning(state.primaryClock), "No warning.");

    text("overview-case", state.session.caseTitle, "No case selected.");
    text("overview-location", state.session.location, "No location.");
    text("overview-next-clue", state.caseFile.nextClue, "No clue staged.");
    text("overview-next-pressure", state.caseFile.nextPressureBeat, "No beat staged.");

    text("overview-attention", state.attention.current, "Unseen");
    text("overview-residue", state.attention.residue, "None logged.");
    text("overview-follows-home", state.attention.followsHome, "None logged.");
    text("overview-unresolved", state.unresolvedConsequences || state.handlerNotes.consequenceQueue, "No unresolved consequences.");

    renderOperators();
    const playerSafe = api.playerViewPayload(state);
    text("overview-player-scene", playerSafe.scene, "Scene pending.");
    text("overview-player-clock", playerSafe.consequence ? "Player-safe only" : "Hidden from Player View");
    text("overview-player-consequence", playerSafe.consequence || "No player-safe consequence set.");
    if (window.HandlerNav) window.HandlerNav.render();
  }

  function roomAnswer() {
    if (!state.roomAnswer.object && !state.roomAnswer.emotionalInput && !state.roomAnswer.consequence) return "Object, feeling, consequence pending.";
    return `${state.roomAnswer.object || "Object"} + ${state.roomAnswer.emotionalInput || "feeling"} -> ${state.roomAnswer.consequence || "consequence"}`;
  }

  function renderNpcs() {
    const list = document.getElementById("overview-npcs");
    if (!list) return;
    const active = state.npcs.filter((npc) => npc.name || npc.role || npc.pressure || npc.location).slice(0, 5);
    list.textContent = "";
    if (!active.length) {
      list.append(emptyLine("No active NPCs."));
      return;
    }
    active.forEach((npc) => {
      const row = document.createElement("p");
      row.innerHTML = `<strong>${api.safeString(npc.name || "Unnamed NPC", 80)}</strong><span>${api.safeString([npc.role, npc.pressure, npc.location].filter(Boolean).join(" // "), 180) || "No pressure logged."}</span><em>${npc.flags.join(" // ") || "No flags"}</em>`;
      list.append(row);
    });
  }

  function renderOperators() {
    const list = document.getElementById("overview-operators");
    if (!list) return;
    list.textContent = "";
    state.players.slice(0, 6).forEach((operator) => {
      const row = document.createElement("p");
      row.innerHTML = `<strong>${api.safeString(operator.name || "Operator", 80)}</strong><span>${api.safeString([operator.stability, operator.harm, operator.misfire, operator.primaryFrequency].filter(Boolean).join(" // "), 220) || "No table summary."}</span><em>${api.safeString(operator.equipment || (operator.lastImported ? `Imported ${operator.lastImported.slice(0, 10)}` : operator.anchors), 160) || "Anchor pending"}</em>`;
      list.append(row);
    });
  }

  function emptyLine(copy) {
    const line = document.createElement("p");
    line.className = "empty-line";
    line.textContent = copy;
    return line;
  }

  function bindControls() {
    const applyTemplate = document.getElementById("apply-template");
    const picker = document.getElementById("template-picker");
    if (applyTemplate && picker) applyTemplate.addEventListener("click", () => {
      const template = api.templates.find((item) => item.id === picker.value) || api.templates[0];
      try {
        state = api.writeState(api.mergeDeep(state, template.data), `${template.name.toUpperCase()} LOADED`);
        setStatus(`${template.name.toUpperCase()} LOADED`);
        renderOverview();
      } catch (error) {
        setStatus("STORAGE REFUSED", true);
      }
    });

    const exportButton = document.getElementById("export-case");
    if (exportButton) exportButton.addEventListener("click", () => {
      state = api.readState();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (state.session.caseTitle || "handler-overview").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      link.href = url;
      link.download = `veildaemon-${safeName || "handler-overview"}-${new Date().toISOString().slice(0, 10)}.json`;
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
        setStatus("IMPORT ACCEPTED");
        renderOverview();
      } catch (error) {
        setStatus("IMPORT REFUSED", true);
      } finally {
        importInput.value = "";
      }
    });

    const resetButton = document.getElementById("reset-dashboard");
    if (resetButton) resetButton.addEventListener("click", () => {
      if (!window.confirm("Reset the local Handler case record in this browser?")) return;
      try {
        window.localStorage.removeItem(api.storageKey);
      } catch (error) {
        // Local cleanup is best effort.
      }
      state = api.readState();
      setStatus("LOCAL RESET");
      renderOverview();
    });
  }

  async function init() {
    await api.loadTemplates();
    renderTemplates();
    bindControls();
    renderOverview();
  }

  init();
}());
