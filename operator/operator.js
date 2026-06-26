(function () {
  const catalogs = window.CradlepointCatalogs || {};
  const consoleStorageKey = "veildaemon.operatorConsole.v1";
  const recordStorageKey = "veildaemon.operatorRecord.v2";
  const legacyRecordStorageKey = "veildaemon.operatorRecord.v1";
  const rewardStorageKey = "veildaemon.artifactCache.v1";
  const apiBase = window.location.hostname === "veildaemon.app" || window.location.hostname === "www.veildaemon.app"
    ? "https://api.veildaemon.app"
    : "";

  const defaults = {
    version: 1,
    createdAt: "",
    updatedAt: "",
    cases: [],
    unlocks: [],
    appliedUnlocks: [],
    equipment: [
      { id: "default-phone", category: "Default Kit", item: "Phone", slot: "No slot", reason: "Default kit", locked: true },
      { id: "default-power", category: "Default Kit", item: "Charger or power bank", slot: "No slot", reason: "Default kit", locked: true },
      { id: "default-flashlight", category: "Default Kit", item: "Flashlight", slot: "No slot", reason: "Default kit", locked: true },
      { id: "default-notebook", category: "Default Kit", item: "Pen and notebook", slot: "No slot", reason: "Default kit", locked: true },
      { id: "default-first-aid", category: "Default Kit", item: "Basic first-aid kit", slot: "No slot", reason: "Default kit", locked: true },
      { id: "default-water", category: "Default Kit", item: "Water bottle", slot: "No slot", reason: "Default kit", locked: true },
      { id: "default-carry", category: "Default Kit", item: "Backpack, messenger bag, or jacket pockets", slot: "No slot", reason: "Default kit", locked: true },
      { id: "default-anchor", category: "Default Kit", item: "One personal Anchor item", slot: "No slot", reason: "Name it in Frequency notes", locked: true },
      { id: "default-background", category: "Default Kit", item: "One practical tool tied to your background", slot: "No slot", reason: "Add the specific tool below", locked: true }
    ],
    operatorStatus: {
      stability: "10",
      stabilityBand: "Calm",
      attentionState: "Unnoticed",
      operatorName: "",
      designation: "",
      role: "Operator",
      activeNeedlepoint: "",
      background: "",
      ontologyPresentation: "",
      creationMode: false,
      frequencyEditMode: false,
      harm: "None recorded",
      harmBoxes: "0",
      voidMarks: "0",
      voidByFrequency: {
        Dream: "0",
        Hunger: "0",
        Silence: "0",
        Stillness: "0",
        Empyrean: "0",
        Becoming: "0"
      },
      breachPoints: "0",
      activeMisfire: "",
      misfireSeverity: "None",
      presentationPressure: "0",
      lotus: {
        Dream: "0",
        Hunger: "0",
        Silence: "0",
        Stillness: "0",
        Empyrean: "0",
        Becoming: "0"
      },
      blindPetal: "",
      selectedLotusPetal: "",
      attributes: {
        Body: "1",
        Agility: "1",
        Mind: "1",
        Instinct: "1",
        Presence: "1",
        Nerves: "1"
      },
      skills: {},
      rollAttributeKey: "Body",
      rollSkillKey: "",
      rollModifier: "0",
      rollAdvantage: false,
      rollDisadvantage: false,
      quickNotes: "",
      expressions: "",
      bleed: "",
      misfires: "",
      commonTell: "",
      misfireFlavor: "",
      anchorPerson: "",
      totemObject: "",
      groundingLine: "",
      recoveryGround: false,
      recoveryBreathe: false,
      recoveryConnect: false,
      recoveryLeave: false,
      recoveryNameIt: false,
      voidBreach: "",
      emotionalState: ""
    },
    anomalies: [],
    relationships: [],
    residue: []
  };

  const lists = {
    cases: document.getElementById("case-list"),
    equipment: document.getElementById("equipment-list"),
    anomalies: document.getElementById("anomaly-list"),
    relationships: document.getElementById("relationship-list"),
    residue: document.getElementById("residue-list")
  };

  const forms = {
    cases: document.getElementById("case-form"),
    equipment: document.getElementById("equipment-form"),
    status: document.getElementById("status-form"),
    frequency: document.getElementById("frequency-form"),
    anomalies: document.getElementById("anomaly-form"),
    relationships: document.getElementById("relationship-form"),
    residue: document.getElementById("residue-form")
  };

  const equipmentOptions = {
    "Default Kit": [
      "Phone",
      "Charger or power bank",
      "Flashlight",
      "Pen and notebook",
      "Basic first-aid kit",
      "Water bottle",
      "Backpack, messenger bag, or jacket pockets",
      "One personal Anchor item",
      "One practical tool tied to your background"
    ],
    "Optional Carry": [
      "Pocket knife or multitool",
      "Pepper spray",
      "Handgun with one spare magazine",
      "Basic flak jacket",
      "Work gloves",
      "Lighter",
      "Duct tape",
      "Cheap audio recorder",
      "Camera",
      "Chalk or marker",
      "Basic lockpick set",
      "Laptop or tablet",
      "Religious, occult, or family keepsake"
    ],
    "Background Tool": [
      "Mechanic: socket wrench, jumper cables, work light",
      "Nurse / EMT: better first-aid kit, gloves, trauma shears",
      "Student: laptop, school bag, campus ID",
      "Security: radio, flashlight, restraints",
      "Occultist: chalk, salt, candles, notebook",
      "Technician: toolkit, cables, diagnostic meter",
      "Journalist: recorder, camera, press badge",
      "Parent: snacks, wipes, blanket, kid's toy",
      "Driver: tire iron, roadside kit, maps"
    ],
    Custom: ["Custom item"]
  };

  const equipmentSlots = {
    "Phone": "No slot",
    "Charger or power bank": "No slot",
    "Flashlight": "No slot",
    "Pen and notebook": "No slot",
    "Basic first-aid kit": "No slot",
    "Water bottle": "No slot",
    "Backpack, messenger bag, or jacket pockets": "No slot",
    "One personal Anchor item": "No slot",
    "One practical tool tied to your background": "No slot",
    "Pocket knife or multitool": "Minor",
    "Pepper spray": "Minor",
    "Handgun with one spare magazine": "Minor",
    "Basic flak jacket": "Major",
    "Work gloves": "No slot",
    "Lighter": "No slot",
    "Duct tape": "Minor",
    "Cheap audio recorder": "Minor",
    "Camera": "Minor",
    "Chalk or marker": "No slot",
    "Basic lockpick set": "Minor",
    "Laptop or tablet": "Minor",
    "Religious, occult, or family keepsake": "No slot",
    "Mechanic: socket wrench, jumper cables, work light": "Major",
    "Nurse / EMT: better first-aid kit, gloves, trauma shears": "Minor",
    "Student: laptop, school bag, campus ID": "Minor",
    "Security: radio, flashlight, restraints": "Minor",
    "Occultist: chalk, salt, candles, notebook": "Minor",
    "Technician: toolkit, cables, diagnostic meter": "Major",
    "Journalist: recorder, camera, press badge": "Minor",
    "Parent: snacks, wipes, blanket, kid's toy": "Minor",
    "Driver: tire iron, roadside kit, maps": "Major",
    "Custom item": "Minor"
  };

  let consoleState = readConsoleState();
  let operatorRecord = readOperatorRecord();
  const artifactState = readArtifactState();
  let lotusPulseFrequency = "";

  function nowStamp() {
    return new Date().toISOString();
  }

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(defaults));
  }

  function safeString(value, max = 2000) {
    return String(value || "").trim().slice(0, max);
  }

  function titleCaseKey(key) {
    if (typeof catalogs.titleCaseKey === "function") return catalogs.titleCaseKey(key);
    return String(key || "")
      .toLowerCase()
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function presentationEntry(key) {
    if (typeof catalogs.presentationEntry === "function") return catalogs.presentationEntry(key);
    const label = titleCaseKey(key);
    return { label, displayName: label, access: "unknown" };
  }

  function backgroundEntry(key) {
    if (typeof catalogs.backgroundEntry === "function") return catalogs.backgroundEntry(key);
    const label = titleCaseKey(key);
    return { label, displayName: label, access: "unknown" };
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeConsoleState(value) {
    const fallback = cloneDefaultState();
    const now = nowStamp();
    const state = value && typeof value === "object" ? value : {};
    const hasEquipment = Object.prototype.hasOwnProperty.call(state, "equipment");

    return {
      version: 1,
      createdAt: safeString(state.createdAt) || now,
      updatedAt: safeString(state.updatedAt) || now,
      cases: normalizeArray(state.cases),
      unlocks: normalizeUnlocks(state.unlocks),
      appliedUnlocks: normalizeArray(state.appliedUnlocks).map((value) => safeString(value, 120)).filter(Boolean),
      equipment: normalizeEquipment(hasEquipment ? state.equipment : fallback.equipment),
      operatorStatus: migrateOperatorStatus({
        ...fallback.operatorStatus,
        ...(state.operatorStatus && typeof state.operatorStatus === "object" ? state.operatorStatus : {})
      }),
      anomalies: normalizeArray(state.anomalies),
      relationships: normalizeArray(state.relationships),
      residue: normalizeArray(state.residue)
    };
  }

  function normalizeEquipment(value) {
    const list = Array.isArray(value) ? value : [];
    return list.slice(0, 30).map((item, index) => ({
      id: safeString(item.id, 120) || `equipment-${index + 1}`,
      category: safeString(item.category, 80) || "Custom",
      item: safeString(item.item || item.name, 120),
      slot: normalizeEquipmentSlot(item.slot || equipmentSlots[item.item || item.name]),
      reason: safeString(item.reason || item.notes, 220),
      locked: Boolean(item.locked)
    })).filter((item) => item.item);
  }

  function normalizeEquipmentSlot(value) {
    const slot = safeString(value, 20);
    return ["No slot", "Minor", "Major"].includes(slot) ? slot : "Minor";
  }

  function normalizeUnlocks(value) {
    const list = Array.isArray(value) ? value : [];
    return list.slice(0, 40).map((item, index) => ({
      id: safeString(item.id, 120) || `unlock-${index + 1}`,
      type: normalizeUnlockType(item.type),
      key: safeString(item.key, 80).toUpperCase().replace(/[^A-Z0-9_]+/g, "_"),
      label: safeString(item.label, 120),
      note: safeString(item.note, 1000),
      importedAt: safeString(item.importedAt, 80) || nowStamp(),
      applied: Boolean(item.applied)
    })).filter((item) => item.type && item.key);
  }

  function normalizeUnlockType(value) {
    const type = safeString(value, 40).toLowerCase();
    if (["ontology", "background", "case"].includes(type)) return type;
    return "";
  }

  function migrateOperatorStatus(status) {
    return {
      ...status,
      anchorPerson: status.anchorPerson || status.anchors || "",
      attentionState: normalizeAttentionState(status.attentionState),
      frequencyEditMode: Boolean(status.frequencyEditMode),
      creationMode: Boolean(status.creationMode),
      stability: normalizeStabilityValue(status.stability),
      harmBoxes: normalizeBoxValue(status.harmBoxes, 5),
      voidMarks: normalizeNonNegative(status.voidMarks),
      voidByFrequency: normalizeVoidByFrequency(status.voidByFrequency),
      breachPoints: normalizeNonNegative(status.breachPoints),
      activeMisfire: normalizeActiveMisfire(status),
      misfireSeverity: normalizeMisfireSeverity(status.misfireSeverity || severityFromLegacyMisfire(status.misfireBoxes)),
      presentationPressure: normalizeBoxValue(status.presentationPressure, 5),
      lotus: normalizeLotus(status.lotus),
      blindPetal: normalizeFrequencyName(status.blindPetal),
      selectedLotusPetal: normalizeFrequencyName(status.selectedLotusPetal),
      attributes: normalizeAttributes(status.attributes),
      skills: normalizeSkills(status.skills),
      rollAttributeKey: normalizeAttributeName(status.rollAttributeKey) || "Body",
      rollSkillKey: normalizeSkillName(status.rollSkillKey),
      rollModifier: normalizeSignedValue(status.rollModifier, -10, 10),
      rollAdvantage: Boolean(status.rollAdvantage) && !Boolean(status.rollDisadvantage),
      rollDisadvantage: Boolean(status.rollDisadvantage),
      recoveryGround: Boolean(status.recoveryGround),
      recoveryBreathe: Boolean(status.recoveryBreathe),
      recoveryConnect: Boolean(status.recoveryConnect),
      recoveryLeave: Boolean(status.recoveryLeave),
      recoveryNameIt: Boolean(status.recoveryNameIt),
      stabilityBand: bandFromLegacyStability(status.stability)
    };
  }

  function readConsoleState() {
    try {
      return normalizeConsoleState(JSON.parse(window.localStorage.getItem(consoleStorageKey)));
    } catch (error) {
      return normalizeConsoleState(null);
    }
  }

  function writeConsoleState() {
    consoleState.updatedAt = nowStamp();
    try {
      window.localStorage.setItem(consoleStorageKey, JSON.stringify(consoleState));
      window.dispatchEvent(new CustomEvent("veildaemon:operator-record-updated"));
      setStorageStatus("Local console record held in this browser.");
    } catch (error) {
      setStorageStatus("Local storage refused the record. Export before continuing.", true);
    }
  }

  function readOperatorRecord() {
    try {
      const raw = window.localStorage.getItem(recordStorageKey) || window.localStorage.getItem(legacyRecordStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function readArtifactState() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(rewardStorageKey));
      return raw && typeof raw === "object" ? raw : {};
    } catch (error) {
      return {};
    }
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = safeString(value, 140) || "UNRECORDED";
  }

  function setStorageStatus(message, isError) {
    const status = document.getElementById("storage-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  function setAnomalyTransferStatus(message, isError) {
    const status = document.getElementById("anomaly-transfer-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  function renderSnapshot() {
    setText("snapshot-designation", operatorRecord && operatorRecord.designation || "UNINITIALIZED");
    setText("snapshot-classification", operatorRecord && operatorRecord.observerClassification || "PENDING");
    setText("snapshot-frequency", operatorRecord && operatorRecord.primaryFrequency || "UNASSIGNED");
    setText("snapshot-attention", operatorRecord && operatorRecord.attentionStatus || "UNMEASURED");
    setText("snapshot-access", operatorRecord && operatorRecord.accessLevel || "LOCAL");

    const notice = document.getElementById("record-notice");
    const sealedPanel = document.getElementById("operator-sealed-panel");
    document.body.classList.toggle("operator-record-sealed", !operatorRecord);
    if (sealedPanel) sealedPanel.hidden = Boolean(operatorRecord);
    if (!notice) return;

    if (!operatorRecord) {
      notice.innerHTML = '<p><span class="prompt">&gt;</span> No operator intake record found. Console entries remain local, but classification fields will initialize after intake.</p>';
      return;
    }

    const unlocked = Array.isArray(artifactState.unlocked) ? artifactState.unlocked.length : 0;
    notice.innerHTML = `<p><span class="prompt">&gt;</span> Local record detected: ${safeString(operatorRecord.designation, 80)}. Artifact cache reports ${unlocked} recovered item${unlocked === 1 ? "" : "s"}.</p>`;
  }

  function entry(title, rows, collection, id) {
    const article = document.createElement("article");
    article.className = "console-entry";
    const source = (consoleState[collection] || []).find((item) => item.id === id);

    const header = document.createElement("div");
    header.className = "entry-header";
    const h3 = document.createElement("h3");
    h3.textContent = title || "UNLABELED RECORD";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "entry-remove";
    remove.textContent = "Remove";
    if (source && source.locked) {
      remove.disabled = true;
      remove.textContent = "Default";
    } else {
      remove.addEventListener("click", () => {
        consoleState[collection] = consoleState[collection].filter((item) => item.id !== id);
        writeConsoleState();
        renderAll();
      });
    }
    header.append(h3, remove);
    article.append(header);

    rows.filter((row) => row[1]).forEach(([label, value]) => {
      const line = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}:`;
      line.append(strong, ` ${safeString(value, 1200)}`);
      article.append(line);
    });

    return article;
  }

  function renderList(collection, emptyText, getTitle, getRows) {
    const list = lists[collection];
    if (!list) return;
    list.textContent = "";

    if (!consoleState[collection].length) {
      const empty = document.createElement("p");
      empty.className = "empty-line";
      empty.textContent = emptyText;
      list.append(empty);
      return;
    }

    consoleState[collection].forEach((item) => {
      list.append(entry(getTitle(item), getRows(item), collection, item.id));
    });
  }

  function renderEquipmentPicker() {
    const form = forms.equipment;
    if (!form) return;
    const category = form.elements.category;
    const preset = document.getElementById("equipment-preset");
    const slot = document.getElementById("equipment-slot");
    if (!category || !preset) return;
    const selected = category.value || "Optional Carry";
    preset.textContent = "";
    (equipmentOptions[selected] || equipmentOptions.Custom).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      preset.append(option);
    });
    if (slot) slot.value = equipmentSlotForSelection(preset.value, selected === "Custom");
  }

  function syncEquipmentSlot() {
    const preset = document.getElementById("equipment-preset");
    const slot = document.getElementById("equipment-slot");
    if (!preset || !slot) return;
    slot.value = equipmentSlotForSelection(preset.value, preset.value === "Custom item");
  }

  function equipmentSlotForSelection(item, custom = false) {
    if (custom) return equipmentSlots["Custom item"];
    return equipmentSlots[item] || equipmentSlots["Custom item"];
  }

  function equipmentCounts(extra) {
    return [...consoleState.equipment, extra].filter(Boolean).reduce((counts, item) => {
      const slot = normalizeEquipmentSlot(item.slot);
      if (slot === "Major") counts.major += 1;
      if (slot === "Minor") counts.minor += 1;
      return counts;
    }, { major: 0, minor: 0 });
  }

  function equipmentCapMessage(extra) {
    const counts = equipmentCounts(extra);
    if (counts.major > 3) return `Major item cap exceeded: ${counts.major}/3. Ask the Handler or leave something behind.`;
    if (counts.minor > 6) return `Minor item cap exceeded: ${counts.minor}/6. Ask the Handler or leave something behind.`;
    return "";
  }

  function renderEquipmentCapStatus() {
    const status = document.getElementById("equipment-cap-status");
    if (!status) return;
    const counts = equipmentCounts();
    status.textContent = `Major ${counts.major}/3 // Minor ${counts.minor}/6. Default kit is already listed. Optional carry is usually one item.`;
    status.classList.toggle("is-error", counts.major > 3 || counts.minor > 6);
  }

  function renderAuthorization() {
    const backgroundUnlocks = consoleState.unlocks.filter((item) => item.type === "background");
    const ontologyUnlocks = consoleState.unlocks.filter((item) => item.type === "ontology");
    toggleUnlockPanel("background", backgroundUnlocks.length > 0);
    toggleUnlockPanel("ontology", ontologyUnlocks.length > 0);
    renderUnlockList("background", backgroundUnlocks);
    renderUnlockList("ontology", ontologyUnlocks);
  }

  function toggleUnlockPanel(kind, enabled) {
    document.querySelectorAll(`[data-unlock-tab="${kind}"], [data-unlock-panel="${kind}"]`).forEach((node) => {
      node.hidden = !enabled;
    });
  }

  function renderUnlockList(kind, unlocks) {
    const notice = document.getElementById(`${kind}-unlock-notice`);
    const list = document.getElementById(`${kind}-unlock-list`);
    if (!list) return;
    list.textContent = "";
    if (notice) {
      notice.textContent = unlocks.length
        ? authorizationNotice(kind, unlocks[0])
        : `No ${kind} authorization packet imported.`;
    }
    unlocks.forEach((unlock) => {
      list.append(entry(unlock.label || unlock.key, [
        ["Authorization", `${unlock.type.toUpperCase()}_UNLOCK:${unlock.key}`],
        ["Status", unlock.applied ? "Applied" : "Available"],
        ["Handler note", unlock.note],
        ["Imported", formatDate(unlock.importedAt)]
      ], "unlocks", unlock.id));
    });
  }

  function authorizationNotice(kind, unlock) {
    if (kind === "ontology") {
      const entry = presentationEntry(unlock.key);
      return unlock.note || `NEW ONTOLOGY SIGNAL DETECTED\n\nHandler authorization received.\n\n${entry.displayName} available for review.`;
    }
    const entry = backgroundEntry(unlock.key);
    return unlock.note || `BACKGROUND AUTHORIZATION RECEIVED\n\nHandler authorization received.\n\n${entry.displayName} available for review.`;
  }

  function parseAuthorizationPacket(text) {
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = null;
    }
    const note = safeString(payload?.note || payload?.handlerNote, 1000);
    const rawFlags = Array.isArray(payload?.flags)
      ? payload.flags
      : Array.isArray(payload?.unlocks)
        ? payload.unlocks.map((item) => item.flag || `${String(item.type || "").toUpperCase()}_UNLOCK:${item.key || item.value || ""}`)
        : [];
    const source = rawFlags.length ? rawFlags.join("\n") : text;
    const matches = Array.from(source.matchAll(/\b(ONTOLOGY|BACKGROUND|CASE)_UNLOCK\s*:\s*([A-Z0-9_ -]+)/gi));
    return matches.map((match) => {
      const type = match[1].toLowerCase();
      const key = safeString(match[2], 80).toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_|_$/g, "");
      return {
        id: `${type}-${key.toLowerCase()}-${Date.now()}`,
        type,
        key,
        label: unlockLabel(type, key),
        note,
        importedAt: nowStamp(),
        applied: false
      };
    }).filter((item) => item.type && item.key);
  }

  function unlockLabel(type, key) {
    if (type === "ontology") return presentationEntry(key).displayName;
    if (type === "background") return backgroundEntry(key).displayName;
    if (type === "case" && key === "NEEDLEPOINT_SURVIVOR") return "Needlepoint Survivor";
    return titleCaseKey(key);
  }

  function mergeUnlocks(unlocks) {
    let added = 0;
    unlocks.forEach((unlock) => {
      const existing = consoleState.unlocks.find((item) => item.type === unlock.type && item.key === unlock.key);
      if (existing) {
        existing.note = unlock.note || existing.note;
        existing.importedAt = unlock.importedAt;
        return;
      }
      consoleState.unlocks.push(unlock);
      added += 1;
    });
    return added;
  }

  function applyUnlockEffects() {
    consoleState.unlocks.forEach((unlock) => {
      const key = `${unlock.type}:${unlock.key}`;
      if (consoleState.appliedUnlocks.includes(key)) {
        unlock.applied = true;
        return;
      }
      if (unlock.type === "background" && unlock.key === "FIELD_MEDIC") {
        consoleState.operatorStatus.background = "Field Medic";
        const skills = normalizeSkills(consoleState.operatorStatus.skills);
        skills.Medicine = String(Math.min(5, Number(skills.Medicine || 0) + 1));
        consoleState.operatorStatus.skills = skills;
        unlock.applied = true;
        consoleState.appliedUnlocks.push(key);
        return;
      }
      if (unlock.type === "background") {
        consoleState.operatorStatus.background = backgroundEntry(unlock.key).displayName;
        unlock.applied = true;
        consoleState.appliedUnlocks.push(key);
        return;
      }
      if (unlock.type === "ontology") {
        consoleState.operatorStatus.ontologyPresentation = presentationEntry(unlock.key).displayName;
        unlock.applied = true;
        consoleState.appliedUnlocks.push(key);
      }
    });
  }

  function renderStatusForm() {
    const status = consoleState.operatorStatus;
    setNamedValue("operatorName", status.operatorName || "");
    setNamedValue("designation", status.designation || operatorRecord?.designation || "");
    setNamedValue("role", status.role || "Operator");
    setNamedValue("activeNeedlepoint", status.activeNeedlepoint || "");
    setNamedValue("background", status.background || "");
    setNamedValue("ontologyPresentation", status.ontologyPresentation || "");
    consoleState.operatorStatus.creationMode = Boolean(status.creationMode);
    consoleState.operatorStatus.stability = normalizeStabilityValue(status.stability);
    consoleState.operatorStatus.stabilityBand = bandFromLegacyStability(consoleState.operatorStatus.stability);
    setNamedValue("attentionState", normalizeAttentionState(status.attentionState));
    setNamedValue("emotionalState", status.emotionalState || operatorRecord?.attentionStatus || "");
    consoleState.operatorStatus.voidByFrequency = normalizeVoidByFrequency(status.voidByFrequency);
    consoleState.operatorStatus.voidMarks = clampVoidBank(status.voidMarks, consoleState.operatorStatus.voidByFrequency);
    setNamedValue("voidMarks", consoleState.operatorStatus.voidMarks);
    setNamedValue("breachPoints", normalizeNonNegative(status.breachPoints));
    setNamedValue("activeMisfire", status.activeMisfire || "");
    setNamedValue("commonTell", status.commonTell || "");
    setNamedValue("rollAttributeKey", normalizeAttributeName(status.rollAttributeKey) || "Body");
    setNamedValue("rollSkillKey", normalizeSkillName(status.rollSkillKey));
    setNamedValue("rollModifier", normalizeSignedValue(status.rollModifier, -10, 10));
    setNamedChecked("rollAdvantage", Boolean(status.rollAdvantage) && !Boolean(status.rollDisadvantage));
    setNamedChecked("rollDisadvantage", Boolean(status.rollDisadvantage));
    setNamedValue("quickNotes", status.quickNotes || "");
    setNamedValue("expressions", status.expressions || "");
    setNamedValue("misfireFlavor", status.misfireFlavor || frequencyCard(operatorRecord?.primaryFrequency).misfireFlavor);
    setNamedValue("anchorPerson", status.anchorPerson || "");
    setNamedValue("totemObject", status.totemObject || "");
    setNamedValue("groundingLine", status.groundingLine || "");
    setNamedValue("bleed", status.bleed || formatDrift(operatorRecord));
    setNamedValue("misfires", status.misfires || "");
    setNamedValue("voidBreach", status.voidBreach || "");
    setNamedChecked("recoveryGround", Boolean(status.recoveryGround));
    setNamedChecked("recoveryBreathe", Boolean(status.recoveryBreathe));
    setNamedChecked("recoveryConnect", Boolean(status.recoveryConnect));
    setNamedChecked("recoveryLeave", Boolean(status.recoveryLeave));
    setNamedChecked("recoveryNameIt", Boolean(status.recoveryNameIt));
    renderTrackers();
    renderSegmentedControls();
    renderBandMeter();
    renderLotus();
    renderAttributes();
    renderSkills();
    renderRollSelectors();
    renderCreationMode();
    renderFrequencyEditMode();
    renderStatusSummary();
  }

  function setNamedValue(name, value) {
    const input = document.querySelector(`[name="${name}"]`);
    if (input) input.value = value;
  }

  function setNamedChecked(name, value) {
    const input = document.querySelector(`[name="${name}"]`);
    if (input) input.checked = Boolean(value);
  }

  function normalizeStabilityValue(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "10";
    return String(Math.max(0, Math.min(10, Math.round(parsed))));
  }

  function normalizeNonNegative(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return "0";
    return String(Math.round(parsed));
  }

  function normalizeBoxValue(value, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "0";
    return String(Math.max(0, Math.min(max, Math.round(parsed))));
  }

  function normalizeSignedValue(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "0";
    return String(Math.max(min, Math.min(max, Math.round(parsed))));
  }

  function attributeNames() {
    return ["Body", "Agility", "Mind", "Instinct", "Presence", "Nerves"];
  }

  function skillNames() {
    return [
      "Athletics",
      "Melee",
      "Ranged",
      "Stealth",
      "Survival",
      "Medicine",
      "Investigation",
      "Hacking",
      "Engineering",
      "Academics",
      "Awareness",
      "Tactics",
      "Empathy",
      "Deception",
      "Persuasion",
      "Intimidation",
      "Performance",
      "Ritual"
    ];
  }

  function skillRankLabel(rank) {
    return ["", "Familiar", "Competent", "Skilled", "Expert", "Elite"][Number(rank)] || "Untrained";
  }

  function genericSkillRankDescription(rank) {
    const descriptions = {
      1: "You can use this without penalty. Routine TNs are reachable.",
      2: "You handle common tasks well. Standard TNs are routine.",
      3: "You impress specialists. Hard TNs are standard for you.",
      4: "You perform under pressure. Severe TNs are achievable with the right setup.",
      5: "Top-tier human. Once per Breach, reduce a related TN by 2 or claim Advantage when the fiction supports it."
    };
    return descriptions[Number(rank)] || "Roll Attribute only unless the GM agrees another Skill fits.";
  }

  function skillRankDescription(skill, rank) {
    const level = Number(normalizeBoxValue(rank, 5));
    const example = skillRankExample(skill, level);
    return example
      ? `${genericSkillRankDescription(level)} Example: ${example}`
      : genericSkillRankDescription(level);
  }

  function skillRankExample(skill, rank) {
    const examples = {
      Athletics: [
        "clear a fence, sprint a short distance, or keep balance on bad footing.",
        "climb under stress, swim with gear, or make a controlled jump.",
        "cross dangerous terrain while chased or carry someone out under pressure.",
        "move through severe hazards, long falls, bad weather, or collapsing spaces.",
        "do the impossible-looking physical line once the scene gives you an opening."
      ],
      Melee: [
        "hold a weapon correctly, block clumsy attacks, or avoid cutting yourself.",
        "handle a common fight, break a grab, or use reach and footing.",
        "exploit openings, disarm a threat, or fight while protecting someone.",
        "control tempo against trained opposition or multiple close threats.",
        "turn positioning into a decisive close-combat advantage."
      ],
      Ranged: [
        "load, aim, fire, and follow basic safety without freezing.",
        "clear a jam, reload under mild stress, and hit ordinary shots.",
        "shoot under pressure, use cover, and make hard shots with discipline.",
        "handle moving targets, poor visibility, and crisis reloads.",
        "take the shot that only a true marksman should attempt."
      ],
      Stealth: [
        "avoid obvious noise, keep low, and use shadow or timing.",
        "move past casual notice or hide simple traces.",
        "pass alert observers, conceal tools, or keep quiet under pressure.",
        "cross hostile spaces and manage patrol logic.",
        "vanish from a scene that should have trapped you."
      ],
      Survival: [
        "spot shelter, bad weather, unsafe water, or a basic trail.",
        "navigate rough ground, start a fire, and stretch supplies.",
        "track under pressure or keep a group alive in hostile terrain.",
        "read extreme environments, hazards, and pursuit signs quickly.",
        "turn the environment into your operating field."
      ],
      Medicine: [
        "stop bleeding, recognize shock, and know when someone needs help now.",
        "treat common injuries and make useful field calls.",
        "handle trauma while the situation is still moving.",
        "perform severe emergency care with limited tools and a bad clock.",
        "save a life when the scene says there should not be time."
      ],
      Investigation: [
        "notice a useful clue and ask the obvious next question.",
        "connect evidence, timelines, and witness gaps.",
        "work a hostile scene without losing the important thread.",
        "reconstruct complex events from partial records or contradictions.",
        "find the one fact the scene is trying to bury."
      ],
      Hacking: [
        "recognize basic systems, credentials, and obvious weak points.",
        "handle common intrusion, lockout, recovery, or cleanup tasks.",
        "beat hardened ordinary systems while pressure mounts.",
        "operate in hostile infrastructure with traces and countermeasures active.",
        "open the door everyone else called impossible."
      ],
      Engineering: [
        "identify what a machine does and what part is failing.",
        "repair common gear, bypass simple damage, or improvise a tool.",
        "stabilize dangerous equipment under pressure.",
        "build or repair complex systems with limited time and bad conditions.",
        "make the machine do one brilliant thing it was not built to do."
      ],
      Academics: [
        "recognize common references and know where to look next.",
        "apply trained knowledge to ordinary research or analysis.",
        "interpret specialized material under time pressure.",
        "connect obscure sources, history, theory, and technical language.",
        "produce the answer that changes what the team thinks is possible."
      ],
      Awareness: [
        "notice movement, tone, danger, or the thing out of place.",
        "keep watch, read a room, and spot common ambush signs.",
        "track several threats or clues while the scene is loud.",
        "notice subtle patterns, concealed movement, or emotional tells.",
        "catch the detail the scene only offered once."
      ],
      Tactics: [
        "understand cover, angles, and why the obvious plan is bad.",
        "coordinate a simple approach or retreat.",
        "run a crisis plan while people are scared and moving.",
        "control a complex fight, breach, or rescue under pressure.",
        "turn a losing scene into an operation with one decisive call."
      ],
      Empathy: [
        "tell when someone is upset, guarded, or not saying the whole thing.",
        "offer useful comfort and read ordinary emotional pressure.",
        "support someone in crisis without making it about you.",
        "navigate volatile feelings, trauma responses, or group tension.",
        "anchor someone when connection is the only thing still holding."
      ],
      Deception: [
        "tell a simple lie without immediately giving yourself away.",
        "maintain a cover story through normal questions.",
        "lie under pressure and adapt when details shift.",
        "run a serious false identity or misdirection under scrutiny.",
        "make the lie become the scene's safest available truth."
      ],
      Persuasion: [
        "make a reasonable ask sound reasonable.",
        "negotiate common resistance or calm a tense exchange.",
        "move someone who has reasons to say no.",
        "shift a room, bargain, or authority figure under pressure.",
        "say the thing that changes the choice in front of everyone."
      ],
      Intimidation: [
        "look dangerous enough to make someone hesitate.",
        "make a threat, boundary, or warning land cleanly.",
        "control a hostile exchange without immediately escalating it.",
        "break momentum in a dangerous room through presence and pressure.",
        "make the opposition believe the next second belongs to you."
      ],
      Performance: [
        "hold attention briefly and deliver a prepared bit.",
        "read an audience and keep a performance steady.",
        "improvise under pressure or use performance as cover.",
        "command a room and shape its emotional tempo.",
        "make the performance become the moment everyone follows."
      ],
      Ritual: [
        "follow instructions and recognize obvious symbolic mistakes.",
        "prepare common materials, timing, and boundaries correctly.",
        "perform under pressure without losing the thread.",
        "adapt a working ritual to a dangerous scene or damaged site.",
        "hold the pattern together when reality is trying to interrupt."
      ]
    };
    return examples[skill]?.[Number(rank) - 1] || "";
  }

  function normalizeAttributeName(value) {
    return attributeNames().includes(value) ? value : "";
  }

  function normalizeSkillName(value) {
    return skillNames().includes(value) ? value : "";
  }

  function normalizeAttributes(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const attributes = {};
    attributeNames().forEach((name) => {
      attributes[name] = normalizeBoxValue(source[name] || 1, 5);
      if (attributes[name] === "0") attributes[name] = "1";
    });
    return attributes;
  }

  function normalizeSkills(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const skills = {};
    skillNames().forEach((name) => {
      const rank = Number(normalizeBoxValue(source[name], 5));
      if (rank > 0) skills[name] = String(rank);
    });
    return skills;
  }

  function advancementCost(from, to) {
    const start = Math.max(0, Number(from) || 0);
    const end = Math.max(0, Number(to) || 0);
    if (end <= start) return 0;
    let cost = 0;
    for (let rank = start + 1; rank <= end; rank += 1) cost += rank;
    return cost;
  }

  function totalSkillRanks(skills) {
    return Object.values(normalizeSkills(skills)).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function totalAttributeBoosts(attributes) {
    return Object.values(normalizeAttributes(attributes)).reduce((sum, value) => sum + Math.max(0, Number(value || 1) - 1), 0);
  }

  function creationSkillBudget() {
    return 8;
  }

  function creationAttributeSpreadBudget() {
    return 6;
  }

  function creationBonusBreachBudget() {
    return 3;
  }

  function maxFrequencyPips() {
    return 20;
  }

  function maxTotalVoid() {
    return 13;
  }

  function creationBonusSpent(attributes) {
    return Math.max(0, totalAttributeBoosts(attributes) - creationAttributeSpreadBudget());
  }

  function selectedCoreFrequency() {
    const blind = normalizeFrequencyName(consoleState.operatorStatus.blindPetal);
    const candidates = [
      normalizeFrequencyName(consoleState.operatorStatus.selectedLotusPetal),
      normalizeFrequencyName(operatorRecord?.primaryFrequency),
      "Dream",
      ...frequencies()
    ];
    return candidates.find((frequency) => frequency && frequency !== blind) || "Dream";
  }

  function canSpendBreach(cost) {
    return Number(consoleState.operatorStatus.breachPoints || 0) >= cost;
  }

  function spendBreach(cost) {
    if (cost <= 0) return true;
    if (!canSpendBreach(cost)) {
      setStorageStatus(`Insufficient Breach. Required ${cost}.`, true);
      return false;
    }
    consoleState.operatorStatus.breachPoints = String(Number(consoleState.operatorStatus.breachPoints || 0) - cost);
    setNamedValue("breachPoints", consoleState.operatorStatus.breachPoints);
    return true;
  }

  function refundCreationBreach(amount) {
    if (amount <= 0) return;
    const current = Number(normalizeNonNegative(consoleState.operatorStatus.breachPoints));
    consoleState.operatorStatus.breachPoints = String(Math.min(creationBonusBreachBudget(), current + amount));
    setNamedValue("breachPoints", consoleState.operatorStatus.breachPoints);
  }

  function applyBreachDelta(delta) {
    if (delta > 0) return spendBreach(delta);
    if (delta < 0 && consoleState.operatorStatus.creationMode) refundCreationBreach(Math.abs(delta));
    return true;
  }

  function applyFrequencyBreachDelta(delta) {
    if (delta > 0) return spendBreach(delta);
    if (delta < 0) {
      const current = Number(normalizeNonNegative(consoleState.operatorStatus.breachPoints));
      consoleState.operatorStatus.breachPoints = String(Math.min(99, current + Math.abs(delta)));
      setNamedValue("breachPoints", consoleState.operatorStatus.breachPoints);
    }
    return true;
  }

  function skillChangeAllowed(skills, skill, targetRank) {
    const next = normalizeSkills({ ...skills, [skill]: String(targetRank) });
    if (consoleState.operatorStatus.creationMode) {
      if (targetRank > 3) return { ok: false, message: "Creation skill cap is Rank 3." };
      const oldOverage = Math.max(0, totalSkillRanks(skills) - creationSkillBudget());
      const newOverage = Math.max(0, totalSkillRanks(next) - creationSkillBudget());
      return { ok: true, cost: newOverage - oldOverage };
    }
    const oldRank = Number(normalizeSkills(skills)[skill] || 0);
    return { ok: true, cost: advancementCost(oldRank, targetRank) };
  }

  function attributeChangeAllowed(attributes, attribute, targetRank) {
    const next = normalizeAttributes({ ...attributes, [attribute]: String(targetRank) });
    if (consoleState.operatorStatus.creationMode) {
      if (targetRank > 4) return { ok: false, message: "Creation attribute cap is 4." };
      const oldOverage = Math.max(0, totalAttributeBoosts(attributes) - creationAttributeSpreadBudget());
      const newOverage = Math.max(0, totalAttributeBoosts(next) - creationAttributeSpreadBudget());
      return { ok: true, cost: newOverage - oldOverage };
    }
    const oldRank = Number(normalizeAttributes(attributes)[attribute] || 1);
    return { ok: true, cost: advancementCost(oldRank, targetRank) };
  }

  function frequencyPipBreachCost(pip) {
    const value = Number(normalizeBoxValue(pip, 6));
    if (value >= 5) return 3;
    if (value >= 3) return 2;
    if (value >= 1) return 1;
    return 0;
  }

  function cumulativeFrequencyBreachCost(level) {
    const target = Number(normalizeBoxValue(level, 6));
    let cost = 0;
    for (let pip = 1; pip <= target; pip += 1) cost += frequencyPipBreachCost(pip);
    return cost;
  }

  function requiredVoidForFrequencyLevel(level) {
    const value = Number(normalizeBoxValue(level, 6));
    if (value >= 5) return 4;
    if (value >= 3) return 2;
    if (value >= 1) return 1;
    return 0;
  }

  function maxFrequencyLevelForVoid(value) {
    const voidValue = Number(normalizeNonNegative(value));
    if (voidValue >= 4) return 6;
    if (voidValue >= 2) return 4;
    if (voidValue >= 1) return 2;
    return 0;
  }

  function normalizeVoidByFrequency(value) {
    const source = value && typeof value === "object" ? value : {};
    const voidByFrequency = {};
    frequencies().forEach((frequency) => {
      voidByFrequency[frequency] = normalizeNonNegative(source[frequency]);
    });
    return voidByFrequency;
  }

  function totalInvestedVoid(voidByFrequency) {
    return Object.values(normalizeVoidByFrequency(voidByFrequency)).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function clampVoidBank(value, voidByFrequency) {
    const available = Math.max(0, maxTotalVoid() - totalInvestedVoid(voidByFrequency));
    return String(Math.min(available, Number(normalizeNonNegative(value))));
  }

  function totalCultivatedPips(lotus) {
    return Object.values(normalizeLotus(lotus)).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function voidForFrequency(frequency) {
    const voidByFrequency = normalizeVoidByFrequency(consoleState.operatorStatus.voidByFrequency);
    return Number(voidByFrequency[frequency] || 0);
  }

  function setFrequencyVoid(frequency, value) {
    consoleState.operatorStatus.voidByFrequency = normalizeVoidByFrequency(consoleState.operatorStatus.voidByFrequency);
    const current = Number(consoleState.operatorStatus.voidByFrequency[frequency] || 0);
    const target = Number(normalizeNonNegative(value));
    const delta = target - current;
    const investedIfApplied = totalInvestedVoid({
      ...consoleState.operatorStatus.voidByFrequency,
      [frequency]: String(target)
    });
    if (investedIfApplied > maxTotalVoid()) {
      setStorageStatus(`Void cap exceeded. Total Void cannot exceed ${maxTotalVoid()}.`, true);
      return false;
    }
    if (delta > 0) {
      const bank = Number(normalizeNonNegative(consoleState.operatorStatus.voidMarks));
      if (bank < delta) {
        setStorageStatus(`Insufficient Void. Required ${delta}; banked ${bank}.`, true);
        return false;
      }
      consoleState.operatorStatus.voidMarks = String(bank - delta);
    }
    if (delta < 0) {
      const bank = Number(normalizeNonNegative(consoleState.operatorStatus.voidMarks));
      consoleState.operatorStatus.voidMarks = String(bank + Math.abs(delta));
    }
    consoleState.operatorStatus.lotus = normalizeLotus(consoleState.operatorStatus.lotus);
    const currentLevel = Number(consoleState.operatorStatus.lotus[frequency] || 0);
    const maxLevel = maxFrequencyLevelForVoid(target);
    if (currentLevel > maxLevel) {
      const refund = cumulativeFrequencyBreachCost(currentLevel) - cumulativeFrequencyBreachCost(maxLevel);
      consoleState.operatorStatus.lotus[frequency] = String(maxLevel);
      applyFrequencyBreachDelta(-refund);
      setStorageStatus(`Void gate reduced. ${frequency} pips above ${maxLevel} refunded.`, true);
    }
    consoleState.operatorStatus.voidByFrequency[frequency] = String(target);
    consoleState.operatorStatus.voidMarks = clampVoidBank(consoleState.operatorStatus.voidMarks, consoleState.operatorStatus.voidByFrequency);
    consoleState.operatorStatus.selectedLotusPetal = frequency;
    setNamedValue("voidMarks", consoleState.operatorStatus.voidMarks);
    writeConsoleState();
    return true;
  }

  function creationOpenedFrequency(lotus) {
    const cultivated = Object.entries(normalizeLotus(lotus)).find(([, level]) => Number(level || 0) > 0);
    return cultivated && cultivated[0] || selectedCoreFrequency();
  }

  function frequencyChangeAllowed(lotus, frequency, targetLevel) {
    const normalizedLotus = normalizeLotus(lotus);
    const oldLevel = Number(normalizedLotus[frequency] || 0);
    const target = Number(normalizeBoxValue(targetLevel, 6));
    const lowering = target < oldLevel;
    const totalAfter = totalCultivatedPips({
      ...normalizedLotus,
      [frequency]: String(target)
    });
    const requiredVoid = requiredVoidForFrequencyLevel(target);
    const availableVoid = voidForFrequency(frequency);

    if (frequency === normalizeFrequencyName(consoleState.operatorStatus.blindPetal)) {
      return { ok: false, message: "Blind petal cannot be cultivated." };
    }
    if (lowering && !consoleState.operatorStatus.creationMode && !consoleState.operatorStatus.frequencyEditMode) {
      return { ok: false, message: "Frequency Edit Mode required to remove pips." };
    }
    if (requiredVoid > availableVoid) {
      return { ok: false, message: `Gate locked. ${target} pips require ${requiredVoid} Void on that Frequency.` };
    }
    if (totalAfter > maxFrequencyPips()) {
      return { ok: false, message: `Frequency pip cap exceeded: ${totalAfter}/${maxFrequencyPips()}.` };
    }

    if (consoleState.operatorStatus.creationMode) {
      if (target > 2) return { ok: false, message: "Creation cap is Pip 2 on the opened Gate." };
      const opened = creationOpenedFrequency(normalizedLotus);
      const hasCultivatedPetal = Object.values(normalizedLotus).some((level) => Number(level || 0) > 0);
      if (hasCultivatedPetal && opened !== frequency && target > 0) {
        return { ok: false, message: `Creation Gate already opened on ${opened}.` };
      }
      const oldCost = Math.max(0, cumulativeFrequencyBreachCost(oldLevel) - 1);
      const newCost = Math.max(0, cumulativeFrequencyBreachCost(target) - 1);
      return { ok: true, cost: newCost - oldCost };
    }

    return { ok: true, cost: cumulativeFrequencyBreachCost(target) - cumulativeFrequencyBreachCost(oldLevel) };
  }

  function normalizeStabilityBand(value) {
    const allowed = ["Calm", "Strained", "Unraveling", "Collapse Risk"];
    return allowed.includes(value) ? value : "Calm";
  }

  function normalizeMisfireSeverity(value) {
    const allowed = ["None", "Minor", "Major", "Severe"];
    return allowed.includes(value) ? value : "None";
  }

  function normalizeActiveMisfire(status) {
    const active = safeString(status.activeMisfire, 1000);
    if (active) return active;
    const severity = normalizeMisfireSeverity(status.misfireSeverity || severityFromLegacyMisfire(status.misfireBoxes));
    return severity === "None" ? "" : `${severity} Misfire`;
  }

  function severityFromLegacyMisfire(value) {
    const boxes = Number(normalizeBoxValue(value, 6));
    if (boxes >= 5) return "Severe";
    if (boxes >= 3) return "Major";
    if (boxes >= 1) return "Minor";
    return "None";
  }

  function frequencies() {
    return ["Dream", "Hunger", "Silence", "Stillness", "Empyrean", "Becoming"];
  }

  function normalizeFrequencyName(value) {
    return frequencies().includes(value) ? value : "";
  }

  function normalizeLotus(value) {
    const source = value && typeof value === "object" ? value : {};
    const lotus = {};
    frequencies().forEach((frequency) => {
      lotus[frequency] = normalizeBoxValue(source[frequency], 6);
    });
    return lotus;
  }

  function normalizeAttentionState(value) {
    const allowed = ["Unnoticed", "Brushed", "Noted", "Marked", "Pursued", "Claimed"];
    return allowed.includes(value) ? value : "Unnoticed";
  }

  function bandFromLegacyStability(value) {
    const stability = Number(normalizeStabilityValue(value));
    if (stability >= 8) return "Calm";
    if (stability >= 5) return "Strained";
    if (stability >= 3) return "Unraveling";
    return "Collapse Risk";
  }

  function frequencyCard(frequency) {
    const cards = {
      Dream: {
        bleedCue: "deja vu, false familiarity, and memory confusion",
        misfireFlavor: "Metaphor becomes literal, a memory intrudes, or the wrong symbol answers.",
        blind: "Symbols lie cleanly. Dreams, omens, and subconscious pressure pass as coincidence."
      },
      Hunger: {
        bleedCue: "fixation, jealousy, shame after wanting, and fear that need makes you monstrous",
        misfireFlavor: "Want becomes compulsion, a bargain asks too much, or satisfaction turns hollow.",
        blind: "Want reads as noise. Appetite, debt, coercion, and escalation reach you late."
      },
      Silence: {
        bleedCue: "numbness, dissociation, missing time, and relief when no one asks questions",
        misfireFlavor: "The wrong thing is erased, a truth cannot be spoken, or protection becomes isolation.",
        blind: "Absence has no outline. Nullification, shutdown, omission, and erasure go unseen."
      },
      Stillness: {
        bleedCue: "emotional freezing, rigid control, delayed panic, and inability to leave a memory behind",
        misfireFlavor: "A moment traps the wrong person, action stalls, or composure becomes paralysis.",
        blind: "Momentum traps you. Delay, freezing, restraint, and control effects land before you name them."
      },
      Empyrean: {
        bleedCue: "emotional flooding, over-identification, guilt, and fear of being felt too clearly",
        misfireFlavor: "Feelings spread too far, a bond overwhelms consent, or pain becomes communal.",
        blind: "Connection arrives distorted. Shared pain, consent pressure, awe, and relational gravity are hard to read."
      },
      Becoming: {
        bleedCue: "identity drift, impostor fear, and panic when recognized",
        misfireFlavor: "A mask sticks, a role overwrites behavior, or an unwanted self steps forward.",
        blind: "Identity feels fixed until it breaks. Masks, role pressure, and self-rewrite catch you flat-footed."
      }
    };
    return cards[frequency] || {
      bleedCue: "choose a primary Frequency to load bleed cues",
      misfireFlavor: "",
      blind: ""
    };
  }

  function renderStatusSummary() {
    const band = document.getElementById("status-band");
    const bleedCue = document.getElementById("status-bleed-cue");
    const status = consoleState.operatorStatus;
    status.stabilityBand = bandFromLegacyStability(status.stability);
    if (band) band.textContent = status.stabilityBand.toUpperCase();
    if (bleedCue) bleedCue.textContent = frequencyCard(operatorRecord?.primaryFrequency).bleedCue.toUpperCase();
    setText("sheet-frequency", operatorRecord && operatorRecord.primaryFrequency || "UNASSIGNED");
  }

  function renderTrackers() {
    const board = document.getElementById("tracker-board");
    if (!board) return;
    const trackers = [
      { key: "harmBoxes", label: "Harm", max: 5, kind: "harm" },
      { key: "stability", label: "Stability", max: 10, kind: "stability" }
    ];
    board.textContent = "";
    trackers.forEach((tracker) => {
      const value = Number(normalizeBoxValue(consoleState.operatorStatus[tracker.key], tracker.max));
      const article = document.createElement("article");
      article.className = `line-tracker ${tracker.kind}`;

      const header = document.createElement("div");
      header.className = "pip-header";
      const title = document.createElement("strong");
      title.textContent = tracker.label;
      const count = document.createElement("span");
      count.textContent = `${value}/${tracker.max}`;
      header.append(title, count);

      const pips = document.createElement("div");
      pips.className = "line-pips";
      for (let index = 1; index <= tracker.max; index += 1) {
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = "pip";
        pip.classList.toggle("is-filled", index <= value);
        pip.setAttribute("aria-label", `${tracker.label} ${index}`);
        pip.addEventListener("click", () => setTrackerValue(tracker.key, index === value ? index - 1 : index, tracker.max));
        pips.append(pip);
      }

      const controls = document.createElement("div");
      controls.className = "pip-controls";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "-";
      minus.setAttribute("aria-label", `Decrease ${tracker.label}`);
      minus.addEventListener("click", () => setTrackerValue(tracker.key, value - 1, tracker.max));
      const plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.setAttribute("aria-label", `Increase ${tracker.label}`);
      plus.addEventListener("click", () => setTrackerValue(tracker.key, value + 1, tracker.max));
      controls.append(minus, plus);

      const derived = document.createElement("p");
      derived.className = "pip-derived";
      derived.textContent = tracker.key === "harmBoxes"
        ? `Condition: ${harmCondition(value)}`
        : `Band: ${bandFromLegacyStability(value)}`;

      article.append(header, pips, derived, controls);
      board.append(article);
    });
  }

  function renderAttributes() {
    const grid = document.getElementById("attribute-grid");
    if (!grid) return;
    const attrs = normalizeAttributes(consoleState.operatorStatus.attributes);
    consoleState.operatorStatus.attributes = attrs;
    grid.textContent = "";
    attributeNames().forEach((name) => {
      const value = Number(attrs[name]);
      const row = document.createElement("article");
      row.className = "attribute-row";
      const label = document.createElement("button");
      label.type = "button";
      label.className = "attribute-name";
      label.textContent = name;
      label.addEventListener("click", () => {
        consoleState.operatorStatus.rollAttributeKey = name;
        writeConsoleState();
        renderRollSelectors();
      });
      const pips = document.createElement("div");
      pips.className = "attribute-pips";
      for (let index = 1; index <= 5; index += 1) {
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = "pip";
        pip.classList.toggle("is-filled", index <= value);
        pip.setAttribute("aria-label", `${name} ${index}`);
        pip.addEventListener("click", () => {
          const allowed = attributeChangeAllowed(attrs, name, index);
          if (!allowed.ok) {
            setStorageStatus(allowed.message, true);
            return;
          }
          if (!applyBreachDelta(allowed.cost || 0)) return;
          attrs[name] = normalizeBoxValue(index, 5);
          consoleState.operatorStatus.attributes = attrs;
          consoleState.operatorStatus.rollAttributeKey = name;
          writeConsoleState();
          renderAttributes();
          renderRollSelectors();
          renderCreationMode();
        });
        pips.append(pip);
      }
      row.append(label, pips);
      grid.append(row);
    });
  }

  function renderSkills() {
    const picker = document.getElementById("skill-picker");
    const list = document.getElementById("skill-list");
    if (picker) {
      const current = picker.value;
      picker.textContent = "";
      skillNames().forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        picker.append(option);
      });
      picker.value = normalizeSkillName(current) || "Athletics";
    }
    if (!list) return;
    const skills = normalizeSkills(consoleState.operatorStatus.skills);
    consoleState.operatorStatus.skills = skills;
    list.textContent = "";
    const entries = Object.entries(skills);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-line";
      empty.textContent = "No trained skills assigned.";
      list.append(empty);
      renderRollSelectors();
      return;
    }
    entries.forEach(([name, rank]) => {
      const row = document.createElement("article");
      row.className = "skill-row";
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "skill-name";
      pick.textContent = name;
      pick.addEventListener("click", () => {
        consoleState.operatorStatus.rollSkillKey = name;
        writeConsoleState();
        renderRollSelectors();
      });
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "5";
      input.step = "1";
      input.value = rank;
      input.setAttribute("aria-label", `${name} rank`);
      input.addEventListener("change", () => {
        const targetRank = Number(normalizeBoxValue(input.value, 5));
        const allowed = skillChangeAllowed(skills, name, targetRank);
        if (!allowed.ok) {
          setStorageStatus(allowed.message, true);
          renderSkills();
          return;
        }
        if (!applyBreachDelta(allowed.cost || 0)) {
          renderSkills();
          return;
        }
        skills[name] = String(targetRank);
        if (skills[name] === "0") delete skills[name];
        consoleState.operatorStatus.skills = skills;
        writeConsoleState();
        renderSkills();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "entry-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        delete skills[name];
        if (consoleState.operatorStatus.rollSkillKey === name) consoleState.operatorStatus.rollSkillKey = "";
        consoleState.operatorStatus.skills = skills;
        writeConsoleState();
        renderSkills();
      });
      const descriptor = document.createElement("p");
      descriptor.className = "skill-scale";
      descriptor.textContent = `${name} ${rank} // ${skillRankLabel(rank)}: ${skillRankDescription(name, rank)}`;
      row.append(pick, input, remove, descriptor);
      list.append(row);
    });
    renderRollSelectors();
  }

  function renderCreationMode() {
    const toggle = document.getElementById("creation-mode-toggle");
    const budget = document.getElementById("creation-budget");
    const status = consoleState.operatorStatus;
    if (toggle) {
      toggle.textContent = status.creationMode ? "Creation Mode: On" : "Creation Mode: Off";
      toggle.classList.toggle("primary", Boolean(status.creationMode));
    }
    if (budget) {
      if (status.creationMode) {
        const skillUsed = totalSkillRanks(status.skills);
        const attrUsed = totalAttributeBoosts(status.attributes);
        budget.textContent = `Creation: skills ${Math.min(skillUsed, creationSkillBudget())}/${creationSkillBudget()} // attribute spread ${Math.min(attrUsed, creationAttributeSpreadBudget())}/${creationAttributeSpreadBudget()} // Bonus Breach ${normalizeNonNegative(status.breachPoints)}/${creationBonusBreachBudget()}`;
      } else {
        budget.textContent = `Advancement: Breach bank ${normalizeNonNegative(status.breachPoints)}`;
      }
    }
    renderSkillCostPreview();
  }

  function renderFrequencyEditMode() {
    const toggle = document.getElementById("frequency-edit-toggle");
    const status = document.getElementById("frequency-edit-status");
    const enabled = Boolean(consoleState.operatorStatus.frequencyEditMode);
    if (toggle) {
      toggle.textContent = enabled ? "Frequency Edit Mode: On" : "Frequency Edit Mode: Off";
      toggle.classList.toggle("primary", enabled);
    }
    if (status) {
      status.textContent = enabled
        ? "Pip removal unlocked. Refunds apply to removed Frequency pips."
        : "Pip removal locked during field play.";
    }
  }

  function renderSkillCostPreview() {
    const preview = document.getElementById("skill-cost-preview");
    const meaning = document.getElementById("skill-rank-preview");
    const picker = document.getElementById("skill-picker");
    const rank = document.getElementById("skill-rank");
    if (!preview || !picker || !rank) return;
    const skill = normalizeSkillName(picker.value);
    const targetRank = Number(normalizeBoxValue(rank.value || 1, 5));
    const skills = normalizeSkills(consoleState.operatorStatus.skills);
    if (!skill) {
      preview.textContent = "Cost: unavailable";
      if (meaning) meaning.textContent = "Select a skill to load rank meaning.";
      return;
    }
    const allowed = skillChangeAllowed(skills, skill, targetRank);
    if (!allowed.ok) {
      preview.textContent = allowed.message;
      if (meaning) meaning.textContent = `${skill} ${targetRank} // ${skillRankLabel(targetRank)}: ${skillRankDescription(skill, targetRank)}`;
      return;
    }
    const cost = allowed.cost || 0;
    preview.textContent = consoleState.operatorStatus.creationMode
      ? cost < 0
        ? `Refund: ${Math.abs(cost)} Bonus Breach`
        : `Creation cost: ${cost} Bonus Breach`
      : `Cost: ${cost} Breach`;
    if (meaning) meaning.textContent = `${skill} ${targetRank} // ${skillRankLabel(targetRank)}: ${skillRankDescription(skill, targetRank)}`;
  }

  function renderRollSelectors() {
    const attrSelect = document.getElementById("roll-attribute");
    const skillSelect = document.getElementById("roll-skill");
    const status = consoleState.operatorStatus;
    if (attrSelect) {
      const current = normalizeAttributeName(status.rollAttributeKey) || "Body";
      attrSelect.textContent = "";
      attributeNames().forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = `${name} +${normalizeAttributes(status.attributes)[name]}`;
        attrSelect.append(option);
      });
      attrSelect.value = current;
    }
    if (skillSelect) {
      const current = normalizeSkillName(status.rollSkillKey);
      const skills = normalizeSkills(status.skills);
      skillSelect.textContent = "";
      const untrained = document.createElement("option");
      untrained.value = "";
      untrained.textContent = "Untrained +0";
      skillSelect.append(untrained);
      Object.entries(skills).forEach(([name, rank]) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = `${name} +${rank}`;
        skillSelect.append(option);
      });
      skillSelect.value = current && skills[current] ? current : "";
    }
  }

  function setTrackerValue(key, value, max) {
    consoleState.operatorStatus[key] = normalizeBoxValue(value, max);
    if (key === "stability") {
      consoleState.operatorStatus.stabilityBand = bandFromLegacyStability(consoleState.operatorStatus.stability);
      renderBandMeter();
      renderStatusSummary();
    }
    writeConsoleState();
    renderTrackers();
  }

  function renderSegmentedControls() {
    document.querySelectorAll("[data-segmented]").forEach((group) => {
      const field = group.getAttribute("data-segmented");
      const current = field === "stabilityBand"
        ? normalizeStabilityBand(consoleState.operatorStatus[field])
        : field === "misfireSeverity"
          ? normalizeMisfireSeverity(consoleState.operatorStatus[field])
          : normalizeAttentionState(consoleState.operatorStatus[field]);
      group.querySelectorAll("button[data-value]").forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-value") === current);
      });
    });
  }

  function renderBandMeter() {
    const current = bandFromLegacyStability(consoleState.operatorStatus.stability);
    consoleState.operatorStatus.stabilityBand = current;
    document.querySelectorAll("#stability-band-meter [data-band]").forEach((node) => {
      node.classList.toggle("is-active", node.getAttribute("data-band") === current);
    });
  }

  function harmCondition(value) {
    const harm = Number(normalizeBoxValue(value, 5));
    return ["Fine", "Injured", "Wounded", "Impaired", "Critical", "Dying"][harm] || "Fine";
  }

  function lotusTier(level) {
    const value = Number(normalizeBoxValue(level, 6));
    if (value >= 6) return "Divergence";
    if (value >= 5) return "Distortion";
    if (value >= 3) return "Empowered";
    if (value >= 1) return "Basic";
    return "None";
  }

  function tierCopy(frequency, tier, level) {
    const expression = frequencyExpression(frequency, Number(normalizeBoxValue(level, 6)));
    if (expression) return `${expression.type} available: ${expression.name}.`;
    return "No pip selected. This petal has not been cultivated.";
  }

  function lotusEconomyCopy(frequency, level) {
    const current = Number(normalizeBoxValue(level, 6));
    const requiredVoid = requiredVoidForFrequencyLevel(current);
    const next = Math.min(6, current + 1);
    const nextVoid = requiredVoidForFrequencyLevel(next);
    const nextCost = current >= 6 ? 0 : frequencyPipBreachCost(next);
    const petalVoid = voidForFrequency(frequency);
    const bank = normalizeNonNegative(consoleState.operatorStatus.breachPoints);
    const gate = current > 0
      ? `Current gate: ${requiredVoid} Void on ${frequency}. Recorded: ${petalVoid}.`
      : `Gate 1 requires 1 Void on ${frequency}. Recorded: ${petalVoid}.`;
    const nextLine = current >= 6
      ? "Pip ceiling reached."
      : `Next pip: ${nextCost} Breach after ${nextVoid} Void gate access.`;
    return `${gate} ${nextLine} Breach bank: ${bank}.`;
  }

  function expressionLadders() {
    return {
      Dream: [
        { pip: 1, name: "INDEX THE IMPOSSIBLE", type: "Expression", actionCost: "None; ambient leakage. Small Interaction only when deliberately focusing.", roll: "None for obvious pressure; 3d6 + Mind + Investigation for hidden context", effect: "Notice symbolic repetition, impossible geometry, emotional patterning, reflected inconsistencies, conceptual wrongness, or spaces behaving metaphorically.", misfire: "The symbol indexes the Operator instead." },
        { pip: 2, name: "SYMBOLIC NUDGE", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Mind + Academics, Mind + Investigation, or Presence + Performance", effect: "Shift how one minor symbolic detail is perceived until the end of the current Pressure Round.", misfire: "The symbol chooses a harsher meaning than intended." },
        { pip: 3, name: "ACTIVE HALLUCINATION", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Performance or Mind + Deception", effect: "Create a brief sensory impression that fits the scene's emotional logic.", misfire: "The wrong person sees it, or it reveals information the Operator did not mean to expose." },
        { pip: 4, name: "REFRAME THE SCENE", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Mind + Ritual or Presence + Performance", effect: "Recast one symbolic pattern so it becomes survivable.", misfire: "The reframing works, but the new meaning demands an emotional price." },
        { pip: 5, name: "LOCAL MYTH", type: "Distortion", actionCost: "Frequency Use", roll: "3d6 + Presence + Ritual", effect: "Turn one emotionally charged symbol into a temporary local rule.", misfire: "The symbol becomes law against the Operator first." },
        { pip: 6, name: "WALKING DREAM INDEX", type: "Divergence", actionCost: "Sustained or Frequency Use", roll: "3d6 + Nerves + Ritual when contested", effect: "Become the reference point for dream logic.", misfire: "The Operator's unresolved symbolism becomes scene architecture." }
      ],
      Hunger: [
        { pip: 1, name: "APPETITE SENSE", type: "Expression", actionCost: "None; ambient leakage. Small Interaction only when deliberately focusing.", roll: "None for obvious wants; 3d6 + Instinct + Awareness for hidden ones", effect: "Detect emotional weakness, escalation, fixation, desperation, desire pressure, or the direction of pursuit.", misfire: "The Operator feels the want as their own until the end of the current Pressure Round." },
        { pip: 2, name: "WANT FINDS A WAY", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Instinct + Survival or Agility + Athletics", effect: "Find a small path toward something needed.", misfire: "The path exists, but it leads through temptation, exposure, or someone else's need." },
        { pip: 3, name: "FIXATION MARK", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Nerves + Survival or Presence + Intimidation", effect: "Mark one desired target. Gain Advantage on one roll to pursue, track, corner, reach, or keep pressure on it.", misfire: "The fixation narrows too hard; actions unrelated to the target suffer Disadvantage until focus breaks." },
        { pip: 4, name: "PRESS THE WANT", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Persuasion, Presence + Intimidation, or Presence + Deception", effect: "Intensify an existing want until it creates an opening.", misfire: "The desire attaches to the Operator instead." },
        { pip: 5, name: "APPETITE BLEED", type: "Distortion", actionCost: "Frequency Use", roll: "3d6 + Presence + Intimidation or Instinct + Survival", effect: "Make one appetite environmental.", misfire: "The appetite chooses the Operator as its object." },
        { pip: 6, name: "PREDATORY SOVEREIGNTY", type: "Divergence", actionCost: "Sustained or Frequency Use", roll: "3d6 + Nerves + Survival when contested", effect: "Become the apex appetite in the scene.", misfire: "The Operator's need becomes visible enough for the Zone or entity to feed it." }
      ],
      Silence: [
        { pip: 1, name: "SOFT FOOTPRINT", type: "Expression", actionCost: "None; ambient leakage. Small Interaction only when deliberately focusing.", roll: "None for obvious absence; 3d6 + Instinct + Awareness for hidden omission", effect: "Notice omissions, suppressed truths, conversational absences, and emotional withholding; leave one minor sign of presence quieter than it should be.", misfire: "Something important fails to notice the Operator when they need to be seen." },
        { pip: 2, name: "DAMPENING", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Agility + Stealth or Mind + Engineering", effect: "Mute or soften one immediate detail until the end of the current Pressure Round. Gain Advantage on one roll to resist detection through that muted detail.", misfire: "The wrong detail vanishes, drawing attention to the absence." },
        { pip: 3, name: "MEMORY BLUR", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Deception or Mind + Hacking", effect: "Blur one brief event in memory or records.", misfire: "The blur hides the intended detail and exposes a worse one." },
        { pip: 4, name: "NULL PULSE", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Mind + Engineering or Nerves + Stealth", effect: "Create a brief dead zone in one limited channel.", misfire: "The null field suppresses something the Operators needed to hear." },
        { pip: 5, name: "CONCEPT EROSION", type: "Distortion", actionCost: "Frequency Use", roll: "3d6 + Nerves + Ritual or Mind + Hacking", effect: "Erode one concept from local continuity.", misfire: "The eroded concept returns as a hostile absence." },
        { pip: 6, name: "PERFECT SILENCE", type: "Divergence", actionCost: "Sustained or Frequency Use", roll: "3d6 + Nerves + Stealth when contested", effect: "Become a local absence around which observation fails.", misfire: "The Operator is cut out of ally perception at the worst possible moment." }
      ],
      Stillness: [
        { pip: 1, name: "ANCHOR BREATH", type: "Expression", actionCost: "None; ambient leakage. Small Interaction only when deliberately focusing.", roll: "None for obvious pressure; 3d6 + Nerves + Awareness for hidden timing", effect: "Regulate movement, steady visible stress, and notice the instant before escalation.", misfire: "The Operator freezes on the warning instead of moving." },
        { pip: 2, name: "BRACE", type: "Reaction", actionCost: "Reaction", roll: "3d6 + Body + Athletics or Nerves + Athletics", effect: "Reduce or resist one impact, shove, fall, blast, panic surge, or forced movement.", misfire: "The force stops, then transfers somewhere worse." },
        { pip: 3, name: "MOMENT LOCK", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Nerves + Athletics or Mind + Engineering", effect: "Hold one detail in place until next Turn.", misfire: "The detail resumes with stored force." },
        { pip: 4, name: "HALT FIELD", type: "Sustained", actionCost: "Frequency Use, then Sustained", roll: "3d6 + Nerves + Ritual or Body + Athletics", effect: "Create a local field where escalation slows.", misfire: "The field traps an ally, truth, or needed emotion inside it." },
        { pip: 5, name: "SUSPENDED FRAME", type: "Distortion", actionCost: "Frequency Use", roll: "3d6 + Nerves + Ritual", effect: "Suspend one scene element in a visible frame.", misfire: "The Operator is included in the frame." },
        { pip: 6, name: "ABSOLUTE STILLPOINT", type: "Divergence", actionCost: "Sustained or Frequency Use", roll: "3d6 + Nerves + Ritual when contested", effect: "Become the fixed point in the scene.", misfire: "The stillpoint preserves what should have been allowed to change." }
      ],
      Empyrean: [
        { pip: 1, name: "SHARED BREATH", type: "Expression", actionCost: "None; ambient leakage. Small Interaction or quiet scene focus only when deliberately grounding someone.", roll: "None for obvious distress; 3d6 + Presence + Empathy or Nerves + Medicine when contested or unstable", effect: "Synchronize emotionally with nearby people and steady immediate panic, isolation, spiraling, or distress.", misfire: "Shared panic, emotional echo loops, involuntary memory flashes, mirrored body language, or synchronized trembling." },
        { pip: 2, name: "RESONANCE CONDUCTION", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Empathy, Presence + Persuasion, or Nerves + Medicine", effect: "Transfer emotional pressure between people, environments, or entities.", misfire: "Synchronized panic, involuntary honesty, emotional flooding, accidental intimacy, memory bleed, or recursive empathy." },
        { pip: 3, name: "RELATIONAL GRAVITY", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Empathy, Presence + Performance, or Nerves + Tactics", effect: "Draw attention without speaking, pull fractured groups into temporary coherence, or create an emotional center of gravity.", misfire: "Unwanted attachment, emotional obsession, dependency loops, involuntary trust, parasocial fixation, or transferred loneliness." },
        { pip: 4, name: "WITNESS STATE", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Empathy, Presence + Persuasion, or Mind + Awareness", effect: "Force emotional acknowledgment, expose concealed grief/shame/fear, weaken denial-based phenomena, or anchor identity under recursive pressure.", misfire: "Involuntary emotional intake, identity overlap, emotional paralysis, inability to filter distress, recursive witnessing, or shared trauma flashback states." },
        { pip: 5, name: "HARMONIC CASCADE", type: "Distortion", actionCost: "Frequency Use", roll: "3d6 + Presence + Empathy, Presence + Performance, or Presence + Ritual", effect: "Synchronize a crowd, group field, relationship web, panic wave, riot, or emotional ecosystem around emotional pressure.", misfire: "Crowd hysteria, synchronized breakdown, emotional contagion spirals, involuntary cult behavior, mass dependency, or recursive emotional amplification." },
        { pip: 6, name: "COMMUNION EVENT", type: "Divergence", actionCost: "Sustained or Frequency Use", roll: "3d6 + Presence + Empathy or Presence + Ritual when contested", effect: "Create temporary shared emotional architecture or collective witness states.", misfire: "Personality blending, emotional hive states, recursive communion, involuntary synchronization, collective panic collapse, or inability to emotionally isolate self from others." }
      ],
      Becoming: [
        { pip: 1, name: "ADAPTIVE INSTINCT", type: "Expression", actionCost: "None; ambient leakage. Small Interaction only when deliberately focusing.", roll: "None for obvious pressure; 3d6 + Presence + Awareness for hidden identity pressure", effect: "Adapt posture, cadence, presentation, and behavior toward survivable patterns; notice role or mask pressure.", misfire: "The Operator reflexively mirrors a role they did not choose." },
        { pip: 2, name: "WEAR THE NEEDED FACE", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Deception or Presence + Performance", effect: "Adopt a surface role convincingly enough to pass a first glance, deliver one line, enter a space, or calm a social moment.", misfire: "The role fits too well and asks for behavior the Operator did not intend." },
        { pip: 3, name: "PATTERN MIMIC", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Performance or Mind + Investigation", effect: "Mimic a limited pattern well enough to use it.", misfire: "The pattern carries emotional residue into the Operator." },
        { pip: 4, name: "IDENTITY DRIFT", type: "Signature", actionCost: "Frequency Use", roll: "3d6 + Presence + Deception or Mind + Hacking", effect: "Drift one limited identity marker.", misfire: "The old and new identities overlap in public." },
        { pip: 5, name: "METAMORPHIC ECHO", type: "Distortion", actionCost: "Frequency Use", roll: "3d6 + Presence + Performance or Nerves + Ritual", effect: "Make identity change physically or socially consequential.", misfire: "The transformation answers a deeper expectation than intended." },
        { pip: 6, name: "TRUE BECOMING", type: "Divergence", actionCost: "Sustained or Frequency Use", roll: "3d6 + Nerves + Performance when contested", effect: "Become a transformation pressure source.", misfire: "The Operator changes in a way that solves the scene and complicates the self." }
      ]
    };
  }

  function fusionExpressions() {
    return {
      "Dream|Hunger": { name: "DESTRUCTIVE VISION", target: "one target or one small hostile cluster already acting through fear, pursuit, or aggression", effect: "Turn an illusion or symbolic frame emotionally violent. The target's next attack, defense, pursuit, or focused action is downgraded once.", misfire: "The violent symbol attaches to the wrong want or marks an ally as the threat." },
      "Dream|Silence": { name: "CONCEPT ERASURE", target: "one visible detail, meaning, signal, label, instruction, or symbolic cue", effect: "Remove one meaning from the scene until the next turn.", misfire: "The missing meaning leaves a louder absence." },
      "Dream|Stillness": { name: "FROZEN SYMBOL", target: "one illusion, omen, dream image, or symbolic feature already present in the scene", effect: "Hold the symbol as temporary terrain, cover, obstruction, or footing until the next turn.", misfire: "The symbol becomes fixed in the wrong place or holds the wrong person." },
      "Dream|Empyrean": { name: "SHARED DREAMSCAPE", target: "the Operator and up to three willing or emotionally exposed participants in the same scene", effect: "Pull the group into one shared symbolic frame.", misfire: "Everyone sees the same symbol but interprets it differently." },
      "Dream|Becoming": { name: "DREAMFORM SHIFT", target: "self", effect: "Appear as the version of yourself the scene's resonance is willing to accept.", misfire: "The accepted version of you is useful, but wrong." },
      "Hunger|Dream": { name: "PREDATORY VISION", target: "one target or one small hostile cluster within Near range", effect: "Make the target's fear or desire appear as a threat they must answer.", misfire: "The vision chooses the strongest appetite in the room instead of the intended target." },
      "Hunger|Silence": { name: "EMPTY PREDATOR", target: "one target the Operator can reach, stalk, or pressure", effect: "Create one perfect predatory opening.", misfire: "The Operator's own emotional presence drops out of the scene." },
      "Hunger|Stillness": { name: "MOMENTUM BREAK", target: "one moving target, rush, charge, pursuit, or projectile exchange", effect: "Cancel the target's movement until their next turn.", misfire: "The stopped motion stores pressure and releases somewhere inconvenient." },
      "Hunger|Empyrean": { name: "EMOTIONAL BIND", target: "one emotionally exposed target", effect: "Anchor the target's attention, desire, fear, or guilt to the Operator.", misfire: "The bind becomes mutual for one beat." },
      "Hunger|Becoming": { name: "FOCUSED PREDATOR", target: "one target with a clear role, stance, mask, or combat function", effect: "Copy the threat shape the target fears and strip confidence from one role.", misfire: "The Operator copies more of the target's fear than intended." },
      "Silence|Dream": { name: "NULL ILLUSION", target: "one space, sightline, clue, doorway, or symbolic object", effect: "Create an empty-space illusion that hides, blanks, or misdirects attention away from a truth in the scene.", misfire: "The blank spot becomes the most suspicious part of the room." },
      "Silence|Hunger": { name: "HOLLOW APPETITE", target: "one target, pursuit path, or predatory opening", effect: "Remove the emotional noise from a hunt, ambush, escape, or intimidation beat.", misfire: "The Operator's own wants become unreadable even to allies." },
      "Silence|Stillness": { name: "MOTION ERASURE", target: "one movement trail, impact record, projectile path, sound trace, or brief escape route", effect: "Remove the record of one action until the next turn.", misfire: "The erased motion skips forward and reappears as consequence." },
      "Silence|Empyrean": { name: "EMOTIONAL VOID", target: "one target or one small group sharing a clear emotional state", effect: "Suppress one named emotion until the next turn.", misfire: "The emotion returns flattened, displaced, or attached to the wrong person." },
      "Silence|Becoming": { name: "IDENTITY ERASURE", target: "self or one willing ally", effect: "Erase the target from recognition or symbolic presence until the next turn.", misfire: "The target returns with one identity marker missing or misplaced." },
      "Stillness|Dream": { name: "TIME-LOCKED VISION", target: "one symbolic moment, attack tell, decision point, or revealed omen", effect: "Freeze the moment long enough to read it.", misfire: "The read is true, but fixed to the wrong timing." },
      "Stillness|Hunger": { name: "MOMENTUM CANCEL", target: "one moving target, charge, pursuit, escape, or forced movement effect", effect: "Erase the target's motion until their next turn.", misfire: "The canceled momentum transfers into the environment." },
      "Stillness|Silence": { name: "NULL STASIS", target: "one 10 ft zone, threshold, object cluster, or pressure point", effect: "Create a small zone where sound, motion, and emotional traces are muted until the next turn.", misfire: "Something important inside the zone fails to move when it should." },
      "Stillness|Empyrean": { name: "CALM ANCHOR", target: "one small group, panic loop, argument, fear cascade, or emotional hazard", effect: "Freeze the group's current emotional state and prevent escalation until the next turn.", misfire: "The calm hardens into numbness or refusal to act." },
      "Stillness|Becoming": { name: "FIXED IDENTITY", target: "self, one willing ally, or one identity marker under pressure", effect: "Prevent identity shifts, imposed roles, disguise collapse, symbolic renaming, or mental displacement affecting the target until the next turn.", misfire: "The protected identity becomes rigid and harder to adapt." },
      "Empyrean|Dream": { name: "SHARED VISION", target: "the Operator and up to three willing, allied, or emotionally open participants", effect: "Give the group one shared emotional-symbolic picture of the scene.", misfire: "The vision reveals an emotional truth no one is ready to share." },
      "Empyrean|Hunger": { name: "ENTRAPPING EMOTION", target: "one emotionally exposed target", effect: "Bind the target to one named emotional tether.", misfire: "The tether catches an ally, bystander, or the Operator as well." },
      "Empyrean|Silence": { name: "QUIET HEART", target: "one target or one small group sharing a clear emotional signal", effect: "Remove the expression of one emotion until the next turn.", misfire: "The emotion returns through a different channel." },
      "Empyrean|Stillness": { name: "ANCHORED HARMONY", target: "one group emotional state, truce, confession, panic loop, or morale field", effect: "Hold the current emotional state stable until the next turn.", misfire: "The harmony locks in the wrong feeling." },
      "Empyrean|Becoming": { name: "EMOTIONAL MASK", target: "self", effect: "Adopt one target's emotional presentation, social warmth, relational tone, or affective signature until the next turn.", misfire: "The copied emotion sticks after the mask ends." },
      "Becoming|Dream": { name: "ARCHETYPE PROJECTION", target: "self and one audience, witness, target, or symbolic frame", effect: "Become the figure the scene expects, fears, needs, or recognizes.", misfire: "The archetype demands behavior the Operator does not want to perform." },
      "Becoming|Hunger": { name: "ADAPTIVE PREDATOR", target: "one target who can perceive or emotionally register the Operator", effect: "Take the threat shape the target fears.", misfire: "The Operator becomes convincing enough to frighten allies or themselves." },
      "Becoming|Silence": { name: "NAMELESS SELF", target: "self", effect: "Become conceptually hard to target until the next turn.", misfire: "The Operator's identity returns incomplete or mislabeled." },
      "Becoming|Stillness": { name: "FIXED ROLE", target: "self, one willing ally, or one imposed role currently under pressure", effect: "Lock the target into a chosen self, role, or survivor identity until the next turn.", misfire: "The fixed role becomes hard to release." },
      "Becoming|Empyrean": { name: "EMOTIONAL MASK", target: "self and one copied emotional profile", effect: "Copy one person's emotional identity, affect, social warmth, or relational posture until the next turn.", misfire: "The copied emotional identity answers back." }
    };
  }

  function frequencyExpressions(frequency) {
    return expressionLadders()[frequency] || [];
  }

  function frequencyExpression(frequency, pip) {
    return frequencyExpressions(frequency).find((entry) => entry.pip === Number(pip));
  }

  function pipLabel(frequency, index) {
    const expression = frequencyExpression(frequency, index);
    return expression ? expression.name : "Expression";
  }

  function unlockedLotusEntries() {
    const status = consoleState.operatorStatus;
    const lotus = normalizeLotus(status.lotus);
    const blind = normalizeFrequencyName(status.blindPetal);
    return frequencies().flatMap((frequency) => {
      if (frequency === blind) return [];
      const level = Number(lotus[frequency] || 0);
      return frequencyExpressions(frequency).slice(0, level).map((expression, index) => ({
        frequency,
        pip: index + 1,
        ...expression
      }));
    });
  }

  function eligibleFusionEntries() {
    const lotus = normalizeLotus(consoleState.operatorStatus.lotus);
    const blind = normalizeFrequencyName(consoleState.operatorStatus.blindPetal);
    const catalog = fusionExpressions();
    return frequencies().flatMap((initiator) => {
      if (initiator === blind || Number(lotus[initiator] || 0) < 6) return [];
      return frequencies().flatMap((receiver) => {
        if (receiver === initiator || receiver === blind || Number(lotus[receiver] || 0) < 4) return [];
        const fusion = catalog[`${initiator}|${receiver}`];
        return fusion ? [{ initiator, receiver, ...fusion }] : [];
      });
    });
  }

  function renderLotusUnlocks() {
    const list = document.getElementById("lotus-unlocks");
    if (!list) return;
    const status = consoleState.operatorStatus;
    const selected = normalizeFrequencyName(status.selectedLotusPetal) || "Dream";
    const blind = normalizeFrequencyName(status.blindPetal);
    const selectedVoid = voidForFrequency(selected);
    const selectedLevel = Number(normalizeLotus(status.lotus)[selected] || 0);
    list.textContent = "";

    if (selected === blind) {
      const blindNotice = document.createElement("p");
      blindNotice.className = "lotus-warning";
      blindNotice.textContent = `${selected.toUpperCase()} // BLIND — LOCKED`;
      list.append(blindNotice);
    }

    const selectedTitle = document.createElement("h3");
    selectedTitle.textContent = selected === blind ? `${selected} // Blind` : `${selected} unlocked // Void ${selectedVoid}`;
    list.append(selectedTitle);

    const selectedEntries = frequencyExpressions(selected).slice(0, selectedLevel).map((expression, index) => ({
      frequency: selected,
      pip: index + 1,
      ...expression
    }));
    if (selected === blind) {
      const blocked = document.createElement("p");
      blocked.className = "empty-line";
      blocked.textContent = frequencyCard(selected).blind;
      list.append(blocked);
    } else if (selectedLevel <= 0) {
      const empty = document.createElement("p");
      empty.className = "empty-line";
      empty.textContent = "No pips selected for this Frequency.";
      list.append(empty);
    } else {
      const selectedList = document.createElement("ol");
      selectedEntries.forEach((entry) => selectedList.append(lotusUnlockEntry(entry, { compact: true })));
      list.append(selectedList);
    }

    const fusions = eligibleFusionEntries().filter((entry) => entry.initiator === selected || entry.receiver === selected);
    const fusionTitle = document.createElement("h3");
    fusionTitle.textContent = fusions.length ? "Selected fusion status" : "Fusion status";
    list.append(fusionTitle);
    if (!fusions.length) {
      const empty = document.createElement("p");
      empty.className = "empty-line";
      empty.textContent = selected === blind
        ? "Blind petal cannot participate in legal Fusion."
        : "No legal Fusion currently uses this Frequency.";
      list.append(empty);
      return;
    }

    const fusionList = document.createElement("ol");
    fusions.forEach((entry) => fusionList.append(fusionUnlockEntry(entry)));
    list.append(fusionList);
  }

  function renderActiveResonanceProfile() {
    const profile = document.getElementById("active-resonance-profile");
    if (!profile) return;
    const status = consoleState.operatorStatus;
    const lotus = normalizeLotus(status.lotus);
    const blind = normalizeFrequencyName(status.blindPetal);
    profile.textContent = "";
    frequencies().forEach((frequency) => {
      const group = document.createElement("section");
      group.className = "resonance-group";
      const title = document.createElement("h3");
      title.textContent = frequency === blind ? `${frequency.toUpperCase()} // BLIND — LOCKED` : frequency;
      group.append(title);
      if (frequency === blind) {
        const locked = document.createElement("p");
        locked.className = "empty-line";
        locked.textContent = "Petal unavailable.";
        group.append(locked);
        profile.append(group);
        return;
      }
      const level = Number(lotus[frequency] || 0);
      if (level <= 0) {
        const empty = document.createElement("p");
        empty.className = "empty-line";
        empty.textContent = "No cultivated pips.";
        group.append(empty);
        profile.append(group);
        return;
      }
      const groupList = document.createElement("ul");
      frequencyExpressions(frequency).slice(0, level).forEach((entry) => {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = `${entry.pip}. ${entry.name}`;
        item.append(name);
        groupList.append(item);
      });
      group.append(groupList);
      profile.append(group);
    });
  }

  function renderFrequencyBuildSummary() {
    const summary = document.getElementById("frequency-build-summary");
    if (!summary) return;
    const status = consoleState.operatorStatus;
    const lotus = normalizeLotus(status.lotus);
    const blind = normalizeFrequencyName(status.blindPetal);
    const levels = Object.values(lotus).map((value) => Number(value || 0));
    const highestLevel = Math.max(0, ...levels);
    const fusions = eligibleFusionEntries();
    summary.textContent = "";
    [
      ["Blind petal", blind ? `${blind} // LOCKED` : "Unmarked"],
      ["Total cultivated pips", `${totalCultivatedPips(lotus)} / ${maxFrequencyPips()}`],
      ["Total Void committed", `${totalInvestedVoid(status.voidByFrequency)} / ${maxTotalVoid()}`],
      ["Breach bank", normalizeNonNegative(status.breachPoints)],
      ["Fusion eligibility", fusions.length ? `${fusions.length} legal signature${fusions.length === 1 ? "" : "s"}` : "No legal 6-to-4 pair"],
      ["Highest unlocked tier", lotusTier(highestLevel)]
    ].forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "summary-row";
      const key = document.createElement("span");
      key.textContent = label;
      const data = document.createElement("strong");
      data.textContent = value;
      row.append(key, data);
      summary.append(row);
    });
  }

  function lotusUnlockEntry(entry, options = {}) {
    const item = document.createElement("li");
    if (options.compact) {
      item.className = "compact-rule-entry";
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `${entry.pip}: ${pipLabel(entry.frequency, entry.pip)} // ${entry.type}`;
      const effect = document.createElement("p");
      effect.textContent = entry.effect;
      const meta = document.createElement("p");
      meta.className = "expression-meta";
      meta.textContent = `${entry.actionCost} // ${entry.roll} // Misfire: ${entry.misfire}`;
      details.append(summary, effect, meta);
      item.append(details);
      return item;
    }
    const label = document.createElement("strong");
    const includeFrequency = Boolean(options.includeFrequency);
    label.textContent = `${includeFrequency ? `${entry.frequency} ` : ""}${entry.pip}: ${pipLabel(entry.frequency, entry.pip)}`;
    const effect = document.createElement("p");
    effect.textContent = `${entry.type}. ${entry.effect}`;
    item.append(label, effect);
    const meta = document.createElement("p");
    meta.className = "expression-meta";
    meta.textContent = `${entry.actionCost} // ${entry.roll} // Misfire: ${entry.misfire}`;
    item.append(meta);
    return item;
  }

  function fusionUnlockEntry(entry) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = `Fusion: ${entry.name}`;
    const pair = document.createElement("p");
    pair.textContent = `${entry.initiator} 6 + ${entry.receiver} 4 // Target: ${entry.target}`;
    const effect = document.createElement("p");
    effect.textContent = entry.effect;
    const meta = document.createElement("p");
    meta.className = "expression-meta";
    meta.textContent = `Misfire: ${entry.misfire}`;
    item.append(label, pair, effect, meta);
    return item;
  }

  function renderLotus() {
    const map = document.getElementById("lotus-map");
    if (!map) return;
    const status = consoleState.operatorStatus;
    const lotus = normalizeLotus(status.lotus);
    status.voidByFrequency = normalizeVoidByFrequency(status.voidByFrequency);
    const selected = normalizeFrequencyName(status.selectedLotusPetal) || operatorRecord?.primaryFrequency || "Dream";
    status.selectedLotusPetal = normalizeFrequencyName(selected) || "Dream";
    status.lotus = lotus;
    map.textContent = "";

    frequencies().forEach((frequency) => {
      const level = Number(lotus[frequency] || 0);
      const petalVoid = voidForFrequency(frequency);
      if (frequency === status.blindPetal && level > 0) {
        lotus[frequency] = "0";
      }
      const petal = document.createElement("article");
      petal.className = "lotus-petal";
      const openGate = petalVoid >= 4 ? 3 : petalVoid >= 2 ? 2 : petalVoid >= 1 ? 1 : 0;
      petal.dataset.gate = String(openGate);
      petal.classList.toggle("is-selected", frequency === status.selectedLotusPetal);
      petal.classList.toggle("is-blind", frequency === status.blindPetal);
      petal.classList.toggle("is-powered", frequency !== status.blindPetal && level > 0);
      petal.classList.toggle("is-gate-open", frequency !== status.blindPetal && openGate > 0);
      petal.classList.toggle("is-pulsing", frequency === lotusPulseFrequency);

      const header = document.createElement("button");
      header.type = "button";
      header.className = "lotus-petal-name";
      header.textContent = frequency === status.blindPetal ? `${frequency} // Blind` : frequency;
      header.addEventListener("click", () => {
        status.selectedLotusPetal = frequency;
        writeConsoleState();
        renderLotus();
      });

      const pips = document.createElement("div");
      pips.className = "lotus-pips";
      for (let index = 1; index <= 6; index += 1) {
        const lockedByVoid = index > level && requiredVoidForFrequencyLevel(index) > petalVoid;
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = "pip";
        pip.disabled = frequency === status.blindPetal || lockedByVoid;
        pip.classList.toggle("is-filled", frequency !== status.blindPetal && index <= Number(lotus[frequency] || 0));
        pip.classList.toggle("is-locked", frequency !== status.blindPetal && lockedByVoid);
        pip.setAttribute("aria-label", `${frequency} pip ${index}`);
        if (lockedByVoid) {
          pip.title = `Requires ${requiredVoidForFrequencyLevel(index)} Void on ${frequency}.`;
        }
        pip.addEventListener("click", () => {
          if (frequency === status.blindPetal) return;
          const targetLevel = index === level ? index - 1 : index;
          const allowed = frequencyChangeAllowed(status.lotus, frequency, targetLevel);
          if (!allowed.ok) {
            setStorageStatus(allowed.message, true);
            renderLotus();
            return;
          }
          if (!applyFrequencyBreachDelta(allowed.cost || 0)) {
            renderLotus();
            return;
          }
          status.lotus[frequency] = normalizeBoxValue(targetLevel, 6);
          status.selectedLotusPetal = frequency;
          lotusPulseFrequency = frequency;
          writeConsoleState();
          renderCreationMode();
          renderLotus();
          window.setTimeout(() => {
            if (lotusPulseFrequency === frequency) {
              lotusPulseFrequency = "";
              renderLotus();
            }
          }, 760);
        });
        pips.append(pip);
      }

      const voidField = document.createElement("label");
      voidField.className = "lotus-void";
      const voidText = document.createElement("span");
      voidText.textContent = "Void";
      const voidInput = document.createElement("input");
      voidInput.type = "number";
      voidInput.min = "0";
      voidInput.max = "99";
      voidInput.step = "1";
      voidInput.inputMode = "numeric";
      voidInput.value = status.voidByFrequency[frequency];
      voidInput.setAttribute("aria-label", `${frequency} Void`);
      voidInput.addEventListener("change", () => {
        setFrequencyVoid(frequency, voidInput.value);
        renderLotus();
      });
      voidField.append(voidText, voidInput);

      const blind = document.createElement("button");
      blind.type = "button";
      blind.className = "blind-toggle";
      blind.textContent = frequency === status.blindPetal ? "Blind Petal" : "Mark Blind";
      if (status.blindPetal && !status.creationMode && frequency !== status.blindPetal) {
        blind.hidden = true;
      }
      if (status.blindPetal && !status.creationMode && frequency === status.blindPetal) {
        blind.disabled = true;
      }
      blind.addEventListener("click", () => {
        status.blindPetal = frequency;
        if (status.blindPetal === frequency) status.lotus[frequency] = "0";
        status.selectedLotusPetal = frequency;
        writeConsoleState();
        renderLotus();
      });

      petal.append(header, pips, voidField, blind);
      map.append(petal);
    });

    const selectedLevel = Number(lotus[status.selectedLotusPetal] || 0);
    const tier = lotusTier(selectedLevel);
    const selectedVoid = voidForFrequency(status.selectedLotusPetal);
    const selectedGate = selectedVoid >= 4 ? "Gate 3" : selectedVoid >= 2 ? "Gate 2" : selectedVoid >= 1 ? "Gate 1" : "Gate 0";
    const nextPip = Math.min(6, selectedLevel + 1);
    const nextRequirement = selectedLevel >= 6
      ? "Ceiling reached"
      : `${requiredVoidForFrequencyLevel(nextPip)} Void // ${frequencyPipBreachCost(nextPip)} Breach`;
    setText("lotus-frequency", status.selectedLotusPetal + (status.selectedLotusPetal === status.blindPetal ? " // BLIND" : ""));
    setText("lotus-tier", status.selectedLotusPetal === status.blindPetal ? "LOCKED" : tier);
    setText("lotus-gate", status.selectedLotusPetal === status.blindPetal ? "LOCKED" : `${selectedGate} // ${selectedVoid} Void`);
    setText("lotus-pips-readout", status.selectedLotusPetal === status.blindPetal ? "0 / 6" : `${selectedLevel} / 6`);
    setText("lotus-next", status.selectedLotusPetal === status.blindPetal ? "LOCKED" : nextRequirement);
    const copy = document.getElementById("lotus-copy");
    if (copy) {
      copy.textContent = status.selectedLotusPetal === status.blindPetal
        ? frequencyCard(status.selectedLotusPetal).blind
        : tierCopy(status.selectedLotusPetal, tier, selectedLevel);
    }
    renderLotusUnlocks();
    renderActiveResonanceProfile();
    renderFrequencyBuildSummary();
  }

  function formatDrift(record) {
    if (!record || !Array.isArray(record.frequencyDrift)) return "";
    return record.frequencyDrift
      .filter((entry) => Number(entry.value) > 0)
      .map((entry) => `${entry.frequency} ${entry.value}`)
      .join(" // ");
  }

  function renderAll() {
    renderSnapshot();
    renderStatusForm();
    renderEquipmentPicker();
    renderList("cases", "No cases recorded in this browser.", (item) => item.title, (item) => [
      ["Needlepoint", item.needlepoint],
      ["Clues", item.clues],
      ["NPCs / entities", item.entities],
      ["Timeline", item.timeline],
      ["Unresolved questions", item.questions],
      ["Recorded", formatDate(item.createdAt)]
    ]);
    renderList("equipment", "No equipment recorded.", (item) => item.item, (item) => [
      ["Category", item.category],
      ["Slot", item.slot],
      ["Why you have it", item.reason]
    ]);
    renderEquipmentCapStatus();
    renderList("anomalies", "No anomalies logged.", (item) => item.scene, (item) => [
      ["Impossible detail", item.detail],
      ["Severity", item.severity],
      ["Tags", item.tags],
      ["Notes", item.notes],
      ["Recorded", formatDate(item.createdAt)]
    ]);
    renderList("relationships", "No relationships mapped.", (item) => item.name, (item) => [
      ["Type", item.kind],
      ["Trust", item.trust],
      ["Tension", item.tension],
      ["Why they matter", item.why || item.bond || item.risk],
      ["Notes", item.notes]
    ]);
    renderList("residue", "No residue tracked.", (item) => item.scene, (item) => [
      ["Highest state", item.highestState],
      ["Persistence", item.persistence],
      ["Who noticed", item.noticed],
      ["What returns", item.returns],
      ["Mundane record", item.mundaneRecord],
      ["Recovery opening", item.recoveryOpening]
    ]);
    renderAuthorization();
    setStorageStatus("Local console record held in this browser.");
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "TIMEBASE UNCERTAIN";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).toUpperCase();
  }

  function formPayload(form) {
    const data = new FormData(form);
    const payload = {};
    data.forEach((value, key) => {
      payload[key] = safeString(value, 3000);
    });
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      payload[input.name] = input.checked;
    });
    if (form.id === "equipment-form") {
      const custom = payload.category === "Custom";
      const selectedItem = payload.item;
      payload.item = custom && payload.customItem ? payload.customItem : selectedItem;
      payload.slot = normalizeEquipmentSlot(equipmentSlotForSelection(selectedItem, custom));
      delete payload.customItem;
    }
    return payload;
  }

  function collectStatusPayload() {
    const status = { ...consoleState.operatorStatus };
    document.querySelectorAll("#status-form input, #status-form textarea, #status-form select, #frequency-form input, #frequency-form textarea, #frequency-form select").forEach((input) => {
      if (!input.name) return;
      status[input.name] = input.type === "checkbox" ? input.checked : safeString(input.value, 3000);
    });
    return {
      ...status,
      stability: normalizeStabilityValue(status.stability),
      stabilityBand: bandFromLegacyStability(status.stability),
      attentionState: normalizeAttentionState(status.attentionState),
      harmBoxes: normalizeBoxValue(status.harmBoxes, 5),
      voidByFrequency: normalizeVoidByFrequency(status.voidByFrequency),
      voidMarks: clampVoidBank(status.voidMarks, status.voidByFrequency),
      breachPoints: normalizeNonNegative(status.breachPoints),
      creationMode: Boolean(status.creationMode),
      frequencyEditMode: Boolean(status.frequencyEditMode),
      activeMisfire: safeString(status.activeMisfire, 1000),
      misfireSeverity: normalizeMisfireSeverity(status.misfireSeverity),
      presentationPressure: normalizeBoxValue(status.presentationPressure, 5),
      lotus: normalizeLotus(status.lotus),
      blindPetal: normalizeFrequencyName(status.blindPetal),
      selectedLotusPetal: normalizeFrequencyName(status.selectedLotusPetal),
      attributes: normalizeAttributes(status.attributes),
      skills: normalizeSkills(status.skills),
      rollAttributeKey: normalizeAttributeName(status.rollAttributeKey) || "Body",
      rollSkillKey: normalizeSkillName(status.rollSkillKey),
      rollModifier: normalizeSignedValue(status.rollModifier, -10, 10),
      rollAdvantage: Boolean(status.rollAdvantage) && !Boolean(status.rollDisadvantage),
      rollDisadvantage: Boolean(status.rollDisadvantage)
    };
  }

  function autosaveStatus() {
    consoleState.operatorStatus = collectStatusPayload();
    writeConsoleState();
    setNamedValue("voidMarks", consoleState.operatorStatus.voidMarks);
    renderBandMeter();
    renderLotus();
    renderFrequencyEditMode();
    renderStatusSummary();
    renderSegmentedControls();
    renderRollSelectors();
    renderCreationMode();
  }

  function addEntry(collection, form) {
    const payload = formPayload(form);
    const record = {
      id: `${collection}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowStamp(),
      ...payload
    };
    consoleState[collection].unshift(record);
    writeConsoleState();
    form.reset();
    renderAll();
    return record;
  }

  async function parseApiResponse(response) {
    const text = await response.text();
    let result;
    try {
      result = text ? JSON.parse(text) : {};
    } catch (error) {
      const snippet = text.replace(/\s+/g, " ").replace(/[<>{}]/g, "").trim().slice(0, 160);
      throw new Error(`HTTP ${response.status}: ${snippet || "Transfer returned non-JSON."}`);
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Transfer refused.");
    }

    return result;
  }

  async function volunteerAnomaly(record) {
    const status = consoleState.operatorStatus;
    const response = await fetch(`${apiBase}/api/reports/anomaly-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operatorName: status.operatorName,
        designation: status.designation || operatorRecord?.designation || "",
        primaryFrequency: operatorRecord?.primaryFrequency || status.selectedLotusPetal || "",
        classification: operatorRecord?.observerClassification || "",
        attentionState: status.attentionState,
        activeNeedlepoint: status.activeNeedlepoint,
        scene: record.scene,
        detail: record.detail,
        severity: record.severity,
        tags: record.tags,
        notes: record.notes,
      }),
    });
    return parseApiResponse(response);
  }

  function bindForms() {
    if (forms.cases) forms.cases.addEventListener("submit", (event) => {
      event.preventDefault();
      addEntry("cases", forms.cases);
    });
    if (forms.equipment) {
      renderEquipmentPicker();
      forms.equipment.elements.category.addEventListener("change", renderEquipmentPicker);
      forms.equipment.querySelector('[name="item"]').addEventListener("change", syncEquipmentSlot);
      forms.equipment.addEventListener("submit", (event) => {
        event.preventDefault();
        const payload = formPayload(forms.equipment);
        if (!payload.item) {
          setStorageStatus("Choose or name an equipment item first.", true);
          return;
        }
        const capMessage = equipmentCapMessage(payload);
        if (capMessage) {
          setStorageStatus(capMessage, true);
          renderEquipmentCapStatus();
          return;
        }
        addEntry("equipment", forms.equipment);
      });
    }
    if (forms.anomalies) forms.anomalies.addEventListener("submit", (event) => {
      event.preventDefault();
      const shouldVolunteer = event.submitter && event.submitter.getAttribute("data-anomaly-submit") === "volunteer";
      const record = addEntry("anomalies", forms.anomalies);
      if (!shouldVolunteer) {
        setAnomalyTransferStatus("Anomaly logged locally. No upstream copy created.");
        return;
      }

      setAnomalyTransferStatus("Volunteer transfer in progress.");
      volunteerAnomaly(record)
        .then((result) => setAnomalyTransferStatus(`Volunteer copy accepted: ${result.id}.`))
        .catch((error) => setAnomalyTransferStatus(error.message, true));
    });
    if (forms.relationships) forms.relationships.addEventListener("submit", (event) => {
      event.preventDefault();
      addEntry("relationships", forms.relationships);
    });
    if (forms.residue) forms.residue.addEventListener("submit", (event) => {
      event.preventDefault();
      addEntry("residue", forms.residue);
    });
    if (forms.status) forms.status.addEventListener("submit", (event) => {
      event.preventDefault();
      autosaveStatus();
    });
    if (forms.frequency) forms.frequency.addEventListener("submit", (event) => {
      event.preventDefault();
      autosaveStatus();
    });
    const clearActiveMisfire = document.getElementById("clear-active-misfire");
    if (clearActiveMisfire) clearActiveMisfire.addEventListener("click", () => {
      consoleState.operatorStatus.activeMisfire = "";
      setNamedValue("activeMisfire", "");
      writeConsoleState();
      setStorageStatus("Active Misfire cleared. Recorded log retained.");
    });
    document.querySelectorAll("#status-form input, #status-form textarea, #status-form select, #frequency-form input, #frequency-form textarea, #frequency-form select").forEach((input) => {
      input.addEventListener("input", autosaveStatus);
      input.addEventListener("change", autosaveStatus);
    });
    const rollAdvantage = document.querySelector('[name="rollAdvantage"]');
    const rollDisadvantage = document.querySelector('[name="rollDisadvantage"]');
    if (rollAdvantage && rollDisadvantage) {
      rollAdvantage.addEventListener("change", () => {
        if (rollAdvantage.checked) rollDisadvantage.checked = false;
        autosaveStatus();
      });
      rollDisadvantage.addEventListener("change", () => {
        if (rollDisadvantage.checked) rollAdvantage.checked = false;
        autosaveStatus();
      });
    }
    document.querySelectorAll("[data-segmented] button[data-value]").forEach((button) => {
      button.addEventListener("click", () => {
        const group = button.closest("[data-segmented]");
        const field = group && group.getAttribute("data-segmented");
        if (!field) return;
        consoleState.operatorStatus[field] = button.getAttribute("data-value");
        setNamedValue(field, consoleState.operatorStatus[field]);
        autosaveStatus();
      });
    });
    const rollButton = document.getElementById("roll-action");
    if (rollButton) rollButton.addEventListener("click", rollAction);
    const addSkill = document.getElementById("add-skill");
    if (addSkill) addSkill.addEventListener("click", () => {
      const picker = document.getElementById("skill-picker");
      const rank = document.getElementById("skill-rank");
      const skill = picker && normalizeSkillName(picker.value);
      if (!skill) return;
      consoleState.operatorStatus.skills = normalizeSkills(consoleState.operatorStatus.skills);
      const targetRank = Number(normalizeBoxValue(rank && rank.value || 1, 5));
      const allowed = skillChangeAllowed(consoleState.operatorStatus.skills, skill, targetRank);
      if (!allowed.ok) {
        setStorageStatus(allowed.message, true);
        return;
      }
      if (!applyBreachDelta(allowed.cost || 0)) return;
      consoleState.operatorStatus.skills[skill] = String(targetRank);
      if (consoleState.operatorStatus.skills[skill] === "0") consoleState.operatorStatus.skills[skill] = "1";
      consoleState.operatorStatus.rollSkillKey = skill;
      writeConsoleState();
      renderSkills();
      renderCreationMode();
    });
    const applyCoreStart = document.getElementById("apply-core-start");
    if (applyCoreStart) applyCoreStart.addEventListener("click", () => {
      const status = consoleState.operatorStatus;
      const frequency = selectedCoreFrequency();
      status.creationMode = true;
      status.voidMarks = "0";
      status.voidByFrequency = normalizeVoidByFrequency(status.voidByFrequency);
      status.voidByFrequency[frequency] = String(Math.max(1, Number(status.voidByFrequency[frequency] || 0)));
      status.breachPoints = String(creationBonusBreachBudget());
      status.lotus = normalizeLotus(status.lotus);
      status.lotus[frequency] = String(Math.max(1, Number(status.lotus[frequency] || 0)));
      status.selectedLotusPetal = frequency;
      setNamedValue("voidMarks", status.voidMarks);
      setNamedValue("breachPoints", status.breachPoints);
      writeConsoleState();
      renderAll();
      setStorageStatus(`Core start applied: ${frequency} pip 1, 1 Void invested, 3 Bonus Breach.`);
    });
    const creationMode = document.getElementById("creation-mode-toggle");
    if (creationMode) creationMode.addEventListener("click", () => {
      consoleState.operatorStatus.creationMode = !consoleState.operatorStatus.creationMode;
      writeConsoleState();
      renderCreationMode();
      renderAttributes();
      renderSkills();
    });
    const frequencyEdit = document.getElementById("frequency-edit-toggle");
    if (frequencyEdit) frequencyEdit.addEventListener("click", () => {
      consoleState.operatorStatus.frequencyEditMode = !consoleState.operatorStatus.frequencyEditMode;
      writeConsoleState();
      renderFrequencyEditMode();
      renderLotus();
    });
    const skillPicker = document.getElementById("skill-picker");
    const skillRank = document.getElementById("skill-rank");
    if (skillPicker) skillPicker.addEventListener("change", renderSkillCostPreview);
    if (skillRank) skillRank.addEventListener("input", renderSkillCostPreview);
  }

  function rollAction() {
    autosaveStatus();
    const status = consoleState.operatorStatus;
    const rollMode = status.rollAdvantage ? "ADVANTAGE" : status.rollDisadvantage ? "DISADVANTAGE" : "STANDARD";
    const dice = rollMode === "STANDARD" ? [rollDie(), rollDie(), rollDie()] : [rollDie(), rollDie(), rollDie(), rollDie()];
    const keptDice = keptRollDice(dice, rollMode);
    const dropped = dice.filter((value, index) => index !== keptDice.dropIndex);
    const attrs = normalizeAttributes(status.attributes);
    const skills = normalizeSkills(status.skills);
    const attrKey = normalizeAttributeName(status.rollAttributeKey) || "Body";
    const skillKey = normalizeSkillName(status.rollSkillKey);
    const attrValue = Number(attrs[attrKey] || 0);
    const skillValue = skillKey ? Number(skills[skillKey] || 0) : 0;
    const total = keptDice.values.reduce((sum, value) => sum + value, 0)
      + attrValue
      + skillValue
      + Number(status.rollModifier || 0);
    const output = document.getElementById("roll-output");
    if (output) {
      const modeText = rollMode === "ADVANTAGE" ? "ADVANTAGE KEEP BEST 3" : "DISADVANTAGE KEEP WORST 3";
      const diceText = rollMode === "STANDARD"
        ? `3D6 ${dice.join(" + ")}`
        : `4D6 ${dice.join(" + ")} // ${modeText} ${keptDice.values.join(" + ")} // DROP ${dropped.join(" + ")}`;
      output.textContent = `${diceText} // ${attrKey} +${attrValue} // ${skillKey || "Untrained"} +${skillValue} // MOD ${status.rollModifier || 0} = ${total}`;
    }
  }

  function keptRollDice(dice, mode) {
    if (mode === "ADVANTAGE") {
      const min = Math.min(...dice);
      const dropIndex = dice.indexOf(min);
      return { dropIndex, values: dice.filter((value, index) => index !== dropIndex) };
    }
    if (mode === "DISADVANTAGE") {
      const max = Math.max(...dice);
      const dropIndex = dice.indexOf(max);
      return { dropIndex, values: dice.filter((value, index) => index !== dropIndex) };
    }
    return { dropIndex: -1, values: dice };
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

  function bindTabs() {
    document.querySelectorAll("[data-module-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-module-tab");
        document.querySelectorAll("[data-module-tab]").forEach((node) => node.classList.toggle("is-active", node === tab));
        document.querySelectorAll("[data-module-panel]").forEach((panel) => {
          panel.classList.toggle("is-active", panel.getAttribute("data-module-panel") === target);
        });
      });
    });
  }

  function bindDataControls() {
    const exportOperatorFile = document.getElementById("export-operator-file");
    const exportButton = document.getElementById("export-console");
    const importInput = document.getElementById("import-console");
    const importAuthorization = document.getElementById("import-authorization");
    const purgeButton = document.getElementById("purge-console");

    if (exportOperatorFile) exportOperatorFile.addEventListener("click", () => {
      operatorRecord = readOperatorRecord();
      const status = collectStatusPayload();
      consoleState.operatorStatus = status;
      writeConsoleState();
      const operatorName = safeString(status.operatorName || operatorRecord?.designation || status.designation || "Operator", 120);
      if (!operatorRecord && !operatorName) {
        setStorageStatus("No operator sheet found. Complete intake or fill the Operator console first.", true);
        return;
      }
      const exportedAt = nowStamp();
      const exportId = safeString(operatorRecord?.id || status.operatorId || status.designation || operatorName, 120);
      const payload = {
        exportType: "cradlepoint.operator",
        version: 1,
        exportedAt,
        operatorName,
        operatorId: exportId,
        source: "veildaemon.operatorConsole.v1",
        operatorRecord: operatorRecord || null,
        operatorStatus: status,
        operatorEquipment: consoleState.equipment
      };
      const safeName = operatorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "operator";
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cradlepoint-operator-${safeName}-${exportedAt.slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStorageStatus("Operator JSON exported.");
    });

    if (exportButton) exportButton.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(consoleState, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `veildaemon-operator-console-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });

    if (importInput) importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        consoleState = normalizeConsoleState(JSON.parse(text));
        writeConsoleState();
        renderAll();
      } catch (error) {
        setStorageStatus("Import refused. File did not match console record shape.", true);
      } finally {
        importInput.value = "";
      }
    });

    if (importAuthorization) importAuthorization.addEventListener("change", async () => {
      const file = importAuthorization.files && importAuthorization.files[0];
      if (!file) return;
      try {
        const unlocks = parseAuthorizationPacket(await file.text());
        if (!unlocks.length) throw new Error("No unlock flags found.");
        const added = mergeUnlocks(unlocks);
        applyUnlockEffects();
        consoleState = normalizeConsoleState(consoleState);
        writeConsoleState();
        renderAll();
        const ontology = unlocks.find((item) => item.type === "ontology");
        setStorageStatus(ontology ? "NEW ONTOLOGY SIGNAL DETECTED" : `${added || unlocks.length} authorization flag processed.`);
      } catch (error) {
        setStorageStatus("Authorization refused. No valid unlock flags found.", true);
      } finally {
        importAuthorization.value = "";
      }
    });

    if (purgeButton) purgeButton.addEventListener("click", () => {
      if (!window.confirm("Purge local console entries from this browser? Intake record remains untouched.")) return;
      consoleState = normalizeConsoleState(null);
      try {
        window.localStorage.removeItem(consoleStorageKey);
        window.dispatchEvent(new CustomEvent("veildaemon:operator-record-updated"));
      } catch (error) {
        // Local cleanup is best effort.
      }
      renderAll();
      setStorageStatus("Local console entries purged. Intake record preserved.");
    });
  }

  bindTabs();
  bindForms();
  bindDataControls();
  renderAll();
  window.addEventListener("veildaemon:operator-record-updated", () => {
    operatorRecord = readOperatorRecord();
    renderAll();
    if (operatorRecord) {
      setStorageStatus(`Operator file imported: ${safeString(operatorRecord.designation, 80)}.`);
    }
  });
}());
