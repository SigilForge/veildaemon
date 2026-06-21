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
      designation: "",
      role: "Operator",
      activeNeedlepoint: "",
      harm: "None recorded",
      harmBoxes: "0",
      voidMarks: "0",
      breachPoints: "0",
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
    anomalies: document.getElementById("anomaly-list"),
    relationships: document.getElementById("relationship-list"),
    residue: document.getElementById("residue-list")
  };

  const forms = {
    cases: document.getElementById("case-form"),
    status: document.getElementById("status-form"),
    frequency: document.getElementById("frequency-form"),
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
      attentionState: normalizeAttentionState(status.attentionState),
      stability: normalizeStabilityValue(status.stability),
      harmBoxes: normalizeBoxValue(status.harmBoxes, 5),
      voidMarks: normalizeNonNegative(status.voidMarks),
      breachPoints: normalizeNonNegative(status.breachPoints),
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
    const status = consoleState.operatorStatus;
    setNamedValue("designation", status.designation || operatorRecord?.designation || "");
    setNamedValue("role", status.role || "Operator");
    setNamedValue("activeNeedlepoint", status.activeNeedlepoint || "");
    consoleState.operatorStatus.stability = normalizeStabilityValue(status.stability);
    consoleState.operatorStatus.stabilityBand = bandFromLegacyStability(consoleState.operatorStatus.stability);
    setNamedValue("attentionState", normalizeAttentionState(status.attentionState));
    setNamedValue("emotionalState", status.emotionalState || operatorRecord?.attentionStatus || "");
    setNamedValue("voidMarks", normalizeNonNegative(status.voidMarks));
    setNamedValue("breachPoints", normalizeNonNegative(status.breachPoints));
    setNamedValue("misfireSeverity", normalizeMisfireSeverity(status.misfireSeverity));
    setNamedValue("commonTell", status.commonTell || "");
    setNamedValue("rollAttributeKey", normalizeAttributeName(status.rollAttributeKey) || "Body");
    setNamedValue("rollSkillKey", normalizeSkillName(status.rollSkillKey));
    setNamedValue("rollModifier", normalizeSignedValue(status.rollModifier, -10, 10));
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

  function normalizeStabilityBand(value) {
    const allowed = ["Calm", "Strained", "Unraveling", "Collapse Risk"];
    return allowed.includes(value) ? value : "Calm";
  }

  function normalizeMisfireSeverity(value) {
    const allowed = ["None", "Minor", "Major", "Severe"];
    return allowed.includes(value) ? value : "None";
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
        basic: "Read symbolic pressure, identify impossible familiarity, and follow dreamlike logic without treating it as proof.",
        empowered: "Shape a scene through metaphor, memory, or omen while keeping the table anchored to consent and consequence.",
        distortion: "A symbol answers too strongly. The scene begins obeying meaning before reality catches up.",
        divergence: "Dream stops describing reality and starts writing it."
      },
      Hunger: {
        bleedCue: "fixation, jealousy, shame after wanting, and fear that need makes you monstrous",
        misfireFlavor: "Want becomes compulsion, a bargain asks too much, or satisfaction turns hollow.",
        basic: "Sense want, leverage appetite, and identify what a person or place is starving for.",
        empowered: "Turn desire into pressure, bargain, pursuit, or refusal with visible emotional cost.",
        distortion: "Need becomes command. Satisfaction creates a worse absence.",
        divergence: "Hunger becomes a law the scene must feed."
      },
      Silence: {
        bleedCue: "numbness, dissociation, missing time, and relief when no one asks questions",
        misfireFlavor: "The wrong thing is erased, a truth cannot be spoken, or protection becomes isolation.",
        basic: "Notice absence, suppress tells, create quiet, and survive by refusing attention.",
        empowered: "Mute a signal, hide a truth, or create protective absence with a clear boundary.",
        distortion: "The wrong thing vanishes. A needed truth cannot cross the room.",
        divergence: "Silence becomes an active presence with its own appetite."
      },
      Stillness: {
        bleedCue: "emotional freezing, rigid control, delayed panic, and inability to leave a memory behind",
        misfireFlavor: "A moment traps the wrong person, action stalls, or composure becomes paralysis.",
        basic: "Hold position, endure pressure, stabilize a scene, and recognize emotional freezing.",
        empowered: "Pin a moment, slow escalation, or keep a fragile pattern from breaking.",
        distortion: "Control becomes paralysis. The wrong person or feeling cannot move.",
        divergence: "Stillness edits time by refusing to let it continue."
      },
      Empyrean: {
        bleedCue: "emotional flooding, over-identification, guilt, and fear of being felt too clearly",
        misfireFlavor: "Feelings spread too far, a bond overwhelms consent, or pain becomes communal.",
        basic: "Read emotional weather, create connection, and notice when feeling exceeds its container.",
        empowered: "Share burden, amplify resonance, or make a bond operational under pressure.",
        distortion: "Feeling spills beyond consent. Pain, guilt, or awe becomes communal.",
        divergence: "Empyrean turns connection into environment."
      },
      Becoming: {
        bleedCue: "identity drift, impostor fear, and panic when recognized",
        misfireFlavor: "A mask sticks, a role overwrites behavior, or an unwanted self steps forward.",
        basic: "Sense identity drift, perform a role, and recognize unstable self-patterns.",
        empowered: "Shift presentation, claim a new role, or force a scene to answer who someone is becoming.",
        distortion: "A mask sticks. A role overwrites behavior. Recognition becomes threat.",
        divergence: "Becoming stops being change and becomes emergence."
      }
    };
    return cards[frequency] || {
      bleedCue: "choose a primary Frequency to load bleed cues",
      misfireFlavor: "",
      basic: "",
      empowered: "",
      distortion: "",
      divergence: ""
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
          attrs[name] = normalizeBoxValue(index, 5);
          consoleState.operatorStatus.attributes = attrs;
          consoleState.operatorStatus.rollAttributeKey = name;
          writeConsoleState();
          renderAttributes();
          renderRollSelectors();
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
        skills[name] = normalizeBoxValue(input.value, 5);
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
      row.append(pick, input, remove);
      list.append(row);
    });
    renderRollSelectors();
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
    if (harm >= 5) return "Critical";
    if (harm >= 3) return "Wounded";
    if (harm >= 1) return "Hurt";
    return "Clear";
  }

  function lotusTier(level) {
    const value = Number(normalizeBoxValue(level, 6));
    if (value >= 6) return "Divergence";
    if (value >= 5) return "Distortion";
    if (value >= 3) return "Empowered";
    if (value >= 1) return "Basic";
    return "None";
  }

  function tierCopy(frequency, tier) {
    const card = frequencyCard(frequency);
    if (tier === "Divergence") return card.divergence;
    if (tier === "Distortion") return card.distortion;
    if (tier === "Empowered") return card.empowered;
    if (tier === "Basic") return card.basic;
    return "No pip selected. This petal has not been cultivated.";
  }

  function renderLotus() {
    const map = document.getElementById("lotus-map");
    if (!map) return;
    const status = consoleState.operatorStatus;
    const lotus = normalizeLotus(status.lotus);
    const selected = normalizeFrequencyName(status.selectedLotusPetal) || operatorRecord?.primaryFrequency || "Dream";
    status.selectedLotusPetal = normalizeFrequencyName(selected) || "Dream";
    status.lotus = lotus;
    map.textContent = "";

    frequencies().forEach((frequency) => {
      const level = Number(lotus[frequency] || 0);
      const petal = document.createElement("article");
      petal.className = "lotus-petal";
      petal.classList.toggle("is-selected", frequency === status.selectedLotusPetal);
      petal.classList.toggle("is-blind", frequency === status.blindPetal);

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
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = "pip";
        pip.classList.toggle("is-filled", index <= level);
        pip.setAttribute("aria-label", `${frequency} pip ${index}`);
        pip.addEventListener("click", () => {
          status.lotus[frequency] = normalizeBoxValue(index === level ? index - 1 : index, 6);
          status.selectedLotusPetal = frequency;
          writeConsoleState();
          renderLotus();
        });
        pips.append(pip);
      }

      const blind = document.createElement("button");
      blind.type = "button";
      blind.className = "blind-toggle";
      blind.textContent = frequency === status.blindPetal ? "Blind Petal" : "Mark Blind";
      blind.addEventListener("click", () => {
        status.blindPetal = frequency === status.blindPetal ? "" : frequency;
        status.selectedLotusPetal = frequency;
        writeConsoleState();
        renderLotus();
      });

      petal.append(header, pips, blind);
      map.append(petal);
    });

    const selectedLevel = Number(lotus[status.selectedLotusPetal] || 0);
    const tier = lotusTier(selectedLevel);
    setText("lotus-frequency", status.selectedLotusPetal + (status.selectedLotusPetal === status.blindPetal ? " // BLIND" : ""));
    setText("lotus-tier", tier);
    const copy = document.getElementById("lotus-copy");
    if (copy) copy.textContent = tierCopy(status.selectedLotusPetal, tier);
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
      voidMarks: normalizeNonNegative(status.voidMarks),
      breachPoints: normalizeNonNegative(status.breachPoints),
      misfireSeverity: normalizeMisfireSeverity(status.misfireSeverity),
      presentationPressure: normalizeBoxValue(status.presentationPressure, 5),
      lotus: normalizeLotus(status.lotus),
      blindPetal: normalizeFrequencyName(status.blindPetal),
      selectedLotusPetal: normalizeFrequencyName(status.selectedLotusPetal),
      attributes: normalizeAttributes(status.attributes),
      skills: normalizeSkills(status.skills),
      rollAttributeKey: normalizeAttributeName(status.rollAttributeKey) || "Body",
      rollSkillKey: normalizeSkillName(status.rollSkillKey),
      rollModifier: normalizeSignedValue(status.rollModifier, -10, 10)
    };
  }

  function autosaveStatus() {
    consoleState.operatorStatus = collectStatusPayload();
    writeConsoleState();
    renderBandMeter();
    renderLotus();
    renderStatusSummary();
    renderSegmentedControls();
    renderRollSelectors();
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
      autosaveStatus();
    });
    if (forms.frequency) forms.frequency.addEventListener("submit", (event) => {
      event.preventDefault();
      autosaveStatus();
    });
    document.querySelectorAll("#status-form input, #status-form textarea, #status-form select, #frequency-form input, #frequency-form textarea, #frequency-form select").forEach((input) => {
      input.addEventListener("input", autosaveStatus);
      input.addEventListener("change", autosaveStatus);
    });
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
      consoleState.operatorStatus.skills[skill] = normalizeBoxValue(rank && rank.value || 1, 5);
      if (consoleState.operatorStatus.skills[skill] === "0") consoleState.operatorStatus.skills[skill] = "1";
      consoleState.operatorStatus.rollSkillKey = skill;
      writeConsoleState();
      renderSkills();
    });
  }

  function rollAction() {
    autosaveStatus();
    const dice = [rollDie(), rollDie(), rollDie()];
    const status = consoleState.operatorStatus;
    const attrs = normalizeAttributes(status.attributes);
    const skills = normalizeSkills(status.skills);
    const attrKey = normalizeAttributeName(status.rollAttributeKey) || "Body";
    const skillKey = normalizeSkillName(status.rollSkillKey);
    const attrValue = Number(attrs[attrKey] || 0);
    const skillValue = skillKey ? Number(skills[skillKey] || 0) : 0;
    const total = dice.reduce((sum, value) => sum + value, 0)
      + attrValue
      + skillValue
      + Number(status.rollModifier || 0);
    const output = document.getElementById("roll-output");
    if (output) {
      output.textContent = `3D6 ${dice.join(" + ")} // ${attrKey} +${attrValue} // ${skillKey || "Untrained"} +${skillValue} // MOD ${status.rollModifier || 0} = ${total}`;
    }
  }

  function rollDie() {
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
