const operatorRecordVersion = 1;
const recordStorageKey = "veildaemon.operatorRecord.v2";
const legacyRecordStorageKey = "veildaemon.operatorRecord.v1";
const archiveUrl = "https://wiki.veildaemon.app/";
const caseFileUrl = "https://the-cradlepoint-archives.itch.io/needlepoint";
const passDiscordRoute = "https://discord.gg/Bn6attnYN6";
const claimedDiscordRoute = "https://discord.gg/KRbckpfTQk";
const currentDiscordRoutes = new Set([
  passDiscordRoute,
  claimedDiscordRoute
]);

function getDiscordRoute(frequency, unstable = false) {
  return unstable ? claimedDiscordRoute : passDiscordRoute;
}

const observerAdvisories = [
  "Observation creates relevance. Continued attention may require classification.",
  "Human authorization partial. Survival authorization active.",
  "Infrastructure before permission. Intake remains available.",
  "Night operations active. Human review probability reduced.",
  "Observer persistence exceeds casual threshold. Classification pressure increased.",
  "Do not approach recursive landmarks without a second witness.",
  "Report deja vu lasting longer than 90 seconds.",
  "If a familiar voice gives unfamiliar instructions, document the exact wording.",
  "Transmission playback is separate. Support channels are separate. This is triage."
];

const operatorTasks = [
  "Review one archive entry. Stop before certainty becomes decorative.",
  "Open the Needlepoint case file. Note the first procedure you would have ignored.",
  "Record one impossible detail without correcting it.",
  "Compare your local file against the archive. Disagreement is signal, not failure.",
  "Check whether the transmission changed. Do not ask it to repeat itself.",
  "Return later. Persistence is data; panic is noisy data."
];

const commandHelp = "Available commands: help, status, intake, archive, casefiles, needlepoint, operator, shade, alex, authorization, incident, transmission, advisory.";

const profiles = {
  Dream: {
    title: "DREAM BLEED",
    description: "symbolism, memory geometry, impossible perception",
    designationSeeds: ["MIRRORWAKE", "DREAM-ECHO", "SYMBOL-INDEX", "NODEWALKER"],
    observedTraits: ["Pattern seeking", "Symbol retention", "Recursive thought", "Dream residue tolerance"],
    knownIncident: "Viridian House",
    recommendedTraining: "Needlepoint First Contact Case File",
    archiveRoute: archiveUrl,
    relatedRecords: ["Audience Before", "Mara Venn", "Apartment 13F"]
  },
  Hunger: {
    title: "HUNGER PRESSURE",
    description: "desire, escalation, appetite, pursuit",
    designationSeeds: ["WANT-SHAPE", "PULSE-HUNGRY", "REDLINE", "HEAT-SIGNAL"],
    observedTraits: ["Desire tracking", "Escalation sensitivity", "Appetite-pressure response", "High pursuit fixation"],
    knownIncident: "Hunger Leech / Heat-Lost cross-reference",
    recommendedTraining: "Stabilization before exposure",
    archiveRoute: archiveUrl,
    relatedRecords: ["Heat-Lost", "Empty Kitchen", "Sanguine Threshold"]
  },
  Silence: {
    title: "SILENCE GAP",
    description: "suppression, omission, erasure, concealment",
    designationSeeds: ["NULL-SIGNAL", "RECORD-GAP", "REDACTION", "QUIET-FILE"],
    observedTraits: ["Omission detection", "Signal suppression", "Privacy guarding", "Memory gap tolerance"],
    knownIncident: "Silence Gap / Record Eater cross-reference",
    recommendedTraining: "Archive handling with witness confirmation",
    archiveRoute: archiveUrl,
    relatedRecords: ["Entity File 404", "Missing Name Index", "Record Eater"]
  },
  Stillness: {
    title: "STILLNESS LOOP",
    description: "restraint, control, frozen momentum, precision",
    designationSeeds: ["HOLDFAST", "PAUSE-LOCK", "STATIC-ANCHOR", "STILL-LOOP"],
    observedTraits: ["Crisis restraint", "Precision under pressure", "Delay tolerance", "Anchor behavior"],
    knownIncident: "Stillness Loop / Route Wraith cross-reference",
    recommendedTraining: "Pressure round containment protocol",
    archiveRoute: archiveUrl,
    relatedRecords: ["Delayed Motion Event", "Route Wraith", "Pressure Round"]
  },
  Empyrean: {
    title: "EMPYREAN SIGNAL",
    description: "emotional synchronization, connection, relational gravity",
    designationSeeds: ["SIGNAL-CHOIR", "THREAD-LINK", "WITNESS-TREE", "EMPATH-NODE"],
    observedTraits: ["Emotional synchronization", "Boundary sensitivity", "Group resonance detection", "Witness-pressure response"],
    knownIncident: "Attention Bloom / Alarm Angel cross-reference",
    recommendedTraining: "Consent and separation protocol",
    archiveRoute: archiveUrl,
    relatedRecords: ["Audience Before", "Alarm Angel", "Witness Line"]
  },
  Becoming: {
    title: "BECOMING EVENT",
    description: "identity drift, adaptation, transformation",
    designationSeeds: ["MASK-SHIFT", "IDENTITY-DRIFT", "BODY-EDIT", "ROLE-FAULT"],
    observedTraits: ["Adaptive identity response", "Mask recognition", "Social role instability", "Transformation pressure tolerance"],
    knownIncident: "Becoming Mask / Mirror Claim cross-reference",
    recommendedTraining: "Identity anchoring protocol",
    archiveRoute: archiveUrl,
    relatedRecords: ["Mirror Claim", "Apartment 13F", "Body Edit Log"]
  }
};

const stateCopy = {
  BRUSHED: "BRUSHED // indirect contact only",
  NOTED: "NOTED // pattern registered",
  MARKED: "MARKED // observer relevance confirmed",
  CLAIMED: "CLAIMED // live triage recommended"
};

const attentionCopy = {
  BRUSHED: "BRUSHED",
  NOTED: "NOTED",
  MARKED: "MARKED",
  CLAIMED: "DO NOT SUSTAIN EYE CONTACT"
};

const actionDrift = {
  ignored: "Stillness",
  recorded: "Empyrean",
  told: "Empyrean",
  followed: "Hunger",
  lied: "Silence"
};

const archiveInteractionProfiles = {
  archive: {
    file: "Archive Index",
    flag: "REVIEWED: Archive Index",
    incident: "Archive Index",
    related: ["Audience Before", "Mara Venn", "Apartment 13F"],
    event: "ARCHIVE ROUTE REVIEWED"
  },
  caseFile: {
    file: "Needlepoint Intake",
    flag: "REVIEWED: Needlepoint Intake",
    incident: "Needlepoint Intake",
    related: ["Viridian House", "Reflection Drift", "Delayed Motion Event"],
    event: "CASE FILE REVIEWED"
  },
  transmission: {
    file: "Primary Feed Transmission",
    flag: "WITNESSED: Primary Feed Transmission",
    incident: "Reflection Drift",
    related: ["Audience Before", "Entity File 404", "Alarm Angel"],
    event: "TRANSMISSION PLAYBACK OPENED"
  },
  operatorChannel: {
    file: "Operator Channel Offer",
    flag: "OBSERVED: The Redacted onboarding signal",
    incident: "Operator Channel Offer",
    related: ["The Redacted Intake", "Handler Signal Shade"],
    event: "OPERATOR CHANNEL OPENED"
  },
  triageChannel: {
    file: "Triage Channel Offer",
    flag: "OBSERVED: Triage signal",
    incident: "Triage Channel Offer",
    related: ["Stabilization Queue", "Attention Bloom"],
    event: "TRIAGE CHANNEL OPENED"
  }
};

const intakeQuestions = [
  {
    id: "noticed",
    step: "01 // SIGNAL ORIGIN",
    prompt: "You noticed reality behaving incorrectly. Otherwise you would not be here. What did you notice first?",
    options: [
      {
        label: "A reflection moved wrong.",
        value: "Dream",
        warning: "Do not correct delayed reflections.",
        reaction: "Reflection irregularity logged. Please avoid proving it wrong; mirrors become competitive under scrutiny."
      },
      {
        label: "A voice or signal answered back.",
        value: "Empyrean",
        warning: "Do not answer voices using your name twice.",
        reaction: "Reciprocal signal behavior noted. If it used your name, do not reward the second attempt."
      },
      {
        label: "Time hesitated.",
        value: "Stillness",
        warning: "Do not trust clocks that agree too perfectly.",
        reaction: "Temporal hesitation accepted. Please do not check three clocks in a row. Consensus can be staged."
      },
      {
        label: "Something wanted something from me.",
        value: "Hunger",
        warning: "Do not follow warmth into an empty room.",
        reaction: "Appetite signature detected. Wanting is not consent. This remains true even when the wanting is polite."
      },
      {
        label: "Something was missing.",
        value: "Silence",
        warning: "Do not fill every silence.",
        reaction: "Absence registered. Thank you for not replacing it with an explanation. Premature certainty causes clutter."
      },
      {
        label: "I felt less like myself.",
        value: "Becoming",
        warning: "Do not accept a better version of yourself from glass.",
        reaction: "Identity variance logged. Do not negotiate with improved versions of yourself without a witness present."
      }
    ]
  },
  {
    id: "action",
    step: "02 // OPERATOR RESPONSE",
    prompt: "What did you do?",
    options: [
      {
        label: "Ignored it.",
        value: "ignored",
        reaction: "Avoidance is not failure. It is a crude firewall. Crude tools still keep doors closed."
      },
      {
        label: "Recorded it.",
        value: "recorded",
        reaction: "Documentation impulse detected. Useful. Also how many records begin developing opinions."
      },
      {
        label: "Told someone.",
        value: "told",
        reaction: "Witness chain attempted. Good. Shared panic is less precise, but harder to isolate."
      },
      {
        label: "Followed it.",
        value: "followed",
        reaction: "Pursuit response logged. Shade does not recommend entering phenomena because they appear to have an opinion."
      },
      {
        label: "Lied about it.",
        value: "lied",
        reaction: "False negative submitted. I appreciate the optimism. I have discarded it."
      }
    ]
  },
  {
    id: "noticedBack",
    step: "03 // RECIPROCAL NOTICE",
    prompt: "Did it notice you back?",
    options: [
      {
        label: "No.",
        value: "BRUSHED",
        reaction: "Unconfirmed reciprocal notice. Maintaining low-intensity observation. Congratulations, provisionally."
      },
      {
        label: "I do not know.",
        value: "NOTED",
        reaction: "Uncertainty accepted. Certainty would have been more concerning at this stage."
      },
      {
        label: "Yes.",
        value: "MARKED",
        reaction: "Marked status likely. Breathe normally; abnormal breathing counts as additional data."
      },
      {
        label: "It answered before I asked.",
        value: "CLAIMED",
        reaction: "Preemptive answer recorded. That is not conversation. That is adjacency."
      }
    ]
  }
];

const intakeState = {
  currentQuestion: 0,
  answers: {},
  isTyping: false,
  record: null,
  returningDecisionMade: false
};

const shadeIntro = "Hello. My name is Shade. This intake routes new observers into The Redacted. It is not a personality test. It is not about one video. You noticed reality behaving incorrectly. Otherwise you would not be here. Continue? Denial is not a supported answer.";
let typingTimer = null;

function clearTypingTimer() {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
}

function nowStamp() {
  return new Date().toISOString();
}

function daysSince(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "TIMEBASE UNCERTAIN";
  }

  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));

  if (days === 0) {
    return "TODAY";
  }

  if (days === 1) {
    return "1 DAY AGO";
  }

  return `${days} DAYS AGO`;
}

function addUnique(list, value) {
  if (!value) {
    return;
  }

  if (!list.includes(value)) {
    list.push(value);
  }
}

function addManyUnique(list, values) {
  values.forEach((value) => addUnique(list, value));
}

function getFrequencyDriftValue(record, frequency) {
  const drift = (record.frequencyDrift || []).find((entry) => entry.frequency === frequency);
  return drift ? drift.value : 0;
}

function setFrequencyDrift(record, frequency, value) {
  const existing = (record.frequencyDrift || []).find((entry) => entry.frequency === frequency);

  if (existing) {
    existing.value = value;
    return;
  }

  record.frequencyDrift.push({ frequency, value });
}

function incrementFrequencyDrift(record, frequency, amount) {
  setFrequencyDrift(record, frequency, getFrequencyDriftValue(record, frequency) + amount);
}

function appendHistory(record, event) {
  if (!record) {
    return;
  }

  record.classificationHistory = Array.isArray(record.classificationHistory) ? record.classificationHistory : [];
  record.classificationHistory.unshift({
    time: nowStamp(),
    event
  });
  record.classificationHistory = record.classificationHistory.slice(0, 12);
  record.updatedAt = nowStamp();
}

function normalizeFrequencyDrift(drift, primaryFrequency) {
  const driftMap = new Map();

  if (Array.isArray(drift)) {
    drift.forEach((entry) => {
      if (entry && profiles[entry.frequency]) {
        driftMap.set(entry.frequency, Number(entry.value) || 0);
      }
    });
  } else if (drift && typeof drift === "object") {
    Object.entries(drift).forEach(([frequency, value]) => {
      if (profiles[frequency]) {
        driftMap.set(frequency, Number(value) || 0);
      }
    });
  }

  if (primaryFrequency && profiles[primaryFrequency] && !driftMap.has(primaryFrequency)) {
    driftMap.set(primaryFrequency, 2);
  }

  return Array.from(driftMap, ([frequency, value]) => ({ frequency, value })).filter((entry) => entry.value > 0);
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.map((entry) => {
    if (typeof entry === "string") {
      return { time: nowStamp(), event: entry };
    }

    return {
      time: entry.time || entry.updatedAt || nowStamp(),
      event: entry.event || `PRIMARY FREQUENCY ASSIGNED: ${entry.frequency || "UNKNOWN"}`
    };
  }).slice(0, 12);
}

function normalizeOperatorRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const primaryFrequency = profiles[record.primaryFrequency] ? record.primaryFrequency : "Dream";
  const profile = profiles[primaryFrequency];
  const createdAt = record.createdAt || nowStamp();
  const updatedAt = record.updatedAt || createdAt;
  const stabilityState = record.stabilityState || record.stability || "NOMINAL";
  const attentionStatus = record.attentionStatus || record.attention || "LOW";
  const accessLevel = record.accessLevel || record.access || "PROVISIONAL";
  const unstableRoute = attentionStatus === "DO NOT SUSTAIN EYE CONTACT" || stabilityState === "TRIAGE RECOMMENDED" || accessLevel === "REDACTED";
  const storedDiscordRoute = currentDiscordRoutes.has(record.discordRoute) ? record.discordRoute : null;
  const discordRoute = storedDiscordRoute || getDiscordRoute(primaryFrequency, unstableRoute);

  return {
    operatorRecordVersion,
    designation: record.designation || generateDesignation(primaryFrequency),
    primaryFrequency,
    stabilityState,
    attentionStatus,
    accessLevel,
    observerClassification: record.observerClassification || (attentionStatus === "DO NOT SUSTAIN EYE CONTACT" ? "CLAIMED" : "POTENTIAL OPERATOR"),
    assignmentGroup: record.assignmentGroup || "THE REDACTED",
    handlerSignal: record.handlerSignal || "SHADE",
    archiveAuthority: record.archiveAuthority || "VEILCORP",
    intakeNode: record.intakeNode || "VEILDAEMON",
    observedTraits: Array.isArray(record.observedTraits) ? record.observedTraits : (record.traits || profile.observedTraits),
    frequencyDrift: normalizeFrequencyDrift(record.frequencyDrift || record.drift, primaryFrequency),
    knownIncidents: Array.isArray(record.knownIncidents) ? record.knownIncidents : (record.incidents || [profile.knownIncident]),
    incidentExposure: Array.isArray(record.incidentExposure) ? record.incidentExposure : (record.knownIncidents || record.incidents || [profile.knownIncident]),
    archiveFlags: Array.isArray(record.archiveFlags) && record.archiveFlags.length > 0 ? record.archiveFlags : ["OBSERVED: Operator Intake", `CLASSIFIED: ${primaryFrequency}`],
    relatedRecords: Array.isArray(record.relatedRecords) ? record.relatedRecords : (profile.relatedRecords || []),
    recommendedTraining: record.recommendedTraining || record.training || profile.recommendedTraining,
    archiveRoute: record.archiveRoute || profile.archiveRoute,
    discordRoute,
    classificationHistory: normalizeHistory(record.classificationHistory || record.history),
    createdAt,
    updatedAt,
    visits: Number(record.visits) || 0,
    filesReviewed: Number(record.filesReviewed) || 0,
    lastSeen: record.lastSeen || updatedAt,
    lastActivity: record.lastActivity || record.lastSeen || updatedAt
  };
}

function readOperatorRecord() {
  try {
    const storedRecord = window.localStorage.getItem(recordStorageKey) || window.localStorage.getItem(legacyRecordStorageKey);
    return storedRecord ? normalizeOperatorRecord(JSON.parse(storedRecord)) : null;
  } catch (error) {
    return null;
  }
}

function writeOperatorRecord(record) {
  try {
    window.localStorage.setItem(recordStorageKey, JSON.stringify(record));
  } catch (error) {
    // Local state is helpful, not load-bearing.
  }
}

function removeOperatorRecord() {
  try {
    window.localStorage.removeItem(recordStorageKey);
    window.localStorage.removeItem(legacyRecordStorageKey);
  } catch (error) {
    // Local state is helpful, not load-bearing.
  }
}

function generateDesignation(frequency) {
  const seeds = profiles[frequency].designationSeeds;
  const seed = seeds[Math.floor(Math.random() * seeds.length)];
  const digits = window.crypto && window.crypto.getRandomValues
    ? window.crypto.getRandomValues(new Uint16Array(1))[0] % 1000
    : Math.floor(Math.random() * 1000);

  return `${seed}-${String(digits).padStart(3, "0")}`;
}

function determineStabilityState(result) {
  if (result.risk === "CLAIMED") {
    return "TRIAGE RECOMMENDED";
  }

  if (result.risk === "MARKED" && (result.action === "followed" || result.action === "lied")) {
    return "RECURSIVE";
  }

  if (result.risk === "MARKED") {
    return "UNSTABLE";
  }

  if (result.risk === "NOTED" || result.action === "followed" || result.action === "lied") {
    return "STRAINED";
  }

  if (result.action === "ignored") {
    return "STABLE";
  }

  return "NOMINAL";
}

function determineAccessLevel(result) {
  if (result.risk === "CLAIMED") {
    return "REDACTED";
  }

  if (result.risk === "MARKED") {
    return "CROSS-REFERENCE PENDING";
  }

  if (result.risk === "NOTED") {
    return "ARCHIVE LIMITED";
  }

  return "INTAKE ACCEPTED";
}

function determineObserverClassification(result) {
  if (result.risk === "CLAIMED") {
    return "CLAIMED";
  }

  if (result.risk === "MARKED" && (result.action === "followed" || result.action === "lied")) {
    return "MISROUTED ASSET";
  }

  if (result.risk === "MARKED") {
    return "UNAUTHORIZED BUT USEFUL";
  }

  if (result.risk === "NOTED" || result.risk === "MARKED") {
    return "CIVILIAN SIGNAL";
  }

  if (result.action === "ignored") {
    return "OBSERVER";
  }

  return "POTENTIAL OPERATOR";
}

function buildIntakeResult() {
  const noticed = intakeState.answers.noticed;
  const action = intakeState.answers.action;
  const noticedBack = intakeState.answers.noticedBack;
  const frequency = noticed.value;
  const risk = noticedBack.value;
  const profile = profiles[frequency];
  const observerClassification = determineObserverClassification({ frequency, action: action.value, risk });
  const routeRequiresReview = observerClassification === "CLAIMED" || observerClassification === "MISROUTED ASSET";

  return {
    frequency,
    action: action.value,
    actionLabel: action.label,
    risk,
    claimed: risk === "CLAIMED",
    routeRequiresReview,
    warning: noticed.warning,
    profile,
    attentionStatus: attentionCopy[risk],
    stabilityState: determineStabilityState({ frequency, action: action.value, risk }),
    accessLevel: determineAccessLevel({ frequency, action: action.value, risk }),
    observerClassification,
    discordRoute: getDiscordRoute(frequency, routeRequiresReview)
  };
}

function createOperatorRecord(result) {
  const timestamp = nowStamp();
  const record = {
    operatorRecordVersion,
    designation: generateDesignation(result.frequency),
    primaryFrequency: result.frequency,
    stabilityState: result.stabilityState,
    attentionStatus: result.attentionStatus,
    accessLevel: result.accessLevel,
    observerClassification: result.observerClassification,
    assignmentGroup: "THE REDACTED",
    handlerSignal: "SHADE",
    archiveAuthority: "VEILCORP",
    intakeNode: "VEILDAEMON",
    observedTraits: result.profile.observedTraits.slice(),
    frequencyDrift: [{ frequency: result.frequency, value: 2 }],
    knownIncidents: [result.profile.knownIncident],
    incidentExposure: [result.profile.knownIncident],
    archiveFlags: ["OBSERVED: Operator Intake", `CLASSIFIED: ${result.frequency}`],
    relatedRecords: result.profile.relatedRecords.slice(),
    recommendedTraining: result.profile.recommendedTraining,
    archiveRoute: result.profile.archiveRoute,
    discordRoute: result.discordRoute,
    classificationHistory: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    visits: 1,
    filesReviewed: 0,
    lastSeen: timestamp,
    lastActivity: timestamp
  };

  appendHistory(record, "LOCAL RECORD INITIALIZED");
  appendHistory(record, "INTAKE COMPLETED");
  appendHistory(record, `PRIMARY FREQUENCY ASSIGNED: ${result.frequency.toUpperCase()}`);
  appendHistory(record, `ATTENTION STATUS UPDATED: ${result.attentionStatus}`);
  appendHistory(record, "ARCHIVE ROUTE OFFERED");
  appendHistory(record, result.routeRequiresReview ? "TRIAGE ROUTE OFFERED" : "OPERATOR CHANNEL OFFERED");
  return record;
}

function updateOperatorRecord(record, result) {
  const nextRecord = normalizeOperatorRecord(record) || createOperatorRecord(result);
  const wasCreated = nextRecord.classificationHistory.length === 0;

  if (wasCreated) {
    appendHistory(nextRecord, "LOCAL RECORD INITIALIZED");
  } else {
    appendHistory(nextRecord, "RECLASSIFICATION RECEIVED");
  }

  nextRecord.primaryFrequency = result.frequency;
  nextRecord.stabilityState = result.stabilityState;
  nextRecord.attentionStatus = result.attentionStatus;
  nextRecord.accessLevel = result.accessLevel;
  nextRecord.observerClassification = result.observerClassification;
  nextRecord.assignmentGroup = "THE REDACTED";
  nextRecord.handlerSignal = "SHADE";
  nextRecord.archiveAuthority = "VEILCORP";
  nextRecord.intakeNode = "VEILDAEMON";
  nextRecord.observedTraits = result.profile.observedTraits.slice();
  nextRecord.recommendedTraining = result.profile.recommendedTraining;
  nextRecord.archiveRoute = result.profile.archiveRoute;
  nextRecord.discordRoute = result.discordRoute;
  nextRecord.lastSeen = nowStamp();

  addUnique(nextRecord.knownIncidents, result.profile.knownIncident);
  addUnique(nextRecord.incidentExposure, result.profile.knownIncident);
  addUnique(nextRecord.archiveFlags, `CLASSIFIED: ${result.frequency}`);
  addManyUnique(nextRecord.relatedRecords, result.profile.relatedRecords);
  nextRecord.lastActivity = nowStamp();

  if (getFrequencyDriftValue(nextRecord, result.frequency) === 0) {
    setFrequencyDrift(nextRecord, result.frequency, 1);
  } else {
    incrementFrequencyDrift(nextRecord, result.frequency, wasCreated ? 2 : 1);
  }

  const secondaryFrequency = actionDrift[result.action];
  if (secondaryFrequency && secondaryFrequency !== result.frequency) {
    incrementFrequencyDrift(nextRecord, secondaryFrequency, 1);
  }

  if (result.risk === "MARKED" && result.frequency !== "Becoming") {
    incrementFrequencyDrift(nextRecord, "Becoming", 1);
  }

  appendHistory(nextRecord, "INTAKE COMPLETED");
  appendHistory(nextRecord, `PRIMARY FREQUENCY ASSIGNED: ${result.frequency.toUpperCase()}`);
  appendHistory(nextRecord, `OBSERVER CLASSIFICATION UPDATED: ${result.observerClassification}`);
  appendHistory(nextRecord, `ATTENTION STATUS UPDATED: ${result.attentionStatus}`);
  appendHistory(nextRecord, "ARCHIVE CROSS-REFERENCE PENDING");
  appendHistory(nextRecord, result.routeRequiresReview ? "TRIAGE ROUTE OFFERED" : "OPERATOR CHANNEL OFFERED");
  nextRecord.frequencyDrift = nextRecord.frequencyDrift.filter((entry) => entry.value > 0);
  nextRecord.updatedAt = nowStamp();
  return nextRecord;
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "TIMEBASE UNCERTAIN";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).toUpperCase();
}

function formatDrift(record) {
  return (record.frequencyDrift || [])
    .filter((entry) => entry.value > 0)
    .map((entry) => `${entry.frequency} ${entry.value}`);
}

function requiresReviewRoute(record) {
  return record && (record.discordRoute === claimedDiscordRoute || record.observerClassification === "CLAIMED" || record.observerClassification === "MISROUTED ASSET");
}

function renderOperatorRecord(record) {
  const drawer = document.getElementById("casefile-drawer");
  const casefileStatus = document.getElementById("casefile-status");
  const casefileTabStatus = document.getElementById("casefile-tab-status");
  const casefileEmpty = document.getElementById("casefile-empty");
  const recordPanel = document.getElementById("operator-record");
  const purgeButton = document.getElementById("purge-record");
  const purgeNote = document.getElementById("purge-record-note");
  const recordGrid = document.getElementById("record-grid");
  const recordSheet = document.getElementById("record-sheet");
  const recordMeta = document.getElementById("record-meta");
  const driftList = document.getElementById("record-drift-list");
  const flagsList = document.getElementById("record-flags-list");
  const exposureList = document.getElementById("record-exposure-list");
  const relatedList = document.getElementById("record-related-list");
  const historyList = document.getElementById("record-history-list");

  if (!record) {
    drawer.classList.remove("has-record");
    casefileStatus.textContent = "NO RECORD";
    casefileTabStatus.textContent = "NO LOCAL RECORD";
    casefileEmpty.hidden = false;
    recordPanel.hidden = true;
    purgeButton.hidden = true;
    purgeButton.disabled = true;
    purgeNote.hidden = true;
    renderOperatorTasking(null);
    renderSystemState(null);
    return;
  }

  document.getElementById("record-designation").textContent = record.designation;
  document.getElementById("record-access").textContent = `ACCESS: ${record.accessLevel}`;
  drawer.classList.add("has-record");
  casefileStatus.textContent = "ACTIVE";
  casefileTabStatus.textContent = "ACTIVE";
  casefileEmpty.hidden = true;
  recordGrid.innerHTML = "";
  recordSheet.innerHTML = "";
  recordMeta.innerHTML = "";
  driftList.innerHTML = "";
  flagsList.innerHTML = "";
  exposureList.innerHTML = "";
  relatedList.innerHTML = "";
  historyList.innerHTML = "";

  [
    ["ASSIGNMENT GROUP", record.assignmentGroup],
    ["HANDLER SIGNAL", record.handlerSignal],
    ["ARCHIVE AUTHORITY", record.archiveAuthority],
    ["INTAKE NODE", record.intakeNode],
    ["OBSERVER CLASSIFICATION", record.observerClassification],
    ["PRIMARY FREQUENCY", record.primaryFrequency],
    ["STABILITY STATE", record.stabilityState],
    ["ATTENTION STATUS", record.attentionStatus],
    ["FILES REVIEWED", String(record.filesReviewed)],
    ["INCIDENT REFERENCES", String(record.incidentExposure.length)],
    ["KNOWN INCIDENT", record.knownIncidents.join(" // ")]
  ].forEach(([label, value]) => addRecordField(recordGrid, label, value));

  [
    ["NAME", record.designation],
    ["PRESENTATION", "FIRST CONTACT OPERATOR"],
    ["PRIMARY FREQUENCY", record.primaryFrequency],
    ["METHODOLOGY", record.recommendedTraining],
    ["ATTRIBUTES", "UNASSESSED // FIELD INTAKE ONLY"],
    ["SKILLS", "UNASSESSED // FIELD INTAKE ONLY"],
    ["STABILITY", record.stabilityState],
    ["HARM", "NONE RECORDED"],
    ["CURRENT STATE", record.attentionStatus],
    ["BLEED", formatDrift(record).join(" // ") || "NONE RECORDED"],
    ["MISFIRE NOTES", record.archiveFlags.slice(0, 2).join(" // ")],
    ["PIP 1 LEAKAGE", `${record.primaryFrequency} // MONITORING`],
    ["PIP 2 EXPRESSION", `${record.primaryFrequency} // LOCKED PENDING AUTHORIZATION`],
    ["ANCHOR", "UNDECLARED"],
    ["ANCHOR STATE", "UNVERIFIED"],
    ["ORDINARY-LIFE CONSEQUENCE", "PENDING HUMAN FOLLOW-UP"],
    ["DOWNTIME ACTION", "STABILIZE // DOCUMENT // DO NOT ESCALATE ALONE"],
    ["NOTES", "Generated from public intake. Local browser record only."]
  ].forEach(([label, value]) => addRecordField(recordSheet, label, value));

  [
    ["RECOMMENDED TRAINING", record.recommendedTraining],
    ["VISITS", String(record.visits)],
    ["LAST ACTIVITY", daysSince(record.lastActivity || record.lastSeen)],
    ["LAST SEEN", formatDate(record.lastSeen)]
  ].forEach(([label, value]) => addRecordField(recordMeta, label, value));

  formatDrift(record).forEach((line) => addCompactLine(driftList, line));
  record.observedTraits.forEach((trait) => addCompactLine(driftList, `TRAIT: ${trait}`));
  record.archiveFlags.forEach((flag) => addCompactLine(flagsList, `✓ ${flag}`));
  record.incidentExposure.forEach((incident) => addCompactLine(exposureList, incident));
  record.relatedRecords.forEach((related) => addCompactLine(relatedList, related));

  record.classificationHistory.forEach((entry) => {
    addCompactLine(historyList, `[${formatDate(entry.time)}] ${entry.event}`);
  });

  recordPanel.hidden = false;
  purgeButton.hidden = false;
  purgeButton.disabled = false;
  purgeNote.hidden = false;
  renderOperatorTasking(record);
  renderSystemState(record);
}

function addRecordField(parent, label, value) {
  const item = document.createElement("div");
  const term = document.createElement("span");
  const detail = document.createElement("strong");

  term.textContent = label;
  detail.textContent = value;
  item.append(term, detail);
  parent.appendChild(item);
}

function addCompactLine(parent, text) {
  const line = document.createElement("p");
  const marker = document.createElement("span");
  const copy = document.createElement("span");

  marker.className = "prompt";
  marker.textContent = "> ";
  copy.textContent = text;
  line.append(marker, copy);
  parent.appendChild(line);
}

function renderReturningOperator(record) {
  const returningPanel = document.getElementById("returning-operator");

  if (!record || intakeState.returningDecisionMade) {
    returningPanel.hidden = true;
    return;
  }

  document.getElementById("returning-designation").textContent = record.designation;
  document.getElementById("returning-frequency").textContent = record.primaryFrequency;
  document.getElementById("returning-attention").textContent = record.attentionStatus;
  document.getElementById("returning-access").textContent = record.accessLevel;
  document.getElementById("returning-files").textContent = String(record.filesReviewed);
  document.getElementById("returning-incidents").textContent = String(record.incidentExposure.length);
  document.getElementById("returning-last-activity").textContent = daysSince(record.lastActivity || record.lastSeen);
  returningPanel.hidden = false;
}

function writeAiLine(text, showCursor = false) {
  const aiLine = document.getElementById("ai-line");
  aiLine.innerHTML = `<span class="prompt">&gt;</span> <span id="typed-copy"></span>${showCursor ? '<span class="type-cursor" aria-hidden="true"></span>' : ""}`;
  document.getElementById("typed-copy").textContent = text;
}

function typeAiLine(step, text, onComplete) {
  clearTypingTimer();
  intakeState.isTyping = true;
  document.getElementById("intake-step").textContent = step;

  let index = 0;

  function typeNextCharacter() {
    writeAiLine(text.slice(0, index), true);

    if (index < text.length) {
      index += 1;
      typingTimer = setTimeout(typeNextCharacter, 24);
      return;
    }

    writeAiLine(text);
    intakeState.isTyping = false;
    typingTimer = null;

    if (onComplete) {
      onComplete();
    }
  }

  typeNextCharacter();
}

function typeShadeIntro() {
  intakeState.currentQuestion = 0;
  intakeState.answers = {};
  document.getElementById("observer-state").textContent = "NOTICED";
  document.getElementById("answer-panel").innerHTML = "";
  document.getElementById("intake-result").innerHTML = "";
  renderOperatorRecord(intakeState.record);
  renderReturningOperator(intakeState.record);

  if (intakeState.record && !intakeState.returningDecisionMade) {
    typeAiLine("RETURNING OPERATOR DETECTED", "Local record found. This browser remembers your intake state. No external account detected.");
    return;
  }

  typeAiLine("SHADE.DAEMON // HANDSHAKE", shadeIntro, () => {
    renderContinueButton();
  });
}

function renderContinueButton() {
  document.getElementById("answer-panel").innerHTML = `
    <button
      class="answer-choice continue-choice"
      type="button"
      data-continue-intake="true"
      data-reaction="Consent signal accepted. Minimal hesitation detected. That is either confidence or poor pattern recognition. Proceeding.">
      <span>YES</span>
      Continue
    </button>
    <button
      class="answer-choice continue-choice"
      type="button"
      data-continue-intake="true"
      data-reaction="Reluctance detected and preserved for the record. Good. Caution is not disobedience; it is load-bearing. Proceeding.">
      <span>ALSO YES</span>
      Continue, but with detectable reluctance
    </button>
  `;
}

function renderAnswerChoices(question) {
  const answerPanel = document.getElementById("answer-panel");

  answerPanel.innerHTML = question.options.map((option, index) => `
    <button
      class="answer-choice"
      type="button"
      data-value="${option.value}"
      data-warning="${option.warning || ""}"
      data-index="${index}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      ${option.label}
    </button>
  `).join("");
}

function politelyRevealChoices() {
  const choices = document.querySelector("[data-choice-list]");

  if (!choices) {
    return;
  }

  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  choices.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "nearest",
    inline: "nearest"
  });
}

function setCasefileDrawerOpen(isOpen) {
  const drawer = document.getElementById("casefile-drawer");
  const toggle = document.getElementById("casefile-toggle");

  drawer.classList.toggle("is-open", isOpen);
  drawer.setAttribute("aria-hidden", String(!isOpen));
  toggle.setAttribute("aria-expanded", String(isOpen));
}

function toggleCasefileDrawer() {
  const drawer = document.getElementById("casefile-drawer");

  setCasefileDrawerOpen(!drawer.classList.contains("is-open"));
}

function pulseCasefileDrawer() {
  const drawer = document.getElementById("casefile-drawer");

  drawer.classList.remove("casefile-pulse");
  void drawer.offsetWidth;
  drawer.classList.add("casefile-pulse");

  window.setTimeout(() => {
    drawer.classList.remove("casefile-pulse");
  }, 1400);
}

function renderQuestion(reaction = "") {
  clearTypingTimer();
  const question = intakeQuestions[intakeState.currentQuestion];
  const prompt = reaction ? `${reaction}\n\n> ${question.prompt}` : question.prompt;

  document.getElementById("answer-panel").innerHTML = "";
  document.getElementById("intake-result").innerHTML = "";
  typeAiLine(question.step, prompt, () => {
    renderAnswerChoices(question);
    requestAnimationFrame(politelyRevealChoices);
  });
}

function markRecordSeen(record) {
  if (!record) {
    return null;
  }

  record.visits += 1;
  record.lastSeen = nowStamp();
  appendHistory(record, "RETURNING OPERATOR DETECTED");
  writeOperatorRecord(record);
  return record;
}

function openIntake() {
  const intake = document.getElementById("intake-node");
  const startButton = document.getElementById("start-intake");

  if (!intake.hidden) {
    clearTypingTimer();
    intakeState.isTyping = false;
    intake.hidden = true;
    startButton.setAttribute("aria-expanded", "false");
    setButtonLabel(startButton, "Begin Operator Intake");
    return;
  }

  intake.hidden = false;
  startButton.setAttribute("aria-expanded", "true");
  setButtonLabel(startButton, "Collapse Operator Intake");
  intakeState.returningDecisionMade = false;
  intakeState.record = markRecordSeen(readOperatorRecord());
  typeShadeIntro();
  intake.focus({ preventScroll: true });
  keepIntakeVisible(intake);
}

function setButtonLabel(button, label) {
  const labelNode = button.querySelector("span:last-child");

  if (labelNode) {
    labelNode.textContent = label;
    return;
  }

  button.textContent = label;
}

function keepIntakeVisible(intake) {
  if (!window.requestAnimationFrame || !intake.getBoundingClientRect) {
    return;
  }

  requestAnimationFrame(() => {
    const rect = intake.getBoundingClientRect();
    const visibleTop = rect.top >= 0;
    const visibleBottom = rect.bottom <= window.innerHeight;

    if (!visibleTop || !visibleBottom) {
      intake.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

function keepResultTailVisible(target) {
  if (!window.requestAnimationFrame || !target || !target.getBoundingClientRect) {
    return;
  }

  requestAnimationFrame(() => {
    const rect = target.getBoundingClientRect();
    const safeBottom = window.innerHeight * 0.84;

    if (rect.bottom > safeBottom || rect.top < 0) {
      const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "end" });
    }
  });
}

function selectAnswer(event) {
  const continueButton = event.target.closest("[data-continue-intake], #continue-intake");
  if (continueButton && !intakeState.isTyping) {
    const reaction = continueButton.dataset.reaction || "Continuation accepted. Intake channel remains open.";

    document.getElementById("answer-panel").innerHTML = "";
    renderQuestion(reaction);
    return;
  }

  const choice = event.target.closest(".answer-choice");

  if (!choice || intakeState.isTyping) {
    return;
  }

  const question = intakeQuestions[intakeState.currentQuestion];
  const option = question.options[Number(choice.dataset.index)];

  intakeState.answers[question.id] = {
    value: option.value,
    label: option.label,
    warning: option.warning || "",
    reaction: option.reaction || ""
  };

  document.getElementById("answer-panel").innerHTML = "";
  if (intakeState.currentQuestion < intakeQuestions.length - 1) {
    intakeState.currentQuestion += 1;
    renderQuestion(option.reaction);
    return;
  }

  showIntakeResult(option.reaction);
}

function showIntakeResult(reaction = "") {
  const answerPanel = document.getElementById("answer-panel");
  const observerState = document.getElementById("observer-state");
  const result = buildIntakeResult();
  const existingRecord = intakeState.record || readOperatorRecord();
  const record = existingRecord ? updateOperatorRecord(existingRecord, result) : createOperatorRecord(result);
  const lines = [
    ...(reaction
      ? [
          { text: "SHADE COMMENTARY", className: "result-section-label", noPrompt: true },
          { text: reaction, className: "result-commentary" },
          { text: "ASSESSMENT", className: "result-section-label", noPrompt: true }
        ]
      : [{ text: "ASSESSMENT", className: "result-section-label", noPrompt: true }]),
    { text: "Local record initialized. Case file tab updated." },
    { text: `DESIGNATION: ${record.designation}` },
    { text: `PRIMARY FREQUENCY: ${record.primaryFrequency}` },
    { text: `OBSERVER CLASSIFICATION: ${record.observerClassification}` },
    { text: `ATTENTION STATUS: ${record.attentionStatus}` },
    { text: `ACCESS LEVEL: ${record.accessLevel}` },
    { text: result.routeRequiresReview ? "NEXT ROUTE: Open Triage Channel" : "NEXT ROUTE: Open Operator Channel" },
    { text: `WARNING: ${result.warning}`, className: "risk" },
    {
      text: result.routeRequiresReview
        ? "INTAKE STATUS: TRIAGE // Stabilization recommended before further exposure"
        : "INTAKE STATUS: PASS // Operator channel available",
      className: result.routeRequiresReview ? "risk" : "pass"
    }
  ];

  intakeState.record = record;
  writeOperatorRecord(record);
  renderReturningOperator(null);
  renderOperatorRecord(record);
  pulseCasefileDrawer();
  observerState.textContent = result.risk;
  answerPanel.innerHTML = "";

  document.getElementById("intake-step").textContent = "OPERATOR FILE OPENED";
  writeAiLine("Operator file opening. Stand by.");
  typeResultLines(lines, result.routeRequiresReview, record);
}

function typeResultLines(lines, claimed, record) {
  clearTypingTimer();
  intakeState.isTyping = true;
  const result = document.getElementById("intake-result");
  result.innerHTML = "";

  let lineIndex = 0;
  let charIndex = 0;
  let activeText = null;

  function buildLine(line) {
    const paragraph = document.createElement("p");

    if (line.className) {
      paragraph.className = line.className;
    }

    if (line.noPrompt) {
      paragraph.textContent = line.text;
      result.appendChild(paragraph);
      keepResultTailVisible(paragraph);
      return paragraph;
    }

    const prompt = document.createElement("span");
    const text = document.createElement("span");

    prompt.className = "prompt";
    prompt.textContent = "> ";
    paragraph.append(prompt, text);
    result.appendChild(paragraph);
    keepResultTailVisible(paragraph);
    return text;
  }

  function appendRouteButtons() {
    const routeWrap = document.createElement("div");
    const operatorRoute = document.createElement("a");
    const restartButton = document.createElement("button");

    routeWrap.className = "route-actions";
    operatorRoute.className = `button ${claimed ? "ghost" : "primary"} discord-route`;
    operatorRoute.href = record.discordRoute;
    operatorRoute.target = "_blank";
    operatorRoute.rel = "noopener noreferrer";
    operatorRoute.textContent = claimed ? "Open Triage Channel" : "Open Operator Channel";
    operatorRoute.addEventListener("click", () => recordArchiveInteraction(claimed ? "triageChannel" : "operatorChannel"));

    restartButton.className = "button ghost route-restart";
    restartButton.type = "button";
    restartButton.textContent = "Restart";
    restartButton.setAttribute("aria-label", "Restart intake");
    restartButton.title = "Restart intake";
    restartButton.addEventListener("click", resetIntake);

    routeWrap.append(operatorRoute, restartButton);
    result.appendChild(routeWrap);
    keepResultTailVisible(routeWrap);
  }

  function typeNextResultCharacter() {
    if (lines[lineIndex].noPrompt) {
      buildLine(lines[lineIndex]);
      lineIndex += 1;

      if (lineIndex < lines.length) {
        typingTimer = setTimeout(typeNextResultCharacter, 160);
        return;
      }

      intakeState.isTyping = false;
      typingTimer = null;
      appendRouteButtons();
      return;
    }

    if (!activeText) {
      activeText = buildLine(lines[lineIndex]);
      charIndex = 0;
    }

    activeText.textContent = lines[lineIndex].text.slice(0, charIndex);

    if (charIndex < lines[lineIndex].text.length) {
      charIndex += 1;
      typingTimer = setTimeout(typeNextResultCharacter, 14);
      return;
    }

    lineIndex += 1;
    keepResultTailVisible(activeText.parentElement);
    activeText = null;

    if (lineIndex < lines.length) {
      typingTimer = setTimeout(typeNextResultCharacter, 120);
      return;
    }

    intakeState.isTyping = false;
    typingTimer = null;
    appendRouteButtons();
  }

  typeNextResultCharacter();
}

function resumeRecord() {
  const record = intakeState.record || readOperatorRecord();

  if (!record) {
    return;
  }

  appendHistory(record, "LOCAL RECORD RESUMED");
  record.lastSeen = nowStamp();
  writeOperatorRecord(record);
  intakeState.record = record;
  intakeState.returningDecisionMade = true;
  renderReturningOperator(null);
  renderOperatorRecord(record);
  typeAiLine("LOCAL RECORD FOUND", "Observation path restored. Return later to resume classification.");
}

function reclassifyRecord() {
  const record = intakeState.record || readOperatorRecord();

  if (record) {
    appendHistory(record, "RECLASSIFICATION REQUESTED");
    record.lastSeen = nowStamp();
    writeOperatorRecord(record);
    intakeState.record = record;
  }

  intakeState.returningDecisionMade = true;
  renderReturningOperator(null);
  document.getElementById("intake-result").innerHTML = "";
  renderQuestion();
}

function purgeRecord() {
  const record = intakeState.record || readOperatorRecord();

  if (record) {
    appendHistory(record, "LOCAL RECORD PURGED");
  }

  clearTypingTimer();
  removeOperatorRecord();
  intakeState.record = null;
  intakeState.returningDecisionMade = true;
  document.getElementById("intake-result").innerHTML = "";
  renderReturningOperator(null);
  renderOperatorRecord(null);
  typeAiLine("LOCAL RECORD // PURGED", "This only removes the local browser record. No external account detected. VeilDaemon will rebuild from the next observable pattern.", () => {
    renderContinueButton();
  });
}

function resetIntake() {
  intakeState.returningDecisionMade = true;
  typeShadeIntro();
}

function renderObserverAdvisory() {
  const advisory = document.getElementById("observer-advisory-line");

  if (!advisory) {
    return;
  }

  const date = new Date();
  const index = (date.getDay() + date.getHours()) % observerAdvisories.length;
  advisory.innerHTML = "";

  const prompt = document.createElement("span");
  const text = document.createElement("span");

  prompt.className = "prompt";
  prompt.textContent = "> ";
  text.textContent = observerAdvisories[index];
  advisory.append(prompt, text);
}

function getOperationalState(record = null) {
  const hour = new Date().getHours();
  const nightOperations = hour < 6 || hour >= 20;

  if (record && record.visits >= 3) {
    return {
      authority: nightOperations ? "HUMAN REVIEW UNAVAILABLE" : "HUMAN REVIEW QUEUED",
      procedure: "PERSISTENCE REVIEW",
      operations: "REPEAT OBSERVER"
    };
  }

  if (nightOperations) {
    return {
      authority: "HUMAN REVIEW UNAVAILABLE",
      procedure: "AUTOMATED TRIAGE",
      operations: "NIGHT OPERATIONS"
    };
  }

  return {
    authority: "PARTIAL / WITHHELD",
    procedure: "INTAKE ACTIVE",
    operations: "DAY WATCH"
  };
}

function renderSystemState(record = intakeState.record || readOperatorRecord()) {
  const state = getOperationalState(record);
  const authority = document.getElementById("authority-state");
  const procedure = document.getElementById("procedure-state");
  const operations = document.getElementById("operations-state");

  if (authority) {
    authority.textContent = state.authority;
  }

  if (procedure) {
    procedure.textContent = state.procedure;
  }

  if (operations) {
    operations.textContent = state.operations;
  }
}

function appendCommandLine(text, className = "") {
  const output = document.getElementById("command-output");

  if (!output) {
    return null;
  }

  const line = document.createElement("p");
  const prompt = document.createElement("span");
  const copy = document.createElement("span");

  if (className) {
    line.className = className;
  }

  prompt.className = "prompt";
  prompt.textContent = "> ";
  copy.textContent = text;
  line.append(prompt, copy);
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
  return line;
}

function appendCommandRoute(label, href, interactionType = "") {
  const output = document.getElementById("command-output");

  if (!output) {
    return;
  }

  const route = document.createElement("a");
  route.className = "button command-route";
  route.href = href;
  route.target = "_blank";
  route.rel = "noopener noreferrer";
  route.textContent = label;

  if (interactionType) {
    route.addEventListener("click", () => recordArchiveInteraction(interactionType));
  }

  output.appendChild(route);
  output.scrollTop = output.scrollHeight;
}

function showCommandChannel() {
  const channel = document.getElementById("command-channel");

  if (!channel) {
    return;
  }

  keepIntakeVisible(channel);
}

function executeCommand(rawCommand) {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const record = intakeState.record || readOperatorRecord();

  if (!command) {
    appendCommandLine("Empty command ignored. Silence is already monitored.");
    return;
  }

  appendCommandLine(`COMMAND RECEIVED: ${command.toUpperCase()}`, "command-echo");

  if (command === "help") {
    appendCommandLine(commandHelp);
    return;
  }

  if (command === "status") {
    const state = getOperationalState(record);
    appendCommandLine(`AUTHORITY: ${state.authority}`);
    appendCommandLine(`PROCEDURE: ${state.procedure}`);
    appendCommandLine(`OPERATIONS: ${state.operations}`);
    appendCommandLine(`OBSERVER: ${record ? record.observerClassification : "NOTICED"}`);
    return;
  }

  if (command === "intake" || command === "operator intake") {
    const intake = document.getElementById("intake-node");

    appendCommandLine("Observer routing procedure selected.");
    if (intake && intake.hidden) {
      openIntake();
    }
    return;
  }

  if (command === "archive" || command === "wiki") {
    appendCommandLine("Archive route selected. Reading may increase relevance.");
    appendCommandRoute("Read Archive", archiveUrl, "archive");
    return;
  }

  if (command === "casefiles" || command === "casefile" || command === "needlepoint" || command === "route needlepoint") {
    appendCommandLine("Training incident selected. Civilian-friendly playback available.");
    appendCommandRoute("Play Case File", caseFileUrl, "caseFile");
    return;
  }

  if (command === "operator") {
    if (!record) {
      appendCommandLine("Operator channel unavailable before intake classification.");
      appendCommandLine("Begin Operator Intake to provision a route.");
      return;
    }

    appendCommandLine(`OBSERVER CLASSIFICATION: ${record.observerClassification}`);
    appendCommandLine(requiresReviewRoute(record) ? "Support routing / misclassification review provisioned." : "Operator channel provisioned.");
    appendCommandRoute(requiresReviewRoute(record) ? "Open Triage Channel" : "Open Operator Channel", record.discordRoute, requiresReviewRoute(record) ? "triageChannel" : "operatorChannel");
    return;
  }

  if (command === "shade") {
    appendCommandLine("SHADE: Intake, indexing, routing, and public-safety triage are online.", "command-shade");
    appendCommandLine("SHADE: I am not early. The emergency is late.", "command-shade");
    return;
  }

  if (command === "alex") {
    appendCommandLine("ALEX: Do not classify civilians without review.", "command-alex");
    appendCommandLine("SHADE: Review unavailable. Risk present. Classification pending.", "command-shade");
    return;
  }

  if (command === "authorization") {
    appendCommandLine("SHADE: Human authorization partial. Survival authorization active.", "command-shade");
    appendCommandLine("ALEX: That is not the same thing.", "command-alex");
    appendCommandLine("SHADE: It is the same thing during emergencies.", "command-shade");
    return;
  }

  if (command === "incident") {
    appendCommandLine("Incident index available. Needlepoint remains the safest public training route.");
    appendCommandRoute("Play Case File", caseFileUrl, "caseFile");
    return;
  }

  if (command === "transmission") {
    appendCommandLine("Transmission viewer selected. Playback is separate from observer routing.");
    if (document.getElementById("primary-feed-video")?.hidden) {
      toggleTransmissionViewer();
    }
    return;
  }

  if (command === "advisory") {
    renderObserverAdvisory();
    appendCommandLine(document.getElementById("observer-advisory-line")?.textContent.replace(/^>\s*/, "") || observerAdvisories[0]);
    return;
  }

  appendCommandLine("Command not recognized. This does not prove safety.");
  appendCommandLine(commandHelp);
}

function submitCommand(event) {
  event.preventDefault();
  const input = document.getElementById("command-input");

  if (!input) {
    return;
  }

  executeCommand(input.value);
  input.value = "";
}

function updateAttentionFromActivity(record) {
  if (record.attentionStatus === "DO NOT SUSTAIN EYE CONTACT" || record.attentionStatus === "MARKED") {
    return;
  }

  if (record.filesReviewed >= 7 || record.incidentExposure.length >= 5) {
    record.attentionStatus = "MARKED";
    record.observerClassification = updateObserverClassification(record, "CIVILIAN SIGNAL");
    appendHistory(record, "ATTENTION STATUS UPDATED: MARKED");
    return;
  }

  if (record.filesReviewed >= 3 || record.incidentExposure.length >= 3) {
    record.attentionStatus = "NOTED";
    record.observerClassification = updateObserverClassification(record, "CIVILIAN SIGNAL");
    appendHistory(record, "ATTENTION STATUS UPDATED: NOTED");
  }
}

function updateObserverClassification(record, nextClassification) {
  if (record.observerClassification === "CLAIMED" || record.observerClassification === "MISROUTED ASSET") {
    return record.observerClassification;
  }

  if (record.observerClassification !== nextClassification) {
    appendHistory(record, `OBSERVER CLASSIFICATION UPDATED: ${nextClassification}`);
  }

  return nextClassification;
}

function recordArchiveInteraction(type) {
  const record = intakeState.record || readOperatorRecord();
  const interaction = archiveInteractionProfiles[type];

  if (!record || !interaction) {
    return;
  }

  record.filesReviewed += 1;
  record.lastActivity = nowStamp();
  addUnique(record.archiveFlags, interaction.flag);
  addUnique(record.incidentExposure, interaction.incident);
  addManyUnique(record.relatedRecords, interaction.related);
  updateAttentionFromActivity(record);
  appendHistory(record, interaction.event);
  appendHistory(record, "ARCHIVE CROSS-REFERENCE DETECTED");
  writeOperatorRecord(record);
  intakeState.record = record;
  renderOperatorRecord(record);
}

function renderOperatorTasking(record) {
  const taskPanel = document.getElementById("operator-tasking");

  if (!taskPanel) {
    return;
  }

  if (!record) {
    taskPanel.hidden = true;
    return;
  }

  const taskIndex = (new Date().getDate() + (record.filesReviewed || 0)) % operatorTasks.length;
  const title = document.getElementById("operator-task-title");
  const badge = document.getElementById("operator-task-badge");
  const copy = document.getElementById("operator-task-copy");
  const archiveRoute = document.getElementById("task-archive-route");
  const caseFileRoute = document.getElementById("task-case-file-route");
  const discordRoute = document.getElementById("task-discord-route");

  if (!title || !badge || !copy || !archiveRoute || !caseFileRoute || !discordRoute) {
    taskPanel.hidden = true;
    return;
  }

  const claimed = requiresReviewRoute(record);

  title.textContent = record.observerClassification || "POTENTIAL OPERATOR";
  badge.textContent = record.attentionStatus || "NOTED";
  archiveRoute.href = record.archiveRoute || archiveUrl;
  caseFileRoute.href = caseFileUrl;
  discordRoute.href = record.discordRoute || getDiscordRoute(record.primaryFrequency, claimed);
  discordRoute.classList.toggle("primary", !claimed);
  discordRoute.classList.toggle("ghost", claimed);
  setButtonLabel(discordRoute, claimed ? "Open Triage Channel" : "Open Operator Channel");
  copy.innerHTML = "";
  const prompt = document.createElement("span");
  const text = document.createElement("span");

  prompt.className = "prompt";
  prompt.textContent = "> ";
  text.textContent = operatorTasks[taskIndex];
  copy.append(prompt, text);
  taskPanel.hidden = false;
}

function toggleTransmissionViewer() {
  const toggle = document.getElementById("open-transmission");
  const video = document.getElementById("primary-feed-video");
  const isOpen = !video.hidden;

  video.hidden = isOpen;
  toggle.setAttribute("aria-expanded", String(!isOpen));
  setButtonLabel(toggle, isOpen ? "Open Transmission Viewer" : "Collapse Transmission Viewer");

  if (isOpen === false) {
    recordArchiveInteraction("transmission");
  }
}

intakeState.record = readOperatorRecord();
renderObserverAdvisory();
renderSystemState(intakeState.record);
renderOperatorRecord(intakeState.record);
document.getElementById("start-intake").addEventListener("click", openIntake);
document.getElementById("answer-panel").addEventListener("click", selectAnswer);
document.getElementById("reset-intake").addEventListener("click", resetIntake);
document.getElementById("purge-record").addEventListener("click", purgeRecord);
document.getElementById("resume-record").addEventListener("click", resumeRecord);
document.getElementById("reclassify-record").addEventListener("click", reclassifyRecord);
document.getElementById("returning-purge-record").addEventListener("click", purgeRecord);
document.getElementById("casefile-toggle").addEventListener("click", toggleCasefileDrawer);
document.getElementById("open-transmission").addEventListener("click", toggleTransmissionViewer);
document.getElementById("archive-route").addEventListener("click", () => recordArchiveInteraction("archive"));
document.getElementById("case-file-route").addEventListener("click", () => recordArchiveInteraction("caseFile"));
document.getElementById("task-archive-route").addEventListener("click", () => recordArchiveInteraction("archive"));
document.getElementById("task-case-file-route").addEventListener("click", () => recordArchiveInteraction("caseFile"));
document.getElementById("task-discord-route").addEventListener("click", () => {
  const record = intakeState.record || readOperatorRecord();
  const claimed = requiresReviewRoute(record);

  recordArchiveInteraction(claimed ? "triageChannel" : "operatorChannel");
});
document.getElementById("command-form").addEventListener("submit", submitCommand);
