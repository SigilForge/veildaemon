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
  const npcFlags = ["Ally", "Witness", "Threat", "Missing", "Compromised"];

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
        },
        caseFile: {
          nextClue: "What cannot be blocked.",
          nextPressureBeat: "What changes if the table waits."
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
        },
        caseFile: {
          nextClue: "A public system knows the case label before the Operators do.",
          nextPressureBeat: "The intake route stops feeling optional."
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
      liveDecision: "",
      midpointEvent: "",
      fullClockEvent: "",
      stabilizer: "",
      ticksWhen: ""
    },
    entityLoop: {
      Need: "",
      Lure: "",
      Pressure: "",
      Gift: "",
      Violence: "",
      Exit: ""
    },
    activeEntity: {
      name: "",
      kind: "Zone",
      sceneState: "Stable",
      notes: ""
    },
    entityLibrary: [],
    attention: {
      current: "Unseen",
      residue: "",
      followsHome: ""
    },
    residueLog: [],
    unresolvedConsequences: "",
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
    npcs: [
      {
        id: "npc-1",
        name: "",
        role: "",
        pressure: "",
        location: "",
        flags: [],
        notes: ""
      }
    ],
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
        relationshipPressure: "",
        primaryFrequency: "",
        frequencyPips: "",
        equipment: "",
        sourceExportedAt: "",
        lastImported: "",
        sourceId: ""
      }
    ],
    caseFile: {
      nextClue: "",
      nextPressureBeat: "",
      templates: "",
      notes: ""
    },
    handlerNotes: {
      privateNotes: "",
      clueList: "",
      consequenceQueue: "",
      residueLog: ""
    },
    canonTerminology
  };

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
      activeEntity: {
        name: safeString(merged.activeEntity.name, 120),
        kind: normalizeChoice(merged.activeEntity.kind, ["Entity", "Zone"], "Zone"),
        sceneState: normalizeChoice(merged.activeEntity.sceneState, sceneStates.map((item) => item.name), merged.sceneState.current || "Stable"),
        notes: safeString(merged.activeEntity.notes, 1000)
      },
      entityLibrary: normalizeEntityLibrary(merged.entityLibrary),
      attention: {
        current: normalizeChoice(merged.attention.current, attentionStates, "Unseen"),
        residue: safeString(merged.attention.residue, 180),
        followsHome: safeString(merged.attention.followsHome, 180)
      },
      residueLog: normalizeResidueLog(merged.residueLog),
      unresolvedConsequences: safeString(merged.unresolvedConsequences, 1000),
      roomAnswer: normalizeTextObject(merged.roomAnswer, defaultState.roomAnswer),
      roll: normalizeRoll(merged.roll),
      npcs: normalizeNpcs(merged.npcs),
      players: normalizePlayers(merged.players),
      caseFile: normalizeTextObject(merged.caseFile, defaultState.caseFile),
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

  function normalizeNpcs(npcs) {
    const list = Array.isArray(npcs) ? npcs : [];
    return list.slice(0, 12).map((npc, index) => ({
      id: safeString(npc.id, 80) || `npc-${index + 1}`,
      name: safeString(npc.name, 100),
      role: safeString(npc.role, 100),
      pressure: safeString(npc.pressure, 160),
      location: safeString(npc.location, 120),
      flags: Array.isArray(npc.flags) ? npc.flags.filter((flag) => npcFlags.includes(flag)).slice(0, 5) : [],
      notes: safeString(npc.notes, 1000)
    }));
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
      relationshipPressure: safeString(player.relationshipPressure, 180),
      primaryFrequency: safeString(player.primaryFrequency, 80),
      frequencyPips: safeString(player.frequencyPips, 180),
      equipment: safeString(player.equipment, 260),
      sourceExportedAt: safeString(player.sourceExportedAt, 80),
      lastImported: safeString(player.lastImported, 80),
      sourceId: safeString(player.sourceId, 120)
    }));
  }

  function normalizeEntityLibrary(entities) {
    const list = Array.isArray(entities) ? entities : [];
    return list.slice(0, 20).map((entity, index) => ({
      id: safeString(entity.id, 80) || `entity-${index + 1}`,
      name: safeString(entity.name, 120),
      kind: normalizeChoice(entity.kind, ["Entity", "Zone"], "Entity"),
      sceneState: normalizeChoice(entity.sceneState, sceneStates.map((item) => item.name), "Stable"),
      loop: normalizeTextObject(entity.loop, defaultState.entityLoop),
      notes: safeString(entity.notes, 1200)
    }));
  }

  function normalizeResidueLog(log) {
    const list = Array.isArray(log) ? log : [];
    return list.slice(0, 20).map((item, index) => ({
      id: safeString(item.id, 80) || `residue-${index + 1}`,
      scene: safeString(item.scene, 140),
      attention: normalizeChoice(item.attention, attentionStates, "Unseen"),
      residue: safeString(item.residue, 240),
      followsHome: safeString(item.followsHome, 240),
      consequence: safeString(item.consequence, 300)
    }));
  }

  function readState() {
    try {
      return normalizeState(JSON.parse(window.localStorage.getItem(storageKey)));
    } catch (error) {
      return normalizeState(null);
    }
  }

  function writeState(state, statusText) {
    const next = normalizeState(state);
    next.updatedAt = nowStamp();
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("veildaemon:handler-state-updated", { detail: { statusText: statusText || "LOCAL SAVED" } }));
    return next;
  }

  function getPath(source, path) {
    return path.split(".").reduce((value, key) => value && value[key], source);
  }

  function setPath(source, path, value) {
    const parts = path.split(".");
    let target = source;
    while (parts.length > 1) {
      const key = parts.shift();
      target[key] = target[key] && typeof target[key] === "object" ? target[key] : {};
      target = target[key];
    }
    target[parts[0]] = value;
  }

  function publicClockLabel(state) {
    const clock = state.primaryClock;
    const name = clock.name || "Active Clock";
    return `${name} ${clock.current}/${clock.segments}`;
  }

  function clockWarning(clock) {
    if (!clock || !clock.segments) return "";
    if (clock.current >= clock.segments) return clock.fullClockEvent || "Full clock event pending.";
    if (clock.current >= Math.ceil(clock.segments / 2)) return clock.midpointEvent || "Midpoint pressure is live.";
    return clock.ticksWhen || "";
  }

  window.HandlerState = {
    storageKey,
    canonTerminology,
    sceneStates,
    attentionStates,
    loopFields,
    npcFlags,
    templates,
    defaultState,
    readState,
    writeState,
    normalizeState,
    mergeDeep,
    safeString,
    safeNumber,
    getPath,
    setPath,
    publicClockLabel,
    clockWarning
  };
}());
