(function () {
  const storageKey = "veildaemon.handlerDashboard.v1";
  const fieldEditStorageKey = "veildaemon.handlerFieldEdit.v1";

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

  const attentionStates = ["Unseen", "Noticed", "Focused", "Targeted", "Exposed"];
  const clueIntegrityStates = ["unknown", "discovered", "secured", "archived", "contaminated", "rerouted"];
  const clueIntegrityActions = [
    { id: "discover", label: "Discover Clue", states: ["unknown"] },
    { id: "secure", label: "Secure Clue", states: ["discovered", "contaminated", "rerouted"] },
    { id: "archive", label: "Archive Clue", states: ["secured", "contaminated", "rerouted"] },
    { id: "contaminate", label: "Contaminate Clue", states: ["discovered"] },
    { id: "reroute", label: "Reroute Clue", states: ["discovered"] }
  ];
  const attentionAliases = {
    observed: "noticed",
    fixed: "targeted",
    witnessed: "targeted",
    marked: "targeted",
    pursued: "targeted",
    mythic: "exposed",
    claimed: "exposed"
  };
  const sceneStateCardKeys = ["stable", "echoed", "recursive", "breached", "collapse"];
  const attentionAftermathCardKeys = ["unseen", "noticed", "focused", "targeted", "exposed"];
  const deterministicLiveCards = {
    "custom-campaign": {
      scene_state_cards: {
        stable: "The site is mostly ordinary. One impossible detail is visible, but the room has not committed.",
        echoed: "The site repeats the central pressure through an object, witness, route, or sensory detail.",
        recursive: "The pressure begins feeding on itself. Choices, routes, records, or behavior loop back.",
        breached: "The local law becomes active. The site can now change what the Operators can safely do.",
        collapse: "The local law overrides ordinary reality until the Operators remove leverage or escape."
      },
      attention_aftermath_cards: {
        unseen: "The pressure has not identified the Operators as relevant.",
        noticed: "The pressure has a weak read on the Operators through one clue, action, or witness.",
        focused: "The pressure can aim consequences through the current scene.",
        targeted: "The pressure can choose a specific Operator, Anchor, relationship, or record.",
        exposed: "The Operators have become part of the case ecology. Residue or follow-home consequences are likely."
      }
    },
    "viridian-house": {
      scene_state_cards: {
        stable: "The lobby still pretends to be ordinary. Cameras watch, but have not answered yet.",
        echoed: "The building repeats avoided truth through cameras, comments, reflections, and elevator timing.",
        recursive: "Routes begin looping through performed selves. The elevator offers 13 when someone edits themselves.",
        breached: "The Audience can caption choices before Operators make them. Apartment 13F becomes reachable.",
        collapse: "The performed self becomes easier for the building to preserve than the living person."
      },
      attention_aftermath_cards: {
        unseen: "The Audience has not selected a subject yet. Observation remains ambient.",
        noticed: "A camera, comment, or reflection has found hesitation and begun tracking it.",
        focused: "The Audience can predict one deflection, lie, or performed response.",
        targeted: "The Audience has attached to a specific Operator, memory, or relationship.",
        exposed: "The Operator is becoming content. Their performed self may follow them home."
      }
    },
    "veilcorp-intake": {
      scene_state_cards: {
        stable: "The site is quiet enough to dismiss. The message, church, or reflection feels wrong but survivable.",
        echoed: "The Intake signal repeats through devices, glass, timestamps, or small impossible confirmations.",
        recursive: "The ruined church begins answering observation. Exits, reflections, and messages refer back to the Operators.",
        breached: "The system knows they noticed. Classification pressure becomes active and the site starts making choices.",
        collapse: "The Intake file becomes more stable than the Operators' own account of why they came."
      },
      attention_aftermath_cards: {
        unseen: "The signal has not confirmed relevance. The Operators are still background noise.",
        noticed: "The system has matched one anomaly, name, device, or reflection to the Operators.",
        focused: "The Intake can now route pressure through the group's devices, Anchors, or witnessed fear.",
        targeted: "A specific Operator has become legible to the signal, church, or reflection drift.",
        exposed: "A standing channel may remain open after exit unless routed, severed, or witnessed safely."
      }
    }
  };
  const loopFields = ["Need", "Lure", "Pressure", "Gift", "Violence", "Exit"];
  const npcFlags = ["Ally", "Witness", "Threat", "Missing", "Compromised", "Anchor"];
  const anchorNpcStates = [
    { id: "with-operators", label: "With Operators", guidance: "Attention +1 on loud/risky/exposed action." },
    { id: "hidden", label: "Hidden", guidance: "Zone +1 when time passes or hiding is stressed." },
    { id: "separated", label: "Separated", guidance: "Attention +1 or Zone +1." },
    { id: "left-behind", label: "Left Behind", guidance: "Aftermath +1 immediately." },
    { id: "taken", label: "Taken", guidance: "Attention +1 and Aftermath +1, or start rescue clock." }
  ];
  const anchorNpcStateIds = anchorNpcStates.map((entry) => entry.id);
  const collapseBreakTypes = ["Body", "Name", "Identity", "Role", "Memory", "Relationship", "Evidence", "Time", "Signal", "Room", "Record", "Location", "History"];
  const rewriteOverwriteTypes = ["Name", "Role", "Memory", "Relationship", "Record", "Body", "Location", "History"];
  const windDownMoves = [
    {
      id: "protect-anchor-npc",
      label: "Protect Anchor NPC",
      target: "attention",
      effects: { attention_delta: -1 },
      guidance: "Use when Operators move, shield, hide, or emotionally stabilize a scenario-critical NPC."
    },
    {
      id: "speak-truth-protected",
      label: "Speak Truth While Protected",
      target: "both",
      effects: {
        primary_delta: -1,
        attention_delta: -1,
        scene_state_soften: 1,
        next_pressure_beat: "Protected truth lowers the room's leverage and dulls the site's read."
      },
      guidance: "Use when honest speech directly weakens the site/entity and another Operator protects the speaker."
    },
    {
      id: "cut-observation",
      label: "Cut Observation",
      target: "attention",
      effects: { attention_delta: -1 },
      guidance: "Use when cameras, mirrors, feeds, witnesses, or tracking vectors are blocked."
    },
    {
      id: "restore-connection",
      label: "Restore Connection",
      target: "both",
      effects: {
        attention_delta: -1,
        scene_state_soften: 1,
        consequence: "Isolation pressure breaks; the room loses its clean angle."
      },
      guidance: "Use when separated Operators reunite, someone is witnessed safely, or isolation pressure is broken."
    },
    {
      id: "secure-route",
      label: "Secure Route / Safe Room",
      target: "primary",
      effects: { primary_delta: -1 },
      guidance: "Use when the physical zone loses access: door barred, hiding place secured, exit mapped, lure interrupted."
    },
    {
      id: "recover-clean-clue",
      label: "Soften Case Pressure",
      target: "case",
      effects: {
        case_delta: -1,
        attention_delta: -1,
        next_pressure_beat: "Truth preserved; the site loses leverage over this clue.",
        case_record: "Truth preserved without feeding the site."
      },
      guidance: "Counterplay shorthand when Operators preserve truth without feeding the site. For full clue state, use Live or Clues → Clue Integrity → Secure Clue."
    },
    {
      id: "use-clock-stabilizer",
      label: "Use Clock Stabilizer",
      target: "primary",
      effects: {
        primary_delta: -2,
        next_pressure_beat: "Clock stabilizer holds; the room stops climbing for a beat."
      },
      guidance: "Use when they do the specific stabilizer written on the clock."
    },
    {
      id: "contain-resolve",
      label: "Contain / Resolve Source",
      target: "both",
      effects: {
        primary_resolve: true,
        attention_delta: -1,
        scene_state_soften: 2,
        consequence: "Source contained; the room loses the entity's personal read."
      },
      guidance: "Use only when the threat's active access is actually ended."
    }
  ];
  const sceneStateRank = sceneStates.reduce((table, item, index) => {
    table[item.name] = index;
    return table;
  }, {});

  const genericTableTriggers = [
    {
      id: "lie-under-observation",
      label: "Operator lies under observation",
      hint: "Lie, deflection, or performance while watched.",
      effects: { clock_target: "both", clock_delta: 1, attention_delta: 1, scene_state_min: "Echoed" }
    },
    {
      id: "operators-split-up",
      label: "Operators split up",
      hint: "Isolation before the group can shield.",
      effects: {
        clock_target: "attention",
        attention_delta: 1,
        scene_state_min: "Echoed",
        next_pressure_beat: "Attention targets the isolated Operator; site offers a private lure."
      }
    },
    {
      id: "npc-as-content",
      label: "Operators treat NPC as evidence/content",
      hint: "Person becomes proof, spectacle, or leverage.",
      effects: { clock_target: "attention", attention_delta: 1, scene_state_min: "Recursive" }
    },
    {
      id: "protect-honest-speech",
      label: "Operators protect honest speech",
      hint: "Shielded truth under observation.",
      effects: { clock_target: "attention", attention_delta: -1, clock_tick: false, scene_state_set: "Stable" }
    },
    {
      id: "force-without-vulnerability",
      label: "Operators force the site without vulnerability",
      hint: "Push through without admitting cost.",
      effects: {
        clock_target: "zone",
        clock_delta: 1,
        scene_state_min: "Breached",
        next_pressure_beat: "Misfire risk rises; next forced action has Disadvantage."
      }
    },
    {
      id: "recover-clue-clean",
      label: "Surface core clue (table shorthand)",
      hint: "Stages next clue without clock tick. Track truth state in Clue Integrity.",
      effects: { clock_target: "case", clock_tick: false, reveal_next_clue: true }
    },
    {
      id: "fail-clue-roll",
      label: "Operators fail clue roll",
      hint: "Clue still arrives, but the site collects a cost.",
      effects: {
        clock_target: "both",
        clock_delta: 1,
        attention_delta: 1,
        reveal_next_clue: true,
        next_pressure_beat: "Clue gained, but Clock and Attention cost fires."
      }
    },
    {
      id: "cut-broadcast",
      label: "Operators cut broadcast / cover lens",
      hint: "Break the feed or step out of frame together.",
      effects: {
        clock_target: "attention",
        attention_delta: -1,
        clock_tick: false,
        consequence: "Attention suppressed; one containment option unlocks."
      }
    },
    {
      id: "misfire-disturbs-site",
      label: "Misfire disturbs site",
      hint: "The place gets worse before anyone notices why.",
      effects: {
        clock_target: "zone",
        clock_delta: 1,
        scene_state_min: "Echoed",
        next_pressure_beat: "Primary Clock (site-owned): the place worsens; show the room answering first."
      }
    },
    {
      id: "misfire-exposes-operator",
      label: "Misfire exposes Operator",
      hint: "The cost lands on a person, not the room.",
      effects: {
        clock_target: "attention",
        attention_delta: 1,
        scene_state_min: "Echoed",
        next_pressure_beat: "Attention Clock: something has a cleaner read on one Operator."
      }
    },
    {
      id: "loud-supernatural-action",
      label: "Loud supernatural action",
      hint: "Loud, intimate, mirrored, bloody, or directly impossible.",
      effects: {
        clock_target: "both",
        clock_delta: 1,
        attention_delta: 1,
        scene_state_min: "Recursive",
        next_pressure_beat: "Both clocks are eligible; prefer the immediate threat if applying manually."
      }
    },
    {
      id: "mirrored-contact",
      label: "Mirrored contact",
      hint: "Reflection, camera, glass, screen, or duplicated self.",
      effects: {
        clock_target: "both",
        clock_delta: 1,
        attention_min: "Noticed",
        scene_state_min: "Echoed"
      }
    },
    {
      id: "blood-exposure",
      label: "Blood exposure",
      hint: "Blood, injury, or body proof gives the site a handle.",
      effects: {
        clock_target: "both",
        clock_delta: 1,
        attention_delta: 1,
        scene_state_min: "Breached",
        consequence: "The site can now answer through the body, not just the room."
      }
    },
    {
      id: "repeated-behavior",
      label: "Repeated behavior",
      hint: "The table repeats a tactic the site can learn.",
      effects: {
        clock_target: "case",
        clock_delta: 1,
        scene_state_min: "Recursive",
        next_pressure_beat: "Case Clock: the mission pattern is now predictable."
      }
    },
    {
      id: "evidence-decay",
      label: "Evidence decay",
      hint: "Clue, witness, recording, or route becomes less reliable.",
      effects: {
        clock_target: "case",
        clock_delta: 1,
        reveal_next_clue: true,
        next_pressure_beat: "Case Clock: evidence changes before it can be stabilized."
      }
    },
    {
      id: "witness-risk",
      label: "Witness risk",
      hint: "Bystander, NPC, or protected person becomes exposed.",
      effects: {
        clock_target: "attention",
        attention_delta: 1,
        scene_state_min: "Recursive",
        npc_pressure_note: "Witness exposure escalates; protect or lose leverage."
      }
    },
    {
      id: "external-forces-arrive",
      label: "External forces arrive",
      hint: "Police, media, family, cult, landlord, or rival pressure enters.",
      effects: {
        clock_target: "case",
        clock_delta: 1,
        next_pressure_beat: "Case Clock: outside pressure changes the mission conditions."
      }
    },
    {
      id: "severe-misfire-natural-3",
      label: "Severe misfire / natural 3",
      hint: "Tick both, or tick the immediate clock twice.",
      effects: {
        clock_target: "both",
        clock_delta: 2,
        attention_delta: 1,
        scene_state_min: "Breached",
        consequence: "Severe misfire: tick both, or let the immediate threat advance twice."
      }
    }
  ];
  const templateCatalogUrl = new URL("templates.json", document.currentScript && document.currentScript.src || window.location.href).href;
  const catalogs = window.CradlepointCatalogs || {};

  const templates = [
  {
    "id": "custom-campaign",
    "name": "Custom Campaign",
    "data": {
      "session": {
        "title": "Custom Campaign",
        "caseTitle": "Custom Campaign",
        "location": "",
        "safeSceneLabel": ""
      },
      "primaryClock": {
        "name": "Case Clock",
        "segments": 6,
        "current": 0,
        "ticksWhen": "Operators stall, split up, ignore the stabilizer, feed the site, fail under pressure, or let Attention isolate someone.",
        "midpointEvent": "Tick 3 - The site reveals what it wants and changes the next safe choice.",
        "fullClockEvent": "Tick 6 - Collapse is live. Force a choice, name the pressure, or leave with a cost.",
        "stabilizer": "A concrete action that reduces the site's leverage and can be repeated at the table."
      },
      "sceneState": {
        "current": "Stable"
      },
      "entityLoop": {
        "Need": "",
        "Lure": "",
        "Pressure": "",
        "Gift": "",
        "Violence": "",
        "Exit": ""
      },
      "activeEntity": {
        "name": "",
        "kind": "Zone",
        "sceneState": "Stable",
        "notes": ""
      },
      "attention": {
        "current": "Unseen"
      },
      "roomAnswer": {
        "object": "",
        "emotionalInput": "",
        "consequence": ""
      },
      "npcs": [],
      "caseFile": {
        "nextClue": "",
        "nextPressureBeat": "",
        "templates": "Custom campaign",
        "notes": ""
      },
      "handlerNotes": {
        "clueList": "",
        "consequenceQueue": "",
        "residueLog": ""
      },
      "unresolvedConsequences": "",
      "activeNeedlepoint": {
        "id": "custom-campaign",
        "scaffold": "",
        "attention_states": {
          "unseen": {
            "residue": "Minor tell only.",
            "follows_home": "",
            "consequence": "No penalty; warning only."
          },
          "noticed": {
            "residue": "The site shows it has noticed one Operator.",
            "follows_home": "",
            "consequence": "First unsafe action under pressure has Disadvantage unless shielded."
          },
          "focused": {
            "residue": "The site learns a usable pattern.",
            "follows_home": "",
            "consequence": "Once per scene, the site can pressure the learned pattern."
          },
          "targeted": {
            "residue": "The site targets one Operator through its active vector.",
            "follows_home": "",
            "consequence": "Refusal costs 1 Stability or ticks the Clock."
          },
          "exposed": {
            "residue": "The site escapes its first boundary.",
            "follows_home": "",
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
            "clock_min": 2,
            "clock_max": 3,
            "attention": "noticed",
            "consequence": "Pressure becomes visible; next denial or unsafe solo action costs position."
          },
          {
            "clock_min": 4,
            "clock_max": 5,
            "attention": "focused",
            "consequence": "The site can target an Operator through the active pressure vector."
          },
          {
            "clock_min": 6,
            "clock_max": 6,
            "attention": "targeted",
            "consequence": "Collapse choice is live; resolve, stabilize, or carry aftermath."
          }
        ],
        "table_triggers": [
          {
            "id": "deny-pressure",
            "label": "Operators deny visible pressure",
            "hint": "They ignore the thing the table can already see.",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_min": "Noticed",
              "scene_state_min": "Echoed"
            }
          },
          {
            "id": "split-up",
            "label": "Operators split up",
            "effects": {
              "clock_target": "attention",
              "attention_delta": 1,
              "scene_state_min": "Echoed",
              "next_pressure_beat": "Isolation lure activates; separated Operator faces the pressure first."
            }
          },
          {
            "id": "protected-truth",
            "label": "Operators protect honest speech",
            "effects": {
              "clock_target": "attention",
              "attention_delta": -1,
              "clock_tick": false,
              "scene_state_set": "Stable"
            }
          },
          {
            "id": "force-site",
            "label": "Operators force the site without leverage",
            "effects": {
              "clock_target": "zone",
              "clock_delta": 1,
              "scene_state_min": "Breached",
              "next_pressure_beat": "The site answers force with worse positioning."
            }
          },
          {
            "id": "clue-fail",
            "label": "Operators fail clue roll",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_delta": 1,
              "reveal_next_clue": true,
              "next_pressure_beat": "Clue gained at a cost; next pressure beat advances."
            }
          },
          {
            "id": "misfire-disturbs-site",
            "label": "Misfire disturbs site",
            "effects": {
              "clock_target": "zone",
              "clock_delta": 1,
              "scene_state_min": "Echoed",
              "next_pressure_beat": "Primary Clock: the site answers before the Operators understand why."
            }
          },
          {
            "id": "misfire-exposes-operator",
            "label": "Misfire exposes Operator",
            "effects": {
              "clock_target": "attention",
              "attention_delta": 1,
              "scene_state_min": "Echoed",
              "next_pressure_beat": "Attention Clock: the pressure has a cleaner read on one Operator."
            }
          },
          {
            "id": "evidence-decay",
            "label": "Evidence decay",
            "effects": {
              "clock_target": "case",
              "clock_delta": 1,
              "reveal_next_clue": true,
              "next_pressure_beat": "Case Clock: evidence changes before the cell can secure it."
            }
          }
        ],
        "collapse_staging": {
          "default_break_type": "Room",
          "broken_law": "The site starts answering pressure before the Operators choose how to respond.",
          "operator_choice": "Name the pressure, stabilize the room, protect the exposed person, or leave with cost.",
          "exit_condition": "The group removes the site's immediate leverage and leaves one concrete Anchor intact.",
          "by_target": {
            "Room": {
              "broken_law": "The site accepts pressure as architecture.",
              "operator_choice": "Leave, anchor the room, bargain with it, or let the place stabilize around the threat.",
              "exit_condition": "The group exits together after naming what the room is preserving."
            },
            "Identity": {
              "broken_law": "The site's classification becomes easier to believe than the person's own self-description.",
              "operator_choice": "Accept the label, dispute it, or define the self before the room does.",
              "exit_condition": "The person states who they are through an Anchor, and another Operator confirms it."
            },
            "Memory": {
              "broken_law": "The edited memory becomes easier to replay than the original.",
              "operator_choice": "Trust a witness, trust evidence, trust the site, or reconstruct the event together.",
              "exit_condition": "A witness names the original truth and pays the cost."
            },
            "Body": {
              "broken_law": "The body reacts to the pressure as if the consequence has already arrived.",
              "operator_choice": "Ground physically, flee, follow the pressure, or let panic route the next action.",
              "exit_condition": "A mundane body action proves the scene has not fully taken control."
            },
            "Relationship": {
              "broken_law": "Isolation increases predation; connection becomes survival infrastructure.",
              "operator_choice": "Separate, protect someone, test trust, or let the site keep everyone isolated.",
              "exit_condition": "One Operator chooses another person's safety over private suspicion."
            },
            "Evidence": {
              "broken_law": "Proof becomes bait when it is studied alone.",
              "operator_choice": "Document it, duplicate it, hide it, share it, or keep staring.",
              "exit_condition": "Evidence is copied, witnessed, and removed from solitary attention."
            },
            "Time": {
              "broken_law": "The next pressure beat behaves like an appointment instead of a consequence.",
              "operator_choice": "Arrive, delay, break sequence, or answer the next prompt.",
              "exit_condition": "The group acts before the recurrence or anchors the moment with mundane timekeeping."
            },
            "Signal": {
              "broken_law": "Unknown signals become known once they know you back.",
              "operator_choice": "Answer, block, trace, corrupt, or refuse the signal.",
              "exit_condition": "The signal is cut off, routed safely, or made safe by group witness."
            }
          }
        },
        "rewrite_staging": {
          "default_overwrite_type": "Name",
          "rewrite_law": "The accepted name becomes easier to remember than the original.",
          "lock_in_risk": "If no one contradicts it before the next pressure beat, records and devices start using the accepted version.",
          "counteraction_window": "A witness says the original name and accepts being seen.",
          "by_target": {
            "Name": {
              "rewrite_law": "The accepted name becomes easier to remember than the original.",
              "lock_in_risk": "If no one contradicts it before the next pressure beat, records and devices start using the accepted version.",
              "counteraction_window": "A witness says the original name and accepts being seen."
            },
            "Role": {
              "rewrite_law": "The useful role becomes the stable identity.",
              "lock_in_risk": "The character gains advantage while performing it, but loses access to unsupported selfhood.",
              "counteraction_window": "Someone asks for the person, not the performance."
            },
            "Record": {
              "rewrite_law": "The institutional version becomes enforceable reality.",
              "lock_in_risk": "Systems begin agreeing with the lie.",
              "counteraction_window": "Duplicate, reconcile, or publicly contradict the record with cost."
            },
            "Location": {
              "rewrite_law": "The accepted place becomes the reachable place.",
              "lock_in_risk": "Routes begin returning to the pressure site.",
              "counteraction_window": "Mark a mundane route and leave by verified architecture."
            },
            "History": {
              "rewrite_law": "The backstory becomes cleaner than the truth.",
              "lock_in_risk": "NPCs remember the simplified version.",
              "counteraction_window": "Someone preserves the messy version without improving it."
            },
            "Memory": {
              "rewrite_law": "The repeated version overwrites the witnessed version.",
              "lock_in_risk": "Future clues point to the edited event unless duplicated proof exists.",
              "counteraction_window": "Three independent records or witnesses reconstruct the true event."
            },
            "Body": {
              "rewrite_law": "The body adapts to the version most safely witnessed.",
              "lock_in_risk": "The physical tell persists after exit.",
              "counteraction_window": "Grounding, touch, medical proof, or self-naming interrupts the shift."
            },
            "Relationship": {
              "rewrite_law": "Public attachment overwrites private bond.",
              "lock_in_risk": "The site can speak through the relationship.",
              "counteraction_window": "The bond-holder names a private truth the site cannot use."
            },
            "Signal": {
              "rewrite_law": "The signal becomes a standing channel.",
              "lock_in_risk": "The site, entity, or unstable system can reach the Operator again.",
              "counteraction_window": "Cut unknown channels or require group confirmation before response."
            }
          }
        },
        "player_view": {
          "safe_consequence": "The room responds when choices become honest, hidden, isolated, or performed."
        }
      }
    }
  },
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
        "midpointEvent": "Tick 3 â€” Shade interrupts with a useful but invasive warning while Alex tries to soften it. Operators gain one clear clue; Shade records emotional tells unless Alex overrides.",
        "fullClockEvent": "Tick 6 â€” The Unfinished Witness acts directly and offers someone a cleaner self. Force break, bind, speak, or flee before the chamber chooses for them.",
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
        "nextPressureBeat": "Tick 2 â€” Church Notices: phones glitch or the building repeats a phrase. Next denial while reflected costs 1 Stability unless another Operator corroborates.",
        "templates": "NP-001 scaffold: handler/needlepoints/veilcorp-intake.json",
        "notes": "Emergency scaffolding, not a stable agency. Six contacts, one church, one mirror chamber. Teach: you were already in the story before anyone invited you."
      },
      "handlerNotes": {
        "clueList": "CLUE 1 â€” VeilCorp is emergency scaffolding.\nRoute A: Alex/Shade contradiction during contact playback.\nRoute B: corrupted intake notice.\nFailure: Shade acts without social consent; anchor glitches on next reflective surface.\n\nCLUE 2 â€” Church reflects refused selves.\nRoute A: extra arrival reflection.\nRoute B: hymn book crossed-out names.\nFailure: one Operator addressed by wrong name until they speak truth aloud.\n\nCLUE 3 â€” Prior cult opened the chamber.\nRoute A: altar eye symbol and residue.\nRoute B: backward floorboard phrase.\nFailure: cult symbol marks a phone photo.\n\nCLUE 4 â€” Basement opens after truth, lie, Frequency use, or blood-glass contact.\nRoute A: altar mirror reaction.\nRoute B: locked basement door after grit disturbed.\nFailure: chamber opens while someone isolated; first basement roll TN 15.\n\nCLUE 5 â€” Witness offers cleaner identities.\nRoute A: altar mirror alternate choices.\nRoute B: wrong reflection on phones or rainwater.\nFailure: offered self protects one cost, then asks to stay.\n\nCLUE 6 â€” Intake completes after the cell survives together.\nRoute A: Alex/Shade cut-in.\nRoute B: group stabilization with protected truthful speech.\nFailure: VeilCorp knows more than Operators chose to share.",
        "consequenceQueue": "FAILURE â€” Puzzle-only approach: reflections offer corrections; investigation without emotional admission costs 1 Stability or ticks Clock.\n\nFAILURE â€” Cleaner self accepted: Operator gains Advantage once, then Disadvantage on identity rolls until refused aloud while witnessed.\n\nFAILURE â€” Split before basement: isolated Operator faces Witness first at TN 15 without Ally support.",
        "residueLog": "CLOCK 1 Wrong Reflection â€” extra person or delayed gesture; identity rolls TN 15.\nCLOCK 2 Church Notices â€” denial while reflected costs 1 Stability without corroboration.\nCLOCK 3 Contact Pressure â€” Shade/Alex cut-in; clue gained, privacy risk.\nCLOCK 4 Basement Opens â€” first solo descent has Disadvantage.\nCLOCK 5 First Misfire â€” reflection walks, wrong name, or Alex says too soon early.\nCLOCK 6 Witness Wakes â€” break, bind, speak, or flee.\n\nRESOLUTION OPTIONS: Break altar mirror (fast, scar risk). Bind with Anchors (safer, Shade learns details). Speak truths (weakens Witness). Flee (valid; site stays active)."
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
          "targeted": {
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
            "attention": "Targeted",
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
        "table_triggers": [
          {
            "id": "lie-reflected",
            "label": "Operator lies while reflected",
            "hint": "Denial under mirror, glass, or screen.",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_min": "Noticed",
              "scene_state_min": "Echoed"
            }
          },
          {
            "id": "split-up",
            "label": "Operators split up",
            "effects": {
              "clock_target": "attention",
              "attention_delta": 1,
              "scene_state_min": "Echoed",
              "next_pressure_beat": "Isolation lure activates; separated Operator faces the Witness first."
            }
          },
          {
            "id": "protected-truth",
            "label": "Operators protect honest speech",
            "effects": {
              "clock_target": "attention",
              "attention_delta": -1,
              "clock_tick": false,
              "scene_state_set": "Stable"
            }
          },
          {
            "id": "force-chamber",
            "label": "Operators force the chamber without vulnerability",
            "effects": {
              "clock_target": "zone",
              "clock_delta": 1,
              "scene_state_min": "Breached",
              "next_pressure_beat": "Misfire risk live; next forced move has Disadvantage."
            }
          },
          {
            "id": "clue-fail",
            "label": "Operators fail clue roll",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_delta": 1,
              "reveal_next_clue": true,
              "next_pressure_beat": "Clue gained at a cost; reflection or wrong name may answer first."
            }
          },
          {
            "id": "misfire-disturbs-site",
            "label": "Misfire disturbs site",
            "hint": "The church gets worse before anyone notices why.",
            "effects": {
              "clock_target": "zone",
              "clock_delta": 1,
              "scene_state_min": "Echoed",
              "next_pressure_beat": "Primary Clock (site-owned): the church answers through reflection, weather, or architecture."
            }
          },
          {
            "id": "misfire-exposes-operator",
            "label": "Misfire exposes Operator",
            "hint": "The reflection learns a person instead of a room.",
            "effects": {
              "clock_target": "attention",
              "attention_delta": 1,
              "scene_state_min": "Echoed",
              "next_pressure_beat": "Attention Clock: the Witness has a cleaner read on one Operator."
            }
          },
          {
            "id": "mirrored-contact",
            "label": "Mirrored contact",
            "hint": "Mirror, phone glass, rainwater, or stained glass answers back.",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_min": "Noticed",
              "scene_state_min": "Echoed"
            }
          },
          {
            "id": "evidence-decay",
            "label": "Evidence decay",
            "hint": "Photo, reflection, clue, or route changes before it is stabilized.",
            "effects": {
              "clock_target": "case",
              "clock_delta": 1,
              "reveal_next_clue": true,
              "next_pressure_beat": "Case Clock: evidence changes before the cell can secure it."
            }
          },
          {
            "id": "severe-misfire-natural-3",
            "label": "Severe misfire / natural 3",
            "hint": "Tick both, or tick the immediate clock twice.",
            "effects": {
              "clock_target": "both",
              "clock_delta": 2,
              "attention_delta": 1,
              "scene_state_min": "Breached",
              "consequence": "Severe misfire: tick both, or let the immediate threat advance twice."
            }
          }
        ],
        "collapse_staging": {
          "default_break_type": "Room",
          "broken_law": "The church answers observation before anyone admits what they saw.",
          "operator_choice": "Cover the reflection, step outside, name the ordinary detail, or keep looking and accept Attention.",
          "exit_condition": "The group breaks line of sight, names what changed, and leaves together with one Anchor intact.",
          "by_target": {
            "Room": {
              "broken_law": "The church answers observation before anyone admits what they saw.",
              "operator_choice": "Cover the reflection, step outside, name the ordinary detail, or keep looking and accept Attention.",
              "exit_condition": "The group breaks line of sight, names what changed, and leaves together with one Anchor intact."
            },
            "Identity": {
              "broken_law": "The system classification becomes easier to believe than the Operator's own self-description.",
              "operator_choice": "Accept the intake label, dispute it, or define yourself before the room does.",
              "exit_condition": "The Operator states who they are through an Anchor, and another Operator confirms it."
            },
            "Memory": {
              "broken_law": "The remembered warning becomes less stable than the message that should not exist.",
              "operator_choice": "Trust the impossible notification, trust personal memory, or compare witness accounts.",
              "exit_condition": "Two Operators reconstruct the same event without relying on the device."
            },
            "Body": {
              "broken_law": "The body reacts to the signal as if danger has already arrived.",
              "operator_choice": "Ground physically, flee, follow the signal, or let panic route the next action.",
              "exit_condition": "A mundane body action proves the scene has not fully taken control: breathing, pain, cold, touch, water, food, or movement."
            },
            "Relationship": {
              "broken_law": "Isolation increases predation; connection becomes survival infrastructure.",
              "operator_choice": "Separate, protect a stranger, test trust, or let the system keep everyone isolated.",
              "exit_condition": "One Operator chooses another person's safety over private suspicion."
            },
            "Evidence": {
              "broken_law": "Proof becomes bait when it is studied alone.",
              "operator_choice": "Document it, duplicate it, hide it, share it, or keep staring.",
              "exit_condition": "Evidence is copied, witnessed, and removed from solitary attention."
            },
            "Time": {
              "broken_law": "The 2:13 timestamp behaves like an appointment instead of a record.",
              "operator_choice": "Arrive, delay, break sequence, or answer the next impossible prompt.",
              "exit_condition": "The group acts before the next 2:13 recurrence or anchors the moment with mundane timekeeping."
            },
            "Signal": {
              "broken_law": "Unknown signals become known once they know you back.",
              "operator_choice": "Answer, block, trace, corrupt, or refuse the signal.",
              "exit_condition": "The signal is routed through VeilCorp Intake, cut off, or made safe by group witness."
            }
          }
        },
        "rewrite_staging": {
          "default_overwrite_type": "Name",
          "rewrite_law": "The intake label begins replacing the Operator's ordinary name.",
          "lock_in_risk": "If no one contradicts it before the next pressure beat, records and devices start using the label.",
          "counteraction_window": "Another Operator speaks the real name while the named Operator holds an Anchor.",
          "by_target": {
            "Name": {
              "rewrite_law": "The intake label begins replacing the Operator's ordinary name.",
              "lock_in_risk": "If no one contradicts it before the next pressure beat, records and devices start using the label.",
              "counteraction_window": "Another Operator speaks the real name while the named Operator holds an Anchor."
            },
            "Role": {
              "rewrite_law": "Operator becomes a function before it becomes a choice.",
              "lock_in_risk": "The room treats hesitation as consent to recruitment.",
              "counteraction_window": "The character chooses why they are here in their own words."
            },
            "Record": {
              "rewrite_law": "The impossible message becomes the official version.",
              "lock_in_risk": "Screens, logs, timestamps, and contact records begin agreeing with the intake file.",
              "counteraction_window": "Duplicate the record, compare devices, and preserve one contradiction."
            },
            "Location": {
              "rewrite_law": "The ruined church becomes easier to find than to leave.",
              "lock_in_risk": "Routes begin returning to the chamber until the Intake completes.",
              "counteraction_window": "Mark a mundane exit and leave as a group before the next reflection shift."
            },
            "History": {
              "rewrite_law": "The system backfills reasons the Operator was always going to answer.",
              "lock_in_risk": "Past anomalies start arranging themselves into a recruitment narrative.",
              "counteraction_window": "Name one ordinary reason you could still refuse."
            },
            "Memory": {
              "rewrite_law": "The message remembers the Operator more clearly than the Operator remembers the event.",
              "lock_in_risk": "Personal memory defers to the intake file.",
              "counteraction_window": "Reconstruct the event aloud with another witness before checking the device again."
            },
            "Body": {
              "rewrite_law": "The body learns the signal as a threat response.",
              "lock_in_risk": "Future notifications trigger panic, dissociation, hunger, freeze, or resonance leakage.",
              "counteraction_window": "Ground through the Anchor and complete one mundane recovery action."
            },
            "Relationship": {
              "rewrite_law": "The first cell forms around shared exposure instead of trust.",
              "lock_in_risk": "Operators become linked by fear, suspicion, or surveillance instead of choice.",
              "counteraction_window": "One Operator offers help without demanding disclosure."
            },
            "Signal": {
              "rewrite_law": "The signal becomes a standing channel.",
              "lock_in_risk": "The site, entity, cult residue, or Intake shell can reach the Operator again.",
              "counteraction_window": "Route through Shade, cut unknown channels, or require group confirmation before response."
            }
          }
        },
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
        "current": "Stable"
      },
      "primaryClock": {
        "name": "Audience Before Clock",
        "segments": 6,
        "current": 0,
        "ticksWhen": "Operators stall, lie under observation, feed the audience, split someone off, force the site, or treat Mara as content.",
        "midpointEvent": "Tick 3 â€” Elevator Listens: repeats an avoided sentence. Next elevator action TN 15 unless someone speaks honestly while recorded. Every screen may show a cruel-but-useful comment.",
        "fullClockEvent": "Tick 6 â€” Performed Self Stabilizes: Audience Before offers one Operator a clean role and asks others to confirm. Refuse as a group or Mara/that Operator may be replaced by the easier version.",
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
        "sceneState": "Stable",
        "notes": "First-contact observation entity. Do not add Monster Manual stats for Needlepoint 001a. Exit requires honest speech under observation, protected by the group."
      },
      "attention": {
        "current": "Noticed"
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
          "role": "Witness / Pressure NPC",
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
          "role": "Memory Anchor",
          "pressure": "Trying to act annoyed instead of scared; holds true memory of Mara.",
          "location": "Floor 11-12 / Saffi's apartment",
          "flags": [
            "Ally",
            "Anchor"
          ],
          "notes": "Active Anchor NPC for the table. Protect her memory of Mara; do not leave her as bait.",
          "anchor": {
            "enabled": true,
            "label": "Memory Anchor",
            "state": "with-operators"
          }
        },
        {
          "id": "npc-mara",
          "name": "Mara Venn",
          "role": "Missing / Locus-bound streamer",
          "pressure": "Built her channel on telling strangers the truth, then refused her own.",
          "location": "Apartment 13F when reachable",
          "flags": [
            "Missing"
          ],
          "notes": "Recovery Anchor until Act 4. Alive on Floor 13 if reached; ground her as a person, not content."
        }
      ],
      "caseFile": {
        "nextClue": "Mara entered the elevator at 2:13 a.m.; her reflection stayed behind. First route: security office timestamp.",
        "nextPressureBeat": "Tick 1 â€” Camera Notices: one device tracks the quietest Operator. Next roll under observation has Disadvantage unless another Operator shields them.",
        "templates": "NP-001A scaffold: handler/needlepoints/viridian-house.json",
        "notes": "Recover Mara from a twelve-floor building indexing withheld speech. Use at least three core clues before 13F. Do not block progress; use worse positioning instead."
      },
      "handlerNotes": {
        "clueList": "CLUE 1 â€” Mara entered elevator at 2:13 a.m.\nRoute A: security timestamp.\nRoute B: Saffi remembers lobby chime.\nFailure: footage loops an Operator into frame; Audience can target them through screens once.\n\nCLUE 2 â€” Mara's reflection stayed behind.\nRoute A: camera still.\nRoute B: lobby mirror / elevator door.\nFailure: reflection mouths private phrase; next social roll under observation TN 15.\n\nCLUE 3 â€” Floor 13 after lie under observation.\nRoute A: manager denial + elevator camera test.\nRoute B: future comment thread in security office.\nFailure: opens Tick 3 not 4; only two core clues; one exit locked; first Floor 13 action TN 15.\n\nCLUE 4 â€” Apartment 13F collects performed selves.\nRoute A: Floor 13 hallway doors.\nRoute B: Mara's stream archive in Saffi's apartment.\nFailure: easier self behind a door; accepting ticks Clock.\n\nCLUE 5 â€” Mara reached by honest speech while recorded.\nRoute A: Saffi's memory.\nRoute B: live comment prompt.\nFailure: audience asks first; answerer loses 1 Stability unless shielded.",
        "consequenceQueue": "FAILURE â€” Mara treated as content: off-camera rescue has Disadvantage; Mara stops responding off-camera.\n\nFAILURE â€” Constant lies under observation: Floor 13 opens Tick 3; two clues only; TN 15 first action; one exit locked.\n\nFAILURE â€” Fed comment thread for spectacle: Tick 5 begins on Floor 13 arrival; one Operator starts with Disadvantage on non-performance rolls.",
        "residueLog": "CLOCK 1 Camera Notices â€” tracks quietest Operator; Disadvantage unless shielded.\nCLOCK 2 Comment Predicts â€” thread names next choice; mask learned if prediction hits.\nCLOCK 3 Elevator Listens â€” TN 15 elevator action unless honest speech while recorded.\nCLOCK 4 Floor 13 Opens â€” worse positioning if fewer than three clues.\nCLOCK 5 Audience Edits â€” performed self grants Advantage once, Disadvantage until refused.\nCLOCK 6 Performed Self Stabilizes â€” group must refuse role or lose Mara/Operator to easier version.\n\nFIRST 20 MIN: Lobby camera before exposition. Camera answers first lie or honest admission. Stabilizer before escalate: step outside, name one normal thing, correct the lie."
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
          "targeted": {
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
            "attention": "targeted",
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
        "table_triggers": [
          {
            "id": "lie-lobby-camera",
            "label": "Lie under lobby camera",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_min": "Noticed",
              "scene_state_min": "Echoed",
              "consequence": "Camera tracks the quietest Operator; next lie under observation has Disadvantage."
            }
          },
          {
            "id": "lie-elevator",
            "label": "Lie inside elevator",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_min": "Focused",
              "scene_state_min": "Recursive",
              "consequence": "Floor 13 can open early; next elevator action TN 15 unless honest speech while recorded."
            }
          },
          {
            "id": "leave-saffi-alone",
            "label": "Leave Saffi alone",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_set": "Targeted",
              "scene_state_min": "Breached",
              "next_pressure_beat": "Saffi becomes the next lure.",
              "npc_name_match": "Saffi",
              "npc_pressure_note": "Targeted by observation; next lure vector."
            }
          },
          {
            "id": "truth-protected",
            "label": "Speak truth while protected",
            "effects": {
              "clock_target": "attention",
              "attention_delta": -1,
              "clock_tick": false,
              "scene_state_set": "Echoed",
              "consequence": "One door unlocks or next consequence softens."
            }
          },
          {
            "id": "mara-as-content",
            "label": "Operators treat Mara as content",
            "effects": {
              "clock_target": "attention",
              "attention_delta": 1,
              "scene_state_min": "Recursive",
              "next_pressure_beat": "Mara stops responding off-camera; rescue attempts have Disadvantage."
            }
          },
          {
            "id": "misfire-disturbs-site",
            "label": "Misfire disturbs site",
            "hint": "Viridian House gets worse before the feed reacts.",
            "effects": {
              "clock_target": "zone",
              "clock_delta": 1,
              "scene_state_min": "Echoed",
              "next_pressure_beat": "Primary Clock (site-owned): the building answers through cameras, doors, or elevator timing."
            }
          },
          {
            "id": "misfire-exposes-operator",
            "label": "Misfire exposes Operator",
            "hint": "The audience learns a person instead of a location.",
            "effects": {
              "clock_target": "attention",
              "attention_delta": 1,
              "scene_state_min": "Echoed",
              "next_pressure_beat": "Attention Clock: the feed now has a cleaner read on one Operator."
            }
          },
          {
            "id": "mirrored-contact",
            "label": "Mirrored contact",
            "hint": "Camera lens, phone screen, elevator panel, or performed self answers back.",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "attention_min": "Noticed",
              "scene_state_min": "Echoed"
            }
          },
          {
            "id": "evidence-decay",
            "label": "Evidence decay",
            "hint": "Clip, comment, memory, witness, or route changes before it is secured.",
            "effects": {
              "clock_target": "case",
              "clock_delta": 1,
              "reveal_next_clue": true,
              "next_pressure_beat": "Case Clock: evidence changes before the Operators can secure it."
            }
          },
          {
            "id": "severe-misfire-natural-3",
            "label": "Severe misfire / natural 3",
            "hint": "Tick both, or tick the immediate clock twice.",
            "effects": {
              "clock_target": "both",
              "clock_delta": 2,
              "attention_delta": 1,
              "scene_state_min": "Breached",
              "collapse_ready": true,
              "consequence": "Severe misfire: tick both, or let the immediate threat advance twice."
            }
          },
          {
            "id": "accept-curated-self",
            "label": "Accept curated / easier self",
            "hint": "Operator accepts the performed role or curated version on Floor 13.",
            "effects": {
              "clock_target": "both",
              "clock_delta": 1,
              "scene_state_min": "Breached",
              "accept_false_self": true,
              "rewrite_ready": true,
              "consequence": "The accepted self stabilizes; overwrite may lock in unless contradicted."
            }
          }
        ],
        "collapse_staging": {
          "default_break_type": "Body",
          "broken_law": "The performed body becomes easier to maintain than the living one.",
          "operator_choice": "Refuse the curated self, ground Mara as a person, protect Saffi's true memory, or flee Floor 13 together.",
          "exit_condition": "Honest speech under observation, protected by the group, directed toward Mara or the room instead of the audience.",
          "by_target": {
            "Body": {
              "broken_law": "The performed body becomes easier to maintain than the living one.",
              "operator_choice": "Refuse the curated self, ground Mara as a person, protect Saffi's true memory, or flee Floor 13 together.",
              "exit_condition": "Honest speech under observation, protected by the group, directed toward Mara or the room instead of the audience."
            },
            "Name": {
              "broken_law": "The audience's name for someone becomes easier to answer to than their own.",
              "operator_choice": "Speak the real name, reject the captioned name, or let the label stabilize.",
              "exit_condition": "Someone who knows the person speaks the real name while another Operator shields them from attention."
            },
            "Role": {
              "broken_law": "The assigned role becomes more stable than the person.",
              "operator_choice": "Refuse the useful role, redefine it, or embody it and accept cost.",
              "exit_condition": "Someone interacts with the person instead of the function: friend, witness, victim, streamer, monster, handler, content."
            },
            "Memory": {
              "broken_law": "The edited memory becomes easier to replay than the original.",
              "operator_choice": "Trust Saffi, trust evidence, trust the feed, or reconstruct the event together.",
              "exit_condition": "A witness names the original truth and pays the cost."
            },
            "Relationship": {
              "broken_law": "The audience relationship replaces the private bond.",
              "operator_choice": "Protect Saffi/Mara as people, or perform care for the feed.",
              "exit_condition": "A private truth is spoken while watched, without making it content."
            },
            "Evidence": {
              "broken_law": "The useful proof becomes more real than the true proof.",
              "operator_choice": "Preserve the ugly evidence, duplicate it, or let the feed curate it.",
              "exit_condition": "Secure a clue before the feed edits it."
            },
            "Time": {
              "broken_law": "Broadcast delay becomes causality.",
              "operator_choice": "Act before the caption resolves, wait for the audience, or break sequence.",
              "exit_condition": "Interrupt the predicted action with a protected honest choice."
            },
            "Signal": {
              "broken_law": "The feed becomes the room's nervous system.",
              "operator_choice": "Cut the broadcast, speak into it, corrupt it, or let it choose.",
              "exit_condition": "Broadcast route is severed, redirected toward the room, or made private."
            },
            "Room": {
              "broken_law": "The site accepts the performance as architecture.",
              "operator_choice": "Leave, anchor the room, bargain with it, or let 13F stabilize.",
              "exit_condition": "The group exits together after naming what the room is preserving."
            }
          }
        },
        "rewrite_staging": {
          "default_overwrite_type": "Name",
          "rewrite_law": "The accepted name becomes easier to remember than the original.",
          "lock_in_risk": "If no one contradicts it before the next pressure beat, update the affected record.",
          "counteraction_window": "A witness says the original name and accepts being seen.",
          "by_target": {
            "Name": {
              "rewrite_law": "The accepted name becomes easier to remember than the original.",
              "lock_in_risk": "If no one contradicts it before the next pressure beat, update the affected record.",
              "counteraction_window": "A witness says the original name and accepts being seen."
            },
            "Role": {
              "rewrite_law": "The useful role becomes the stable identity.",
              "lock_in_risk": "The character gains advantage while performing it, but loses access to unsupported selfhood.",
              "counteraction_window": "Someone asks for the person, not the performance."
            },
            "Memory": {
              "rewrite_law": "The repeated version overwrites the witnessed version.",
              "lock_in_risk": "Future clues point to the edited event unless duplicated proof exists.",
              "counteraction_window": "Three independent records or witnesses reconstruct the true event."
            },
            "Relationship": {
              "rewrite_law": "Public attachment overwrites private bond.",
              "lock_in_risk": "The audience can speak through the relationship.",
              "counteraction_window": "The bond-holder names a private truth the audience cannot use."
            },
            "Record": {
              "rewrite_law": "The institutional version becomes enforceable reality.",
              "lock_in_risk": "Police, landlord, platform, or file systems begin agreeing with the lie.",
              "counteraction_window": "Duplicate, reconcile, or publicly contradict the record with cost."
            },
            "Body": {
              "rewrite_law": "The body adapts to the version most safely witnessed.",
              "lock_in_risk": "The physical tell persists after exit.",
              "counteraction_window": "Grounding, touch, medical proof, or self-naming interrupts the shift."
            },
            "Location": {
              "rewrite_law": "The accepted place becomes the reachable place.",
              "lock_in_risk": "Floor 13 becomes easier to find than Floor 12.",
              "counteraction_window": "Mark a mundane route and leave by verified architecture."
            },
            "History": {
              "rewrite_law": "The backstory becomes cleaner than the truth.",
              "lock_in_risk": "NPCs remember the simplified version.",
              "counteraction_window": "Someone preserves the messy version without improving it."
            }
          }
        },
        "player_view": {
          "safe_consequence": "The room responds visibly when watched choices become honest, hidden, or performed."
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
      sceneConsequence: "",
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
      followsHome: "",
      aftermathConsequence: ""
    },
    residueLog: [],
    clueIntegrity: {
      activeClueId: "",
      clues: []
    },
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
      table_triggers: [],
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
    collapse: {
      ready: false,
      active: false,
      trigger: "",
      breakType: "",
      brokenLaw: "",
      operatorChoice: "",
      exitCondition: "",
      readyLatch: false,
      exitFailedLatch: false,
      fieldsEdited: false
    },
    rewrite: {
      ready: false,
      active: false,
      trigger: "",
      overwriteType: "",
      rewriteLaw: "",
      lockInRisk: "",
      counteractionWindow: "",
      readyLatch: false,
      acceptFalseSelfLatch: false
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
        consequence: safeString(entry.consequence, 500)
      };
    }).filter((entry) => entry.consequence);
  }

  function normalizeSceneStateKey(value) {
    const key = safeString(value, 40).toLowerCase();
    return sceneStateCardKeys.includes(key) ? key : "stable";
  }

  function normalizeDeterministicCardTable(value, allowedKeys) {
    const source = value && typeof value === "object" ? value : {};
    const keys = Array.isArray(allowedKeys) && allowedKeys.length ? allowedKeys : Object.keys(source);
    return keys.reduce((table, key) => {
      const normalizedKey = safeString(key, 40).toLowerCase();
      const card = safeString(source[key] ?? source[normalizedKey], 500);
      if (card) table[normalizedKey] = card;
      return table;
    }, {});
  }

  function missingDeterministicCardMessage(caseId, panel, stateKey) {
    return `NO DETERMINISTIC CARD FOUND: ${caseId}.${panel}.${stateKey}`;
  }

  function normalizeTriggerEffects(value) {
    const effects = value && typeof value === "object" ? value : {};
    return {
      clock_target: normalizeClockTarget(effects.clock_target),
      clock_delta: safeNumber(effects.clock_delta, -6, 6, 0),
      clock_tick: effects.clock_tick !== false,
      attention_delta: safeNumber(effects.attention_delta, -4, 4, 0),
      attention_set: effects.attention_set ? normalizeAttentionDisplay(effects.attention_set) : "",
      attention_min: effects.attention_min ? normalizeAttentionDisplay(effects.attention_min) : "",
      scene_state_min: effects.scene_state_min
        ? normalizeChoice(effects.scene_state_min, sceneStates.map((item) => item.name), "")
        : "",
      scene_state_set: effects.scene_state_set
        ? normalizeChoice(effects.scene_state_set, sceneStates.map((item) => item.name), "")
        : "",
      consequence: safeString(effects.consequence, 220),
      next_pressure_beat: safeString(effects.next_pressure_beat, 500),
      next_clue: safeString(effects.next_clue, 500),
      reveal_next_clue: Boolean(effects.reveal_next_clue),
      npc_pressure_note: safeString(effects.npc_pressure_note, 220),
      npc_name_match: safeString(effects.npc_name_match, 80),
      collapse_ready: Boolean(effects.collapse_ready),
      rewrite_ready: Boolean(effects.rewrite_ready),
      accept_false_self: Boolean(effects.accept_false_self)
    };
  }

  function normalizeClockTarget(value) {
    const target = safeString(value, 40).toLowerCase();
    return ["zone", "attention", "case", "both"].includes(target) ? target : "";
  }

  function normalizeTableTriggers(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 12).map((trigger, index) => ({
      id: safeString(trigger.id, 80) || `trigger-${index + 1}`,
      label: safeString(trigger.label, 140),
      hint: safeString(trigger.hint, 220),
      effects: normalizeTriggerEffects(trigger.effects)
    })).filter((trigger) => trigger.label);
  }

  function normalizeCollapseBreakTypeEntry(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      broken_law: safeString(source.broken_law, 500),
      operator_choice: safeString(source.operator_choice, 500),
      exit_condition: safeString(source.exit_condition, 500)
    };
  }

  function normalizeCollapseByBreakType(value) {
    const source = value && typeof value === "object" ? value : {};
    return collapseBreakTypes.reduce((table, breakType) => {
      const entry = source[breakType] || (breakType === "Role" ? source.Identity : null);
      if (!entry || typeof entry !== "object") return table;
      const normalized = normalizeCollapseBreakTypeEntry(entry);
      if (normalized.broken_law || normalized.operator_choice || normalized.exit_condition) {
        table[breakType] = normalized;
      }
      return table;
    }, {});
  }

  function normalizeCollapseStaging(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      default_break_type: normalizeChoice(source.default_break_type, collapseBreakTypes, ""),
      broken_law: safeString(source.broken_law, 500),
      operator_choice: safeString(source.operator_choice, 500),
      exit_condition: safeString(source.exit_condition, 500),
      by_target: normalizeCollapseByBreakType(source.by_target),
      by_break_type: normalizeCollapseByBreakType(source.by_break_type)
    };
  }

  function normalizeRewriteTargetEntry(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      rewrite_law: safeString(source.rewrite_law, 500),
      lock_in_risk: safeString(source.lock_in_risk, 500),
      counteraction_window: safeString(source.counteraction_window, 500)
    };
  }

  function normalizeRewriteByTarget(value) {
    const source = value && typeof value === "object" ? value : {};
    return rewriteOverwriteTypes.reduce((table, target) => {
      const entry = source[target];
      if (!entry || typeof entry !== "object") return table;
      const normalized = normalizeRewriteTargetEntry(entry);
      if (normalized.rewrite_law || normalized.lock_in_risk || normalized.counteraction_window) {
        table[target] = normalized;
      }
      return table;
    }, {});
  }

  function normalizeRewriteStaging(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      default_overwrite_type: normalizeChoice(source.default_overwrite_type, rewriteOverwriteTypes, ""),
      rewrite_law: safeString(source.rewrite_law, 500),
      lock_in_risk: safeString(source.lock_in_risk, 500),
      counteraction_window: safeString(source.counteraction_window, 500),
      by_target: normalizeRewriteByTarget(source.by_target)
    };
  }

  function needlepointScaffoldUrl(scaffold) {
    const clean = safeString(scaffold, 180).replace(/^\.?\//, "");
    if (!clean) return "";
    if (clean.startsWith("handler/")) return `/${clean}`;
    return `/handler/${clean}`;
  }

  function normalizeClueEffectMap(value) {
    const source = value && typeof value === "object" ? value : {};
    return clueIntegrityActions.reduce((map, action) => {
      if (source[action.id] && typeof source[action.id] === "object") {
        map[action.id] = normalizeTriggerEffects(source[action.id]);
      }
      return map;
    }, {});
  }

  function normalizeCoreClueDefinitions(value) {
    const list = Array.isArray(value) ? value : [];
    return list.slice(0, 7).map((item, index) => {
      const source = item && typeof item === "object" ? item : {};
      return {
        id: safeString(source.id, 40) || `core-clue-${index + 1}`,
        clue: safeString(source.clue, 260),
        firstRoute: safeString(source.first_route || source.firstRoute, 260),
        alternateRoute: safeString(source.alternate_route || source.alternateRoute, 260),
        failureCost: safeString(source.failure_cost || source.failureCost, 320),
        tableEffect: safeString(source.table_effect || source.tableEffect, 320),
        effects: normalizeClueEffectMap(source.effects)
      };
    }).filter((item) => item.clue);
  }

  function getDefaultClueActionEffects(actionId, clue) {
    if (actionId === "discover") {
      return {
        attention_min: "Noticed",
        scene_state_min: "Echoed"
      };
    }
    if (actionId === "secure") {
      return {
        attention_delta: -1,
        next_pressure_beat: "Truth preserved; the site loses leverage over this clue."
      };
    }
    if (actionId === "archive") {
      return {
        clock_tick: false
      };
    }
    if (actionId === "contaminate") {
      return {
        clock_target: "both",
        clock_delta: 1,
        attention_delta: 1,
        scene_state_min: "Echoed",
        next_pressure_beat: clue.failureCost || clue.tableEffect || "Clue gained at a cost."
      };
    }
    if (actionId === "reroute") {
      return {
        clock_target: "case",
        clock_delta: 1,
        next_pressure_beat: "Truth remains available, but the route changes."
      };
    }
    return {};
  }

  function resolveClueEffects(clue, actionId) {
    const defaults = getDefaultClueActionEffects(actionId, clue);
    const custom = clue.effects?.[actionId] || {};
    return normalizeTriggerEffects({ ...defaults, ...custom });
  }

  function captureRuntimeBefore(state) {
    return {
      primaryClock: state.primaryClock.current,
      attention: state.attention.current,
      scene: state.sceneState.current,
      caseClock: state.secondaryClock.current,
      nextPressure: state.caseFile.nextPressureBeat,
      nextClue: state.caseFile.nextClue,
      consequence: state.sceneState.sceneConsequence || state.sceneState.primaryConsequence
    };
  }

  function applyTriggerEffectsToDraft(draft, effects, before = {}) {
    const normalized = normalizeTriggerEffects(effects);
    const changes = [];
    const primaryBefore = before.primaryClock ?? draft.primaryClock.current;
    const attentionBefore = before.attention ?? draft.attention.current;
    const sceneBefore = before.scene ?? draft.sceneState.current;
    const caseBefore = before.caseClock ?? draft.secondaryClock.current;
    const pressureBefore = before.nextPressure ?? draft.caseFile.nextPressureBeat;
    const consequenceBefore = before.consequence ?? draft.sceneState.sceneConsequence;

    if (normalized.clock_tick !== false && normalized.clock_delta) {
      const target = normalized.clock_target || "zone";
      if (target === "case") {
        if (draft.secondaryClock.enabled) {
          draft.secondaryClock.current = safeNumber(
            caseBefore + normalized.clock_delta,
            0,
            draft.secondaryClock.segments,
            caseBefore
          );
          changes.push({
            label: "Case Clock",
            before: `${caseBefore}/${draft.secondaryClock.segments}`,
            after: `${draft.secondaryClock.current}/${draft.secondaryClock.segments}`
          });
        } else {
          draft.caseFile.nextPressureBeat = normalized.next_pressure_beat
            || `Case pressure rises (+${normalized.clock_delta}) from route cost.`;
          changes.push({
            label: "Case Pressure",
            before: pressureBefore || "No beat staged.",
            after: draft.caseFile.nextPressureBeat
          });
        }
      } else {
        draft.primaryClock.current = safeNumber(
          primaryBefore + normalized.clock_delta,
          0,
          draft.primaryClock.segments,
          primaryBefore
        );
        changes.push({
          label: "Clock",
          before: `${primaryBefore}/${draft.primaryClock.segments}`,
          after: `${draft.primaryClock.current}/${draft.primaryClock.segments}`
        });
      }
    }

    const nextAttention = resolveAttentionValue(attentionBefore, normalized);
    if (nextAttention !== attentionBefore) {
      draft.attention.current = nextAttention;
      changes.push({
        label: "Attention",
        before: attentionBefore,
        after: nextAttention
      });
    }

    const nextScene = resolveSceneStateValue(sceneBefore, normalized);
    if (nextScene !== sceneBefore) {
      draft.sceneState.current = nextScene;
      draft.activeEntity.sceneState = nextScene;
      changes.push({
        label: "Scene State",
        before: sceneBefore,
        after: nextScene
      });
    }

    if (normalized.consequence) {
      draft.sceneState.sceneConsequence = normalized.consequence;
      draft.sceneState.primaryConsequence = normalized.consequence;
      changes.push({
        label: "Scene Consequence",
        before: consequenceBefore || "Unset",
        after: normalized.consequence
      });
    }

    if (normalized.next_pressure_beat) {
      draft.caseFile.nextPressureBeat = normalized.next_pressure_beat;
      changes.push({
        label: "Next Pressure",
        before: pressureBefore || "No beat staged.",
        after: normalized.next_pressure_beat
      });
    }

    if (normalized.next_clue) {
      draft.caseFile.nextClue = normalized.next_clue;
      changes.push({
        label: "Next Clue",
        before: before.nextClue || "Staged only",
        after: normalized.next_clue
      });
    }

    return { normalized, changes };
  }

  function normalizeClueIntegrityState(value) {
    return clueIntegrityStates.includes(value) ? value : "unknown";
  }

  function normalizeClueIntegrity(value, coreClues, options = {}) {
    const source = value && typeof value === "object" ? value : {};
    const existing = Array.isArray(source.clues) ? source.clues : [];
    const definitions = normalizeCoreClueDefinitions(coreClues);
    if (!definitions.length && existing.length && !options.reseed) {
      const activeClueId = existing.some((item) => item.id === source.activeClueId)
        ? source.activeClueId
        : (existing[0]?.id || "");
      return { activeClueId, clues: existing };
    }
    const clues = definitions.map((definition) => {
      const prior = existing.find((item) => item.id === definition.id);
      if (prior && !options.reseed) {
        return {
          ...definition,
          state: normalizeClueIntegrityState(prior.state),
          routeUsed: safeString(prior.routeUsed, 40),
          handlerNote: safeString(prior.handlerNote, 320),
          updatedAt: safeString(prior.updatedAt, 40)
        };
      }
      return {
        ...definition,
        state: "unknown",
        routeUsed: "",
        handlerNote: "",
        updatedAt: ""
      };
    });
    const activeClueId = clues.some((item) => item.id === source.activeClueId)
      ? source.activeClueId
      : (clues[0]?.id || "");
    return { activeClueId, clues };
  }

  function clueIntegrityStateLabel(stateId) {
    const labels = {
      unknown: "Unknown",
      discovered: "Discovered",
      secured: "Secured",
      archived: "Archived",
      contaminated: "Contaminated",
      rerouted: "Rerouted"
    };
    return labels[stateId] || "Unknown";
  }

  function getClueIntegritySummary(state) {
    const clues = state?.clueIntegrity?.clues || [];
    const counts = clueIntegrityStates.reduce((next, key) => {
      next[key] = clues.filter((item) => item.state === key).length;
      return next;
    }, {});
    return {
      total: clues.length,
      counts,
      active: clues.find((item) => item.id === state?.clueIntegrity?.activeClueId) || clues[0] || null
    };
  }

  function prependClueResidue(state, residue, consequence = "") {
    state.residueLog.unshift({
      id: `residue-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      scene: safeString(state.sceneState?.current, 80),
      attention: normalizeAttentionDisplay(state.attention?.current),
      residue: safeString(residue, 240),
      followsHome: safeString(state.attention?.followsHome, 240),
      consequence: safeString(consequence, 300)
    });
    state.residueLog = state.residueLog.slice(0, 20);
  }

  const clueStateTransitions = {
    discover: "discovered",
    secure: "secured",
    archive: "archived",
    contaminate: "contaminated",
    reroute: "rerouted"
  };

  function findClueAction(clue, actionId) {
    const action = clueIntegrityActions.find((item) => item.id === actionId);
    if (!clue || !action || !action.states.includes(clue.state)) return null;
    return action;
  }

  function applyClueIdentityMutation(draft, clue, actionId) {
    clue.state = clueStateTransitions[actionId];
    clue.updatedAt = nowStamp();
    draft.clueIntegrity.activeClueId = clue.id;

    if (actionId === "discover") {
      clue.routeUsed = "first";
      draft.caseFile.nextClue = clue.firstRoute
        ? `${clue.clue} First route: ${clue.firstRoute}`
        : clue.clue;
    }

    if (actionId === "contaminate") {
      clue.handlerNote = clue.failureCost;
    }

    if (actionId === "reroute") {
      clue.routeUsed = "alternate";
      clue.handlerNote = clue.alternateRoute;
      draft.caseFile.nextClue = clue.alternateRoute
        ? `${clue.clue} Alternate route: ${clue.alternateRoute}`
        : draft.caseFile.nextClue;
    }

    if (actionId === "archive") {
      clue.exitReady = true;
    }
  }

  function prependClueResidueForAction(draft, clue, actionId) {
    if (actionId === "discover") {
      prependClueResidue(draft, `Discovered: ${clue.clue}`, "Truth surfaced. The case now knows the Operators know.");
      return;
    }
    if (actionId === "secure") {
      prependClueResidue(
        draft,
        `Secured: ${clue.clue}`,
        "Evidence copied, witnessed, anchored, or preserved. Pressure can rise; the clue cannot disappear."
      );
      return;
    }
    if (actionId === "archive") {
      prependClueResidue(
        draft,
        `Archived: ${clue.clue}`,
        "Truth survives the mission for After Action Report, VeilCorp file, or witness chain."
      );
      return;
    }
    if (actionId === "contaminate") {
      prependClueResidue(
        draft,
        `Contaminated: ${clue.clue}`,
        clue.failureCost || "Truth exists, but it is misleading, incomplete, expensive, or dangerous to use."
      );
      return;
    }
    if (actionId === "reroute") {
      prependClueResidue(
        draft,
        `Rerouted: ${clue.clue}`,
        clue.alternateRoute || "Operators missed the obvious path; the case opens another route."
      );
    }
  }

  function appendArchivedTruthNote(draft, clue) {
    const archivedCount = draft.clueIntegrity.clues.filter((item) => item.state === "archived").length;
    const total = draft.clueIntegrity.clues.length;
    const line = `ARCHIVED TRUTH ${archivedCount}/${total}: ${clue.clue}`;
    const existing = safeString(draft.handlerNotes.clueList, 3000);
    draft.handlerNotes.clueList = existing ? `${existing}\n\n${line}` : line;
  }

  function buildClueActionDraft(state, clueId, actionId, options = {}) {
    const sourceClue = state.clueIntegrity?.clues?.find((item) => item.id === clueId);
    const action = findClueAction(sourceClue, actionId);
    if (!action) return null;

    const before = captureRuntimeBefore(state);
    const beforeClueState = sourceClue.state;
    let draft = clone(normalizeState(state));
    const clue = draft.clueIntegrity.clues.find((item) => item.id === clueId);
    applyClueIdentityMutation(draft, clue, actionId);

    const effects = resolveClueEffects(clue, actionId);
    const { changes: effectChanges } = applyTriggerEffectsToDraft(draft, effects, before);

    const lines = [
      {
        label: "Clue State",
        before: clueIntegrityStateLabel(beforeClueState),
        after: clueIntegrityStateLabel(clue.state)
      },
      ...effectChanges
    ];

    if (draft.caseFile.nextClue !== before.nextClue && !effectChanges.some((row) => row.label === "Next Clue")) {
      lines.push({
        label: "Next Clue",
        before: before.nextClue || "Staged only",
        after: draft.caseFile.nextClue
      });
    }

    if (options.persist) {
      prependClueResidueForAction(draft, clue, actionId);
      if (actionId === "archive") appendArchivedTruthNote(draft, clue);
      draft = hasActiveNeedlepoint(draft) ? applyNeedlepointDeterministic(draft) : draft;
    }

    return {
      action,
      clue,
      effects,
      lines,
      nextState: normalizeState(draft),
      before
    };
  }

  function previewClueAction(state, clueId, actionId) {
    return buildClueActionDraft(state, clueId, actionId, { persist: false });
  }

  function applyClueAction(state, clueId, actionId) {
    const built = buildClueActionDraft(state, clueId, actionId, { persist: true });
    if (!built) {
      const clue = state.clueIntegrity?.clues?.find((item) => item.id === clueId);
      const action = clueIntegrityActions.find((item) => item.id === actionId);
      const message = !clue || !action
        ? "Clue action unavailable."
        : `Cannot ${action.label.toLowerCase()} while clue is ${clueIntegrityStateLabel(clue.state).toLowerCase()}.`;
      return { state, ok: false, message, lines: [] };
    }
    return {
      state: built.nextState,
      ok: true,
      message: `${built.action.label}: ${built.clue.clue}`,
      lines: built.lines
    };
  }

  function advanceClueState(state, clueId, actionId) {
    return applyClueAction(state, clueId, actionId);
  }

  async function hydrateClueIntegrity(state, options = {}) {
    const next = clone(state);
    const needlepoint = next.activeNeedlepoint || {};
    if (!needlepoint.id) {
      next.clueIntegrity = normalizeClueIntegrity(null, [], { reseed: true });
      return normalizeState(next);
    }

    let coreClues = needlepoint.core_clues;
    if (!coreClues?.length && needlepoint.scaffold) {
      try {
        const response = await fetch(needlepointScaffoldUrl(needlepoint.scaffold), { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          coreClues = normalizeCoreClueDefinitions(payload.core_clues);
          next.activeNeedlepoint = {
            ...needlepoint,
            core_clues: coreClues
          };
        }
      } catch (error) {
        coreClues = [];
      }
    }

    next.clueIntegrity = normalizeClueIntegrity(
      next.clueIntegrity,
      coreClues || needlepoint.core_clues || [],
      { reseed: Boolean(options.reseed) }
    );
    return normalizeState(next);
  }

  function normalizeActiveNeedlepoint(value) {
    const source = value && typeof value === "object" ? value : {};
    const id = safeString(source.id, 80);
    const seeded = deterministicLiveCards[id] || {};
    return {
      id,
      scaffold: safeString(source.scaffold, 180),
      core_clues: normalizeCoreClueDefinitions(source.core_clues),
      scene_state_cards: {
        ...normalizeDeterministicCardTable(seeded.scene_state_cards, sceneStateCardKeys),
        ...normalizeDeterministicCardTable(source.scene_state_cards, sceneStateCardKeys)
      },
      attention_aftermath_cards: {
        ...normalizeDeterministicCardTable(seeded.attention_aftermath_cards, attentionAftermathCardKeys),
        ...normalizeDeterministicCardTable(source.attention_aftermath_cards, attentionAftermathCardKeys)
      },
      attention_states: normalizeAttentionStatesTable(source.attention_states),
      clock_attention_consequences: normalizeClockAttentionConsequences(source.clock_attention_consequences),
      table_triggers: normalizeTableTriggers(source.table_triggers),
      collapse_staging: normalizeCollapseStaging(source.collapse_staging),
      rewrite_staging: normalizeRewriteStaging(source.rewrite_staging),
      player_view: {
        safe_consequence: safeString(source.player_view?.safe_consequence, 220)
      }
    };
  }

  function normalizeCollapse(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ready: Boolean(source.ready),
      active: Boolean(source.active),
      trigger: safeString(source.trigger, 220),
      breakType: normalizeChoice(source.breakType, collapseBreakTypes, ""),
      brokenLaw: safeString(source.brokenLaw, 500),
      operatorChoice: safeString(source.operatorChoice, 500),
      exitCondition: safeString(source.exitCondition, 500),
      readyLatch: Boolean(source.readyLatch),
      exitFailedLatch: Boolean(source.exitFailedLatch),
      fieldsEdited: Boolean(source.fieldsEdited)
    };
  }

  function normalizeRewrite(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ready: Boolean(source.ready),
      active: Boolean(source.active),
      trigger: safeString(source.trigger, 220),
      overwriteType: normalizeChoice(source.overwriteType, rewriteOverwriteTypes, ""),
      rewriteLaw: safeString(source.rewriteLaw, 500),
      lockInRisk: safeString(source.lockInRisk, 500),
      counteractionWindow: safeString(source.counteractionWindow, 500),
      readyLatch: Boolean(source.readyLatch),
      acceptFalseSelfLatch: Boolean(source.acceptFalseSelfLatch)
    };
  }

  function genericCollapseFallbacks(state) {
    const loop = state.entityLoop || {};
    return {
      brokenLaw: safeString(loop.Violence, 500) || "The room's law breaks under peak pressure.",
      operatorChoice: safeString(loop.Exit, 500)
        ? `Refuse the site's read, ground the person at stake, or meet the exit: ${loop.Exit}`
        : "Refuse the site's read, protect the anchor, or flee together.",
      exitCondition: safeString(loop.Exit, 500) || "Remove leverage the site still holds."
    };
  }

  function collapseBreakTypeGenericDefaults(breakType, state) {
    const loop = state.entityLoop || {};
    const exit = safeString(loop.Exit, 500);
    const violence = safeString(loop.Violence, 500);
    const table = {
      Room: {
        brokenLaw: "The room's physical law stops matching ordinary cause and effect.",
        operatorChoice: "Leave together, secure one true exit, or force the space without vulnerability.",
        exitCondition: "The group names what the room is doing and refuses to play along."
      },
      Name: {
        brokenLaw: "The name the room accepts becomes easier to answer to than the true one.",
        operatorChoice: "Speak the true name, reject the assigned one, or let the label stabilize.",
        exitCondition: "Someone who knows the person speaks the real name while another Operator shields them from attention."
      },
      Role: {
        brokenLaw: "The assigned role becomes more stable than the person.",
        operatorChoice: "Refuse the useful role, redefine it, or embody it and accept cost.",
        exitCondition: "Someone interacts with the person instead of the function."
      },
      Memory: {
        brokenLaw: "The site remembers the version that was easiest to watch.",
        operatorChoice: "Use a true memory, correct the record, or accept the edited aftermath.",
        exitCondition: "A witness names the real memory before the site captions it."
      },
      Body: {
        brokenLaw: "The body answers observation before the person does.",
        operatorChoice: "Shield the harmed Operator, cut observation, or remove them from the read.",
        exitCondition: "Care is given without performance for the room."
      },
      Relationship: {
        brokenLaw: "The site turns care into leverage.",
        operatorChoice: "Protect the bond, reach the person at stake, or refuse to use one as bait for the other.",
        exitCondition: "Someone protects the bond without performing it for the room."
      },
      Evidence: {
        brokenLaw: "The record edits itself toward the version that spreads fastest.",
        operatorChoice: "Secure the original, name the corruption, or let the false record stand and pay the cost.",
        exitCondition: "A witness preserves or speaks the uncorrupted record under pressure."
      },
      Time: {
        brokenLaw: "The next beat arrives before the group can choose.",
        operatorChoice: "Slow the room, buy one honest beat, or act inside the compressed window.",
        exitCondition: "The group acts together before the site locks the next moment."
      },
      Signal: {
        brokenLaw: violence || "The feed captions choices before Operators make them.",
        operatorChoice: "Cut observation, poison the false thread with truth, or flee together.",
        exitCondition: exit || "Break observation or speak honestly while protected."
      }
    };
    return table[breakType] || genericCollapseFallbacks(state);
  }

  function resolveCollapseStagingField(fieldName, breakType, state, existing = {}) {
    const staging = state.activeNeedlepoint?.collapse_staging || {};
    const resolvedBreak = normalizeChoice(breakType, collapseBreakTypes, "");
    const byBreak = resolvedBreak ? (staging.by_target?.[resolvedBreak] || staging.by_break_type?.[resolvedBreak]) : null;
    const genericBreak = resolvedBreak ? collapseBreakTypeGenericDefaults(resolvedBreak, state) : null;
    const generic = genericCollapseFallbacks(state);
    const stagingDefault = staging[fieldName] || "";
    const byBreakValue = byBreak?.[fieldName] || "";
    const genericBreakValue = genericBreak?.[fieldName === "broken_law" ? "brokenLaw" : fieldName === "operator_choice" ? "operatorChoice" : "exitCondition"] || "";
    const existingValue = existing[fieldName === "broken_law" ? "brokenLaw" : fieldName === "operator_choice" ? "operatorChoice" : "exitCondition"] || "";
    const genericValue = generic[fieldName === "broken_law" ? "brokenLaw" : fieldName === "operator_choice" ? "operatorChoice" : "exitCondition"] || "";
    return byBreakValue || stagingDefault || genericBreakValue || existingValue || genericValue;
  }

  function genericRewriteFallbacks(state) {
    const loop = state.entityLoop || {};
    return {
      rewriteLaw: safeString(loop.Pressure, 500) || "The accepted version becomes easier to remember than the original.",
      lockInRisk: safeString(loop.Violence, 500) || "If no one contradicts it before the next pressure beat, the record updates.",
      counteractionWindow: safeString(loop.Gift, 500) || "A witness names the original truth and pays the cost."
    };
  }

  function getCollapseDefaults(state, breakType, existing = {}) {
    const staging = state.activeNeedlepoint?.collapse_staging || {};
    const resolvedBreak = normalizeChoice(breakType || staging.default_break_type, collapseBreakTypes, "");
    return {
      breakType: resolvedBreak,
      brokenLaw: resolveCollapseStagingField("broken_law", resolvedBreak, state, existing),
      operatorChoice: resolveCollapseStagingField("operator_choice", resolvedBreak, state, existing),
      exitCondition: resolveCollapseStagingField("exit_condition", resolvedBreak, state, existing)
    };
  }

  function collapseBreakTypeChangeNeedsConfirm(state, breakType) {
    const collapse = normalizeCollapse(state?.collapse);
    const resolvedBreak = normalizeChoice(breakType, collapseBreakTypes, "");
    if (!resolvedBreak || !collapse.fieldsEdited || !collapse.breakType) return false;
    return collapse.breakType !== resolvedBreak;
  }

  function markCollapseFieldsEdited(state) {
    const next = clone(normalizeState(state));
    next.collapse.fieldsEdited = true;
    return syncCollapseRewriteStaging(next);
  }

  function getRewriteDefaults(state, overwriteType) {
    const staging = state.activeNeedlepoint?.rewrite_staging || {};
    const generic = genericRewriteFallbacks(state);
    const resolvedType = normalizeChoice(overwriteType || staging.default_overwrite_type, rewriteOverwriteTypes, "");
    const byTarget = resolvedType ? staging.by_target?.[resolvedType] : null;
    return {
      overwriteType: resolvedType,
      rewriteLaw: byTarget?.rewrite_law || staging.rewrite_law || generic.rewriteLaw,
      lockInRisk: byTarget?.lock_in_risk || staging.lock_in_risk || generic.lockInRisk,
      counteractionWindow: byTarget?.counteraction_window || staging.counteraction_window || generic.counteractionWindow
    };
  }

  function consequenceImpliesRewrite(consequence) {
    const text = safeString(consequence, 220).toLowerCase();
    if (!text) return false;
    return /replac|overwrite|myth|record corrupt|false self|curated|confirm|easier version|identity overwrite/.test(text);
  }

  function evaluateCollapseSignals(state) {
    const triggers = [];
    if (state.sceneState.current === "Collapse") triggers.push("Scene State: Collapse");
    if (state.primaryClock.current >= state.primaryClock.segments) triggers.push("Primary Clock full");
    if (state.attention.current === "Exposed") triggers.push("Attention: Exposed");
    if (state.collapse.readyLatch) triggers.push(state.collapse.trigger || "Severe misfire / natural 3");
    const collapseRisk = (state.players || []).some((player) => player.stabilityBand === "Collapse Risk");
    if (collapseRisk && state.activeEntity?.kind === "Entity") triggers.push("Operator Stability: Collapse Risk");
    return {
      ready: triggers.length > 0,
      trigger: triggers.join(" // ")
    };
  }

  function evaluateRewriteSignals(state) {
    if (!state.collapse.active) return { ready: false, trigger: "" };
    const triggers = [];
    if (state.rewrite.acceptFalseSelfLatch) triggers.push("Accepted false / curated self");
    if (state.collapse.exitFailedLatch) triggers.push("Collapse exit condition failed");
    if (state.rewrite.readyLatch) triggers.push(state.rewrite.trigger || "Needlepoint trigger");
    if (state.attention.current === "Exposed" && consequenceImpliesRewrite(state.attention.aftermathConsequence)) {
      triggers.push("Exposed + replacement consequence");
    }
    return {
      ready: triggers.length > 0,
      trigger: triggers.join(" // ")
    };
  }

  function syncCollapseRewriteStaging(state) {
    const next = clone(state);
    next.collapse = normalizeCollapse(next.collapse);
    next.rewrite = normalizeRewrite(next.rewrite);

    const collapseSignals = evaluateCollapseSignals(next);
    next.collapse.ready = collapseSignals.ready || next.collapse.active;
    if (collapseSignals.ready && !next.collapse.trigger) next.collapse.trigger = collapseSignals.trigger;
    if (collapseSignals.ready && collapseSignals.trigger) next.collapse.trigger = collapseSignals.trigger;

    if (next.collapse.active && !next.collapse.breakType) {
      const defaults = getCollapseDefaults(next, next.activeNeedlepoint?.collapse_staging?.default_break_type);
      next.collapse.breakType = defaults.breakType;
      if (!next.collapse.brokenLaw) next.collapse.brokenLaw = defaults.brokenLaw;
      if (!next.collapse.operatorChoice) next.collapse.operatorChoice = defaults.operatorChoice;
      if (!next.collapse.exitCondition) next.collapse.exitCondition = defaults.exitCondition;
    }

    const rewriteSignals = evaluateRewriteSignals(next);
    next.rewrite.ready = rewriteSignals.ready || next.rewrite.active;
    if (rewriteSignals.ready && rewriteSignals.trigger) next.rewrite.trigger = rewriteSignals.trigger;

    if (next.rewrite.active && !next.rewrite.overwriteType) {
      const defaults = getRewriteDefaults(next, next.activeNeedlepoint?.rewrite_staging?.default_overwrite_type);
      next.rewrite.overwriteType = defaults.overwriteType;
      if (!next.rewrite.rewriteLaw) next.rewrite.rewriteLaw = defaults.rewriteLaw;
      if (!next.rewrite.lockInRisk) next.rewrite.lockInRisk = defaults.lockInRisk;
      if (!next.rewrite.counteractionWindow) next.rewrite.counteractionWindow = defaults.counteractionWindow;
    }

    if (!next.collapse.active) {
      next.rewrite.ready = false;
      if (!next.rewrite.active) {
        next.rewrite.trigger = "";
      }
    }

    return next;
  }

  function populateCollapseOverlay(state, breakType, options = {}) {
    const next = clone(normalizeState(state));
    const resolvedBreak = normalizeChoice(breakType, collapseBreakTypes, "");
    if (!resolvedBreak) return syncCollapseRewriteStaging(next);

    const forceReplace = Boolean(options.forceReplace);
    const collapse = next.collapse;

    if (collapse.fieldsEdited && collapse.breakType === resolvedBreak && !forceReplace) {
      return syncCollapseRewriteStaging(next);
    }

    if (collapse.fieldsEdited && collapse.breakType && collapse.breakType !== resolvedBreak && !forceReplace) {
      return syncCollapseRewriteStaging(next);
    }

    const defaults = getCollapseDefaults(next, resolvedBreak);
    next.collapse.breakType = defaults.breakType;
    next.collapse.brokenLaw = defaults.brokenLaw;
    next.collapse.operatorChoice = defaults.operatorChoice;
    next.collapse.exitCondition = defaults.exitCondition;
    next.collapse.fieldsEdited = false;
    return syncCollapseRewriteStaging(next);
  }

  function populateRewriteOverlay(state, overwriteType) {
    const next = clone(normalizeState(state));
    const defaults = getRewriteDefaults(next, overwriteType);
    next.rewrite.overwriteType = defaults.overwriteType;
    next.rewrite.rewriteLaw = defaults.rewriteLaw;
    next.rewrite.lockInRisk = defaults.lockInRisk;
    next.rewrite.counteractionWindow = defaults.counteractionWindow;
    return syncCollapseRewriteStaging(next);
  }

  function activateCollapseMode(state) {
    const next = clone(normalizeState(state));
    next.collapse.active = true;
    const defaults = getCollapseDefaults(next, next.collapse.breakType);
    if (!next.collapse.breakType) next.collapse.breakType = defaults.breakType;
    if (!next.collapse.brokenLaw) next.collapse.brokenLaw = defaults.brokenLaw;
    if (!next.collapse.operatorChoice) next.collapse.operatorChoice = defaults.operatorChoice;
    if (!next.collapse.exitCondition) next.collapse.exitCondition = defaults.exitCondition;
    return syncCollapseRewriteStaging(next);
  }

  function deactivateCollapseMode(state) {
    const next = clone(normalizeState(state));
    next.collapse.active = false;
    next.collapse.exitFailedLatch = false;
    next.rewrite.active = false;
    next.rewrite.acceptFalseSelfLatch = false;
    next.rewrite.readyLatch = false;
    return syncCollapseRewriteStaging(next);
  }

  function clearCollapseStaging(state) {
    const next = clone(normalizeState(state));
    next.collapse = normalizeCollapse({});
    next.rewrite = normalizeRewrite({});
    return syncCollapseRewriteStaging(next);
  }

  function activateRewriteMode(state) {
    const next = clone(normalizeState(state));
    if (!next.collapse.active) return syncCollapseRewriteStaging(next);
    next.rewrite.active = true;
    const defaults = getRewriteDefaults(next, next.rewrite.overwriteType);
    if (!next.rewrite.overwriteType) next.rewrite.overwriteType = defaults.overwriteType;
    if (!next.rewrite.rewriteLaw) next.rewrite.rewriteLaw = defaults.rewriteLaw;
    if (!next.rewrite.lockInRisk) next.rewrite.lockInRisk = defaults.lockInRisk;
    if (!next.rewrite.counteractionWindow) next.rewrite.counteractionWindow = defaults.counteractionWindow;
    return syncCollapseRewriteStaging(next);
  }

  function deactivateRewriteMode(state) {
    const next = clone(normalizeState(state));
    next.rewrite.active = false;
    return syncCollapseRewriteStaging(next);
  }

  function markCollapseExitFailed(state) {
    const next = clone(normalizeState(state));
    if (!next.collapse.active) return syncCollapseRewriteStaging(next);
    next.collapse.exitFailedLatch = true;
    return syncCollapseRewriteStaging(next);
  }

  function attentionIndex(label) {
    const key = normalizeAttentionKey(label);
    const index = attentionStates.findIndex((item) => item.toLowerCase() === key);
    return index >= 0 ? index : 0;
  }

  function resolveAttentionValue(current, effects) {
    if (effects.attention_set) return effects.attention_set;
    let index = attentionIndex(current);
    if (effects.attention_min) index = Math.max(index, attentionIndex(effects.attention_min));
    if (effects.attention_delta) index += effects.attention_delta;
    index = Math.max(0, Math.min(attentionStates.length - 1, index));
    return attentionStates[index];
  }

  function resolveSceneStateValue(current, effects) {
    if (effects.scene_state_set) return effects.scene_state_set;
    const currentRank = sceneStateRank[current] ?? 0;
    const minRank = effects.scene_state_min ? (sceneStateRank[effects.scene_state_min] ?? currentRank) : currentRank;
    const nextRank = Math.max(currentRank, minRank);
    return sceneStates[nextRank]?.name || current;
  }

  function softenSceneStateValue(current, steps = 1) {
    const currentRank = sceneStateRank[current] ?? 0;
    const nextRank = Math.max(0, currentRank - safeNumber(steps, 1, 4, 1));
    return sceneStates[nextRank]?.name || current;
  }

  function normalizeWindDownEffects(move) {
    const effects = move?.effects && typeof move.effects === "object" ? move.effects : {};
    return {
      primary_delta: safeNumber(effects.primary_delta, -6, 6, 0),
      attention_delta: safeNumber(effects.attention_delta, -4, 4, 0),
      case_delta: safeNumber(effects.case_delta, -6, 6, 0),
      primary_resolve: Boolean(effects.primary_resolve),
      scene_state_set: effects.scene_state_set
        ? normalizeChoice(effects.scene_state_set, sceneStates.map((item) => item.name), "")
        : "",
      scene_state_soften: safeNumber(effects.scene_state_soften, 0, 4, 0),
      next_pressure_beat: safeString(effects.next_pressure_beat, 500),
      consequence: safeString(effects.consequence, 220),
      case_record: safeString(effects.case_record, 240),
      use_when: safeString(move?.guidance, 260)
    };
  }

  function applyWindDownEffects(draft, move) {
    const effects = normalizeWindDownEffects(move);
    const changes = [];
    const before = {
      primary: draft.primaryClock.current,
      attention: draft.attention.current,
      scene: draft.sceneState.current,
      caseClock: draft.secondaryClock.current,
      residue: draft.attention.residue || "None logged.",
      consequence: draft.attention.aftermathConsequence || draft.sceneState.sceneConsequence || "Unset",
      nextPressure: draft.caseFile.nextPressureBeat || "No beat staged."
    };

    if (effects.primary_resolve) {
      draft.primaryClock.current = 0;
      changes.push({
        label: "Clock",
        before: `${before.primary}/${draft.primaryClock.segments}`,
        after: `${draft.primaryClock.current}/${draft.primaryClock.segments}`
      });
    } else if (effects.primary_delta) {
      draft.primaryClock.current = safeNumber(
        draft.primaryClock.current + effects.primary_delta,
        0,
        draft.primaryClock.segments,
        draft.primaryClock.current
      );
      changes.push({
        label: "Clock",
        before: `${before.primary}/${draft.primaryClock.segments}`,
        after: `${draft.primaryClock.current}/${draft.primaryClock.segments}`
      });
    }

    if (effects.attention_delta) {
      draft.attention.current = resolveAttentionValue(draft.attention.current, { attention_delta: effects.attention_delta });
      changes.push({
        label: "Attention",
        before: before.attention,
        after: draft.attention.current
      });
    }

    if (effects.scene_state_set) {
      draft.sceneState.current = effects.scene_state_set;
    }
    if (effects.scene_state_soften) {
      draft.sceneState.current = softenSceneStateValue(draft.sceneState.current, effects.scene_state_soften);
    }
    if (effects.scene_state_set || effects.scene_state_soften) {
      changes.push({
        label: "Scene State",
        before: before.scene,
        after: draft.sceneState.current
      });
    }

    if (effects.case_delta || effects.case_record) {
      draft.caseFile.nextPressureBeat = effects.next_pressure_beat
        || effects.case_record
        || "Truth preserved; the site loses leverage over this clue.";
      draft.residueLog.unshift({
        id: `residue-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        scene: draft.sceneState.current,
        attention: draft.attention.current,
        residue: effects.case_record || `Truth preserved: ${draft.caseFile.nextClue || move.label}`,
        followsHome: draft.attention.followsHome || "",
        consequence: draft.secondaryClock.enabled
          ? "Case clock softened; truth preserved without feeding the site."
          : "Case pressure beat softened; truth preserved without feeding the site."
      });
      if (draft.secondaryClock.enabled && effects.case_delta) {
        draft.secondaryClock.current = safeNumber(
          draft.secondaryClock.current + effects.case_delta,
          0,
          draft.secondaryClock.segments,
          draft.secondaryClock.current
        );
        changes.push({
          label: "Case Clock",
          before: `${before.caseClock}/${draft.secondaryClock.segments}`,
          after: `${draft.secondaryClock.current}/${draft.secondaryClock.segments}`
        });
      } else if (effects.case_delta || effects.case_record) {
        changes.push({
          label: "Case Clock",
          before: "Disabled",
          after: "Case pressure beat updated"
        });
      }
      changes.push({
        label: "Case Record",
        before: "Unlogged",
        after: draft.residueLog[0]?.residue || effects.case_record || "Truth preserved."
      });
      if (draft.caseFile.nextPressureBeat !== before.nextPressure) {
        changes.push({
          label: "Next Pressure",
          before: before.nextPressure,
          after: draft.caseFile.nextPressureBeat || "No beat staged."
        });
      }
    }

    if (effects.consequence) {
      draft.sceneState.sceneConsequence = effects.consequence;
      draft.sceneState.primaryConsequence = effects.consequence;
      changes.push({
        label: "Consequence",
        before: before.consequence,
        after: draft.sceneState.sceneConsequence || "Unset"
      });
    }

    if (effects.next_pressure_beat && !effects.case_delta) {
      draft.caseFile.nextPressureBeat = effects.next_pressure_beat;
      changes.push({
        label: "Next Pressure",
        before: before.nextPressure,
        after: draft.caseFile.nextPressureBeat || "No beat staged."
      });
    }

    return { draft, effects, changes };
  }

  function getTableTriggers(state) {
    const needlepoint = state?.activeNeedlepoint;
    if (needlepoint?.table_triggers?.length) return needlepoint.table_triggers;
    return genericTableTriggers;
  }

  function findTableTrigger(state, triggerId) {
    return getTableTriggers(state).find((trigger) => trigger.id === triggerId) || null;
  }

  function buildTriggerDraft(state, trigger, options = {}) {
    const draft = clone(normalizeState(state));
    const effects = trigger.effects || {};
    const before = captureRuntimeBefore(state);
    applyTriggerEffectsToDraft(draft, effects, before);

    if (options.persist && effects.npc_name_match) {
      const match = effects.npc_name_match.toLowerCase();
      draft.npcs.forEach((npc) => {
        if (!npc.name || npc.name.toLowerCase().indexOf(match) < 0) return;
        const note = effects.npc_pressure_note || "Pressure escalates from table trigger.";
        npc.pressure = npc.pressure ? `${npc.pressure} // ${note}` : note;
      });
    }

    if (effects.collapse_ready) {
      draft.collapse.readyLatch = true;
      draft.collapse.trigger = trigger.label;
    }
    if (effects.rewrite_ready) {
      draft.rewrite.readyLatch = true;
      draft.rewrite.trigger = trigger.label;
    }
    if (effects.accept_false_self) {
      draft.rewrite.acceptFalseSelfLatch = true;
    }

    if (options.persist) {
      const residueStamp = () => `residue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (effects.reveal_next_clue && draft.caseFile.nextClue) {
        draft.residueLog.unshift({
          id: residueStamp(),
          scene: safeString(draft.session.location || draft.session.caseTitle, 140),
          attention: draft.attention.current,
          residue: `Clue surfaced: ${draft.caseFile.nextClue}`,
          followsHome: "",
          consequence: draft.attention.aftermathConsequence || draft.sceneState.sceneConsequence || ""
        });
      }
      draft.residueLog.unshift({
        id: residueStamp(),
        scene: safeString(draft.session.location || draft.session.caseTitle, 140),
        attention: draft.attention.current,
        residue: `Trigger applied: ${trigger.label}`,
        followsHome: draft.attention.followsHome || "",
        consequence: draft.attention.aftermathConsequence || draft.sceneState.sceneConsequence || ""
      });
    }

    const withNeedlepoint = hasActiveNeedlepoint(draft) ? applyNeedlepointDeterministic(draft) : draft;
    return {
      draft: withNeedlepoint,
      delta: {
        beforeClock: before.primaryClock,
        beforeAttention: before.attention,
        beforeScene: before.scene,
        afterClock: withNeedlepoint.primaryClock.current,
        afterAttention: withNeedlepoint.attention.current,
        afterScene: withNeedlepoint.sceneState.current
      }
    };
  }

  function previewTableTrigger(state, triggerId) {
    const trigger = findTableTrigger(state, triggerId);
    if (!trigger) return null;
    const { draft: withNeedlepoint, delta } = buildTriggerDraft(state, trigger, { persist: false });
    const lines = [
      {
        label: "Responsibility",
        before: "Pending",
        after: clockTargetLabel(trigger.effects.clock_target)
      },
      {
        label: "Clock",
        before: `${state.primaryClock.current}/${state.primaryClock.segments}`,
        after: `${withNeedlepoint.primaryClock.current}/${withNeedlepoint.primaryClock.segments}`
      },
      {
        label: "Attention",
        before: state.attention.current,
        after: withNeedlepoint.attention.current
      },
      {
        label: "Scene State",
        before: state.sceneState.current,
        after: withNeedlepoint.sceneState.current
      },
      {
        label: "Residue",
        before: state.attention.residue || "None logged.",
        after: withNeedlepoint.attention.residue || "None logged."
      },
      {
        label: "Scene Consequence",
        before: state.sceneState.sceneConsequence || "Unset",
        after: withNeedlepoint.sceneState.sceneConsequence || "Unset"
      },
      {
        label: "Attention Aftermath",
        before: state.attention.aftermathConsequence || "Unset",
        after: withNeedlepoint.attention.aftermathConsequence || "Unset"
      },
      {
        label: "Next Pressure",
        before: state.caseFile.nextPressureBeat || "No beat staged.",
        after: withNeedlepoint.caseFile.nextPressureBeat || "No beat staged."
      }
    ];
    if (trigger.effects.reveal_next_clue && state.caseFile.nextClue) {
      lines.push({
        label: "Next Clue",
        before: "Staged only",
        after: state.caseFile.nextClue
      });
    }
    return { trigger, lines, nextState: withNeedlepoint, delta };
  }

  function clockTargetLabel(target) {
    if (target === "zone") return "Primary";
    if (target === "attention") return "Attention";
    if (target === "case") return "Case";
    if (target === "both") return "Primary + Attention";
    return "Choice";
  }

  function applyTableTrigger(state, triggerId) {
    const trigger = findTableTrigger(state, triggerId);
    if (!trigger) return state;
    const { draft } = buildTriggerDraft(state, trigger, { persist: true });
    return normalizeState(draft);
  }

  function windDownTargetLabel(target) {
    if (target === "primary") return "Primary";
    if (target === "attention") return "Attention";
    if (target === "case") return "Case";
    if (target === "both") return "Both";
    return "Handler";
  }

  function windDownDetailTargetLabel(target) {
    if (target === "primary") return "Primary";
    if (target === "attention") return "Attention";
    if (target === "case") return "Case";
    if (target === "both") return "Primary + Attention";
    return "Handler";
  }

  function getViridianWindDownMoves() {
    const moves = windDownMoves.map((move) => {
      if (move.id !== "protect-anchor-npc") return move;
      return {
        ...move,
        id: "protect-saffi-memory",
        label: "Protect Saffi / True Memory",
        guidance: "Use when Operators shield Saffi, preserve her memory of Mara, or keep her from becoming bait."
      };
    });
    moves.splice(1, 0, {
      id: "ground-mara-person",
      label: "Ground Mara As A Person",
      target: "both",
      effects: {
        primary_delta: -1,
        attention_delta: -1,
        scene_state_soften: 1,
        next_pressure_beat: "Mara responds as a person, not content; the Audience loses its curated angle."
      },
      guidance: "Use in Act 4 / Apartment 13F when Operators treat Mara as a person and ground her with Saffi's true memory."
    });
    return moves;
  }

  function getWindDownMoves(state) {
    if (state?.activeNeedlepoint?.id === "viridian-house") return getViridianWindDownMoves();
    return windDownMoves;
  }

  function findWindDownMove(moveId, state) {
    return getWindDownMoves(state).find((move) => move.id === moveId) || null;
  }

  function previewWindDownMove(state, moveId) {
    const move = findWindDownMove(moveId, state);
    if (!move) return null;

    const draft = clone(normalizeState(state));
    const before = {
      primary: draft.primaryClock.current,
      attention: draft.attention.current,
      scene: draft.sceneState.current,
      residue: draft.attention.residue || "None logged.",
      consequence: draft.attention.aftermathConsequence || draft.sceneState.sceneConsequence || "Unset",
      nextPressure: draft.caseFile.nextPressureBeat || "No beat staged.",
      caseClock: draft.secondaryClock.enabled
        ? `${draft.secondaryClock.current}/${draft.secondaryClock.segments}`
        : "Disabled"
    };
    const { draft: windDownDraft, effects } = applyWindDownEffects(draft, move);
    const next = hasActiveNeedlepoint(windDownDraft) ? applyNeedlepointDeterministic(windDownDraft) : windDownDraft;
    const lines = [
      {
        label: "Responsibility",
        before: "Pending",
        after: windDownDetailTargetLabel(move.target)
      },
      {
        label: "Use When",
        before: "",
        after: move.guidance
      },
      {
        label: "Clock",
        before: `${before.primary}/${draft.primaryClock.segments}`,
        after: `${next.primaryClock.current}/${next.primaryClock.segments}`
      },
      {
        label: "Attention",
        before: before.attention,
        after: next.attention.current
      },
      {
        label: "Scene State",
        before: before.scene,
        after: next.sceneState.current
      },
      {
        label: "Residue",
        before: before.residue,
        after: next.attention.residue || "None logged."
      },
      {
        label: "Consequence",
        before: before.consequence,
        after: next.attention.aftermathConsequence || next.sceneState.sceneConsequence || "Unset"
      },
      {
        label: "Next Pressure",
        before: before.nextPressure,
        after: next.caseFile.nextPressureBeat || "No beat staged."
      }
    ];

    if (effects.case_delta || effects.case_record) {
      lines.push({
        label: "Case Clock",
        before: before.caseClock,
        after: next.secondaryClock.enabled
          ? `${next.secondaryClock.current}/${next.secondaryClock.segments}`
          : "Clean clue recorded"
      });
      lines.push({
        label: "Case Record",
        before: "Unlogged",
        after: next.residueLog[0]?.residue || effects.case_record || "Clean clue recovered."
      });
    }

    return { move, lines, nextState: next, message: null };
  }

  function applyWindDownMove(state, moveId) {
    const move = findWindDownMove(moveId, state);
    if (!move) return { state, message: "UNKNOWN WIND DOWN MOVE" };

    const draft = clone(normalizeState(state));
    const { draft: next, changes } = applyWindDownEffects(draft, move);
    const withNeedlepoint = hasActiveNeedlepoint(next) ? applyNeedlepointDeterministic(next) : next;
    const summary = changes
      .map((row) => (row.before === "" ? `${row.label}: ${row.after}` : `${row.label} ${row.before} -> ${row.after}`))
      .join(" | ");
    return {
      state: normalizeState(withNeedlepoint),
      message: summary ? `${move.label.toUpperCase()} — ${summary}` : `${move.label.toUpperCase()} — STABILIZED`
    };
  }

  function readFieldEditMode() {
    try {
      const stored = window.localStorage.getItem(fieldEditStorageKey);
      if (stored === "1" || stored === "0") return stored === "1";
    } catch (error) {
      // Lock preference is convenience only.
    }
    return false;
  }

  function writeFieldEditMode(unlocked) {
    try {
      window.localStorage.setItem(fieldEditStorageKey, unlocked ? "1" : "0");
      window.dispatchEvent(new CustomEvent("veildaemon:handler-field-edit-toggled", {
        detail: { unlocked: Boolean(unlocked) }
      }));
    } catch (error) {
      // Lock preference is convenience only.
    }
  }

  function fieldEditUnlocked() {
    return readFieldEditMode();
  }

  function toggleFieldEditMode() {
    writeFieldEditMode(!readFieldEditMode());
    return readFieldEditMode();
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

  function resolveSceneStateCard(state) {
    const needlepoint = state.activeNeedlepoint;
    const caseId = needlepoint?.id || "no-case";
    const sceneKey = normalizeSceneStateKey(state.sceneState.current);
    const card = needlepoint?.scene_state_cards?.[sceneKey];
    if (card) return card;
    return missingDeterministicCardMessage(caseId, "scene_state", sceneKey);
  }

  function resolveAttentionAftermathConsequence(state) {
    const needlepoint = state.activeNeedlepoint;
    const caseId = needlepoint?.id || "no-case";
    const attentionKey = normalizeAttentionKey(state.attention.current);
    const matrixConsequence = resolveClockAttentionConsequence(state);
    if (matrixConsequence) return matrixConsequence;
    const card = needlepoint?.attention_aftermath_cards?.[attentionKey];
    if (card) return card;
    const row = needlepoint?.attention_states?.[attentionKey];
    if (row?.consequence) return row.consequence;
    return missingDeterministicCardMessage(caseId, "attention_aftermath", attentionKey);
  }

  function applyNeedlepointDeterministic(state, options = { scene: true, attention: true }) {
    const needlepoint = state.activeNeedlepoint;
    if (!needlepoint?.id) return state;
    if (options.scene) {
      state.sceneState.sceneConsequence = resolveSceneStateCard(state);
      state.sceneState.primaryConsequence = state.sceneState.sceneConsequence;
    }
    if (options.attention) {
      const attentionKey = normalizeAttentionKey(state.attention.current);
      const row = needlepoint.attention_states[attentionKey];
      if (row) {
        state.attention.residue = row.residue;
        state.attention.followsHome = row.follows_home;
      }
      state.attention.aftermathConsequence = resolveAttentionAftermathConsequence(state);
    }
    return state;
  }

  function applyNeedlepointSceneState(state) {
    return applyNeedlepointDeterministic(state, { scene: true, attention: false });
  }

  function applyNeedlepointAttention(state) {
    return applyNeedlepointDeterministic(state, { scene: false, attention: true });
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
        sceneConsequence: safeString(
          merged.sceneState.sceneConsequence || merged.sceneState.primaryConsequence,
          500
        ),
        primaryConsequence: safeString(
          merged.sceneState.sceneConsequence || merged.sceneState.primaryConsequence,
          500
        )
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
        followsHome: safeString(merged.attention.followsHome, 180),
        aftermathConsequence: safeString(merged.attention.aftermathConsequence, 500)
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
      collapse: normalizeCollapse(merged.collapse),
      rewrite: normalizeRewrite(merged.rewrite),
      canonTerminology
    };
    const activeNeedlepoint = normalizeActiveNeedlepoint(merged.activeNeedlepoint);
    const withClues = {
      ...next,
      activeNeedlepoint,
      clueIntegrity: normalizeClueIntegrity(merged.clueIntegrity, activeNeedlepoint.core_clues, { reseed: false })
    };
    const withNeedlepoint = hasActiveNeedlepoint(withClues) ? applyNeedlepointDeterministic(withClues) : withClues;
    return syncCollapseRewriteStaging(withNeedlepoint);
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

  function normalizeNpcAnchor(anchor) {
    const source = anchor && typeof anchor === "object" ? anchor : {};
    return {
      enabled: Boolean(source.enabled),
      label: safeString(source.label, 40) || "Anchor NPC",
      state: anchorNpcStateIds.includes(source.state) ? source.state : "with-operators"
    };
  }

  function anchorGuidanceForState(stateId) {
    const entry = anchorNpcStates.find((item) => item.id === stateId);
    return entry ? entry.guidance : "";
  }

  function normalizeNpcs(npcs) {
    const list = Array.isArray(npcs) ? npcs : [];
    return list.slice(0, 12).map((npc, index) => {
      const anchor = normalizeNpcAnchor(npc.anchor);
      const rawFlags = Array.isArray(npc.flags) ? npc.flags.filter((flag) => npcFlags.includes(flag)) : [];
      const flags = Array.from(new Set(anchor.enabled && !rawFlags.includes("Anchor") ? [...rawFlags, "Anchor"] : rawFlags));
      return {
        id: safeString(npc.id, 80) || `npc-${index + 1}`,
        name: safeString(npc.name, 100),
        role: safeString(npc.role, 100),
        pressure: safeString(npc.pressure, 160),
        location: safeString(npc.location, 120),
        flags: flags.slice(0, 6),
        notes: safeString(npc.notes, 1000),
        anchor
      };
    });
  }

  function normalizeTrackerValue(value, max, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(max, Math.round(parsed)));
  }

  function parseStabilityPoints(value) {
    const raw = safeString(value, 80);
    const fraction = raw.match(/(\d+)\s*\/\s*10\b/i);
    if (fraction) return normalizeTrackerValue(fraction[1], 10, 10);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) return Math.round(parsed);
    return 10;
  }

  function parseHarmBoxes(harmBoxesValue, harmText) {
    const rawBoxes = safeString(harmBoxesValue, 20);
    if (rawBoxes !== "") return normalizeTrackerValue(rawBoxes, 5, 0);
    const raw = safeString(harmText, 120);
    const fraction = raw.match(/(\d+)\s*\/\s*5\b/i);
    if (fraction) return normalizeTrackerValue(fraction[1], 5, 0);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 5) return Math.round(parsed);
    const labels = ["fine", "injured", "wounded", "impaired", "critical", "dying"];
    const labelIndex = labels.findIndex((label) => raw.toLowerCase().includes(label));
    return labelIndex >= 0 ? labelIndex : 0;
  }

  function stabilityBandFromPoints(value) {
    const stability = normalizeTrackerValue(value, 10, 10);
    if (stability >= 8) return "Calm";
    if (stability >= 5) return "Strained";
    if (stability >= 3) return "Unraveling";
    return "Collapse Risk";
  }

  function harmConditionFromBoxes(value) {
    const harm = normalizeTrackerValue(value, 5, 0);
    return ["Fine", "Injured", "Wounded", "Impaired", "Critical", "Dying"][harm] || "Fine";
  }

  function formatPlayerStability(points, band) {
    const resolvedBand = band || stabilityBandFromPoints(points);
    return `${resolvedBand} (${normalizeTrackerValue(points, 10, 10)}/10)`;
  }

  function formatPlayerHarm(boxes) {
    const harm = normalizeTrackerValue(boxes, 5, 0);
    const condition = harmConditionFromBoxes(harm);
    return harm ? `${condition} (${harm}/5)` : condition;
  }

  function normalizePlayers(players) {
    const list = Array.isArray(players) ? players : [];
    return list.slice(0, 8).map((player, index) => {
      const stabilityPoints = player.stabilityPoints !== undefined && player.stabilityPoints !== ""
        ? normalizeTrackerValue(player.stabilityPoints, 10, 10)
        : parseStabilityPoints(player.stability);
      const harmBoxes = player.harmBoxes !== undefined && player.harmBoxes !== ""
        ? normalizeTrackerValue(player.harmBoxes, 5, 0)
        : parseHarmBoxes(player.harmBoxes, player.harm);
      const stabilityBand = stabilityBandFromPoints(stabilityPoints);
      return {
      id: safeString(player.id, 80) || `operator-${index + 1}`,
      name: safeString(player.name, 80) || `Operator ${index + 1}`,
      stabilityPoints,
      harmBoxes,
      stabilityBand,
      stability: safeString(player.stability, 80) || formatPlayerStability(stabilityPoints, stabilityBand),
      harm: safeString(player.harm, 120) || formatPlayerHarm(harmBoxes),
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
    };
    });
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

  function currentTemplateLabel(state) {
    const needlepointId = safeString(state?.activeNeedlepoint?.id, 80);
    const match = templates.find((item) => item.id === needlepointId);
    if (match) return match.name;
    const caseTitle = safeString(state?.session?.caseTitle, 80);
    return caseTitle || "your current case";
  }

  function confirmTemplateReplace(state, template) {
    const nextName = safeString(template?.name, 80) || "the selected template";
    const currentName = currentTemplateLabel(state);
    return window.confirm(
      `Apply "${nextName}"?\n\nThis unloads "${currentName}" and loads the new template.`
    );
  }

  function applyTemplateState(state, template) {
    const base = template.id === "custom-campaign" ? defaultState : state;
    const merged = mergeDeep(base, template.data || {});
    if (template.data?.activeNeedlepoint) {
      merged.activeNeedlepoint = template.data.activeNeedlepoint;
    }
    return normalizeState(merged);
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
    anchorNpcStates,
    normalizeNpcAnchor,
    anchorGuidanceForState,
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
    currentTemplateLabel,
    confirmTemplateReplace,
    applyTemplateState,
    publicClockLabel,
    clockWarning,
    applyNeedlepointAttention,
    applyNeedlepointSceneState,
    applyNeedlepointDeterministic,
    resolveSceneStateCard,
    resolveAttentionAftermathConsequence,
    playerViewPayload,
    hasActiveNeedlepoint,
    fieldEditUnlocked,
    toggleFieldEditMode,
    normalizeAttentionDisplay,
    genericTableTriggers,
    getTableTriggers,
    findTableTrigger,
    previewTableTrigger,
    previewWindDownMove,
    applyTableTrigger,
    windDownMoves,
    getWindDownMoves,
    findWindDownMove,
    applyWindDownMove,
    windDownTargetLabel,
    normalizeTrackerValue,
    parseStabilityPoints,
    parseHarmBoxes,
    stabilityBandFromPoints,
    harmConditionFromBoxes,
    formatPlayerStability,
    formatPlayerHarm,
    collapseBreakTypes,
    rewriteOverwriteTypes,
    syncCollapseRewriteStaging,
    populateCollapseOverlay,
    collapseBreakTypeChangeNeedsConfirm,
    markCollapseFieldsEdited,
    populateRewriteOverlay,
    activateCollapseMode,
    deactivateCollapseMode,
    clearCollapseStaging,
    activateRewriteMode,
    deactivateRewriteMode,
    markCollapseExitFailed,
    clueIntegrityStates,
    clueIntegrityActions,
    clueIntegrityStateLabel,
    getClueIntegritySummary,
    previewClueAction,
    applyClueAction,
    advanceClueState,
    hydrateClueIntegrity
  };
}());
