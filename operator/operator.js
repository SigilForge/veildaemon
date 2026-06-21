(function () {
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
    operatorStatus: {
      stability: "10",
      stabilityBand: "Calm",
      attentionState: "Unnoticed",
      operatorName: "",
      designation: "",
      role: "Operator",
      activeNeedlepoint: "",
      creationMode: false,
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
      creationMode: Boolean(status.creationMode),
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
    setNamedValue("operatorName", status.operatorName || "");
    setNamedValue("designation", status.designation || operatorRecord?.designation || "");
    setNamedValue("role", status.role || "Operator");
    setNamedValue("activeNeedlepoint", status.activeNeedlepoint || "");
    consoleState.operatorStatus.creationMode = Boolean(status.creationMode);
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
    renderCreationMode();
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

  function skillChangeAllowed(skills, skill, targetRank) {
    const next = normalizeSkills({ ...skills, [skill]: String(targetRank) });
    if (consoleState.operatorStatus.creationMode) {
      if (targetRank > 3) return { ok: false, message: "Creation skill cap is Rank 3." };
      const oldOverage = Math.max(0, totalSkillRanks(skills) - creationSkillBudget());
      const newOverage = Math.max(0, totalSkillRanks(next) - creationSkillBudget());
      return { ok: true, cost: Math.max(0, newOverage - oldOverage) };
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
      return { ok: true, cost: Math.max(0, newOverage - oldOverage) };
    }
    const oldRank = Number(normalizeAttributes(attributes)[attribute] || 1);
    return { ok: true, cost: advancementCost(oldRank, targetRank) };
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
        blind: "Symbols lie cleanly. Dreams, omens, and subconscious pressure pass as coincidence.",
        pips: [
          "Sense symbolic pressure, repetition, omen logic, and impossible familiarity.",
          "Nudge an existing symbol, coincidence, or remembered detail toward useful meaning.",
          "Read or redirect dreamlike scene logic with repeatable control under pressure.",
          "Make the room answer a metaphor, memory, or omen for a sustained beat.",
          "Force symbolic truth to outrank literal conditions; reality pays for the translation.",
          "Become an anchor for dream logic. Scenes begin arranging themselves around meaning."
        ],
        basic: "Read symbolic pressure, identify impossible familiarity, and follow dreamlike logic without treating it as proof.",
        empowered: "Shape a scene through metaphor, memory, or omen while keeping the table anchored to consent and consequence.",
        distortion: "A symbol answers too strongly. The scene begins obeying meaning before reality catches up.",
        divergence: "Dream stops describing reality and starts writing it."
      },
      Hunger: {
        bleedCue: "fixation, jealousy, shame after wanting, and fear that need makes you monstrous",
        misfireFlavor: "Want becomes compulsion, a bargain asks too much, or satisfaction turns hollow.",
        blind: "Want reads as noise. Appetite, debt, coercion, and escalation reach you late.",
        pips: [
          "Sense appetite, fixation, need, predation, and what a person or place is starving for.",
          "Nudge an existing desire, pursuit, bargain, or refusal without creating it from nothing.",
          "Turn want into reliable pressure in crisis, conflict, or negotiation.",
          "Set the appetite terms for a room, chase, bargain, or emotional exchange.",
          "Make need command behavior or environment; satisfaction leaves a new wound.",
          "Become a gravity well for want. The scene starts feeding or fleeing you."
        ],
        basic: "Sense want, leverage appetite, and identify what a person or place is starving for.",
        empowered: "Turn desire into pressure, bargain, pursuit, or refusal with visible emotional cost.",
        distortion: "Need becomes command. Satisfaction creates a worse absence.",
        divergence: "Hunger becomes a law the scene must feed."
      },
      Silence: {
        bleedCue: "numbness, dissociation, missing time, and relief when no one asks questions",
        misfireFlavor: "The wrong thing is erased, a truth cannot be spoken, or protection becomes isolation.",
        blind: "Absence has no outline. Nullification, shutdown, omission, and erasure go unseen.",
        pips: [
          "Sense absences in the room: missing sound, omitted facts, emotional shutdown, and suppressed presence.",
          "Subtly affect absence by dampening an existing signal, tell, question, or attention line.",
          "Mute, hide, or redact a specific signal under pressure with reliable control.",
          "Create protective absence across a room, route, record, or witness chain for a sustained beat.",
          "Make absence act like force; the wrong thing can vanish or a needed truth can fail to cross the room.",
          "Become a Silence locus. Attention, records, and meaning begin dropping around you."
        ],
        basic: "Notice absence, suppress tells, create quiet, and survive by refusing attention.",
        empowered: "Mute a signal, hide a truth, or create protective absence with a clear boundary.",
        distortion: "The wrong thing vanishes. A needed truth cannot cross the room.",
        divergence: "Silence becomes an active presence with its own appetite."
      },
      Stillness: {
        bleedCue: "emotional freezing, rigid control, delayed panic, and inability to leave a memory behind",
        misfireFlavor: "A moment traps the wrong person, action stalls, or composure becomes paralysis.",
        blind: "Momentum traps you. Delay, freezing, restraint, and control effects land before you name them.",
        pips: [
          "Sense frozen momentum, delayed panic, held breath, rigid control, and trapped moments.",
          "Slow or steady what is already happening: a motion, escalation, reaction, or fragile pattern.",
          "Hold position, timing, or emotional pressure reliably during crisis.",
          "Set the tempo of a scene, room, or exchange for a sustained beat.",
          "Make control become law; action stalls, consequence waits, or the wrong thing cannot move.",
          "Become an anchor for suspended time. The scene hesitates around you."
        ],
        basic: "Hold position, endure pressure, stabilize a scene, and recognize emotional freezing.",
        empowered: "Pin a moment, slow escalation, or keep a fragile pattern from breaking.",
        distortion: "Control becomes paralysis. The wrong person or feeling cannot move.",
        divergence: "Stillness edits time by refusing to let it continue."
      },
      Empyrean: {
        bleedCue: "emotional flooding, over-identification, guilt, and fear of being felt too clearly",
        misfireFlavor: "Feelings spread too far, a bond overwhelms consent, or pain becomes communal.",
        blind: "Connection arrives distorted. Shared pain, consent pressure, awe, and relational gravity are hard to read.",
        pips: [
          "Sense emotional weather, connection, pain, awe, and relational pressure in the room.",
          "Nudge an existing bond, feeling, comfort, or shared burden with clear consent boundaries.",
          "Share, steady, or amplify emotional resonance reliably under pressure.",
          "Make a bond operational across a room, group, hazard, or crisis beat.",
          "Let feeling spill into environment; pain, guilt, awe, or relief becomes communal risk.",
          "Become an emotional anchor. The scene synchronizes around what you carry."
        ],
        basic: "Read emotional weather, create connection, and notice when feeling exceeds its container.",
        empowered: "Share burden, amplify resonance, or make a bond operational under pressure.",
        distortion: "Feeling spills beyond consent. Pain, guilt, or awe becomes communal.",
        divergence: "Empyrean turns connection into environment."
      },
      Becoming: {
        bleedCue: "identity drift, impostor fear, and panic when recognized",
        misfireFlavor: "A mask sticks, a role overwrites behavior, or an unwanted self steps forward.",
        blind: "Identity feels fixed until it breaks. Masks, role pressure, and self-rewrite catch you flat-footed.",
        pips: [
          "Sense identity drift, role pressure, masks, posture shifts, and unstable self-patterns.",
          "Subtly shift presentation, expectation, gait, voice, or access logic already in play.",
          "Adopt or project a role reliably enough to matter during conflict or social pressure.",
          "Set identity terms for a scene: who counts, who belongs, who is believed, or what role sticks.",
          "Let a mask become materially true; recognition, body logic, or paperwork can rewrite around it.",
          "Become an emergence point. The scene asks what you are becoming and starts answering."
        ],
        basic: "Sense identity drift, perform a role, and recognize unstable self-patterns.",
        empowered: "Shift presentation, claim a new role, or force a scene to answer who someone is becoming.",
        distortion: "A mask sticks. A role overwrites behavior. Recognition becomes threat.",
        divergence: "Becoming stops being change and becomes emergence."
      }
    };
    return cards[frequency] || {
      bleedCue: "choose a primary Frequency to load bleed cues",
      misfireFlavor: "",
      blind: "",
      pips: [],
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
          const allowed = attributeChangeAllowed(attrs, name, index);
          if (!allowed.ok) {
            setStorageStatus(allowed.message, true);
            return;
          }
          if (!spendBreach(allowed.cost || 0)) return;
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
        if (!spendBreach(allowed.cost || 0)) {
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
    preview.textContent = consoleState.operatorStatus.creationMode
      ? `Creation cost: ${allowed.cost || 0} Bonus Breach`
      : `Cost: ${allowed.cost || 0} Breach`;
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

  function pipLabel(index) {
    const labels = ["Leakage", "Initiation", "Integration", "Command", "Distortion", "Divergence"];
    return labels[index - 1] || "Expression";
  }

  function unlockedLotusEntries() {
    const status = consoleState.operatorStatus;
    const lotus = normalizeLotus(status.lotus);
    const blind = normalizeFrequencyName(status.blindPetal);
    return frequencies().flatMap((frequency) => {
      if (frequency === blind) return [];
      const card = frequencyCard(frequency);
      const level = Number(lotus[frequency] || 0);
      return card.pips.slice(0, level).map((copy, index) => ({
        frequency,
        pip: index + 1,
        copy
      }));
    });
  }

  function renderLotusUnlocks() {
    const list = document.getElementById("lotus-unlocks");
    if (!list) return;
    const status = consoleState.operatorStatus;
    const selected = normalizeFrequencyName(status.selectedLotusPetal) || "Dream";
    const blind = normalizeFrequencyName(status.blindPetal);
    const selectedLevel = Number(normalizeLotus(status.lotus)[selected] || 0);
    const entries = unlockedLotusEntries();
    list.textContent = "";

    const blindNotice = document.createElement("p");
    blindNotice.className = "lotus-warning";
    blindNotice.textContent = blind
      ? `Blind petal: ${blind}. No pips can be cultivated in that Frequency.`
      : "Blind petal unmarked. Select one Frequency as the permanent blind spot.";
    list.append(blindNotice);

    const selectedTitle = document.createElement("h3");
    selectedTitle.textContent = selected === blind ? `${selected} // Blind` : `${selected} unlocked`;
    list.append(selectedTitle);

    const selectedEntries = entries.filter((entry) => entry.frequency === selected);
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
      selectedEntries.forEach((entry) => selectedList.append(lotusUnlockEntry(entry)));
      list.append(selectedList);
    }

    const allTitle = document.createElement("h3");
    allTitle.textContent = "All active expressions";
    list.append(allTitle);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-line";
      empty.textContent = "No cultivated expressions recorded.";
      list.append(empty);
      return;
    }

    const allList = document.createElement("ol");
    entries.forEach((entry) => allList.append(lotusUnlockEntry(entry, true)));
    list.append(allList);
  }

  function lotusUnlockEntry(entry, includeFrequency) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = `${includeFrequency ? `${entry.frequency} ` : ""}${entry.pip}: ${pipLabel(entry.pip)}`;
    item.append(label, ` — ${entry.copy}`);
    return item;
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
      if (frequency === status.blindPetal && level > 0) {
        lotus[frequency] = "0";
      }
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
        pip.disabled = frequency === status.blindPetal;
        pip.classList.toggle("is-filled", frequency !== status.blindPetal && index <= Number(lotus[frequency] || 0));
        pip.setAttribute("aria-label", `${frequency} pip ${index}`);
        pip.addEventListener("click", () => {
          if (frequency === status.blindPetal) return;
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
        status.blindPetal = frequency;
        if (status.blindPetal === frequency) status.lotus[frequency] = "0";
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
    setText("lotus-tier", status.selectedLotusPetal === status.blindPetal ? "LOCKED" : tier);
    const copy = document.getElementById("lotus-copy");
    if (copy) {
      copy.textContent = status.selectedLotusPetal === status.blindPetal
        ? frequencyCard(status.selectedLotusPetal).blind
        : tierCopy(status.selectedLotusPetal, tier);
    }
    renderLotusUnlocks();
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
      creationMode: Boolean(status.creationMode),
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
      const targetRank = Number(normalizeBoxValue(rank && rank.value || 1, 5));
      const allowed = skillChangeAllowed(consoleState.operatorStatus.skills, skill, targetRank);
      if (!allowed.ok) {
        setStorageStatus(allowed.message, true);
        return;
      }
      if (!spendBreach(allowed.cost || 0)) return;
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
      status.voidMarks = "1";
      status.breachPoints = String(creationBonusBreachBudget());
      status.lotus = normalizeLotus(status.lotus);
      status.lotus[frequency] = String(Math.max(1, Number(status.lotus[frequency] || 0)));
      status.selectedLotusPetal = frequency;
      setNamedValue("voidMarks", status.voidMarks);
      setNamedValue("breachPoints", status.breachPoints);
      writeConsoleState();
      renderAll();
      setStorageStatus(`Core start applied: ${frequency} pip 1, 1 Void, 3 Bonus Breach.`);
    });
    const creationMode = document.getElementById("creation-mode-toggle");
    if (creationMode) creationMode.addEventListener("click", () => {
      consoleState.operatorStatus.creationMode = !consoleState.operatorStatus.creationMode;
      writeConsoleState();
      renderCreationMode();
      renderAttributes();
      renderSkills();
    });
    const skillPicker = document.getElementById("skill-picker");
    const skillRank = document.getElementById("skill-rank");
    if (skillPicker) skillPicker.addEventListener("change", renderSkillCostPreview);
    if (skillRank) skillRank.addEventListener("input", renderSkillCostPreview);
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
