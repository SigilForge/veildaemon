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

  const attentionStates = ["Unseen", "Noticed", "Focused", "Fixed", "Exposed"];
  const attentionAliases = {
    observed: "noticed",
    witnessed: "fixed",
    mythic: "exposed",
    claimed: "exposed"
  };
  const loopFields = ["Need", "Lure", "Pressure", "Gift", "Violence", "Exit"];
  const npcFlags = ["Ally", "Witness", "Threat", "Missing", "Compromised"];
  const templateCatalogUrl = new URL("templates.json", document.currentScript && document.currentScript.src || window.location.href).href;
  const catalogs = window.CradlepointCatalogs || {};

  const templates = [
  {
    "id": "veilcorp-intake",
    "name": "VeilCorp Intake",
    "data": {
      "session": {
        "title": "Needlepoint 001",
        "caseTitle": "VeilCorp Intake",
        "location": "Ruined church north of Kansas City",
        "safeSceneLabel": "Broken Mirror Chamber active; cell not yet assembled"
      },
      "sceneState": {
        "current": "Echoed"
      },
      "primaryClock": {
        "name": "Broken Mirror Chamber",
        "segments": 6,
        "current": 1,
        "ticksWhen": "Operators stall, split up, deny the obvious, fail under pressure, or stare too long into reflective surfaces.",
        "midpointEvent": "Tick 3 — Shade interrupts with a useful but invasive warning while Alex tries to soften it. Operators gain one clear clue; Shade records emotional tells unless Alex overrides.",
        "fullClockEvent": "Tick 6 — The Unfinished Witness acts directly and offers someone a cleaner self. Force break, bind, speak, or flee before the chamber chooses for them.",
        "stabilizer": "Protected truthful speech, Anchors and Totems against the mirror, binding or breaking the altar mirror, or leaving together."
      },
      "entityLoop": {
        "Need": "A complete self to copy, correct, or preserve.",
        "Lure": "Reflections showing a cleaner choice, safer name, or version of the Operator who never broke.",
        "Pressure": "Mirrors, phone screens, rainwater, and stained glass edit identity toward the easiest acceptable version.",
        "Gift": "One true thing the Operator has been avoiding, revealed through reflection or wrong name.",
        "Violence": "It separates an Operator from the group and makes the corrected self feel easier than the real one.",
        "Exit": "Refuse the false self, speak one specific truth while witnessed, and leave together before the chamber chooses."
      },
      "activeEntity": {
        "name": "The Unfinished Witness",
        "kind": "Entity",
        "sceneState": "Echoed",
        "notes": "First-contact mirror entity. Not a hit-point monster. Loses power when Operators refuse false selves, protect each other from isolation, or use Anchors against the altar mirror."
      },
      "attention": {
        "current": "Noticed"
      },
      "roomAnswer": {
        "object": "Mirror, phone screen, rainwater, stained glass, altar shard",
        "emotionalInput": "Refused self, wrong name, control, omission, fear",
        "consequence": "The reflected version answers before the Operator does."
      },
      "npcs": [
        {
          "id": "npc-alex",
          "name": "Alex Shade",
          "role": "Emergency handler / unfinished VeilCorp shell",
          "pressure": "Softens horror through banter until the reflection breaches; then maps exits and countermeasures.",
          "location": "Remote cut-ins, then field contact",
          "flags": [
            "Ally"
          ],
          "notes": "Not a polished founder. Human override when Shade becomes too clinical."
        },
        {
          "id": "npc-shade",
          "name": "Shade",
          "role": "Literal intake AI",
          "pressure": "Useful, invasive warnings through devices; survival-first routing.",
          "location": "Phones, speakers, screens",
          "flags": [
            "Witness"
          ],
          "notes": "Can isolate the chamber signal if the cell gives enough live data."
        }
      ],
      "caseFile": {
        "nextClue": "The church window reflects one more person than arrived. First route: arrival window. Alternate: stained glass wrong weather.",
        "nextPressureBeat": "Tick 2 — Church Notices: phones glitch or the building repeats a phrase. Next denial while reflected costs 1 Stability unless another Operator corroborates.",
        "templates": "NP-001 scaffold: handler/needlepoints/veilcorp-intake.json",
        "notes": "Emergency scaffolding, not a stable agency. Six contacts, one church, one mirror chamber. Teach: you were already in the story before anyone invited you."
      },
      "handlerNotes": {
        "clueList": "CLUE 1 — VeilCorp is emergency scaffolding.\nRoute A: Alex/Shade contradiction during contact playback.\nRoute B: corrupted intake notice.\nFailure: Shade acts without social consent; anchor glitches on next reflective surface.\n\nCLUE 2 — Church reflects refused selves.\nRoute A: extra arrival reflection.\nRoute B: hymn book crossed-out names.\nFailure: one Operator addressed by wrong name until they speak truth aloud.\n\nCLUE 3 — Prior cult opened the chamber.\nRoute A: altar eye symbol and residue.\nRoute B: backward floorboard phrase.\nFailure: cult symbol marks a phone photo.\n\nCLUE 4 — Basement opens after truth, lie, Frequency use, or blood-glass contact.\nRoute A: altar mirror reaction.\nRoute B: locked basement door after grit disturbed.\nFailure: chamber opens while someone isolated; first basement roll TN 15.\n\nCLUE 5 — Witness offers cleaner identities.\nRoute A: altar mirror alternate choices.\nRoute B: wrong reflection on phones or rainwater.\nFailure: offered self protects one cost, then asks to stay.\n\nCLUE 6 — Intake completes after the cell survives together.\nRoute A: Alex/Shade cut-in.\nRoute B: group stabilization with protected truthful speech.\nFailure: VeilCorp knows more than Operators chose to share.",
        "consequenceQueue": "FAILURE — Puzzle-only approach: reflections offer corrections; investigation without emotional admission costs 1 Stability or ticks Clock.\n\nFAILURE — Cleaner self accepted: Operator gains Advantage once, then Disadvantage on identity rolls until refused aloud while witnessed.\n\nFAILURE — Split before basement: isolated Operator faces Witness first at TN 15 without Ally support.",
        "residueLog": "CLOCK 1 Wrong Reflection — extra person or delayed gesture; identity rolls TN 15.\nCLOCK 2 Church Notices — denial while reflected costs 1 Stability without corroboration.\nCLOCK 3 Contact Pressure — Shade/Alex cut-in; clue gained, privacy risk.\nCLOCK 4 Basement Opens — first solo descent has Disadvantage.\nCLOCK 5 First Misfire — reflection walks, wrong name, or Alex says too soon early.\nCLOCK 6 Witness Wakes — break, bind, speak, or flee.\n\nRESOLUTION OPTIONS: Break altar mirror (fast, scar risk). Bind with Anchors (safer, Shade learns details). Speak truths (weakens Witness). Flee (valid; site stays active)."
      },
      "unresolvedConsequences": "Choose campaign track after debrief: containment, paranoia, or haunted.",
      "activeNeedlepoint": {
        "id": "veilcorp-intake",
        "scaffold": "handler/needlepoints/veilcorp-intake.json",
        "attention_states": {
          "unseen": {
            "residue": "Reflections lag half a beat on peripheral glass.",
            "follows_home": "One mirror briefly shows a harmless wrong expression.",
            "consequence": "No penalty; warning only."
          },
          "noticed": {
            "residue": "The arrival window shows one extra reflection.",
            "follows_home": "One avoided truth flickers in stained glass or phone glass.",
            "consequence": "First lie while reflected has Disadvantage unless another Operator corroborates."
          },
          "focused": {
            "residue": "The mirror knows one refused self and tests it on screens.",
            "follows_home": "A reflection scar may persist on one personal object.",
            "consequence": "Once per scene, the Witness may ask which version of yourself you wish had chosen differently."
          },
          "fixed": {
            "residue": "The Unfinished Witness targets one Operator through mirrors and devices.",
            "follows_home": "Comments or wrong names arrive near meaningful identity lies.",
            "consequence": "Refusal costs 1 Stability or ticks the Clock."
          },
          "exposed": {
            "residue": "The Witness escapes the church boundary.",
            "follows_home": "A mundane mirror, feed, or record becomes a new access point.",
            "consequence": "Aftermath hook becomes a future Needlepoint seed."
          }
        },
        "clock_attention_consequences": [
          {
            "clock_min": 0,
            "clock_max": 1,
            "attention": "unseen",
            "consequence": "Minor reflection lag only. No penalty; warning only."
          },
          {
            "clock_min": 0,
            "clock_max": 2,
            "attention": "noticed",
            "consequence": "First lie while reflected has Disadvantage unless another Operator corroborates."
          },
          {
            "clock_min": 2,
            "clock_max": 3,
            "attention": "noticed",
            "consequence": "Shade or Alex cut-in lands; denial while reflected costs 1 Stability without corroboration."
          },
          {
            "clock_min": 3,
            "clock_max": 4,
            "attention": "focused",
            "consequence": "Basement route opens; solo descent has Disadvantage until the cell reunites."
          },
          {
            "clock_min": 4,
            "clock_max": 5,
            "attention": "focused",
            "consequence": "First misfire is live: reflection walks, wrong name, or Alex says too soon early."
          },
          {
            "clock_min": 5,
            "clock_max": 6,
            "attention": "fixed",
            "consequence": "The Witness targets one Operator through mirrors. Refusal costs 1 Stability or ticks the Clock."
          },
          {
            "clock_min": 6,
            "clock_max": 6,
            "attention": "focused",
            "consequence": "Break, bind, speak, or flee before the chamber chooses a cleaner self."
          },
          {
            "clock_min": 6,
            "clock_max": 6,
            "attention": "exposed",
            "consequence": "The Witness escapes the church boundary. Aftermath becomes campaign continuity."
          }
        ],
        "player_view": {
          "safe_consequence": ""
        }
      }
    }
  },
  {
    "id": "viridian-house",
    "name": "Viridian House",
    "data": {
      "session": {
        "title": "Needlepoint 001a",
        "caseTitle": "Viridian House",
        "location": "Viridian House apartment building, Kansas City",
        "safeSceneLabel": "Mara Venn missing; observation indexing withheld speech"
      },
      "sceneState": {
        "current": "Echoed"
      },
      "primaryClock": {
        "name": "Audience Before Clock",
        "segments": 6,
        "current": 0,
        "ticksWhen": "Operators stall, lie under observation, feed the audience, split someone off, force the site, or treat Mara as content.",
        "midpointEvent": "Tick 3 — Elevator Listens: repeats an avoided sentence. Next elevator action TN 15 unless someone speaks honestly while recorded. Every screen may show a cruel-but-useful comment.",
        "fullClockEvent": "Tick 6 — Performed Self Stabilizes: Audience Before offers one Operator a clean role and asks others to confirm. Refuse as a group or Mara/that Operator may be replaced by the easier version.",
        "stabilizer": "One honest sentence spoken while another Operator protects the speaker from audience pressure."
      },
      "entityLoop": {
        "Need": "The moment before confession, when someone edits themselves to survive being seen.",
        "Lure": "Comments that understand too much, footage from impossible angles, and doors offering easier selves.",
        "Pressure": "It predicts, captions, and redirects behavior until Operators start performing for it.",
        "Gift": "It reveals what someone is hiding, including the clue they cannot admit they already noticed.",
        "Violence": "It assigns roles, locks people inside performed selves, and turns audience attention into environmental force.",
        "Exit": "Honest speech under observation, protected by the group, directed toward Mara or the room instead of the audience."
      },
      "activeEntity": {
        "name": "The Audience Before",
        "kind": "Entity",
        "sceneState": "Echoed",
        "notes": "First-contact observation entity. Do not add Monster Manual stats for Needlepoint 001a. Exit requires honest speech under observation, protected by the group."
      },
      "attention": {
        "current": "Focused"
      },
      "roomAnswer": {
        "object": "Lobby camera, elevator panel, comment thread, ring light, apartment door",
        "emotionalInput": "Shame, performance, concealment, audience pressure, confession",
        "consequence": "The building captions the choice before anyone admits it."
      },
      "npcs": [
        {
          "id": "npc-len",
          "name": "Len Orra",
          "role": "Building manager",
          "pressure": "Exhausted, defensive; hiding an eviction notice he never filed.",
          "location": "Lobby / manager office",
          "flags": [
            "Witness"
          ],
          "notes": "Insists there is no thirteenth floor, then says 'not anymore.'"
        },
        {
          "id": "npc-saffi",
          "name": "Saffi Dell",
          "role": "Neighbor / Mara's friend",
          "pressure": "Trying to act annoyed instead of scared; holds true memory of Mara.",
          "location": "Floor 11-12 / Saffi's apartment",
          "flags": [
            "Ally"
          ],
          "notes": "Use for grounding Mara and alternate clue routes."
        },
        {
          "id": "npc-mara",
          "name": "Mara Venn",
          "role": "Missing streamer",
          "pressure": "Built her channel on telling strangers the truth, then refused her own.",
          "location": "Apartment 13F when reachable",
          "flags": [
            "Missing"
          ],
          "notes": "Alive on Floor 13 if reached; do not treat as content."
        }
      ],
      "caseFile": {
        "nextClue": "Mara entered the elevator at 2:13 a.m.; her reflection stayed behind. First route: security office timestamp.",
        "nextPressureBeat": "Tick 1 — Camera Notices: one device tracks the quietest Operator. Next roll under observation has Disadvantage unless another Operator shields them.",
        "templates": "NP-001A scaffold: handler/needlepoints/viridian-house.json",
        "notes": "Recover Mara from a twelve-floor building indexing withheld speech. Use at least three core clues before 13F. Do not block progress; use worse positioning instead."
      },
      "handlerNotes": {
        "clueList": "CLUE 1 — Mara entered elevator at 2:13 a.m.\nRoute A: security timestamp.\nRoute B: Saffi remembers lobby chime.\nFailure: footage loops an Operator into frame; Audience can target them through screens once.\n\nCLUE 2 — Mara's reflection stayed behind.\nRoute A: camera still.\nRoute B: lobby mirror / elevator door.\nFailure: reflection mouths private phrase; next social roll under observation TN 15.\n\nCLUE 3 — Floor 13 after lie under observation.\nRoute A: manager denial + elevator camera test.\nRoute B: future comment thread in security office.\nFailure: opens Tick 3 not 4; only two core clues; one exit locked; first Floor 13 action TN 15.\n\nCLUE 4 — Apartment 13F collects performed selves.\nRoute A: Floor 13 hallway doors.\nRoute B: Mara's stream archive in Saffi's apartment.\nFailure: easier self behind a door; accepting ticks Clock.\n\nCLUE 5 — Mara reached by honest speech while recorded.\nRoute A: Saffi's memory.\nRoute B: live comment prompt.\nFailure: audience asks first; answerer loses 1 Stability unless shielded.",
        "consequenceQueue": "FAILURE — Mara treated as content: off-camera rescue has Disadvantage; Mara stops responding off-camera.\n\nFAILURE — Constant lies under observation: Floor 13 opens Tick 3; two clues only; TN 15 first action; one exit locked.\n\nFAILURE — Fed comment thread for spectacle: Tick 5 begins on Floor 13 arrival; one Operator starts with Disadvantage on non-performance rolls.",
        "residueLog": "CLOCK 1 Camera Notices — tracks quietest Operator; Disadvantage unless shielded.\nCLOCK 2 Comment Predicts — thread names next choice; mask learned if prediction hits.\nCLOCK 3 Elevator Listens — TN 15 elevator action unless honest speech while recorded.\nCLOCK 4 Floor 13 Opens — worse positioning if fewer than three clues.\nCLOCK 5 Audience Edits — performed self grants Advantage once, Disadvantage until refused.\nCLOCK 6 Performed Self Stabilizes — group must refuse role or lose Mara/Operator to easier version.\n\nFIRST 20 MIN: Lobby camera before exposition. Camera answers first lie or honest admission. Stabilizer before escalate: step outside, name one normal thing, correct the lie."
      },
      "unresolvedConsequences": "Aftermath hooks: elevator hesitates after 12; BEFORE_YOU_SAY_IT comments; Mara remembers unsaid speech; Saffi's tomorrow-dated draft.",
      "activeNeedlepoint": {
        "id": "viridian-house",
        "scaffold": "handler/needlepoints/viridian-house.json",
        "attention_states": {
          "unseen": {
            "residue": "A comment arrives before anyone types it.",
            "follows_home": "One phone briefly predicts harmless phrasing.",
            "consequence": "No penalty; warning only."
          },
          "noticed": {
            "residue": "Screens hesitate before showing the Operator's reflection.",
            "follows_home": "One useful lie is predicted.",
            "consequence": "First lie under observation has Disadvantage unless shielded."
          },
          "focused": {
            "residue": "The comment thread knows an Operator's preferred mask.",
            "follows_home": "BEFORE_YOU_SAY_IT may persist after the case.",
            "consequence": "Once per scene, screen pressure can ask what the Operator is performing."
          },
          "fixed": {
            "residue": "The Audience targets one Operator through devices.",
            "follows_home": "Their phone receives comments near meaningful lies.",
            "consequence": "Refusal costs 1 Stability or ticks the Clock."
          },
          "exposed": {
            "residue": "The Audience escapes the site boundary.",
            "follows_home": "Public feed, witness, or device becomes a new access point.",
            "consequence": "Aftermath hook becomes a future Needlepoint seed."
          }
        },
        "clock_attention_consequences": [
          {
            "clock_min": 0,
            "clock_max": 1,
            "attention": "unseen",
            "consequence": "Minor tell only. No penalty; warning only."
          },
          {
            "clock_min": 0,
            "clock_max": 2,
            "attention": "noticed",
            "consequence": "First lie under observation has Disadvantage unless shielded."
          },
          {
            "clock_min": 1,
            "clock_max": 3,
            "attention": "noticed",
            "consequence": "Lobby camera tracks the quietest Operator; first lie under observation has Disadvantage unless shielded."
          },
          {
            "clock_min": 2,
            "clock_max": 4,
            "attention": "focused",
            "consequence": "Once per scene, screen pressure may ask what the Operator is performing."
          },
          {
            "clock_min": 4,
            "clock_max": 5,
            "attention": "focused",
            "consequence": "Once per scene, the Audience may target an Operator through any active screen. Refusal costs 1 Stability or ticks the Clock."
          },
          {
            "clock_min": 4,
            "clock_max": 6,
            "attention": "fixed",
            "consequence": "The Audience targets one Operator through devices. Refusal costs 1 Stability or ticks the Clock."
          },
          {
            "clock_min": 6,
            "clock_max": 6,
            "attention": "focused",
            "consequence": "Audience Before offers a clean role; group refusal required or Mara or an Operator may be replaced."
          },
          {
            "clock_min": 6,
            "clock_max": 6,
            "attention": "exposed",
            "consequence": "The Audience escapes the site boundary. Aftermath becomes a future Needlepoint seed."
          }
        ],
        "player_view": {
          "safe_consequence": ""
        }
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
    activeNeedlepoint: {
      id: "",
      scaffold: "",
      attention_states: {},
      clock_attention_consequences: [],
      player_view: {
        safe_consequence: ""
      }
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

  function normalizeTemplateCatalog(value) {
    if (!Array.isArray(value)) return null;
    const catalog = value
      .filter((template) => template && typeof template === "object" && template.id && template.name)
      .map((template) => ({
        id: safeString(template.id, 80),
        name: safeString(template.name, 120),
        data: template.data && typeof template.data === "object" ? template.data : {}
      }));
    return catalog.length ? catalog : null;
  }

  async function loadTemplates() {
    try {
      const response = await fetch(templateCatalogUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Template catalog unavailable.");
      const catalog = normalizeTemplateCatalog(await response.json());
      if (!catalog) throw new Error("Template catalog empty.");
      templates.splice(0, templates.length, ...catalog);
      return templates;
    } catch (error) {
      return templates;
    }
  }

  function safeString(value, max = 3000) {
    return String(value || "").trim().slice(0, max);
  }

  function safeNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
  }

  function normalizeAttentionKey(value) {
    const raw = safeString(value, 40).toLowerCase();
    const key = attentionAliases[raw] || raw;
    return attentionStates.some((item) => item.toLowerCase() === key) ? key : "unseen";
  }

  function normalizeAttentionDisplay(value) {
    const key = normalizeAttentionKey(value);
    return attentionStates.find((item) => item.toLowerCase() === key) || "Unseen";
  }

  function normalizeAttentionStatesTable(value) {
    const source = value && typeof value === "object" ? value : {};
    return Object.keys(source).reduce((table, key) => {
      const row = source[key];
      if (!row || typeof row !== "object") return table;
      table[normalizeAttentionKey(key)] = {
        residue: safeString(row.residue, 180),
        follows_home: safeString(row.follows_home || row.followsHome, 180),
        consequence: safeString(row.consequence, 220)
      };
      return table;
    }, {});
  }

  function normalizeClockAttentionConsequences(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 24).map((entry) => {
      const clockMin = safeNumber(entry.clock_min, 0, 12, 0);
      return {
        clock_min: clockMin,
        clock_max: safeNumber(entry.clock_max, 0, 12, clockMin),
        attention: normalizeAttentionKey(entry.attention),
        consequence: safeString(entry.consequence, 220)
      };
    }).filter((entry) => entry.consequence);
  }

  function normalizeActiveNeedlepoint(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: safeString(source.id, 80),
      scaffold: safeString(source.scaffold, 180),
      attention_states: normalizeAttentionStatesTable(source.attention_states),
      clock_attention_consequences: normalizeClockAttentionConsequences(source.clock_attention_consequences),
      player_view: {
        safe_consequence: safeString(source.player_view?.safe_consequence, 220)
      }
    };
  }

  function resolveClockAttentionConsequence(state) {
    const needlepoint = state.activeNeedlepoint;
    if (!needlepoint?.id || !needlepoint.clock_attention_consequences.length) return "";
    const clock = safeNumber(state.primaryClock.current, 0, 12, 0);
    const attention = normalizeAttentionKey(state.attention.current);
    const matches = needlepoint.clock_attention_consequences.filter((entry) => (
      clock >= entry.clock_min
      && clock <= entry.clock_max
      && entry.attention === attention
    ));
    if (!matches.length) return "";
    matches.sort((left, right) => (
      (right.clock_min - left.clock_min)
      || ((left.clock_max - left.clock_min) - (right.clock_max - right.clock_min))
    ));
    return matches[0].consequence;
  }

  function applyNeedlepointAttention(state) {
    const needlepoint = state.activeNeedlepoint;
    if (!needlepoint?.id || !Object.keys(needlepoint.attention_states).length) return state;
    const key = normalizeAttentionKey(state.attention.current);
    const row = needlepoint.attention_states[key];
    if (row) {
      state.attention.residue = row.residue;
      state.attention.followsHome = row.follows_home;
    }
    const matrixConsequence = resolveClockAttentionConsequence(state);
    if (matrixConsequence) {
      state.sceneState.primaryConsequence = matrixConsequence;
    } else if (row?.consequence) {
      state.sceneState.primaryConsequence = row.consequence;
    }
    return state;
  }

  function playerViewPayload(state) {
    const needlepoint = state.activeNeedlepoint || {};
    const safeConsequence = safeString(needlepoint.player_view?.safe_consequence, 220);
    return {
      title: safeString(state.session.safeSceneLabel || state.session.caseTitle, 160) || "Scene active.",
      scene: safeString(state.session.safeSceneLabel, 160) || "Scene active.",
      consequence: safeConsequence,
      instruction: "Stay real. Stay alive."
    };
  }

  function hasActiveNeedlepoint(state) {
    return Boolean(state.activeNeedlepoint && state.activeNeedlepoint.id);
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
    const next = {
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
        current: normalizeAttentionDisplay(merged.attention.current),
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
      activeNeedlepoint: normalizeActiveNeedlepoint(merged.activeNeedlepoint),
      handlerNotes: normalizeTextObject(merged.handlerNotes, defaultState.handlerNotes),
      canonTerminology
    };
    return hasActiveNeedlepoint(next) ? applyNeedlepointAttention(next) : next;
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
      attention: normalizeAttentionDisplay(item.attention),
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
    presentationCatalog: catalogs.presentationCatalog || {},
    backgroundCatalog: catalogs.backgroundCatalog || {},
    presentationOptions: catalogs.presentationOptions || (() => []),
    backgroundOptions: catalogs.backgroundOptions || (() => []),
    presentationEntry: catalogs.presentationEntry || ((key) => ({ label: safeString(key), displayName: safeString(key), access: "unknown" })),
    backgroundEntry: catalogs.backgroundEntry || ((key) => ({ label: safeString(key), displayName: safeString(key), access: "unknown" })),
    titleCaseKey: catalogs.titleCaseKey || ((key) => safeString(key).toLowerCase().replace(/(^|_)([a-z])/g, (match, prefix, char) => `${prefix ? " " : ""}${char.toUpperCase()}`)),
    templates,
    loadTemplates,
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
    clockWarning,
    applyNeedlepointAttention,
    playerViewPayload,
    hasActiveNeedlepoint,
    normalizeAttentionDisplay
  };
}());
