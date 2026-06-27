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
  const attentionAliases = {
    observed: "noticed",
    fixed: "targeted",
    witnessed: "targeted",
    marked: "targeted",
    pursued: "targeted",
    mythic: "exposed",
    claimed: "exposed"
  };
  const loopFields = ["Need", "Lure", "Pressure", "Gift", "Violence", "Exit"];
  const npcFlags = ["Ally", "Witness", "Threat", "Missing", "Compromised"];
  const anchorNpcStates = [
    { id: "with-operators", label: "With Operators", guidance: "Attention +1 on loud/risky/exposed action." },
    { id: "hidden", label: "Hidden", guidance: "Zone +1 when time passes or hiding is stressed." },
    { id: "separated", label: "Separated", guidance: "Attention +1 or Zone +1." },
    { id: "left-behind", label: "Left Behind", guidance: "Aftermath +1 immediately." },
    { id: "taken", label: "Taken", guidance: "Attention +1 and Aftermath +1, or start rescue clock." }
  ];
  const anchorNpcStateIds = anchorNpcStates.map((entry) => entry.id);
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
      label: "Recover Clean Clue",
      target: "case",
      effects: {
        case_delta: -1,
        case_record: "Clean clue recovered without feeding the site."
      },
      guidance: "Use when Operators recover the clue without feeding the site, exposing an NPC, or escalating attention. If the case clock is off, still record the clue cleanly."
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
      label: "Operators recover core clue cleanly",
      hint: "Clue lands without extra exposure.",
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
          "notes": "Use for grounding Mara and alternate clue routes.",
          "anchor": {
            "enabled": true,
            "label": "Anchor NPC",
            "state": "with-operators"
          }
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
            "attention": "Targeted",
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
              "consequence": "Camera tracks the quietest Operator; next observed lie has Disadvantage."
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
      npc_name_match: safeString(effects.npc_name_match, 80)
    };
  }

  function normalizeClockTarget(value) {
    const target = safeString(value, 40).toLowerCase();
    return ["zone", "attention", "case", "both"].includes(target) ? target : "";
  }

  function normalizeTableTriggers(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 10).map((trigger, index) => ({
      id: safeString(trigger.id, 80) || `trigger-${index + 1}`,
      label: safeString(trigger.label, 140),
      hint: safeString(trigger.hint, 220),
      effects: normalizeTriggerEffects(trigger.effects)
    })).filter((trigger) => trigger.label);
  }

  function normalizeActiveNeedlepoint(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: safeString(source.id, 80),
      scaffold: safeString(source.scaffold, 180),
      attention_states: normalizeAttentionStatesTable(source.attention_states),
      clock_attention_consequences: normalizeClockAttentionConsequences(source.clock_attention_consequences),
      table_triggers: normalizeTableTriggers(source.table_triggers),
      player_view: {
        safe_consequence: safeString(source.player_view?.safe_consequence, 220)
      }
    };
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
      consequence: draft.sceneState.primaryConsequence || "Unset",
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

    if (effects.case_delta) {
      draft.caseFile.nextPressureBeat = "Clean clue recovered without feeding the site.";
      draft.residueLog.unshift({
        id: `residue-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        scene: draft.sceneState.current,
        attention: draft.attention.current,
        residue: effects.case_record || `Clean clue recovered: ${draft.caseFile.nextClue || move.label}`,
        followsHome: draft.attention.followsHome || "",
        consequence: draft.secondaryClock.enabled
          ? "Case pressure reduced; clue secured."
          : "No clock reduced; clue secured cleanly."
      });
      if (draft.secondaryClock.enabled) {
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
      } else {
        changes.push({
          label: "Case Clock",
          before: "Disabled",
          after: "Clean clue recorded"
        });
      }
      changes.push({
        label: "Case Record",
        before: "Unlogged",
        after: draft.residueLog[0]?.residue || "Clean clue recovered."
      });
      changes.push({
        label: "Next Pressure",
        before: before.nextPressure,
        after: draft.caseFile.nextPressureBeat || "No beat staged."
      });
    }

    if (effects.consequence) {
      draft.sceneState.primaryConsequence = effects.consequence;
      changes.push({
        label: "Consequence",
        before: before.consequence,
        after: draft.sceneState.primaryConsequence || "Unset"
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
    const beforeClock = draft.primaryClock.current;
    const beforeAttention = draft.attention.current;
    const beforeScene = draft.sceneState.current;

    if (effects.clock_tick !== false && effects.clock_delta) {
      draft.primaryClock.current = safeNumber(
        beforeClock + effects.clock_delta,
        0,
        draft.primaryClock.segments,
        beforeClock
      );
    }

    draft.attention.current = resolveAttentionValue(beforeAttention, effects);
    draft.sceneState.current = resolveSceneStateValue(beforeScene, effects);
    draft.activeEntity.sceneState = draft.sceneState.current;

    if (effects.consequence) draft.sceneState.primaryConsequence = effects.consequence;
    if (effects.next_pressure_beat) draft.caseFile.nextPressureBeat = effects.next_pressure_beat;
    if (effects.next_clue) draft.caseFile.nextClue = effects.next_clue;

    if (options.persist && effects.npc_name_match) {
      const match = effects.npc_name_match.toLowerCase();
      draft.npcs.forEach((npc) => {
        if (!npc.name || npc.name.toLowerCase().indexOf(match) < 0) return;
        const note = effects.npc_pressure_note || "Pressure escalates from table trigger.";
        npc.pressure = npc.pressure ? `${npc.pressure} // ${note}` : note;
      });
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
          consequence: draft.sceneState.primaryConsequence || ""
        });
      }
      draft.residueLog.unshift({
        id: residueStamp(),
        scene: safeString(draft.session.location || draft.session.caseTitle, 140),
        attention: draft.attention.current,
        residue: `Trigger applied: ${trigger.label}`,
        followsHome: draft.attention.followsHome || "",
        consequence: draft.sceneState.primaryConsequence || ""
      });
    }

    const withNeedlepoint = hasActiveNeedlepoint(draft) ? applyNeedlepointAttention(draft) : draft;
    return {
      draft: withNeedlepoint,
      delta: {
        beforeClock,
        beforeAttention,
        beforeScene,
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
        label: "Consequence",
        before: state.sceneState.primaryConsequence || "Unset",
        after: withNeedlepoint.sceneState.primaryConsequence || "Unset"
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

  function findWindDownMove(moveId) {
    return windDownMoves.find((move) => move.id === moveId) || null;
  }

  function previewWindDownMove(state, moveId) {
    const move = findWindDownMove(moveId);
    if (!move) return null;

    const draft = clone(normalizeState(state));
    const before = {
      primary: draft.primaryClock.current,
      attention: draft.attention.current,
      scene: draft.sceneState.current,
      residue: draft.attention.residue || "None logged.",
      consequence: draft.sceneState.primaryConsequence || "Unset",
      nextPressure: draft.caseFile.nextPressureBeat || "No beat staged.",
      caseClock: draft.secondaryClock.enabled
        ? `${draft.secondaryClock.current}/${draft.secondaryClock.segments}`
        : "Disabled"
    };
    const { draft: windDownDraft, effects } = applyWindDownEffects(draft, move);
    const next = hasActiveNeedlepoint(windDownDraft) ? applyNeedlepointAttention(windDownDraft) : windDownDraft;
    const lines = [
      {
        label: "Responsibility",
        before: "Pending",
        after: windDownTargetLabel(move.target)
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
        after: next.sceneState.primaryConsequence || "Unset"
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
    const move = findWindDownMove(moveId);
    if (!move) return { state, message: "UNKNOWN WIND DOWN MOVE" };

    const draft = clone(normalizeState(state));
    const { draft: next, changes } = applyWindDownEffects(draft, move);
    const withNeedlepoint = hasActiveNeedlepoint(next) ? applyNeedlepointAttention(next) : next;
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
    return list.slice(0, 12).map((npc, index) => ({
      id: safeString(npc.id, 80) || `npc-${index + 1}`,
      name: safeString(npc.name, 100),
      role: safeString(npc.role, 100),
      pressure: safeString(npc.pressure, 160),
      location: safeString(npc.location, 120),
      flags: Array.isArray(npc.flags) ? npc.flags.filter((flag) => npcFlags.includes(flag)).slice(0, 5) : [],
      notes: safeString(npc.notes, 1000),
      anchor: normalizeNpcAnchor(npc.anchor)
    }));
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
    publicClockLabel,
    clockWarning,
    applyNeedlepointAttention,
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
    findWindDownMove,
    applyWindDownMove,
    windDownTargetLabel,
    normalizeTrackerValue,
    parseStabilityPoints,
    parseHarmBoxes,
    stabilityBandFromPoints,
    harmConditionFromBoxes,
    formatPlayerStability,
    formatPlayerHarm
  };
}());
