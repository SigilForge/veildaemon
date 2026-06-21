(function () {
  const consoleStorageKey = "veildaemon.operatorConsole.v1";
  const recordStorageKey = "veildaemon.operatorRecord.v2";
  const legacyRecordStorageKey = "veildaemon.operatorRecord.v1";
  const rewardStorageKey = "veildaemon.artifactCache.v1";

  const defaults = {
    version: 1,
    createdAt: "",
    updatedAt: "",
    cases: [],
    operatorStatus: {
      stability: "10",
      stabilityBand: "Calm",
      attentionState: "Unnoticed",
      harm: "None recorded",
      harmBoxes: "0",
      voidMarks: "0",
      breachPoints: "0",
      misfireBoxes: "0",
      presentationPressure: "0",
      bleed: "",
      misfires: "",
      commonTell: "",
      misfireFlavor: "",
      anchorPerson: "",
      totemObject: "",
      groundingLine: "",
      presentation: "",
      obligation: "",
      lotusPrimary: "",
      lotusBlind: "",
      lotusMethod: "",
      vectorNeed: "",
      pipOneLeakage: "",
      pipTwoExpression: "",
      knownExpressions: "",
      expressionLimits: "",
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
    anomalies: document.getElementById("anomaly-list"),
    relationships: document.getElementById("relationship-list"),
    residue: document.getElementById("residue-list")
  };

  const forms = {
    cases: document.getElementById("case-form"),
    status: document.getElementById("status-form"),
    anomalies: document.getElementById("anomaly-form"),
    relationships: document.getElementById("relationship-form"),
    residue: document.getElementById("residue-form")
  };

  let consoleState = readConsoleState();
  const operatorRecord = readOperatorRecord();
  const artifactState = readArtifactState();

  function nowStamp() {
    return new Date().toISOString();
  }

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(defaults));
  }

  function safeString(value, max = 2000) {
    return String(value || "").trim().slice(0, max);
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeConsoleState(value) {
    const fallback = cloneDefaultState();
    const now = nowStamp();
    const state = value && typeof value === "object" ? value : {};

    return {
      version: 1,
      createdAt: safeString(state.createdAt) || now,
      updatedAt: safeString(state.updatedAt) || now,
      cases: normalizeArray(state.cases),
      operatorStatus: migrateOperatorStatus({
        ...fallback.operatorStatus,
        ...(state.operatorStatus && typeof state.operatorStatus === "object" ? state.operatorStatus : {})
      }),
      anomalies: normalizeArray(state.anomalies),
      relationships: normalizeArray(state.relationships),
      residue: normalizeArray(state.residue)
    };
  }

  function migrateOperatorStatus(status) {
    return {
      ...status,
      anchorPerson: status.anchorPerson || status.anchors || "",
      stabilityBand: normalizeStabilityBand(status.stabilityBand || bandFromLegacyStability(status.stability)),
      attentionState: normalizeAttentionState(status.attentionState),
      stability: normalizeStabilityValue(status.stability),
      harmBoxes: normalizeBoxValue(status.harmBoxes, 6),
      voidMarks: normalizeNonNegative(status.voidMarks),
      breachPoints: normalizeNonNegative(status.breachPoints),
      misfireBoxes: normalizeBoxValue(status.misfireBoxes, 6),
      presentationPressure: normalizeBoxValue(status.presentationPressure, 5),
      recoveryGround: Boolean(status.recoveryGround),
      recoveryBreathe: Boolean(status.recoveryBreathe),
      recoveryConnect: Boolean(status.recoveryConnect),
      recoveryLeave: Boolean(status.recoveryLeave),
      recoveryNameIt: Boolean(status.recoveryNameIt)
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

  function renderSnapshot() {
    setText("snapshot-designation", operatorRecord && operatorRecord.designation || "UNINITIALIZED");
    setText("snapshot-classification", operatorRecord && operatorRecord.observerClassification || "PENDING");
    setText("snapshot-frequency", operatorRecord && operatorRecord.primaryFrequency || "UNASSIGNED");
    setText("snapshot-attention", operatorRecord && operatorRecord.attentionStatus || "UNMEASURED");
    setText("snapshot-access", operatorRecord && operatorRecord.accessLevel || "LOCAL");

    const notice = document.getElementById("record-notice");
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

    const header = document.createElement("div");
    header.className = "entry-header";
    const h3 = document.createElement("h3");
    h3.textContent = title || "UNLABELED RECORD";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "entry-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      consoleState[collection] = consoleState[collection].filter((item) => item.id !== id);
      writeConsoleState();
      renderAll();
    });
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

  function renderStatusForm() {
    const form = forms.status;
    if (!form) return;
    const status = consoleState.operatorStatus;
    form.elements.stabilityBand.value = normalizeStabilityBand(status.stabilityBand);
    form.elements.attentionState.value = normalizeAttentionState(status.attentionState);
    form.elements.harm.value = status.harm || "None recorded";
    form.elements.harmBoxes.value = normalizeBoxValue(status.harmBoxes, 6);
    form.elements.voidMarks.value = normalizeNonNegative(status.voidMarks);
    form.elements.breachPoints.value = normalizeNonNegative(status.breachPoints);
    form.elements.misfireBoxes.value = normalizeBoxValue(status.misfireBoxes, 6);
    form.elements.presentationPressure.value = normalizeBoxValue(status.presentationPressure, 5);
    form.elements.emotionalState.value = status.emotionalState || operatorRecord?.attentionStatus || "";
    form.elements.commonTell.value = status.commonTell || "";
    form.elements.presentation.value = status.presentation || "";
    form.elements.obligation.value = status.obligation || "";
    form.elements.lotusPrimary.value = status.lotusPrimary || operatorRecord?.primaryFrequency || "";
    form.elements.lotusBlind.value = status.lotusBlind || "";
    form.elements.lotusMethod.value = status.lotusMethod || "";
    form.elements.vectorNeed.value = status.vectorNeed || "";
    form.elements.misfireFlavor.value = status.misfireFlavor || frequencyCard(operatorRecord?.primaryFrequency).misfireFlavor;
    form.elements.anchorPerson.value = status.anchorPerson || "";
    form.elements.totemObject.value = status.totemObject || "";
    form.elements.groundingLine.value = status.groundingLine || "";
    form.elements.pipOneLeakage.value = status.pipOneLeakage || "";
    form.elements.pipTwoExpression.value = status.pipTwoExpression || "";
    form.elements.knownExpressions.value = status.knownExpressions || "";
    form.elements.expressionLimits.value = status.expressionLimits || "";
    form.elements.bleed.value = status.bleed || formatDrift(operatorRecord);
    form.elements.misfires.value = status.misfires || "";
    form.elements.voidBreach.value = status.voidBreach || "";
    form.elements.recoveryGround.checked = Boolean(status.recoveryGround);
    form.elements.recoveryBreathe.checked = Boolean(status.recoveryBreathe);
    form.elements.recoveryConnect.checked = Boolean(status.recoveryConnect);
    form.elements.recoveryLeave.checked = Boolean(status.recoveryLeave);
    form.elements.recoveryNameIt.checked = Boolean(status.recoveryNameIt);
    renderStatusSummary();
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

  function normalizeStabilityBand(value) {
    const allowed = ["Calm", "Strained", "Unraveling", "Collapse Risk"];
    return allowed.includes(value) ? value : "Calm";
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
        misfireFlavor: "Metaphor becomes literal, a memory intrudes, or the wrong symbol answers."
      },
      Hunger: {
        bleedCue: "fixation, jealousy, shame after wanting, and fear that need makes you monstrous",
        misfireFlavor: "Want becomes compulsion, a bargain asks too much, or satisfaction turns hollow."
      },
      Silence: {
        bleedCue: "numbness, dissociation, missing time, and relief when no one asks questions",
        misfireFlavor: "The wrong thing is erased, a truth cannot be spoken, or protection becomes isolation."
      },
      Stillness: {
        bleedCue: "emotional freezing, rigid control, delayed panic, and inability to leave a memory behind",
        misfireFlavor: "A moment traps the wrong person, action stalls, or composure becomes paralysis."
      },
      Empyrean: {
        bleedCue: "emotional flooding, over-identification, guilt, and fear of being felt too clearly",
        misfireFlavor: "Feelings spread too far, a bond overwhelms consent, or pain becomes communal."
      },
      Becoming: {
        bleedCue: "identity drift, impostor fear, and panic when recognized",
        misfireFlavor: "A mask sticks, a role overwrites behavior, or an unwanted self steps forward."
      }
    };
    return cards[frequency] || { bleedCue: "choose a primary Frequency to load bleed cues", misfireFlavor: "" };
  }

  function renderStatusSummary() {
    const band = document.getElementById("status-band");
    const bleedCue = document.getElementById("status-bleed-cue");
    const status = consoleState.operatorStatus;
    if (band) band.textContent = normalizeStabilityBand(status.stabilityBand).toUpperCase();
    if (bleedCue) bleedCue.textContent = frequencyCard(operatorRecord?.primaryFrequency).bleedCue.toUpperCase();
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
    renderList("cases", "No cases recorded in this browser.", (item) => item.title, (item) => [
      ["Needlepoint", item.needlepoint],
      ["Clues", item.clues],
      ["NPCs / entities", item.entities],
      ["Timeline", item.timeline],
      ["Unresolved questions", item.questions],
      ["Recorded", formatDate(item.createdAt)]
    ]);
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
    return payload;
  }

  function addEntry(collection, form) {
    const payload = formPayload(form);
    consoleState[collection].unshift({
      id: `${collection}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowStamp(),
      ...payload
    });
    writeConsoleState();
    form.reset();
    renderAll();
  }

  function bindForms() {
    if (forms.cases) forms.cases.addEventListener("submit", (event) => {
      event.preventDefault();
      addEntry("cases", forms.cases);
    });
    if (forms.anomalies) forms.anomalies.addEventListener("submit", (event) => {
      event.preventDefault();
      addEntry("anomalies", forms.anomalies);
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
      const payload = formPayload(forms.status);
      consoleState.operatorStatus = {
        ...consoleState.operatorStatus,
        ...payload,
        stabilityBand: normalizeStabilityBand(payload.stabilityBand),
        attentionState: normalizeAttentionState(payload.attentionState),
        harmBoxes: normalizeBoxValue(payload.harmBoxes, 6),
        voidMarks: normalizeNonNegative(payload.voidMarks),
        breachPoints: normalizeNonNegative(payload.breachPoints),
        misfireBoxes: normalizeBoxValue(payload.misfireBoxes, 6),
        presentationPressure: normalizeBoxValue(payload.presentationPressure, 5)
      };
      writeConsoleState();
      renderAll();
    });
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
    const exportButton = document.getElementById("export-console");
    const importInput = document.getElementById("import-console");
    const purgeButton = document.getElementById("purge-console");

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

    if (purgeButton) purgeButton.addEventListener("click", () => {
      if (!window.confirm("Purge local console entries from this browser? Intake record remains untouched.")) return;
      consoleState = normalizeConsoleState(null);
      try {
        window.localStorage.removeItem(consoleStorageKey);
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
}());
