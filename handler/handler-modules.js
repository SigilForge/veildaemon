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

  function slug(value) {
    return api.safeString(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "operator";
  }

  function formatStamp(value) {
    const source = api.safeString(value, 80);
    if (!source) return "";
    const date = new Date(source);
    if (Number.isNaN(date.getTime())) return source;
    return date.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  }

  function compactJoin(parts, fallback = "") {
    return parts.map((part) => api.safeString(part, 180)).filter(Boolean).join(" // ") || fallback;
  }

  function relationshipSummary(relationships) {
    if (!Array.isArray(relationships) || !relationships.length) return "";
    return relationships.slice(0, 2).map((item) => compactJoin([item.name, item.pressure, item.status], "")).filter(Boolean).join(" // ");
  }

  function readOperatorExport(payload) {
    const isModern = payload && payload.exportType === "cradlepoint.operator";
    const record = payload && (payload.operatorRecord || payload.record || payload.operator || {});
    const status = payload && (payload.operatorStatus || payload.status || payload.consoleState?.operatorStatus || {});
    const hasLegacyShape = record && typeof record === "object" && (record.designation || record.primaryFrequency || record.observerClassification);
    const hasStatusShape = status && typeof status === "object" && (status.operatorName || status.designation || status.stability || status.lotus);
    if (!isModern && !hasLegacyShape && !hasStatusShape) return null;

    const lotus = status.lotus && typeof status.lotus === "object" ? status.lotus : {};
    const pips = Object.entries(lotus)
      .map(([name, value]) => [api.safeString(name, 40), Number(value || 0)])
      .filter(([name, value]) => name && value > 0)
      .map(([name, value]) => `${name} ${value}`)
      .join(" // ");
    const primaryFrequency = api.safeString(record.primaryFrequency || status.selectedLotusPetal || Object.keys(lotus).find((name) => Number(lotus[name] || 0) > 0), 80);
    const equipment = equipmentSummary(payload.operatorEquipment || payload.equipment || payload.consoleState?.equipment);
    const operatorName = api.safeString(payload.operatorName || status.operatorName || record.operatorName || record.designation || status.designation || "Operator", 80);
    const sourceId = api.safeString(payload.operatorId || record.id || record.operatorId || record.designation || status.designation || "", 120);
    const stabilityBand = api.safeString(status.stabilityBand || status.stabilityState || "", 40);
    const stabilityValue = api.safeString(status.stability, 20);
    const stability = stabilityBand && stabilityValue ? `${stabilityBand} (${stabilityValue}/10)` : stabilityBand || stabilityValue;
    const voidBreach = compactJoin([
      status.voidBreach,
      status.voidMarks ? `Void ${status.voidMarks}` : "",
      status.breachPoints ? `Breach ${status.breachPoints}` : ""
    ]);

    return {
      id: sourceId ? `operator-${slug(sourceId)}` : `operator-${slug(operatorName)}-${Date.now()}`,
      sourceId,
      name: operatorName,
      stability,
      harm: compactJoin([status.harm, status.harmBoxes ? `Harm ${status.harmBoxes}/5` : ""]),
      misfire: compactJoin([status.activeMisfire, status.misfireSeverity && status.misfireSeverity !== "None" ? status.misfireSeverity : "", status.misfires]),
      voidBreach,
      anchors: compactJoin([status.anchorPerson, status.anchors, status.totemObject]),
      emotionalState: compactJoin([status.emotionalState]),
      relationshipPressure: compactJoin([status.relationshipPressure, relationshipSummary(payload.relationships || payload.consoleState?.relationships)]),
      primaryFrequency,
      frequencyPips: pips,
      equipment,
      sourceExportedAt: api.safeString(payload.exportedAt || payload.updatedAt || status.updatedAt, 80),
      lastImported: new Date().toISOString()
    };
  }

  function equipmentSummary(equipment) {
    if (!Array.isArray(equipment) || !equipment.length) return "";
    const optional = equipment
      .filter((item) => item && item.category !== "Default Kit")
      .map((item) => api.safeString(item.item || item.name, 80))
      .filter(Boolean);
    const defaults = equipment
      .filter((item) => item && item.category === "Default Kit")
      .map((item) => api.safeString(item.item || item.name, 80))
      .filter(Boolean);
    return optional.slice(0, 5).join(" // ") || defaults.slice(0, 5).join(" // ");
  }

  function operatorIsBlank(operator) {
    const defaultName = /^Operator \d+$/.test(api.safeString(operator.name, 80));
    return (defaultName || !api.safeString(operator.name, 80))
      && !["stability", "harm", "misfire", "voidBreach", "anchors", "emotionalState", "relationshipPressure", "primaryFrequency", "frequencyPips", "equipment"].some((field) => api.safeString(operator[field], 180));
  }

  function upsertImportedOperator(summary) {
    const sourceMatch = summary.sourceId
      ? state.players.findIndex((operator) => operator.sourceId === summary.sourceId || operator.id === summary.id)
      : -1;
    if (sourceMatch >= 0) {
      state.players[sourceMatch] = { ...state.players[sourceMatch], ...summary };
      return "replaced";
    }

    const blankIndex = state.players.findIndex(operatorIsBlank);
    if (blankIndex >= 0) {
      state.players[blankIndex] = { ...state.players[blankIndex], ...summary };
      return "accepted";
    }

    const nameMatch = state.players.findIndex((operator) => operator.name.toLowerCase() === summary.name.toLowerCase());
    if (nameMatch >= 0) {
      const replace = window.confirm(`Replace existing Operator summary for ${summary.name}?`);
      if (!replace) return "skipped";
      state.players[nameMatch] = { ...state.players[nameMatch], ...summary };
      return "replaced";
    }

    state.players.push(summary);
    return "accepted";
  }

  function renderImportResults(results) {
    const node = document.getElementById("operator-import-results");
    if (!node) return;
    node.textContent = "";
    results.forEach((result) => {
      const line = document.createElement("p");
      line.className = `import-result is-${result.action}`;
      line.textContent = `${result.file}: ${result.action.toUpperCase()}${result.name ? ` - ${result.name}` : ""}`;
      node.append(line);
    });
  }

  function bindOperatorImport() {
    const input = document.getElementById("import-operator-file");
    if (!input) return;
    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const results = [];
      for (const file of files) {
        try {
          const payload = JSON.parse(await file.text());
          const summary = readOperatorExport(payload);
          if (!summary) throw new Error("Not an Operator export.");
          const action = upsertImportedOperator(summary);
          results.push({ file: file.name, action, name: summary.name });
        } catch (error) {
          results.push({ file: file.name, action: "refused", name: error.message });
        }
      }
      state = api.normalizeState(state);
      writeState("OPERATOR IMPORTED");
      renderOperators();
      renderImportResults(results);
      input.value = "";
    });
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

  function syncAttentionFromNeedlepoint() {
    collectForm();
    state = api.normalizeState(state);
    syncForm();
    writeState();
    renderDynamic();
    if (window.HandlerNav) window.HandlerNav.renderSessionStrip();
  }

  function bindAttentionControl() {
    const select = document.querySelector('[name="attention.current"]');
    if (!select) return;
    select.addEventListener("change", syncAttentionFromNeedlepoint);
  }

  function bindSimpleForm() {
    document.querySelectorAll("[name]").forEach((input) => {
      if (input.name === "attention.current") return;
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
        if (window.HandlerNav) window.HandlerNav.renderSessionStrip();
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
          <label>Primary Frequency<input data-operator="${index}" data-field="primaryFrequency" maxlength="80" /></label>
          <label>Frequency Pips<input data-operator="${index}" data-field="frequencyPips" maxlength="180" /></label>
        </div>
        <label>Relationship Pressure<input data-operator="${index}" data-field="relationshipPressure" maxlength="180" /></label>
        <label>Equipment Summary<input data-operator="${index}" data-field="equipment" maxlength="260" /></label>
        <div class="import-meta">
          <span>Source Timestamp: ${api.safeString(formatStamp(operator.sourceExportedAt), 80) || "Not imported"}</span>
          <span>Last Imported: ${api.safeString(formatStamp(operator.lastImported), 80) || "Manual summary"}</span>
        </div>
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
      state.players.push({ id: `operator-${Date.now()}`, name: `Operator ${next}`, stability: "", harm: "", misfire: "", voidBreach: "", anchors: "", emotionalState: "", relationshipPressure: "", primaryFrequency: "", frequencyPips: "", equipment: "", sourceExportedAt: "", lastImported: "", sourceId: "" });
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

  function bindAuthorizationExport() {
    const form = document.getElementById("authorization-form");
    if (!form) return;
    const preview = document.getElementById("authorization-preview");
    const copy = document.getElementById("copy-authorization");
    const refreshPreview = () => {
      const payload = buildAuthorizationPayload(new FormData(form), { allowEmpty: true });
      if (preview) preview.textContent = JSON.stringify(payload, null, 2);
    };
    form.addEventListener("input", refreshPreview);
    form.addEventListener("change", refreshPreview);
    if (copy) copy.addEventListener("click", async () => {
      const payload = buildAuthorizationPayload(new FormData(form), { allowEmpty: true });
      const text = JSON.stringify(payload, null, 2);
      if (preview) preview.textContent = text;
      try {
        await navigator.clipboard.writeText(text);
        setStatus("Authorization packet copied.");
      } catch (error) {
        setStatus("COPY REFUSED", true);
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = buildAuthorizationPayload(data);
      if (!payload.flags.length) {
        setStatus("NO AUTHORIZATION FLAGS", true);
        return;
      }
      if (preview) preview.textContent = JSON.stringify(payload, null, 2);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = api.safeString(payload.packetLabel || payload.operatorName || "operator", 100).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      link.href = url;
      link.download = `cradlepoint-authorization-${safeName || "operator"}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("AUTHORIZATION PACKET EXPORTED");
    });
    refreshPreview();
  }

  function buildAuthorizationPayload(data, options = {}) {
    const flags = [];
    const ontologies = data.getAll("ontology").map((value) => api.safeString(value, 80)).filter(Boolean);
    const backgrounds = data.getAll("background").map((value) => api.safeString(value, 80)).filter(Boolean);
    const caseUnlock = api.safeString(data.get("case"), 80);
    const voidReward = Math.max(0, Math.min(13, Math.round(Number(data.get("voidReward") || 0))));
    const breachReward = Math.max(0, Math.min(99, Math.round(Number(data.get("breachReward") || 0))));
    ontologies.forEach((ontology) => flags.push(`ONTOLOGY_UNLOCK:${ontology}`));
    backgrounds.forEach((background) => flags.push(`BACKGROUND_UNLOCK:${background}`));
    if (caseUnlock) flags.push(`CASE_UNLOCK:${caseUnlock}`);
    if (voidReward > 0) flags.push(`VOID_REWARD:${voidReward}`);
    if (breachReward > 0) flags.push(`BREACH_REWARD:${breachReward}`);
    api.safeString(data.get("customFlags"), 1000)
      .split(/\r?\n/)
      .map((line) => api.safeString(line, 120).toUpperCase().replace(/\s+/g, "_"))
      .filter((line) => /^(ONTOLOGY|BACKGROUND|CASE)_UNLOCK:[A-Z0-9_ -]+$/.test(line) || /^(VOID|BREACH)_REWARD:\d+$/.test(line))
      .forEach((line) => {
        if (!flags.includes(line)) flags.push(line);
      });
    const packetLabel = api.safeString(data.get("packetLabel"), 100);
    const operatorName = api.safeString(data.get("operatorName"), 80);
    return {
      exportType: "cradlepoint.authorization",
      version: 1,
      exportedAt: options.allowEmpty ? "PREVIEW" : new Date().toISOString(),
      packetLabel,
      operatorName,
      flags,
      note: api.safeString(data.get("note"), 1000) || defaultAuthorizationNote(flags)
    };
  }

  function defaultAuthorizationNote(flags) {
    const ontologyLabels = flags
      .filter((flag) => flag.startsWith("ONTOLOGY_UNLOCK:"))
      .map((flag) => api.presentationEntry(flag.split(":")[1]).displayName);
    const backgroundLabels = flags
      .filter((flag) => flag.startsWith("BACKGROUND_UNLOCK:"))
      .map((flag) => api.backgroundEntry(flag.split(":")[1]).displayName);
    if (ontologyLabels.length) {
      return `NEW ONTOLOGY SIGNAL DETECTED\n\nHandler authorization received.\n\n${ontologyLabels.join(", ")} available for review.`;
    }
    if (backgroundLabels.length) {
      return `BACKGROUND AUTHORIZATION RECEIVED\n\nHandler authorization received.\n\n${backgroundLabels.join(", ")} available for review.`;
    }
    return "HANDLER AUTHORIZATION RECEIVED\n\nNew Operator option available for review.";
  }

  function renderAuthorizationCatalogs() {
    const ontology = document.querySelector('[name="ontology"]');
    const background = document.querySelector('[name="background"]');
    if (ontology) {
      ontology.textContent = "";
      api.presentationOptions().forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.key;
        option.textContent = `${entry.label} // ${entry.access}`;
        ontology.append(option);
      });
    }
    if (background) {
      background.textContent = "";
      api.backgroundOptions().forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.key;
        option.textContent = `${entry.label} // ${entry.access}`;
        background.append(option);
      });
    }
  }

  function renderPlayerView() {
    const payload = api.playerViewPayload(state);
    text("safe-scene", payload.scene, "Scene pending.");
    text("safe-scene-detail", payload.scene, "Scene pending.");
    text("safe-instruction", payload.instruction, "Stay real. Stay alive.");
    text("safe-consequence", payload.consequence, "");
    const stateNode = document.getElementById("safe-state");
    const clockNode = document.getElementById("safe-clock");
    const consequenceNode = document.getElementById("safe-consequence");
    if (stateNode) stateNode.closest("div").hidden = true;
    if (clockNode) clockNode.closest("div").hidden = true;
    if (consequenceNode) consequenceNode.closest("div").hidden = !payload.consequence;
  }

  function renderAttentionHint() {
    const hint = document.getElementById("attention-deterministic-hint");
    if (hint) hint.hidden = !api.hasActiveNeedlepoint(state);
  }

  function entityCardSummary(entity) {
    return [
      entity.kind,
      entity.sceneState,
      entity.loop?.Need,
      entity.loop?.Pressure
    ].map((part) => api.safeString(part, 120)).filter(Boolean).join(" // ") || "Loop pending.";
  }

  function renderEntityLibrary() {
    const grid = document.getElementById("entity-library-grid");
    if (!grid) return;
    grid.textContent = "";
    const library = Array.isArray(state.entityLibrary) ? state.entityLibrary : [];
    if (!library.length) {
      grid.append(emptyEntityLine("No extra Entities / Zones staged. Add one when a second pressure field is live."));
      return;
    }
    library.forEach((entity, index) => {
      const card = document.createElement("article");
      card.className = "player-card entity-library-card";
      card.innerHTML = `
        <div class="player-head">
          <strong>${api.safeString(entity.name || "Unnamed Entity / Zone", 120)}</strong>
          <div class="entity-library-actions">
            <button class="button primary no-print" type="button" data-activate-entity="${index}">Set Active</button>
            <button class="entry-remove no-print" type="button" data-remove-entity="${index}">Remove</button>
          </div>
        </div>
        <p class="helper-copy">${api.safeString(entityCardSummary(entity), 260)}</p>
        <label>Notes<textarea data-entity-notes="${index}" rows="3"></textarea></label>
      `;
      grid.append(card);
      const notes = card.querySelector(`[data-entity-notes="${index}"]`);
      if (notes) {
        notes.value = entity.notes || "";
        notes.addEventListener("input", () => {
          state.entityLibrary[index].notes = api.safeString(notes.value, 1200);
          writeState();
        });
      }
    });
    grid.querySelectorAll("[data-activate-entity]").forEach((button) => {
      button.addEventListener("click", () => activateEntity(Number(button.dataset.activateEntity)));
    });
    grid.querySelectorAll("[data-remove-entity]").forEach((button) => {
      button.addEventListener("click", () => {
        state.entityLibrary.splice(Number(button.dataset.removeEntity), 1);
        writeState();
        renderEntityLibrary();
      });
    });
  }

  function emptyEntityLine(copy) {
    const line = document.createElement("p");
    line.className = "helper-copy";
    line.textContent = copy;
    return line;
  }

  function activateEntity(index) {
    const library = Array.isArray(state.entityLibrary) ? state.entityLibrary : [];
    const selected = library[index];
    if (!selected) return;
    const current = {
      id: `entity-${Date.now()}`,
      name: state.activeEntity.name,
      kind: state.activeEntity.kind,
      sceneState: state.activeEntity.sceneState,
      loop: { ...state.entityLoop },
      notes: state.activeEntity.notes
    };
    library[index] = current;
    state.entityLibrary = library;
    state.activeEntity = {
      name: selected.name,
      kind: selected.kind,
      sceneState: selected.sceneState,
      notes: selected.notes
    };
    state.entityLoop = { ...selected.loop };
    state = api.normalizeState(state);
    syncForm();
    writeState("ENTITY ACTIVATED");
    renderEntityLibrary();
    if (window.HandlerNav) window.HandlerNav.renderFieldLock();
  }

  function addEntity() {
    const button = document.getElementById("add-entity");
    if (!button) return;
    button.addEventListener("click", () => {
      const next = (state.entityLibrary?.length || 0) + 1;
      if (!Array.isArray(state.entityLibrary)) state.entityLibrary = [];
      state.entityLibrary.push({
        id: `entity-${Date.now()}`,
        name: `Entity / Zone ${next}`,
        kind: "Entity",
        sceneState: state.sceneState.current,
        loop: {
          Need: "",
          Lure: "",
          Pressure: "",
          Gift: "",
          Violence: "",
          Exit: ""
        },
        notes: ""
      });
      writeState("ENTITY ADDED");
      renderEntityLibrary();
      if (window.HandlerNav) window.HandlerNav.renderFieldLock();
    });
  }

  function renderModuleContext() {
    text("module-case", state.session.caseTitle, "No case loaded");
    text("module-attention", state.attention.current, "Unseen");
    text("module-clock", api.publicClockLabel(state), "0/6");
    text("module-active-consequence", state.sceneState.primaryConsequence, "Set Attention and Clock.");
    text("module-needlepoint-scaffold", state.activeNeedlepoint?.scaffold || state.caseFile.templates || "No active Needlepoint loaded.");
    if (window.HandlerNav) window.HandlerNav.renderSessionStrip();
  }

  function text(id, value, fallback) {
    const node = document.getElementById(id);
    if (node) node.textContent = api.safeString(value, 220) || fallback || "Unset";
  }

  function renderDynamic() {
    renderClock("primary-clock-track", state.primaryClock, "primaryClock", true);
    renderClock("secondary-clock-track", state.secondaryClock, "secondaryClock", state.secondaryClock.enabled);
    renderAttentionHint();
    renderModuleContext();
    if (window.HandlerNav) window.HandlerNav.renderFieldLock();
    renderPlayerView();
    text("clock-warning", api.clockWarning(state.primaryClock), "No warning.");
  }

  function renderAll() {
    state = api.readState();
    renderAuthorizationCatalogs();
    fillSelect("attention.current", api.attentionStates);
    fillSelect("activeEntity.kind", ["Entity", "Zone"]);
    fillSelect("activeEntity.sceneState", api.sceneStates.map((item) => item.name));
    bindAttentionControl();
    syncForm();
    renderDynamic();
    renderNpcs();
    renderOperators();
    renderResidueLog();
    renderEntityLibrary();
    setStatus("LOCAL READY");
    if (window.HandlerNav) window.HandlerNav.render();
  }

  bindSimpleForm();
  bindDataControls();
  bindOperatorImport();
  bindAuthorizationExport();
  addNpcs();
  addOperators();
  addResidue();
  addEntity();
  renderAll();
  document.body.classList.add(`handler-module-${moduleName}`);
}());
