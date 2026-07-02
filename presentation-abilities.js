(function () {
  /**
   * Presentation permissions = ontology-facing abilities separate from Frequency petals.
   * Only actives with interaction contracts are clickable; passives stay reference unless marked optional.
   */
  const SURGE_ATTRS = ["Body", "Agility", "Instinct"];
  const SURGE_APPLIES_COPY = "Applies to next pursuit, force, escape, predatory movement, or blood-sense roll.";
  const RESONANT_READ_ATTRS = ["Instinct", "Mind", "Presence"];
  const RESONANT_READ_APPLIES_COPY = "Applies to next Instinct, Mind, or Presence read of a person, room, object, threat, ritual, recording, or pressure pattern.";
  const SECOND_PASS_ATTRS = ["Mind", "Agility", "Instinct"];
  const SECOND_PASS_APPLIES_COPY = "Applies to next Mind, Agility, or Instinct action when repeating, correcting, retracing, escaping, or exploiting something that already happened in the scene.";
  const SLIP_NOTICE_ATTRS = ["Agility", "Presence", "Mind"];
  const SLIP_NOTICE_APPLIES_COPY = "Applies to next Agility, Presence, or Mind action involving hiding in plain sight, avoiding notice, passing through distraction, escaping attention, or exploiting an omission.";
  const DAEMON_PUSH_ATTRS = ["Mind", "Presence"];
  const DAEMON_PUSH_APPLIES_COPY = "Applies to next Mind or Presence action involving devices, overlays, surveillance, signal tracing, myth-tech interfaces, corrupted records, or daemon-assisted analysis.";
  const FERAL_DRIVE_ATTRS = ["Body", "Agility", "Instinct"];
  const FERAL_DRIVE_APPLIES_COPY = "Applies to next Body, Agility, or Instinct action involving pursuit, escape, tracking, climbing, grappling, intimidation, endurance, threat response, or territorial defense.";
  const BORROWED_FORCE_ATTRS = ["Body", "Presence", "Mind", "Instinct"];
  const BORROWED_FORCE_APPLIES_COPY = "Applies to next Body, Presence, Mind, or Instinct action when drawing on the contained presence for strength, intimidation, resistance, perception, or supernatural pressure.";
  const FUNCTION_SURGE_ATTRS = ["Body", "Mind"];
  const FUNCTION_SURGE_APPLIES_COPY = "Applies to next Body or Mind action involving repair, endurance, precision, protection, purpose execution, system interaction, or continuing under pressure.";
  const ANOMALY_PUSH_ATTRS = ["Body", "Mind", "Instinct"];
  const ANOMALY_PUSH_APPLIES_COPY = "Applies to next Body, Mind, or Instinct action involving breach survival, anomaly handling, impossible spaces, corrupted physics, Void exposure, or resisting reality pressure.";
  const PRESENTATION_ROLL_ACTIVE_SPECS = {
    sanguine: {
      stateKey: "bloodSurge",
      label: "Blood Surge",
      prompt: "Spend or risk Blood Load?",
      spendLabel: "Spend 1 Blood Load",
      riskLabel: "Risk Blood Load",
      spendAction: "blood_surge_spend",
      riskAction: "blood_surge_risk",
      clearAction: "blood_surge_clear"
    },
    sensitive: {
      stateKey: "resonantRead",
      label: "Resonant Read",
      prompt: "Spend or risk Resonance Load?",
      spendLabel: "Spend 1 Resonance Load",
      riskLabel: "Risk Resonance Load",
      spendAction: "resonant_read_spend",
      riskAction: "resonant_read_risk",
      clearAction: "resonant_read_clear"
    },
    echo: {
      stateKey: "secondPass",
      label: "Second Pass",
      prompt: "Spend or risk Echo Load?",
      spendLabel: "Spend 1 Echo Load",
      riskLabel: "Risk Echo Load",
      spendAction: "second_pass_spend",
      riskAction: "second_pass_risk",
      clearAction: "second_pass_clear"
    },
    silence: {
      stateKey: "slipNotice",
      label: "Slip Notice",
      prompt: "Spend or risk Silence Load?",
      spendLabel: "Spend 1 Silence Load",
      riskLabel: "Risk Silence Load",
      spendAction: "slip_notice_spend",
      riskAction: "slip_notice_risk",
      clearAction: "slip_notice_clear"
    },
    technomancer: {
      stateKey: "daemonPush",
      label: "Daemon Push",
      prompt: "Spend or risk Signal Load?",
      spendLabel: "Spend 1 Signal Load",
      riskLabel: "Risk Signal Load",
      spendAction: "daemon_push_spend",
      riskAction: "daemon_push_risk",
      clearAction: "daemon_push_clear"
    },
    therian: {
      stateKey: "feralDrive",
      label: "Feral Drive",
      prompt: "Spend or risk Instinct Load?",
      spendLabel: "Spend 1 Instinct Load",
      riskLabel: "Risk Instinct Load",
      spendAction: "feral_drive_spend",
      riskAction: "feral_drive_risk",
      clearAction: "feral_drive_clear"
    },
    vessel: {
      stateKey: "borrowedForce",
      label: "Borrowed Force",
      prompt: "Spend or risk Containment Load?",
      spendLabel: "Spend 1 Containment Load",
      riskLabel: "Risk Containment Load",
      spendAction: "borrowed_force_spend",
      riskAction: "borrowed_force_risk",
      clearAction: "borrowed_force_clear"
    },
    construct: {
      stateKey: "functionSurge",
      label: "Function Surge",
      prompt: "Spend or risk Function Load?",
      spendLabel: "Spend 1 Function Load",
      riskLabel: "Risk Function Load",
      spendAction: "function_surge_spend",
      riskAction: "function_surge_risk",
      clearAction: "function_surge_clear"
    },
    void_shard: {
      stateKey: "anomalyPush",
      label: "Anomaly Push",
      prompt: "Spend or risk Void Load?",
      spendLabel: "Spend 1 Void Load",
      riskLabel: "Risk Void Load",
      spendAction: "anomaly_push_spend",
      riskAction: "anomaly_push_risk",
      clearAction: "anomaly_push_clear"
    }
  };
  const CONTAINED_TYPE_OPTIONS = [
    { id: "unknown", label: "Unknown" },
    { id: "angelic", label: "Angelic / Divine / Sainted" },
    { id: "infernal", label: "Demon / Infernal / Contracted" },
    { id: "dead", label: "Dead / Ancestral / Ghost-bound" },
    { id: "void", label: "Void / Breach / Null Presence" },
    { id: "daemon", label: "Daemon / AI / Synthetic Presence" },
    { id: "mythic", label: "Mythic Presence" },
    { id: "alien", label: "Alien Presence" },
    { id: "custom", label: "Custom" }
  ];
  const RECOVERY_ACTIONS = {
    ground: {
      label: "Ground",
      statusKey: "recoveryGround",
      rounds: 1,
      resolveLog: "Stability +1",
      effects: [{ track: "stability", delta: 1 }]
    },
    breathe: {
      label: "Breathe",
      statusKey: "recoveryBreathe",
      rounds: 1,
      resolveLog: "Stability +1 or cleared temporary pressure tag",
      effects: [{ kind: "breathe_recovery" }]
    },
    connect: {
      label: "Connect",
      statusKey: "recoveryConnect",
      rounds: 1,
      resolveLog: "Presentation Load moved 1 toward stable range",
      effects: [{ kind: "presentation_load_center", delta: 1 }]
    },
    leave: {
      label: "Leave",
      statusKey: "recoveryLeave",
      rounds: 1,
      resolveLog: "Exposure ended — blocks one scene-pressure tick",
      effects: [{ setFlag: "exposureEnded", value: true }]
    },
    name_it: {
      label: "Name It",
      statusKey: "recoveryNameIt",
      rounds: 1,
      resolveLog: "Pressure named or unknown-pressure cleared",
      effects: [{ kind: "name_it_recovery" }]
    }
  };
  const TREAT_HARM_TIMER = {
    abilityId: "treat_harm",
    label: "Treat Harm",
    effectType: "round_timer",
    remainingRounds: 1,
    resolutionKind: "treat_harm"
  };
  const ACTIVE_DANGER_ATTENTION = ["Targeted", "Exposed"];
  const RECOVERY_ORDER = ["ground", "breathe", "connect", "leave", "name_it"];
  const NAMED_PRESSURE_SKILLS = ["Stealth", "Survival", "Medicine", "Ritual"];

  function passivePermission(spec) {
    return {
      id: spec.id,
      name: spec.name,
      kind: "passive",
      effect: spec.effect || "",
      when: spec.when || "",
      handlerNote: spec.handlerNote || "",
      interaction: spec.interaction || "reference",
      clickable: false
    };
  }

  function activeAbility(spec) {
    return {
      id: spec.id,
      name: spec.name,
      kind: "active",
      headline: Boolean(spec.headline),
      cost: spec.cost || "",
      effect: spec.effect || "",
      roll: spec.roll || "",
      cadence: spec.cadence || "",
      tags: Array.isArray(spec.tags) ? spec.tags.slice() : [],
      interaction: spec.interaction || "active_confirm",
      clickable: true
    };
  }

  function bandModifier(spec) {
    return {
      atLoad: Number(spec.atLoad),
      bandLabel: spec.bandLabel || "",
      kind: spec.kind || "edge",
      helps: spec.helps || "",
      hurts: spec.hurts || "",
      note: spec.note || ""
    };
  }

  function collapseBehavior(spec) {
    return {
      atLoad: Number(spec.atLoad ?? 6),
      name: spec.name || "",
      bonus: spec.bonus || "",
      agency: spec.agency || "handler-framed",
      effect: spec.effect || "",
      risk: spec.risk || ""
    };
  }

  function hauntInterfaceSpec(spec) {
    return {
      enabled: Boolean(spec?.enabled),
      fields: Array.isArray(spec?.fields) ? spec.fields.slice() : [],
      defaultHauntRange: spec?.defaultHauntRange || ""
    };
  }

  function containmentInterfaceSpec(spec) {
    const source = spec && typeof spec === "object" ? spec : {};
    return {
      enabled: Boolean(source.enabled),
      containedTypeOptions: Array.isArray(source.containedTypeOptions)
        ? source.containedTypeOptions.slice()
        : CONTAINED_TYPE_OPTIONS.slice(),
      archivePaths: source.archivePaths && typeof source.archivePaths === "object"
        ? { ...source.archivePaths }
        : {}
    };
  }

  function presentationAbilityContract(spec) {
    return {
      id: spec.id,
      catalogKeys: Array.isArray(spec.catalogKeys) ? spec.catalogKeys.slice() : [],
      label: spec.label,
      displayLabel: spec.displayLabel || spec.label,
      accessTier: spec.accessTier || "",
      identityLine: spec.identityLine || "",
      pressureTrack: spec.pressureTrack || null,
      hauntInterface: hauntInterfaceSpec(spec.hauntInterface),
      containmentInterface: containmentInterfaceSpec(spec.containmentInterface),
      passivePermissions: Array.isArray(spec.passivePermissions)
        ? spec.passivePermissions.map(passivePermission)
        : [],
      activeAbilities: Array.isArray(spec.activeAbilities)
        ? spec.activeAbilities.map(activeAbility)
        : [],
      bandModifiers: Array.isArray(spec.bandModifiers)
        ? spec.bandModifiers.map(bandModifier)
        : [],
      collapseBehavior: spec.collapseBehavior ? collapseBehavior(spec.collapseBehavior) : null
    };
  }

  const PRESENTATION_ABILITIES = [
    presentationAbilityContract({
      id: "sanguine",
      catalogKeys: ["SANGUINE"],
      label: "Sanguine",
      accessTier: "handler_approval",
      identityLine: "Too warm, too fast, too close, too hard to stop.",
      pressureTrack: {
        trackId: "sanguine.blood_load",
        trackLabel: "Blood Load"
      },
      passivePermissions: [
        {
          id: "blood_sense",
          name: "Blood Sense",
          effect: "Detect nearby blood, injury, pulse, heat, or living warmth when fiction allows.",
          handlerNote: "Handler decides what answers.",
          interaction: "reference"
        },
        {
          id: "blood_warm_recovery",
          name: "Blood-Warm Recovery",
          when: "Coherent range (Blood Load 2–4)",
          effect: "Recovery, rest, and stabilization read as warmth returning. Handler may allow faster mundane recovery where appropriate.",
          handlerNote: "Coherent range (2–4): Treat Harm allowed. Load 5–6: no clean healing. Use Recovery checkboxes + Next Round.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "blood_surge",
          name: "Blood Surge",
          headline: true,
          cost: "Spend or risk Blood Load",
          effect: "+1 on one Body, Agility, or Instinct action involving pursuit, force, escape, predatory movement, or blood-sense.",
          tags: ["pursuit", "force", "escape", "predatory movement", "blood-sense"],
          interaction: "blood_surge"
        },
        {
          id: "closing_burst",
          name: "Closing Burst",
          cadence: "Once per scene",
          effect: "Move immediately into close range, cross a short gap, or intercept someone nearby if physically possible.",
          roll: "Roll if contested.",
          interaction: "once_per_scene"
        }
      ],
      bandModifiers: [
        {
          atLoad: 5,
          bandLabel: "Predatory Saturation",
          kind: "edge",
          helps: "+1 to pursuit, force, and blood-sense rolls",
          hurts: "-1 to restraint and masking rolls",
          note: "Appetite starts organizing behavior before the Operator names the want."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "Hunger Takes the Wheel",
        bonus: "+2 to predatory surge actions",
        agency: "handler-framed",
        effect: "Blood-body dominance kicks past normal human limits for one decisive beat — then keeps going.",
        risk: "Handler frames impulse, target pressure, and collateral risk."
      }
    }),
    presentationAbilityContract({
      id: "sensitive",
      catalogKeys: ["RESONANT_SENSITIVE"],
      label: "Resonant Sensitive",
      displayLabel: "Resonant Sensitive",
      accessTier: "open",
      identityLine: "Too aware, too open, too early, too easy to reach.",
      pressureTrack: {
        trackId: "sensitive.sensory_load",
        trackLabel: "Resonance Load"
      },
      passivePermissions: [
        {
          id: "pressure_sense",
          name: "Pressure Sense",
          effect: "Detect emotional charge, recent violence, unstable attention, fear, grief, obsession, or supernatural pressure when fiction allows.",
          handlerNote: "Handler decides what answers. Not perfect answers — pressure before language.",
          interaction: "reference"
        },
        {
          id: "signal_bruising",
          name: "Signal Bruising",
          effect: "When a room, object, person, or recording carries strong residue, feel that something happened here before proof appears.",
          handlerNote: "Residue sense, not generic perception.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "bad_room_read",
          name: "Bad Room Read",
          headline: true,
          cadence: "Once per scene",
          effect: "Ask the Handler one pressure question: what feels wrong, what is building, what is watching, what emotion does not belong, or what is about to become dangerous.",
          roll: "No roll. Handler frames the read.",
          interaction: "once_per_scene"
        },
        {
          id: "resonant_read",
          name: "Resonant Read",
          cost: "Spend or risk Resonance Load",
          effect: "+1 on one Instinct, Mind, or Presence action involving reading a person, room, object, threat, ritual, recording, or pressure pattern.",
          tags: ["pressure read", "danger read", "pattern recognition", "resonance read"],
          interaction: "resonant_read"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Numbed",
          kind: "deprived",
          hurts: "-1 to pressure-reading and resonance-native function",
          note: "Signal arrives muted; the world feels padded wrong."
        },
        {
          atLoad: 5,
          bandLabel: "Over-Tuned",
          kind: "edge",
          helps: "+1 to pressure reads, danger reads, pattern recognition, supernatural detection",
          hurts: "-1 to masking, calm social presence, or ignoring stimuli",
          note: "The room's signal organizes attention before consent catches up."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "The Signal Reads Back",
        bonus: "+2 to one urgent pressure-read or danger-response action",
        agency: "handler-framed",
        effect: "Sensory bleed, false certainty, unwanted empathy, attention spike, or emotional contamination take the mic.",
        risk: "Handler frames sensory bleed. -2 to masking, restraint, or control."
      }
    }),
    presentationAbilityContract({
      id: "echo",
      catalogKeys: ["ECHO_ALTERED", "MYTHIC_ECHO"],
      label: "Echo-Altered",
      displayLabel: "Echo-Altered",
      accessTier: "open",
      identityLine: "Too familiar, too recursive, too hard to surprise, too easy to repeat.",
      pressureTrack: {
        trackId: "echo.echo_load",
        trackLabel: "Echo Load"
      },
      passivePermissions: [
        {
          id: "echo_recognition",
          name: "Echo Recognition",
          effect: "Sense when a place, action, phrase, route, object, or person is repeating a prior pattern when fiction allows.",
          handlerNote: "Continuity sense, not time travel. Pattern before explanation.",
          interaction: "reference"
        },
        {
          id: "residual_familiarity",
          name: "Residual Familiarity",
          effect: "In a location with strong Echo residue, know small physical details you should not know: where the door sticks, which stair creaks, where someone stood too long.",
          handlerNote: "Handler frames what residue is strong enough.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "replay_slip",
          name: "Replay Slip",
          headline: true,
          cadence: "Once per scene",
          effect: "Briefly treat a current moment as if you have seen its shape before: avoid a repeated mistake, notice a changed detail, or act before a familiar pattern completes.",
          roll: "No roll. Handler frames the slip. Not a rewind.",
          interaction: "once_per_scene"
        },
        {
          id: "second_pass",
          name: "Second Pass",
          cost: "Spend or risk Echo Load",
          effect: "+1 on one Mind, Agility, or Instinct action when repeating, correcting, retracing, escaping, or exploiting something that has already happened in the scene.",
          tags: ["retrace", "repeat", "pattern break", "escape", "continuity"],
          interaction: "second_pass"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Dislocated",
          kind: "deprived",
          hurts: "-1 to echo-native function, retracing, and continuity reads",
          note: "Action and record stop lining up under witness."
        },
        {
          atLoad: 5,
          bandLabel: "Continuity Saturation",
          kind: "edge",
          helps: "+1 to retracing, pattern breaks, pursuit through known routes, repeated actions, recognizing scene loops",
          hurts: "-1 to improvisation, present-moment social reads, or accepting that something has truly changed",
          note: "The next move wants to be the last move again."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "The Loop Closes",
        bonus: "+2 to one urgent repeat/retrace/escape action",
        agency: "handler-framed",
        effect: "Compulsive repetition, timeline confusion, scene bleed, mistaken familiarity, or a loop attempting to complete through the Operator.",
        risk: "Handler frames loop impulse. -2 to restraint, control, or breaking the loop."
      }
    }),
    presentationAbilityContract({
      id: "silence",
      catalogKeys: ["HOLLOW_SILENCE_ALTERED"],
      label: "Hollow / Silence-Altered",
      displayLabel: "Hollow / Silence-Altered",
      accessTier: "open",
      identityLine: "Too quiet, too hard to hold, too easy to miss, too close to gone.",
      pressureTrack: {
        trackId: "silence.silence_load",
        trackLabel: "Silence Load"
      },
      passivePermissions: [
        {
          id: "omitted_presence",
          name: "Omitted Presence",
          effect: "Be overlooked, underreported, misremembered, or deprioritized when fiction allows — especially in crowds, records, witness accounts, and distracted scenes.",
          handlerNote: "Failure of attention, not invisibility.",
          interaction: "reference"
        },
        {
          id: "quiet_cut",
          name: "Quiet Cut",
          effect: "Sense gaps: missing names, omitted footage, redacted details, unsaid motives, silent rooms, or places where attention refuses to settle.",
          handlerNote: "Handler frames what the gap is willing to show.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "leave_a_blank",
          name: "Leave a Blank",
          headline: true,
          cadence: "Once per scene",
          effect: "Create a small absence: a witness hesitates, a camera loses a beat, a guard forgets to mention them, a record fails to fully catch them, or a question slides off the room.",
          roll: "Roll if contested or system-secured.",
          interaction: "once_per_scene"
        },
        {
          id: "slip_notice",
          name: "Slip Notice",
          cost: "Spend or risk Silence Load",
          effect: "+1 on one Agility, Presence, or Mind action involving hiding in plain sight, avoiding notice, passing through a distracted space, escaping attention, or exploiting an omission.",
          tags: ["hide", "omit", "misdirect", "escape attention", "quiet cut"],
          interaction: "slip_notice"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Overexposed",
          kind: "deprived",
          hurts: "-1 to silence-native function, omission, concealment, and reading gaps",
          note: "Speech, record, and emotional signal refuse to stay hidden."
        },
        {
          atLoad: 5,
          bandLabel: "Negative Space",
          kind: "edge",
          helps: "+1 to hiding, omission, misdirection, quiet escape, or reading what is missing",
          hurts: "-1 to being remembered, making direct social impact, asking for help, or asserting identity",
          note: "The table realizes something cannot be said aloud."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "The Missing Part Wins",
        bonus: "+2 to one urgent omission, escape, concealment, or nullification action",
        agency: "handler-framed",
        effect: "Erasure pressure, lost identity, record damage, social disappearance, or something important forgetting them back.",
        risk: "Handler frames erasure impulse. -2 to restraint, identity assertion, social anchoring, or staying recorded."
      }
    }),
    presentationAbilityContract({
      id: "technomancer",
      catalogKeys: ["TECHNOMANCER_DAEMON_ALIGNED"],
      label: "Technomancer / Daemon-Aligned",
      displayLabel: "Technomancer / Daemon-Aligned",
      accessTier: "open",
      identityLine: "Too connected, too readable, too useful, too easy to route through.",
      pressureTrack: {
        trackId: "technomancer.signal_load",
        trackLabel: "Signal Load"
      },
      passivePermissions: [
        {
          id: "signal_sight",
          name: "Signal Sight",
          effect: "Can sense active devices, corrupted feeds, surveillance attention, nearby networks, abnormal UI behavior, daemon traces, or myth-tech signal pressure when fiction allows.",
          handlerNote: "Handler frames what the signal is willing to show.",
          interaction: "reference"
        },
        {
          id: "interface_sympathy",
          name: "Interface Sympathy",
          effect: "Mundane devices respond easier to the Operator's presence: screens wake, static clears, corrupted files expose fragments, locked systems show where they resist. Permission to interact, not automatic control.",
          handlerNote: "Handler frames resistance and consent.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "soft_override",
          name: "Soft Override",
          headline: true,
          cadence: "Once per scene",
          effect: "Ask a device, feed, lock, sensor, file, bot, or interface to do one small plausible thing: open, pause, loop, reveal, ping, mute, spoof, misroute, or display a hidden fragment.",
          roll: "Roll if secured, hostile, unstable, or contested.",
          interaction: "once_per_scene"
        },
        {
          id: "daemon_push",
          name: "Daemon Push",
          cost: "Spend or risk Signal Load",
          effect: "+1 on one Focus, Logic, or Presence action involving devices, overlays, surveillance, signal tracing, myth-tech interfaces, corrupted records, or daemon-assisted analysis.",
          tags: ["device work", "signal trace", "daemon push", "interface", "surveillance"],
          interaction: "daemon_push"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Desynced",
          kind: "deprived",
          hurts: "-1 to signal-native function, device work, daemon reads, and interface actions",
          note: "Devices and channels read dead or untrustworthy."
        },
        {
          atLoad: 5,
          bandLabel: "Overclocked Link",
          kind: "edge",
          helps: "+1 to device work, signal reads, daemon pushes, surveillance manipulation, or myth-tech interface actions",
          hurts: "-1 to bodily awareness, offline tasks, masking signal presence, or ignoring prompts",
          note: "The system offers solutions before the Operator asks."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "The System Writes Back",
        bonus: "+2 to one urgent override, trace, daemon push, or interface action",
        agency: "handler-framed",
        effect: "Handler frames command bleed, hostile prompts, identity spoofing, device backlash, leaked location, or the daemon acting through the Operator.",
        risk: "Handler frames system impulse. -2 to restraint, control, signal masking, or resisting daemon/system prompts."
      }
    }),
    presentationAbilityContract({
      id: "therian",
      catalogKeys: ["THERIAN_ADAPTATION"],
      label: "Therian Adaptation",
      displayLabel: "Therian Adaptation",
      accessTier: "open",
      identityLine: "Too alert, too physical, too territorial, too honest to pass as calm.",
      pressureTrack: {
        trackId: "therian.instinct_load",
        trackLabel: "Instinct Load"
      },
      passivePermissions: [
        {
          id: "animal_read",
          name: "Animal Read",
          effect: "Can detect scent, movement tension, territorial pressure, fear response, injury, pursuit trails, or predator/prey behavior when fiction allows.",
          handlerNote: "Handler frames what the body is willing to notice.",
          interaction: "reference"
        },
        {
          id: "body_memory",
          name: "Body Memory",
          effect: "The Operator's body adapts around instinct: better balance, posture, threat orientation, silent movement, pain compartmentalization, or environmental awareness when the scene supports it. Permission, not armor.",
          handlerNote: "Handler frames what the body can carry without breaking cover.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "claim_ground",
          name: "Claim Ground",
          headline: true,
          cadence: "Once per scene",
          effect: "Mark a person, route, room, exit, object, or zone of movement as claimed for the current conflict. Gain fictional priority to defend, track, intercept, hold, or notice intrusion there.",
          roll: "Roll if contested.",
          interaction: "once_per_scene"
        },
        {
          id: "feral_drive",
          name: "Feral Drive",
          cost: "Spend or risk Instinct Load",
          effect: "+1 on one Body, Agility, or Instinct action involving pursuit, escape, tracking, climbing, grappling, intimidation, endurance, threat response, or territorial defense.",
          tags: ["pursuit", "escape", "tracking", "territory", "threat response", "intimidation"],
          interaction: "feral_drive"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Leashed",
          kind: "deprived",
          hurts: "-1 to instinct-native function, animal reads, tracking, and territorial response",
          note: "Human choice leads, but the body's threat-sense feels far away."
        },
        {
          atLoad: 5,
          bandLabel: "Hunting Pitch",
          kind: "edge",
          helps: "+1 to tracking, pursuit, threat response, intimidation, movement, or territorial actions",
          hurts: "-1 to restraint, verbal negotiation, masking intent, or backing down",
          note: "Threat and desire read through nonhuman patterning."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "The Body Decides",
        bonus: "+2 to one urgent chase, strike, escape, defend, track, or territorial action",
        agency: "handler-framed",
        effect: "Handler frames feral impulse, target fixation, dominance pressure, flight response, or collateral harm.",
        risk: "Handler frames territorial impulse. -2 to restraint, control, masking, or disengaging."
      }
    }),
    presentationAbilityContract({
      id: "vessel",
      catalogKeys: ["VESSEL"],
      label: "Vessel",
      displayLabel: "Vessel",
      accessTier: "handler_approval",
      identityLine: "Too full, too watched from within, too hard to break, too dangerous to open.",
      pressureTrack: {
        trackId: "vessel.containment_load",
        trackLabel: "Containment Load"
      },
      containmentInterface: {
        enabled: true,
        containedTypeOptions: CONTAINED_TYPE_OPTIONS,
        archivePaths: {
          angelic: "Radiance Archive",
          infernal: "Covenant Archive",
          dead: "Death Archive",
          daemon: "Machine Archive",
          void: "Deep Void Archive",
          mythic: "Mythic Archive",
          alien: "Alien Archive",
          custom: "Handler-defined subtype"
        }
      },
      passivePermissions: [
        {
          id: "inner_pressure",
          name: "Inner Pressure",
          effect: "Can sense when the contained presence reacts to people, places, objects, rituals, threats, entities, or emotional states when fiction allows.",
          handlerNote: "Handler frames what the inside is willing to notice.",
          interaction: "reference"
        },
        {
          id: "sealed_resilience",
          name: "Sealed Resilience",
          effect: "The Vessel may endure certain pressures because something inside absorbs, contests, hungers for, or recognizes the force involved. Permission, not immunity.",
          handlerNote: "Handler frames what the seal can carry without opening.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "let_it_look",
          name: "Let It Look",
          headline: true,
          cadence: "Once per scene",
          effect: "Allow the contained presence to perceive through the Vessel. Ask the Handler what it notices, wants, fears, recognizes, or refuses.",
          roll: "Roll if the presence is hostile, hungry, alien, or unstable.",
          interaction: "once_per_scene"
        },
        {
          id: "borrowed_force",
          name: "Borrowed Force",
          cost: "Spend or risk Containment Load",
          effect: "+1 on one Body, Presence, Focus, or Instinct action when briefly drawing on the contained presence for strength, intimidation, resistance, perception, or supernatural pressure.",
          tags: ["borrowed force", "intimidation", "resistance", "inner presence", "supernatural pressure"],
          interaction: "borrowed_force"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Sealed Shut",
          kind: "deprived",
          hurts: "-1 to containment-native function, inner reads, borrowed force, and seal response",
          note: "The contained presence sleeps, bound, or refuses to answer."
        },
        {
          atLoad: 5,
          bandLabel: "Seal Strain",
          kind: "edge",
          helps: "+1 to borrowed force, resistance, intimidation, inner-presence reads, or supernatural pressure contests",
          hurts: "-1 to self-control, masking, ordinary social presence, or keeping the contained thing quiet",
          note: "At 5, the Vessel borrows from what is inside."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "Something Opens Its Eyes",
        bonus: "+2 to one urgent borrowed-force, resistance, perception, or pressure action",
        agency: "handler-framed",
        effect: "Handler frames emergence pressure, voice bleed, body overwrite, target fixation, bargain impulse, or the contained presence acting through the Vessel.",
        risk: "Handler frames emergence impulse. -2 to restraint, control, masking, or resisting contained prompts."
      }
    }),
    presentationAbilityContract({
      id: "construct",
      catalogKeys: ["CONSTRUCT", "CONSTRUCT_VESSEL"],
      label: "Construct",
      displayLabel: "Construct",
      accessTier: "handler_approval",
      identityLine: "Too useful, too durable, too focused, too easy to reduce to function.",
      pressureTrack: {
        trackId: "construct.function_load",
        trackLabel: "Function Load"
      },
      passivePermissions: [
        {
          id: "diagnostic_sense",
          name: "Diagnostic Sense",
          effect: "Can assess structural damage, system failure, bodily strain, tool condition, environmental stress, or procedural inefficiency when fiction allows.",
          handlerNote: "Handler frames what the body or system is willing to report.",
          interaction: "reference"
        },
        {
          id: "built_to_continue",
          name: "Built To Continue",
          effect: "The Construct may endure fatigue, fear, pain, repetition, or environmental discomfort differently because their body or identity routes around ordinary human limits. Permission, not immunity.",
          handlerNote: "Handler frames what the purpose can carry without breaking cover.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "execute_directive",
          name: "Execute Directive",
          headline: true,
          cadence: "Once per scene",
          effect: "Declare a narrow directive for the current problem: protect this person, hold this door, repair this system, reach this point, finish this task, preserve this evidence. Gain fictional priority while acting directly toward that directive.",
          roll: "Roll if resisted, complex, or dangerous.",
          interaction: "once_per_scene"
        },
        {
          id: "function_surge",
          name: "Function Surge",
          cost: "Spend or risk Function Load",
          effect: "+1 on one Body, Focus, Logic, or Craft action involving repair, endurance, precision, protection, execution of purpose, system interaction, or continuing under pressure.",
          tags: ["repair", "endurance", "precision", "directive", "procedure"],
          interaction: "function_surge"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Degraded",
          kind: "deprived",
          hurts: "-1 to function-native work, diagnostics, procedure, and directive execution",
          note: "Tasks stutter, diagnostics lie, or purpose feels out of reach."
        },
        {
          atLoad: 5,
          bandLabel: "Purpose Lock",
          kind: "edge",
          helps: "+1 to directive actions, repair, endurance, protection, precision work, or system tasks",
          hurts: "-1 to improvisation, emotional flexibility, social softness, or abandoning the task",
          note: "At 5, the Construct executes the purpose."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "The Directive Overrides",
        bonus: "+2 to one urgent directive, endurance, repair, protection, or precision action",
        agency: "handler-framed",
        effect: "Handler frames command fixation, emotional shutdown, collateral disregard, self-damage, or the Construct's purpose acting through them.",
        risk: "Handler frames directive impulse. -2 to restraint, improvisation, emotional flexibility, or defying purpose."
      }
    }),
    presentationAbilityContract({
      id: "void_shard",
      catalogKeys: ["VOID_SHARD"],
      label: "Void-Shard",
      displayLabel: "Void-Shard",
      accessTier: "handler_approval",
      identityLine: "Too contaminated, too compatible with wrongness, too useful near the impossible, too dangerous to stand beside.",
      pressureTrack: {
        trackId: "void_shard.void_load",
        trackLabel: "Void Load"
      },
      passivePermissions: [
        {
          id: "breach_tolerance",
          name: "Breach Tolerance",
          effect: "Can endure, approach, or function near minor anomalies, unstable spaces, impossible geometry, pressure leaks, or breach residue when fiction allows. Permission, not immunity.",
          handlerNote: "Handler frames what the Shard can carry without opening further.",
          interaction: "reference"
        },
        {
          id: "wrongness_sense",
          name: "Wrongness Sense",
          effect: "Can detect when reality is thin, rules are inconsistent, a space has been breached, an object is contaminated, or an event does not belong.",
          handlerNote: "Handler frames what wrongness is willing to show before proof appears.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "break_pattern",
          name: "Break Pattern",
          headline: true,
          cadence: "Once per scene",
          effect: "Exploit a local inconsistency: pass through a warped threshold, ignore one impossible penalty, disrupt an anomaly's rhythm, stabilize a breach for a beat, or make the wrong rule fail.",
          roll: "Roll if the breach is hostile, major, or observed.",
          interaction: "once_per_scene"
        },
        {
          id: "anomaly_push",
          name: "Anomaly Push",
          cost: "Spend or risk Void Load",
          effect: "+1 on one Focus, Instinct, Body, or Logic action involving breach survival, anomaly handling, impossible spaces, corrupted physics, Void exposure, or resisting reality pressure.",
          tags: ["breach survival", "anomaly", "impossible space", "void exposure"],
          interaction: "anomaly_push"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Cold Shard",
          kind: "deprived",
          hurts: "-1 to void-native function, breach reads, anomaly handling, and reality-fit",
          note: "The wound runs cold; ordinary rules feel too solid to trust."
        },
        {
          atLoad: 5,
          bandLabel: "Contamination Bloom",
          kind: "edge",
          helps: "+1 to anomaly survival, breach reads, impossible movement, contamination handling, or reality-pressure resistance",
          hurts: "-1 to stability, normal social grounding, masking contamination, or trusting ordinary perception",
          note: "At 5, the Operator uses the Shard to survive the impossible."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "The Breach Answers",
        bonus: "+2 to one urgent anomaly, breach, escape, resistance, or impossible-space action",
        agency: "handler-framed",
        effect: "Handler frames breach expansion, contamination spread, spatial contradiction, attention from the Void, or reality using the Operator as a weak point.",
        risk: "Handler frames breach impulse. -2 to restraint, stability, masking contamination, or trusting ordinary perception."
      }
    }),
    presentationAbilityContract({
      id: "wraith",
      catalogKeys: ["WRAITH_TOUCHED_ANCHOR_BOUND", "WRAITH"],
      label: "Wraith",
      displayLabel: "Wraith-Touched / Anchor-Bound",
      accessTier: "handler_approval",
      identityLine: "Bound to a Locus. Haunting through geometry, not spell lists.",
      pressureTrack: {
        trackId: "wraith.essence_load",
        trackLabel: "Essence Load"
      },
      hauntInterface: {
        enabled: true,
        defaultHauntRange: "Full in/through Locus. Limited through Tethers.",
        fields: [
          { id: "primaryLocus", label: "Primary Locus", placeholder: "Name your Locus" },
          { id: "locusScale", label: "Locus Scale", placeholder: "Vehicle, room, building…" },
          { id: "hauntRange", label: "Locus Range", placeholder: "Full in/through Locus. Limited through Tethers." }
        ]
      },
      passivePermissions: [
        {
          id: "locus_sense",
          name: "Locus Sense",
          effect: "You know when someone touches, enters, damages, records, or meaningfully invokes your Locus.",
          interaction: "reference"
        },
        {
          id: "haunt_reach",
          name: "Locus Reach",
          effect: "You may attempt Wraith actions through a valid Locus or Tether without direct physical contact. The action originates from continuity, not distance.",
          interaction: "reference"
        },
        {
          id: "dead_presence",
          name: "Dead Presence",
          effect: "Inside your Locus or near a Tether, you may manifest signs of presence: cold, sound, reflection, movement, pressure.",
          interaction: "reference"
        }
      ],
      activeAbilities: [
        {
          id: "poltergeist_touch",
          name: "Poltergeist Touch",
          roll: "Roll if contested.",
          effect: "Move, open, close, jam, flicker, stall, or disturb something connected to your Locus or Tether.",
          interaction: "once_per_scene"
        },
        {
          id: "dead_route",
          name: "Dead Route",
          roll: "Roll if risky.",
          effect: "Move sound, shadow, attention, or presence through Locus geometry.",
          interaction: "once_per_scene"
        },
        {
          id: "essence_transfer",
          name: "Essence Transfer",
          cost: "Move 1 Essence",
          effect: "Store Essence in a meaningful object, person, place, or record to create or feed a Tether.",
          interaction: "essence_transfer_note"
        },
        {
          id: "re_corporealize",
          name: "Re-Corporealize",
          cost: "Delay / low Essence",
          effect: "If disrupted near a valid Locus or Tether, return after 1d3 rounds or the next quiet beat.",
          interaction: "countdown_timer"
        },
        {
          id: "anchor_pull",
          name: "Anchor Pull",
          cadence: "Scene action",
          effect: "While touching or inside your Locus, move Essence Load 1 step toward 2–4.",
          interaction: "load_shift_center"
        }
      ],
      bandModifiers: [
        {
          atLoad: 0,
          bandLabel: "Fading",
          kind: "deprived",
          helps: "",
          hurts: "-1 to presence, self-memory, and acting away from Locus/Tether",
          note: "The cup reads empty — presence thins away from anchor."
        },
        {
          atLoad: 5,
          bandLabel: "Possessive Saturation",
          kind: "edge",
          helps: "+1 to Locus actions, haunting, ghost-sense, intimidation",
          hurts: "-1 to restraint and self-separation",
          note: "Essence starts steering behavior before the Operator names the want."
        }
      ],
      collapseBehavior: {
        atLoad: 6,
        name: "Haunting Risk",
        bonus: "+2 to Locus surge actions",
        agency: "handler-framed",
        effect: "Containment frays — anchor failure, predatory haunting, or dead identity residue takes the mic.",
        risk: "Handler frames the haunting impulse. -2 to restraint and self-separation."
      }
    })
  ];

  const abilityById = Object.fromEntries(PRESENTATION_ABILITIES.map((item) => [item.id, item]));
  const catalogKeyIndex = {};
  PRESENTATION_ABILITIES.forEach((entry) => {
    entry.catalogKeys.forEach((key) => {
      catalogKeyIndex[String(key).toUpperCase()] = entry.id;
    });
  });

  function defaultSceneTimer() {
    return {
      round: 1,
      timers: [],
      log: [],
      recoveryFlags: { exposureEnded: false, namedPressure: false },
      lastError: ""
    };
  }

  function normalizeTimerEntry(entry, index) {
    const effectType = ["round_timer", "countdown", "scene_flag", "instant"].includes(entry?.effectType)
      ? entry.effectType
      : "round_timer";
    return {
      id: String(entry?.id || `timer-${index + 1}`),
      abilityId: String(entry?.abilityId || "").slice(0, 80),
      presentationId: String(entry?.presentationId || "").slice(0, 40),
      label: String(entry?.label || "Pending effect").slice(0, 120),
      effectType,
      remainingRounds: Math.max(0, Number(entry?.remainingRounds) || 0),
      awaitingResolution: Boolean(entry?.awaitingResolution),
      resolutionKind: String(entry?.resolutionKind || "").slice(0, 40)
    };
  }

  function normalizeRecoveryFlags(flags) {
    const raw = flags && typeof flags === "object" ? flags : {};
    return {
      exposureEnded: Boolean(raw.exposureEnded),
      namedPressure: Boolean(raw.namedPressure),
      unknownPressure: Boolean(raw.unknownPressure)
    };
  }

  function normalizeSceneTimer(status) {
    const next = { ...(status || {}) };
    const raw = next.sceneTimer && typeof next.sceneTimer === "object" ? next.sceneTimer : {};
    const timers = Array.isArray(raw.timers) ? raw.timers.map(normalizeTimerEntry) : [];
    const log = Array.isArray(raw.log) ? raw.log.map((line) => String(line).slice(0, 160)).slice(0, 8) : [];
    next.sceneTimer = {
      round: Math.max(1, Number(raw.round) || 1),
      timers: timers.slice(0, 24),
      log,
      recoveryFlags: normalizeRecoveryFlags(raw.recoveryFlags),
      harmRecoveredThisScene: Boolean(raw.harmRecoveredThisScene),
      lastError: String(raw.lastError || "").slice(0, 160)
    };
    return next;
  }

  function isActiveDanger(status) {
    const attention = String(status?.attentionState || "").trim();
    return ACTIVE_DANGER_ATTENTION.includes(attention);
  }

  function sanguineBloodLoad(status) {
    const pressure = window.PresentationPressure;
    if (!pressure) return 0;
    return pressure.readTrackValue(status, "sanguine.blood_load");
  }

  function isSanguinePresentation(catalogKey) {
    const key = String(catalogKey || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
    return key === "SANGUINE" || abilityForCatalogKey(key)?.id === "sanguine";
  }

  function bloodWarmCoherent(status, catalogKey) {
    if (!isSanguinePresentation(catalogKey)) return false;
    const load = sanguineBloodLoad(status);
    return load >= 2 && load <= 4;
  }

  function bloodWarmBlocksHealing(status, catalogKey) {
    if (!isSanguinePresentation(catalogKey)) return false;
    const load = sanguineBloodLoad(status);
    return load >= 5;
  }

  function treatHarmEligibility(status, catalogKey) {
    const next = normalizePresentationAbilityState(status);
    const harm = Number(next.harmBoxes || 0);
    if (harm <= 0) {
      return { ok: false, reason: "No Harm recorded to treat." };
    }
    if (next.sceneTimer.harmRecoveredThisScene) {
      return { ok: false, reason: "Only 1 Harm can be recovered per scene." };
    }
    if (hasActiveTimer(next, TREAT_HARM_TIMER.abilityId)) {
      return { ok: false, reason: "Treat Harm already pending." };
    }
    if (isActiveDanger(next)) {
      return { ok: false, reason: "Harm cannot be reduced during active danger." };
    }
    if (bloodWarmBlocksHealing(next, catalogKey)) {
      return { ok: false, reason: "Blood Load too high for clean healing." };
    }
    if (isSanguinePresentation(catalogKey) && !bloodWarmCoherent(next, catalogKey)) {
      return { ok: false, reason: "Blood-Warm Recovery requires Coherent range (2–4)." };
    }
    return { ok: true, reason: "" };
  }

  function appendSceneTimerLog(status, line) {
    const next = normalizeSceneTimer(status);
    const copy = String(line || "").slice(0, 160);
    if (!copy) return next;
    next.sceneTimer.log = [copy, ...(next.sceneTimer.log || [])].slice(0, 8);
    return next;
  }

  function checkedRecoveryKeys(status) {
    return RECOVERY_ORDER.filter((key) => Boolean(status?.[RECOVERY_ACTIONS[key].statusKey]));
  }

  function clearRecoveryCheckboxes(status) {
    const next = { ...status };
    RECOVERY_ORDER.forEach((key) => {
      next[RECOVERY_ACTIONS[key].statusKey] = false;
    });
    return next;
  }

  function presentationTrackIdForCatalog(catalogKey) {
    const pressure = window.PresentationPressure;
    if (!pressure || !catalogKey) return "";
    const presentation = pressure.presentationForCatalogKey(catalogKey);
    return presentation?.tracks?.[0]?.id || "";
  }

  function applyRecoveryEffect(status, effect, catalogKey) {
    let next = normalizePresentationAbilityState(status);
    if (effect.track && Number.isFinite(effect.delta)) {
      const current = Number(next[effect.track] ?? 0);
      next[effect.track] = clampTrackerValue(effect.track, current + effect.delta);
      return next;
    }
    if (effect.clearTag === "temporary_pressure" || effect.kind === "breathe_recovery") {
      const surge = next.presentationAbilityState.sanguine?.bloodSurge;
      if (surge?.active || surge?.riskQueued) {
        next.presentationAbilityState.sanguine.bloodSurge = {
          active: false,
          mode: "",
          riskQueued: false
        };
        return next;
      }
      if (effect.kind === "breathe_recovery") {
        const current = Number(next.stability ?? 0);
        next.stability = clampTrackerValue("stability", current + 1);
      }
      return next;
    }
    if (effect.kind === "name_it_recovery") {
      const flags = normalizeRecoveryFlags(next.sceneTimer.recoveryFlags);
      if (flags.unknownPressure) {
        next.sceneTimer.recoveryFlags = { ...flags, unknownPressure: false };
      } else {
        next.sceneTimer.recoveryFlags = { ...flags, namedPressure: true };
      }
      return next;
    }
    if (effect.kind === "presentation_load_center") {
      const trackId = presentationTrackIdForCatalog(catalogKey);
      if (trackId) next = shiftLoadTowardCenter(next, trackId, effect.delta || 1);
      return next;
    }
    if (effect.setFlag === "exposureEnded") {
      next.sceneTimer.recoveryFlags = {
        ...normalizeRecoveryFlags(next.sceneTimer.recoveryFlags),
        exposureEnded: Boolean(effect.value)
      };
      return next;
    }
    if (effect.addTag === "named_pressure") {
      next.sceneTimer.recoveryFlags = {
        ...normalizeRecoveryFlags(next.sceneTimer.recoveryFlags),
        namedPressure: true
      };
      return next;
    }
    return next;
  }

  function applyRecoveryAction(status, actionKey, catalogKey) {
    const action = RECOVERY_ACTIONS[actionKey];
    if (!action) return { status, label: "", resolveLog: "" };
    let next = normalizePresentationAbilityState(status);
    if (actionKey === "ground" && bloodWarmBlocksHealing(next, catalogKey)) {
      next.sceneTimer.lastError = "No clean healing at this Blood Load. Stabilize load first.";
      return { status: next, label: action.label, resolveLog: "", blocked: true };
    }
    let resolveLog = action.resolveLog;
    if (actionKey === "breathe") {
      const surge = next.presentationAbilityState?.sanguine?.bloodSurge;
      resolveLog = (surge?.active || surge?.riskQueued)
        ? "Cleared temporary pressure tag"
        : "Stability +1";
    }
    if (actionKey === "name_it") {
      const flags = normalizeRecoveryFlags(next.sceneTimer?.recoveryFlags);
      resolveLog = flags.unknownPressure
        ? "Cleared unknown-pressure tag"
        : "+1 next stabilization/resistance roll";
    }
    (action.effects || []).forEach((effect) => {
      next = applyRecoveryEffect(next, effect, catalogKey);
    });
    next[action.statusKey] = false;
    return { status: next, label: action.label, resolveLog };
  }

  function resolveTreatHarmTimer(status, catalogKey) {
    let next = normalizePresentationAbilityState(status);
    const harm = Number(next.harmBoxes || 0);
    if (harm <= 0) {
      return { status: next, resolved: false, skipped: true, resolveLog: "no Harm to reduce" };
    }
    if (next.sceneTimer.harmRecoveredThisScene) {
      return { status: next, resolved: false, skipped: true, resolveLog: "Harm already recovered this scene" };
    }
    if (isActiveDanger(next)) {
      return { status: next, resolved: false, skipped: true, resolveLog: "treatment unsafe — active danger" };
    }
    if (bloodWarmBlocksHealing(next, catalogKey)) {
      return { status: next, resolved: false, skipped: true, resolveLog: "Blood Load too high for clean healing" };
    }
    if (isSanguinePresentation(catalogKey) && !bloodWarmCoherent(next, catalogKey)) {
      return { status: next, resolved: false, skipped: true, resolveLog: "Blood-Warm Recovery requires Coherent range" };
    }
    next.harmBoxes = clampTrackerValue("harmBoxes", harm - 1);
    next.sceneTimer.harmRecoveredThisScene = true;
    return { status: next, resolved: true, resolveLog: "Harm -1" };
  }

  function resolveDeclaredRecovery(status, catalogKey) {
    let next = normalizePresentationAbilityState(status);
    const checked = checkedRecoveryKeys(next);
    if (!checked.length) return { status: next, resolved: false };
    if (checked.length > 1) {
      next.sceneTimer.lastError = "One recovery per round. Uncheck extras.";
      return { status: next, resolved: false, blocked: true };
    }
    const result = applyRecoveryAction(next, checked[0], catalogKey);
    if (result.blocked) {
      return { status: result.status, resolved: false, blocked: true };
    }
    result.status.sceneTimer.lastError = "";
    return {
      status: result.status,
      resolved: true,
      label: result.label,
      resolveLog: result.resolveLog
    };
  }

  function namedPressureAppliesToRoll(status, attrKey, skillKey) {
    const flags = normalizeRecoveryFlags(status?.sceneTimer?.recoveryFlags);
    if (!flags.namedPressure) return false;
    const attr = String(attrKey || "").trim();
    const skill = String(skillKey || "").trim();
    return attr === "Nerves" || NAMED_PRESSURE_SKILLS.includes(skill);
  }

  function namedPressureRollBonus(status, attrKey, skillKey) {
    return namedPressureAppliesToRoll(status, attrKey, skillKey) ? 1 : 0;
  }

  function consumeNamedPressureOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    if (!normalized.sceneTimer?.recoveryFlags?.namedPressure) return normalized;
    normalized.sceneTimer.recoveryFlags = {
      ...normalizeRecoveryFlags(normalized.sceneTimer.recoveryFlags),
      namedPressure: false
    };
    return normalized;
  }

  function createTimer(spec) {
    return normalizeTimerEntry({
      id: spec.id || `${spec.abilityId || "timer"}-${Date.now()}`,
      abilityId: spec.abilityId || "",
      presentationId: spec.presentationId || "",
      label: spec.label || "Pending effect",
      effectType: spec.effectType || "round_timer",
      remainingRounds: Math.max(0, Number(spec.remainingRounds) || 0),
      awaitingResolution: false,
      resolutionKind: spec.resolutionKind || ""
    }, 0);
  }

  function hasActiveTimer(status, abilityId) {
    const timers = status?.sceneTimer?.timers || [];
    return timers.some((timer) => timer.abilityId === abilityId
      && (timer.remainingRounds > 0 || timer.awaitingResolution));
  }

  function rollCountdownRounds() {
    return 1 + Math.floor(Math.random() * 3);
  }

  function defaultPresentationState(presentationId) {
    if (presentationId === "sanguine") {
      return {
        bloodSurge: { active: false, mode: "", riskQueued: false },
        closingBurstUsed: false
      };
    }
    if (presentationId === "sensitive") {
      return {
        resonantRead: { active: false, mode: "", riskQueued: false },
        sceneUses: {}
      };
    }
    if (presentationId === "echo") {
      return {
        secondPass: { active: false, mode: "", riskQueued: false },
        sceneUses: {}
      };
    }
    if (presentationId === "silence") {
      return {
        slipNotice: { active: false, mode: "", riskQueued: false },
        sceneUses: {}
      };
    }
    if (presentationId === "technomancer") {
      return {
        daemonPush: { active: false, mode: "", riskQueued: false },
        sceneUses: {}
      };
    }
    if (presentationId === "therian") {
      return {
        feralDrive: { active: false, mode: "", riskQueued: false },
        sceneUses: {}
      };
    }
    if (presentationId === "vessel") {
      return {
        borrowedForce: { active: false, mode: "", riskQueued: false },
        containedType: "unknown",
        containedNotes: "",
        sceneUses: {}
      };
    }
    if (presentationId === "construct") {
      return {
        functionSurge: { active: false, mode: "", riskQueued: false },
        sceneUses: {}
      };
    }
    if (presentationId === "void_shard") {
      return {
        anomalyPush: { active: false, mode: "", riskQueued: false },
        sceneUses: {}
      };
    }
    if (presentationId === "wraith") {
      return {
        primaryLocus: "",
        locusScale: "",
        hauntRange: "Full in/through Locus. Limited through Tethers.",
        tethers: [],
        sceneUses: {},
        notes: []
      };
    }
    return {};
  }

  function normalizeTether(entry, index) {
    return {
      id: String(entry?.id || `tether-${index + 1}`),
      name: String(entry?.name || "").slice(0, 80),
      type: String(entry?.type || "").slice(0, 40),
      essence: String(entry?.essence ?? "0").slice(0, 2),
      status: String(entry?.status || "Intact").slice(0, 40)
    };
  }

  function normalizePresentationAbilityState(status) {
    let next = normalizeSceneTimer(status);
    const store = next.presentationAbilityState && typeof next.presentationAbilityState === "object"
      ? { ...next.presentationAbilityState }
      : {};
    PRESENTATION_ABILITIES.forEach((entry) => {
      const base = defaultPresentationState(entry.id);
      const current = store[entry.id] && typeof store[entry.id] === "object" ? store[entry.id] : {};
      if (entry.id === "sanguine") {
        store[entry.id] = {
          ...base,
          ...current,
          bloodSurge: {
            active: Boolean(current.bloodSurge?.active),
            mode: current.bloodSurge?.mode === "risk" ? "risk" : (current.bloodSurge?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.bloodSurge?.riskQueued)
          },
          closingBurstUsed: Boolean(current.closingBurstUsed)
        };
      } else if (entry.id === "sensitive") {
        store[entry.id] = {
          ...base,
          ...current,
          resonantRead: {
            active: Boolean(current.resonantRead?.active),
            mode: current.resonantRead?.mode === "risk" ? "risk" : (current.resonantRead?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.resonantRead?.riskQueued)
          },
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {}
        };
      } else if (entry.id === "echo") {
        store[entry.id] = {
          ...base,
          ...current,
          secondPass: {
            active: Boolean(current.secondPass?.active),
            mode: current.secondPass?.mode === "risk" ? "risk" : (current.secondPass?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.secondPass?.riskQueued)
          },
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {}
        };
      } else if (entry.id === "silence") {
        store[entry.id] = {
          ...base,
          ...current,
          slipNotice: {
            active: Boolean(current.slipNotice?.active),
            mode: current.slipNotice?.mode === "risk" ? "risk" : (current.slipNotice?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.slipNotice?.riskQueued)
          },
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {}
        };
      } else if (entry.id === "technomancer") {
        store[entry.id] = {
          ...base,
          ...current,
          daemonPush: {
            active: Boolean(current.daemonPush?.active),
            mode: current.daemonPush?.mode === "risk" ? "risk" : (current.daemonPush?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.daemonPush?.riskQueued)
          },
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {}
        };
      } else if (entry.id === "therian") {
        store[entry.id] = {
          ...base,
          ...current,
          feralDrive: {
            active: Boolean(current.feralDrive?.active),
            mode: current.feralDrive?.mode === "risk" ? "risk" : (current.feralDrive?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.feralDrive?.riskQueued)
          },
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {}
        };
      } else if (entry.id === "vessel") {
        const allowedTypes = CONTAINED_TYPE_OPTIONS.map((option) => option.id);
        const containedType = allowedTypes.includes(current.containedType) ? current.containedType : "unknown";
        store[entry.id] = {
          ...base,
          ...current,
          borrowedForce: {
            active: Boolean(current.borrowedForce?.active),
            mode: current.borrowedForce?.mode === "risk" ? "risk" : (current.borrowedForce?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.borrowedForce?.riskQueued)
          },
          containedType,
          containedNotes: String(current.containedNotes || "").slice(0, 200),
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {}
        };
      } else if (entry.id === "construct") {
        store[entry.id] = {
          ...base,
          ...current,
          functionSurge: {
            active: Boolean(current.functionSurge?.active),
            mode: current.functionSurge?.mode === "risk" ? "risk" : (current.functionSurge?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.functionSurge?.riskQueued)
          },
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {}
        };
      } else if (entry.id === "void_shard") {
        store[entry.id] = {
          ...base,
          ...current,
          anomalyPush: {
            active: Boolean(current.anomalyPush?.active),
            mode: current.anomalyPush?.mode === "risk" ? "risk" : (current.anomalyPush?.mode === "spend" ? "spend" : ""),
            riskQueued: Boolean(current.anomalyPush?.riskQueued)
          },
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {}
        };
      } else if (entry.id === "wraith") {
        const tethers = Array.isArray(current.tethers) ? current.tethers.map(normalizeTether) : [];
        store[entry.id] = {
          ...base,
          primaryLocus: String(current.primaryLocus || "").slice(0, 120),
          locusScale: String(current.locusScale || "").slice(0, 80),
          hauntRange: String(current.hauntRange || base.hauntRange).slice(0, 200),
          tethers: tethers.slice(0, 12),
          sceneUses: current.sceneUses && typeof current.sceneUses === "object" ? { ...current.sceneUses } : {},
          notes: Array.isArray(current.notes) ? current.notes.slice(0, 8).map((n) => String(n).slice(0, 240)) : []
        };
      } else {
        store[entry.id] = { ...base, ...current };
      }
    });
    next.presentationAbilityState = store;
    return next;
  }

  function presentationState(status, presentationId) {
    const normalized = normalizePresentationAbilityState(status);
    return normalized.presentationAbilityState?.[presentationId]
      || defaultPresentationState(presentationId);
  }

  function accessTierFromCatalog(entry) {
    if (!entry) return "";
    if (entry.access === "open" || entry.access === "starter") return "open";
    if (entry.access === "handler") return "handler_approval";
    if (entry.access === "archive") return "archive_locked";
    return "";
  }

  function resolveAccessTier(ability, catalogKey) {
    if (ability.accessTier) return ability.accessTier;
    const catalogs = typeof window !== "undefined" ? window.CradlepointCatalogs : null;
    if (!catalogs || !catalogKey) return "";
    const entry = catalogs.presentationEntry ? catalogs.presentationEntry(catalogKey) : null;
    return accessTierFromCatalog(entry);
  }

  function abilityForCatalogKey(key) {
    const normalized = String(key || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_|_$/g, "");
    const id = catalogKeyIndex[normalized];
    return id ? abilityById[id] : null;
  }

  function abilityForPresentationId(id) {
    return abilityById[id] || null;
  }

  function bandModifierForLoad(ability, loadValue, bandLabel) {
    if (!ability) return null;
    const value = Number(loadValue);
    if (ability.collapseBehavior && value >= ability.collapseBehavior.atLoad) {
      return {
        type: "collapse",
        ...ability.collapseBehavior,
        bandLabel: bandLabel || ability.collapseBehavior.name
      };
    }
    if (value <= 1) {
      const fading = (ability.bandModifiers || []).find((entry) => entry.kind === "deprived" || entry.atLoad <= 1);
      if (fading) return { type: "deprived", ...fading };
    }
    return (ability.bandModifiers || []).find((entry) => entry.atLoad === value)
      || (ability.bandModifiers || []).find((entry) => entry.bandLabel === bandLabel)
      || null;
  }

  function bloodSurgeAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "sanguine");
    if (!state.bloodSurge?.active) return false;
    return SURGE_ATTRS.includes(String(attrKey || "").trim());
  }

  function bloodSurgeRollBonus(status, attrKey) {
    return bloodSurgeAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeBloodSurgeOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.sanguine;
    if (!state?.bloodSurge?.active) return normalized;
    state.bloodSurge.active = false;
    state.bloodSurge.mode = "";
    normalized.presentationAbilityState.sanguine = state;
    return normalized;
  }

  function resonantReadAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "sensitive");
    if (!state.resonantRead?.active) return false;
    return RESONANT_READ_ATTRS.includes(String(attrKey || "").trim());
  }

  function resonantReadRollBonus(status, attrKey) {
    return resonantReadAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeResonantReadOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.sensitive;
    if (!state?.resonantRead?.active) return normalized;
    state.resonantRead.active = false;
    state.resonantRead.mode = "";
    normalized.presentationAbilityState.sensitive = state;
    return normalized;
  }

  function secondPassAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "echo");
    if (!state.secondPass?.active) return false;
    return SECOND_PASS_ATTRS.includes(String(attrKey || "").trim());
  }

  function secondPassRollBonus(status, attrKey) {
    return secondPassAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeSecondPassOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.echo;
    if (!state?.secondPass?.active) return normalized;
    state.secondPass.active = false;
    state.secondPass.mode = "";
    normalized.presentationAbilityState.echo = state;
    return normalized;
  }

  function slipNoticeAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "silence");
    if (!state.slipNotice?.active) return false;
    return SLIP_NOTICE_ATTRS.includes(String(attrKey || "").trim());
  }

  function slipNoticeRollBonus(status, attrKey) {
    return slipNoticeAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeSlipNoticeOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.silence;
    if (!state?.slipNotice?.active) return normalized;
    state.slipNotice.active = false;
    state.slipNotice.mode = "";
    normalized.presentationAbilityState.silence = state;
    return normalized;
  }

  function daemonPushAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "technomancer");
    if (!state.daemonPush?.active) return false;
    return DAEMON_PUSH_ATTRS.includes(String(attrKey || "").trim());
  }

  function daemonPushRollBonus(status, attrKey) {
    return daemonPushAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeDaemonPushOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.technomancer;
    if (!state?.daemonPush?.active) return normalized;
    state.daemonPush.active = false;
    state.daemonPush.mode = "";
    normalized.presentationAbilityState.technomancer = state;
    return normalized;
  }

  function feralDriveAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "therian");
    if (!state.feralDrive?.active) return false;
    return FERAL_DRIVE_ATTRS.includes(String(attrKey || "").trim());
  }

  function feralDriveRollBonus(status, attrKey) {
    return feralDriveAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeFeralDriveOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.therian;
    if (!state?.feralDrive?.active) return normalized;
    state.feralDrive.active = false;
    state.feralDrive.mode = "";
    normalized.presentationAbilityState.therian = state;
    return normalized;
  }

  function borrowedForceAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "vessel");
    if (!state.borrowedForce?.active) return false;
    return BORROWED_FORCE_ATTRS.includes(String(attrKey || "").trim());
  }

  function borrowedForceRollBonus(status, attrKey) {
    return borrowedForceAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeBorrowedForceOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.vessel;
    if (!state?.borrowedForce?.active) return normalized;
    state.borrowedForce.active = false;
    state.borrowedForce.mode = "";
    normalized.presentationAbilityState.vessel = state;
    return normalized;
  }

  function functionSurgeAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "construct");
    if (!state.functionSurge?.active) return false;
    return FUNCTION_SURGE_ATTRS.includes(String(attrKey || "").trim());
  }

  function functionSurgeRollBonus(status, attrKey) {
    return functionSurgeAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeFunctionSurgeOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.construct;
    if (!state?.functionSurge?.active) return normalized;
    state.functionSurge.active = false;
    state.functionSurge.mode = "";
    normalized.presentationAbilityState.construct = state;
    return normalized;
  }

  function anomalyPushAppliesToRoll(status, attrKey) {
    const state = presentationState(status, "void_shard");
    if (!state.anomalyPush?.active) return false;
    return ANOMALY_PUSH_ATTRS.includes(String(attrKey || "").trim());
  }

  function anomalyPushRollBonus(status, attrKey) {
    return anomalyPushAppliesToRoll(status, attrKey) ? 1 : 0;
  }

  function consumeAnomalyPushOnRoll(status) {
    const normalized = normalizePresentationAbilityState(status);
    const state = normalized.presentationAbilityState.void_shard;
    if (!state?.anomalyPush?.active) return normalized;
    state.anomalyPush.active = false;
    state.anomalyPush.mode = "";
    normalized.presentationAbilityState.void_shard = state;
    return normalized;
  }

  function shiftLoadTowardCenter(status, trackId, steps) {
    const pressure = window.PresentationPressure;
    if (!pressure) return status;
    const track = pressure.trackById(trackId);
    if (!track) return status;
    const current = pressure.readTrackValue(status, trackId);
    const targetMid = 3;
    let next = current;
    const delta = Number(steps) || 1;
    if (current < targetMid) next = Math.min(targetMid, current + delta);
    else if (current > targetMid) next = Math.max(targetMid, current - delta);
    return pressure.writeTrackValue(status, trackId, next);
  }

  function clampTrackerValue(key, value) {
    const numeric = Number(value) || 0;
    if (key === "stability") return String(Math.max(0, Math.min(10, numeric)));
    if (key === "harmBoxes") return String(Math.max(0, Math.min(5, numeric)));
    return String(numeric);
  }

  function abilityLabelForId(presentationId, abilityId) {
    const ability = abilityById[presentationId];
    if (!ability) return abilityId;
    const passive = (ability.passivePermissions || []).find((entry) => entry.id === abilityId);
    if (passive) return passive.name;
    const active = (ability.activeAbilities || []).find((entry) => entry.id === abilityId);
    return active?.name || abilityId;
  }

  function activeTimerDisplayEntries(status) {
    const normalized = normalizePresentationAbilityState(status);
    const entries = [];
    RECOVERY_ORDER.forEach((key) => {
      const action = RECOVERY_ACTIONS[key];
      if (!normalized[action.statusKey]) return;
      entries.push({
        id: `recovery-declared-${key}`,
        label: action.label,
        line: `${action.label}: declared — resolves on Next Round`
      });
    });

    const recoveryFlags = normalizeRecoveryFlags(normalized.sceneTimer?.recoveryFlags);
    if (recoveryFlags.exposureEnded) {
      entries.push({
        id: "recovery-flag-exposure",
        label: "Leave",
        line: "Leave: exposure ended — blocks one scene-pressure tick"
      });
    }
    if (recoveryFlags.namedPressure) {
      entries.push({
        id: "recovery-flag-named",
        label: "Name It",
        line: "Name It: +1 next stabilization/resistance roll"
      });
    }

    (normalized.sceneTimer?.timers || []).forEach((timer) => {
      if (timer.effectType === "scene_flag") return;
      if (timer.remainingRounds > 0) {
        const rounds = timer.remainingRounds;
        const line = timer.abilityId === TREAT_HARM_TIMER.abilityId
          ? "Treat Harm pending — Next Round: Harm -1 if still safe and treatment remains possible"
          : `${timer.label}: ${rounds} round${rounds === 1 ? "" : "s"} remaining`;
        entries.push({
          id: timer.id,
          label: timer.label,
          line
        });
      }
    });

    if (normalized.sceneTimer?.harmRecoveredThisScene) {
      entries.push({
        id: "harm-recovered-scene",
        label: "Treat Harm",
        line: "Harm recovery used this scene"
      });
    }

    const sanguine = normalized.presentationAbilityState.sanguine;
    if (sanguine?.closingBurstUsed) {
      entries.push({
        id: "scene-flag-closing_burst",
        label: "Closing Burst",
        line: "Closing Burst: used this scene",
        sceneFlag: true
      });
    }
    if (sanguine?.bloodSurge?.active) {
      entries.push({
        id: "scene-tag-blood_surge",
        label: "Blood Surge",
        line: "Blood Surge: +1 next valid roll",
        sceneFlag: true
      });
    }
    const sensitive = normalized.presentationAbilityState.sensitive;
    if (sensitive?.resonantRead?.active) {
      entries.push({
        id: "scene-tag-resonant_read",
        label: "Resonant Read",
        line: "Resonant Read: +1 next pressure read",
        sceneFlag: true
      });
    }
    const echo = normalized.presentationAbilityState.echo;
    if (echo?.secondPass?.active) {
      entries.push({
        id: "scene-tag-second_pass",
        label: "Second Pass",
        line: "Second Pass: +1 next repeat/retrace action",
        sceneFlag: true
      });
    }
    const silence = normalized.presentationAbilityState.silence;
    if (silence?.slipNotice?.active) {
      entries.push({
        id: "scene-tag-slip_notice",
        label: "Slip Notice",
        line: "Slip Notice: +1 next omission/escape action",
        sceneFlag: true
      });
    }
    const technomancer = normalized.presentationAbilityState.technomancer;
    if (technomancer?.daemonPush?.active) {
      entries.push({
        id: "scene-tag-daemon_push",
        label: "Daemon Push",
        line: "Daemon Push: +1 next device/interface action",
        sceneFlag: true
      });
    }
    const therian = normalized.presentationAbilityState.therian;
    if (therian?.feralDrive?.active) {
      entries.push({
        id: "scene-tag-feral_drive",
        label: "Feral Drive",
        line: "Feral Drive: +1 next pursuit/territory action",
        sceneFlag: true
      });
    }
    const vessel = normalized.presentationAbilityState.vessel;
    if (vessel?.borrowedForce?.active) {
      entries.push({
        id: "scene-tag-borrowed_force",
        label: "Borrowed Force",
        line: "Borrowed Force: +1 next borrowed presence action",
        sceneFlag: true
      });
    }
    const construct = normalized.presentationAbilityState.construct;
    if (construct?.functionSurge?.active) {
      entries.push({
        id: "scene-tag-function_surge",
        label: "Function Surge",
        line: "Function Surge: +1 next Body/Mind directive action",
        sceneFlag: true
      });
    }
    const voidShard = normalized.presentationAbilityState.void_shard;
    if (voidShard?.anomalyPush?.active) {
      entries.push({
        id: "scene-tag-anomaly_push",
        label: "Anomaly Push",
        line: "Anomaly Push: +1 next Body/Mind/Instinct anomaly action",
        sceneFlag: true
      });
    }

    PRESENTATION_ABILITIES.forEach((presentation) => {
      const bucket = normalized.presentationAbilityState[presentation.id];
      const sceneUses = bucket?.sceneUses;
      if (!sceneUses || typeof sceneUses !== "object") return;
      Object.keys(sceneUses).forEach((abilityId) => {
        if (!sceneUses[abilityId]) return;
        const label = abilityLabelForId(presentation.id, abilityId);
        entries.push({
          id: `scene-flag-${presentation.id}-${abilityId}`,
          label,
          line: `${label}: used this scene`,
          sceneFlag: true
        });
      });
    });

    return entries;
  }

  function clearSceneFlags(status) {
    let next = normalizePresentationAbilityState(status);
    next = clearRecoveryCheckboxes(next);
    next.presentationAbilityState.sanguine.closingBurstUsed = false;
    PRESENTATION_ABILITIES.forEach((presentation) => {
      const bucket = next.presentationAbilityState[presentation.id];
      if (bucket && typeof bucket === "object") bucket.sceneUses = {};
    });
    if (next.presentationAbilityState.sanguine?.bloodSurge?.active) {
      next.presentationAbilityState.sanguine.bloodSurge = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    if (next.presentationAbilityState.sensitive?.resonantRead?.active) {
      next.presentationAbilityState.sensitive.resonantRead = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    if (next.presentationAbilityState.echo?.secondPass?.active) {
      next.presentationAbilityState.echo.secondPass = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    if (next.presentationAbilityState.silence?.slipNotice?.active) {
      next.presentationAbilityState.silence.slipNotice = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    if (next.presentationAbilityState.technomancer?.daemonPush?.active) {
      next.presentationAbilityState.technomancer.daemonPush = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    if (next.presentationAbilityState.therian?.feralDrive?.active) {
      next.presentationAbilityState.therian.feralDrive = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    if (next.presentationAbilityState.vessel?.borrowedForce?.active) {
      next.presentationAbilityState.vessel.borrowedForce = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    if (next.presentationAbilityState.construct?.functionSurge?.active) {
      next.presentationAbilityState.construct.functionSurge = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    if (next.presentationAbilityState.void_shard?.anomalyPush?.active) {
      next.presentationAbilityState.void_shard.anomalyPush = {
        active: false,
        mode: "",
        riskQueued: false
      };
    }
    next.sceneTimer.recoveryFlags = { exposureEnded: false, namedPressure: false, unknownPressure: false };
    next.sceneTimer.harmRecoveredThisScene = false;
    next.sceneTimer.timers = (next.sceneTimer.timers || []).filter((timer) => {
      if (timer.effectType === "round_timer" || timer.effectType === "instant") return false;
      if (timer.effectType === "countdown" && timer.remainingRounds <= 0) return false;
      return true;
    });
    return next;
  }

  function applySceneTimerAction(status, action, payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    let next = normalizePresentationAbilityState(status);

    if (action === "next_round") {
      const catalogKey = String(data.catalogKey || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
      const recovery = resolveDeclaredRecovery(next, catalogKey);
      next = recovery.status;
      if (recovery.blocked) return next;

      next.sceneTimer.round = (next.sceneTimer.round || 1) + 1;
      next.sceneTimer.lastError = "";
      if (recovery.resolved) {
        next = appendSceneTimerLog(
          next,
          `ROUND ${next.sceneTimer.round} — ${recovery.label} resolved: ${recovery.resolveLog}`
        );
      }
      const updated = [];
      (next.sceneTimer.timers || []).forEach((timer) => {
        const remaining = timer.remainingRounds - 1;
        if (remaining > 0) {
          updated.push({ ...timer, remainingRounds: remaining });
          return;
        }
        if (timer.resolutionKind === "corporealize_return") {
          const notes = next.presentationAbilityState.wraith?.notes || [];
          notes.unshift(`${timer.label}: re-corporealized after countdown.`);
          next.presentationAbilityState.wraith.notes = notes.slice(0, 8);
          next = appendSceneTimerLog(
            next,
            `ROUND ${next.sceneTimer.round} — ${timer.label} resolved: re-corporealized`
          );
          return;
        }
        if (timer.resolutionKind === "treat_harm") {
          const harmResult = resolveTreatHarmTimer(next, catalogKey);
          next = harmResult.status;
          if (harmResult.resolved) {
            next = appendSceneTimerLog(
              next,
              `ROUND ${next.sceneTimer.round} — Treat Harm resolved: ${harmResult.resolveLog}`
            );
          } else if (harmResult.skipped) {
            next = appendSceneTimerLog(
              next,
              `ROUND ${next.sceneTimer.round} — Treat Harm skipped: ${harmResult.resolveLog}`
            );
          }
          return;
        }
      });
      next.sceneTimer.timers = updated;
      return next;
    }

    if (action === "end_scene") {
      const decay = Boolean(data.decayLoad);
      next = clearSceneFlags(next);
      next.sceneTimer.round = 1;
      if (decay) {
        const pressure = window.PresentationPressure;
        const catalogKey = String(data.catalogKey || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
        const presentation = catalogKey ? pressure?.presentationForCatalogKey?.(catalogKey) : null;
        const trackId = presentation?.tracks?.[0]?.id;
        if (trackId) next = shiftLoadTowardCenter(next, trackId, 1);
      }
      const countdown = [];
      (next.sceneTimer.timers || []).forEach((timer) => {
        if (timer.effectType !== "countdown" || timer.awaitingResolution) return;
        const remaining = timer.remainingRounds - 1;
        if (remaining > 0) countdown.push({ ...timer, remainingRounds: remaining });
        else if (timer.resolutionKind === "corporealize_return") {
          const notes = next.presentationAbilityState.wraith?.notes || [];
          notes.unshift(`${timer.label}: re-corporealized after scene tick.`);
          next.presentationAbilityState.wraith.notes = notes.slice(0, 8);
        }
      });
      next.sceneTimer.timers = countdown;
      return next;
    }

    if (action === "timer_cancel") {
      const timerId = String(data.timerId || "");
      const abilityId = String(data.abilityId || "");
      next.sceneTimer.timers = (next.sceneTimer.timers || []).filter((timer) => {
        if (timerId) return timer.id !== timerId;
        if (abilityId) return timer.abilityId !== abilityId;
        return true;
      });
      return next;
    }

    return next;
  }

  function applyPresentationAbilityAction(status, action, payload) {
    const pressure = window.PresentationPressure;
    let next = normalizePresentationAbilityState(status);
    const data = payload && typeof payload === "object" ? payload : {};

    if (action === "blood_surge_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "sanguine.blood_load", -1);
      }
      next.presentationAbilityState.sanguine.bloodSurge = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "blood_surge_risk") {
      next.presentationAbilityState.sanguine.bloodSurge = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "blood_surge_clear") {
      next.presentationAbilityState.sanguine.bloodSurge = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "resonant_read_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "sensitive.sensory_load", -1);
      }
      next.presentationAbilityState.sensitive.resonantRead = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "resonant_read_risk") {
      next.presentationAbilityState.sensitive.resonantRead = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "resonant_read_clear") {
      next.presentationAbilityState.sensitive.resonantRead = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "second_pass_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "echo.echo_load", -1);
      }
      next.presentationAbilityState.echo.secondPass = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "second_pass_risk") {
      next.presentationAbilityState.echo.secondPass = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "second_pass_clear") {
      next.presentationAbilityState.echo.secondPass = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "slip_notice_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "silence.silence_load", -1);
      }
      next.presentationAbilityState.silence.slipNotice = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "slip_notice_risk") {
      next.presentationAbilityState.silence.slipNotice = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "slip_notice_clear") {
      next.presentationAbilityState.silence.slipNotice = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "daemon_push_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "technomancer.signal_load", -1);
      }
      next.presentationAbilityState.technomancer.daemonPush = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "daemon_push_risk") {
      next.presentationAbilityState.technomancer.daemonPush = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "daemon_push_clear") {
      next.presentationAbilityState.technomancer.daemonPush = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "feral_drive_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "therian.instinct_load", -1);
      }
      next.presentationAbilityState.therian.feralDrive = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "feral_drive_risk") {
      next.presentationAbilityState.therian.feralDrive = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "feral_drive_clear") {
      next.presentationAbilityState.therian.feralDrive = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "borrowed_force_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "vessel.containment_load", -1);
      }
      next.presentationAbilityState.vessel.borrowedForce = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "borrowed_force_risk") {
      next.presentationAbilityState.vessel.borrowedForce = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "borrowed_force_clear") {
      next.presentationAbilityState.vessel.borrowedForce = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "function_surge_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "construct.function_load", -1);
      }
      next.presentationAbilityState.construct.functionSurge = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "function_surge_risk") {
      next.presentationAbilityState.construct.functionSurge = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "function_surge_clear") {
      next.presentationAbilityState.construct.functionSurge = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "anomaly_push_spend") {
      if (pressure) {
        next = pressure.adjustTrackLoad(next, "void_shard.void_load", -1);
      }
      next.presentationAbilityState.void_shard.anomalyPush = {
        active: true,
        mode: "spend",
        riskQueued: false
      };
      return next;
    }

    if (action === "anomaly_push_risk") {
      next.presentationAbilityState.void_shard.anomalyPush = {
        active: true,
        mode: "risk",
        riskQueued: true
      };
      return next;
    }

    if (action === "anomaly_push_clear") {
      next.presentationAbilityState.void_shard.anomalyPush = {
        active: false,
        mode: "",
        riskQueued: false
      };
      return next;
    }

    if (action === "vessel_contained_type") {
      const allowed = CONTAINED_TYPE_OPTIONS.map((option) => option.id);
      const containedType = allowed.includes(data.containedType) ? data.containedType : "unknown";
      next.presentationAbilityState.vessel.containedType = containedType;
      return next;
    }

    if (action === "vessel_contained_notes") {
      next.presentationAbilityState.vessel.containedNotes = String(data.value ?? "").slice(0, 200);
      return next;
    }

    if (action === "closing_burst_use") {
      next.presentationAbilityState.sanguine.closingBurstUsed = true;
      return next;
    }

    if (action === "closing_burst_reset") {
      next.presentationAbilityState.sanguine.closingBurstUsed = false;
      return next;
    }

    if (action === "treat_harm_start") {
      const catalogKey = String(data.catalogKey || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
      const eligible = treatHarmEligibility(next, catalogKey);
      if (!eligible.ok) {
        next.sceneTimer.lastError = eligible.reason;
        return next;
      }
      next.sceneTimer.lastError = "";
      next.sceneTimer.timers = [
        ...(next.sceneTimer.timers || []),
        createTimer(TREAT_HARM_TIMER)
      ];
      return next;
    }

    if (action === "treat_harm_cancel") {
      next.sceneTimer.timers = (next.sceneTimer.timers || [])
        .filter((timer) => timer.abilityId !== TREAT_HARM_TIMER.abilityId);
      return next;
    }

    if (action === "re_corporealize_start") {
      if (hasActiveTimer(next, "re_corporealize")) return next;
      const rounds = rollCountdownRounds();
      next.sceneTimer.timers = [
        ...(next.sceneTimer.timers || []),
        createTimer({
          abilityId: "re_corporealize",
          presentationId: "wraith",
          label: "Wraith Re-Corporealize",
          effectType: "countdown",
          remainingRounds: rounds,
          resolutionKind: "corporealize_return"
        })
      ];
      return next;
    }

    if (action === "re_corporealize_cancel") {
      next.sceneTimer.timers = (next.sceneTimer.timers || [])
        .filter((timer) => timer.abilityId !== "re_corporealize");
      return next;
    }

    if (action === "scene_use") {
      const presentationId = String(data.presentationId || "");
      const abilityId = String(data.abilityId || "");
      if (!presentationId || !abilityId) return next;
      const bucket = next.presentationAbilityState[presentationId] || defaultPresentationState(presentationId);
      bucket.sceneUses = { ...(bucket.sceneUses || {}), [abilityId]: true };
      next.presentationAbilityState[presentationId] = bucket;
      return next;
    }

    if (action === "scene_reset") {
      const presentationId = String(data.presentationId || "");
      const abilityId = String(data.abilityId || "");
      if (!presentationId || !abilityId) return next;
      const bucket = next.presentationAbilityState[presentationId] || defaultPresentationState(presentationId);
      const sceneUses = { ...(bucket.sceneUses || {}) };
      delete sceneUses[abilityId];
      bucket.sceneUses = sceneUses;
      next.presentationAbilityState[presentationId] = bucket;
      return next;
    }

    if (action === "anchor_pull") {
      if (pressure) {
        next = shiftLoadTowardCenter(next, "wraith.essence_load", 1);
      }
      const notes = next.presentationAbilityState.wraith.notes || [];
      notes.unshift("Anchor Pull: Essence Load moved 1 step toward Anchored range.");
      next.presentationAbilityState.wraith.notes = notes.slice(0, 8);
      return next;
    }

    if (action === "essence_transfer_note") {
      const notes = next.presentationAbilityState.wraith.notes || [];
      notes.unshift("Essence Transfer queued: store 1 Essence in a meaningful object, person, place, or record. Handler tables Tether creation.");
      next.presentationAbilityState.wraith.notes = notes.slice(0, 8);
      return next;
    }

    if (action === "wraith_field") {
      const field = String(data.field || "");
      const value = String(data.value ?? "").slice(0, 200);
      if (!field) return next;
      if (["primaryLocus", "locusScale", "hauntRange"].includes(field)) {
        next.presentationAbilityState.wraith[field] = value;
      }
      return next;
    }

    if (action === "wraith_tether_upsert") {
      const tether = normalizeTether(data.tether || {}, 0);
      const list = [...(next.presentationAbilityState.wraith.tethers || [])];
      const index = list.findIndex((item) => item.id === tether.id);
      if (index >= 0) list[index] = tether;
      else list.push(tether);
      next.presentationAbilityState.wraith.tethers = list.slice(0, 12);
      return next;
    }

    if (action === "wraith_tether_remove") {
      const id = String(data.id || "");
      next.presentationAbilityState.wraith.tethers = (next.presentationAbilityState.wraith.tethers || [])
        .filter((item) => item.id !== id);
      return next;
    }

    return next;
  }

  function presentationAbilityView(status, catalogKeyOrId) {
    const pressure = typeof window !== "undefined" ? window.PresentationPressure : null;
    if (!pressure || !status) return null;

    let presentation = null;
    let catalogKey = "";
    if (typeof catalogKeyOrId === "string") {
      presentation = pressure.presentationForCatalogKey(catalogKeyOrId)
        || pressure.presentationById(catalogKeyOrId)
        || null;
      catalogKey = pressure.presentationForCatalogKey(catalogKeyOrId) ? catalogKeyOrId : "";
      if (!catalogKey && presentation) catalogKey = presentation.catalogKeys?.[0] || "";
    }

    const ability = presentation
      ? abilityForPresentationId(presentation.id) || abilityForCatalogKey(catalogKey)
      : abilityForCatalogKey(catalogKeyOrId) || abilityForPresentationId(catalogKeyOrId);
    if (!ability) return null;

    const normalized = normalizePresentationAbilityState(status);
    const runtimeState = normalized.presentationAbilityState[ability.id] || defaultPresentationState(ability.id);
    const track = presentation ? pressure.primaryTrack(presentation) : null;
    const trackId = ability.pressureTrack?.trackId || track?.id || "";
    const loadValue = trackId ? pressure.readTrackValue(normalized, trackId) : 0;
    const bandLabel = trackId ? pressure.bandForTrack(trackId, loadValue) : "";
    const bandState = bandModifierForLoad(ability, loadValue, bandLabel);

    const runtimeSceneTimers = (normalized.sceneTimer?.timers || [])
      .filter((timer) => timer.presentationId === ability.id);

    return {
      id: ability.id,
      label: ability.label,
      displayLabel: ability.displayLabel,
      accessTier: resolveAccessTier(ability, catalogKey || ability.catalogKeys?.[0] || ""),
      identityLine: ability.identityLine,
      hauntInterface: ability.hauntInterface,
      containmentInterface: ability.containmentInterface,
      pressureTrack: {
        trackId,
        trackLabel: ability.pressureTrack?.trackLabel || presentation?.trackLabel || "",
        value: loadValue,
        band: bandLabel
      },
      passivePermissions: ability.passivePermissions.slice(),
      activeAbilities: ability.activeAbilities.slice(),
      bandModifiers: ability.bandModifiers.slice(),
      collapseBehavior: ability.collapseBehavior,
      activeBandState: bandState,
      runtimeState,
      runtimeSceneTimers,
      sceneRound: normalized.sceneTimer?.round || 1,
      headlineAbility: ability.activeAbilities.find((entry) => entry.headline) || null
    };
  }

  function createButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className || "presentation-ability-btn";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function appendRollTag(block, view, dispatch, spec) {
    const state = view.runtimeState?.[spec.stateKey];
    if (!state?.active) return;
    const tag = document.createElement("div");
    tag.className = "presentation-active-tag";
    const title = document.createElement("p");
    title.className = "presentation-active-tag-title";
    title.textContent = spec.title;
    const copy = document.createElement("p");
    copy.className = "presentation-active-tag-copy";
    copy.textContent = spec.copy;
    tag.append(title, copy);
    if (state.mode === "risk" || state.riskQueued) {
      const risk = document.createElement("p");
      risk.className = "presentation-active-tag-risk";
      risk.textContent = spec.riskCopy;
      tag.append(risk);
    }
    tag.append(createButton("Clear", "presentation-ability-btn subtle", () => {
      dispatch(spec.clearAction);
    }));
    block.append(tag);
  }

  function appendActiveTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "bloodSurge",
      title: "ACTIVE: Blood Surge +1",
      copy: SURGE_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Blood Load +1 or Handler escalates.",
      clearAction: "blood_surge_clear"
    });
  }

  function appendResonantReadTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "resonantRead",
      title: "ACTIVE: Resonant Read +1",
      copy: RESONANT_READ_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Resonance Load +1 or Handler escalates.",
      clearAction: "resonant_read_clear"
    });
  }

  function appendSecondPassTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "secondPass",
      title: "ACTIVE: Second Pass +1",
      copy: SECOND_PASS_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Echo Load +1 or Handler escalates.",
      clearAction: "second_pass_clear"
    });
  }

  function appendSlipNoticeTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "slipNotice",
      title: "ACTIVE: Slip Notice +1",
      copy: SLIP_NOTICE_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Silence Load +1 or Handler escalates.",
      clearAction: "slip_notice_clear"
    });
  }

  function appendDaemonPushTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "daemonPush",
      title: "ACTIVE: Daemon Push +1",
      copy: DAEMON_PUSH_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Signal Load +1 or Handler escalates.",
      clearAction: "daemon_push_clear"
    });
  }

  function appendFeralDriveTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "feralDrive",
      title: "ACTIVE: Feral Drive +1",
      copy: FERAL_DRIVE_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Instinct Load +1 or Handler escalates.",
      clearAction: "feral_drive_clear"
    });
  }

  function appendBorrowedForceTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "borrowedForce",
      title: "ACTIVE: Borrowed Force +1",
      copy: BORROWED_FORCE_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Containment Load +1 or Handler escalates.",
      clearAction: "borrowed_force_clear"
    });
  }

  function appendFunctionSurgeTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "functionSurge",
      title: "ACTIVE: Function Surge +1",
      copy: FUNCTION_SURGE_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Function Load +1 or Handler escalates.",
      clearAction: "function_surge_clear"
    });
  }

  function appendAnomalyPushTag(block, view, dispatch) {
    appendRollTag(block, view, dispatch, {
      stateKey: "anomalyPush",
      title: "ACTIVE: Anomaly Push +1",
      copy: ANOMALY_PUSH_APPLIES_COPY,
      riskCopy: "RISK: On miss or severe consequence, Void Load +1 or Handler escalates.",
      clearAction: "anomaly_push_clear"
    });
  }

  function appendSpendRiskReadCard(card, entry, view, dispatch, spec) {
    const state = view.runtimeState?.[spec.stateKey];
    if (state?.active) {
      card.classList.add("is-resolved");
      return;
    }
    const open = createButton(entry.headline ? "Activate" : "Use", "presentation-ability-btn", () => {
      card.querySelector(".presentation-ability-confirm")?.remove();
      const confirm = document.createElement("div");
      confirm.className = "presentation-ability-confirm";
      const prompt = document.createElement("p");
      prompt.className = "presentation-ability-confirm-prompt";
      prompt.textContent = spec.prompt;
      const actions = document.createElement("div");
      actions.className = "presentation-ability-confirm-actions";
      actions.append(
        createButton(spec.spendLabel, "presentation-ability-btn", () => dispatch(spec.spendAction)),
        createButton(spec.riskLabel, "presentation-ability-btn subtle", () => dispatch(spec.riskAction)),
        createButton("Cancel", "presentation-ability-btn ghost", () => confirm.remove())
      );
      confirm.append(prompt, actions);
      card.append(confirm);
    });
    card.append(open);
  }

  function appendBloodSurgeCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "bloodSurge",
      prompt: "Spend or risk Blood Load?",
      spendLabel: "Spend 1 Blood Load",
      riskLabel: "Risk Blood Load",
      spendAction: "blood_surge_spend",
      riskAction: "blood_surge_risk"
    });
  }

  function appendResonantReadCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "resonantRead",
      prompt: "Spend or risk Resonance Load?",
      spendLabel: "Spend 1 Resonance Load",
      riskLabel: "Risk Resonance Load",
      spendAction: "resonant_read_spend",
      riskAction: "resonant_read_risk"
    });
  }

  function appendSecondPassCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "secondPass",
      prompt: "Spend or risk Echo Load?",
      spendLabel: "Spend 1 Echo Load",
      riskLabel: "Risk Echo Load",
      spendAction: "second_pass_spend",
      riskAction: "second_pass_risk"
    });
  }

  function appendSlipNoticeCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "slipNotice",
      prompt: "Spend or risk Silence Load?",
      spendLabel: "Spend 1 Silence Load",
      riskLabel: "Risk Silence Load",
      spendAction: "slip_notice_spend",
      riskAction: "slip_notice_risk"
    });
  }

  function appendDaemonPushCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "daemonPush",
      prompt: "Spend or risk Signal Load?",
      spendLabel: "Spend 1 Signal Load",
      riskLabel: "Risk Signal Load",
      spendAction: "daemon_push_spend",
      riskAction: "daemon_push_risk"
    });
  }

  function appendFeralDriveCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "feralDrive",
      prompt: "Spend or risk Instinct Load?",
      spendLabel: "Spend 1 Instinct Load",
      riskLabel: "Risk Instinct Load",
      spendAction: "feral_drive_spend",
      riskAction: "feral_drive_risk"
    });
  }

  function appendBorrowedForceCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "borrowedForce",
      prompt: "Spend or risk Containment Load?",
      spendLabel: "Spend 1 Containment Load",
      riskLabel: "Risk Containment Load",
      spendAction: "borrowed_force_spend",
      riskAction: "borrowed_force_risk"
    });
  }

  function appendFunctionSurgeCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "functionSurge",
      prompt: "Spend or risk Function Load?",
      spendLabel: "Spend 1 Function Load",
      riskLabel: "Risk Function Load",
      spendAction: "function_surge_spend",
      riskAction: "function_surge_risk"
    });
  }

  function appendAnomalyPushCard(card, entry, view, dispatch) {
    appendSpendRiskReadCard(card, entry, view, dispatch, {
      stateKey: "anomalyPush",
      prompt: "Spend or risk Void Load?",
      spendLabel: "Spend 1 Void Load",
      riskLabel: "Risk Void Load",
      spendAction: "anomaly_push_spend",
      riskAction: "anomaly_push_risk"
    });
  }

  function sceneAbilityUsed(view, entry) {
    if (entry.id === "closing_burst") return Boolean(view.runtimeState?.closingBurstUsed);
    return Boolean(view.runtimeState?.sceneUses?.[entry.id]);
  }

  function appendOncePerSceneCard(card, entry, view, dispatch) {
    if (entry.id === "closing_burst") {
      if (view.runtimeState?.closingBurstUsed) {
        card.classList.add("is-used");
        const usedLabel = document.createElement("p");
        usedLabel.className = "presentation-ability-used";
        usedLabel.textContent = "USED THIS SCENE";
        card.append(usedLabel);
        card.append(createButton("Reset", "presentation-ability-btn subtle", () => dispatch("closing_burst_reset")));
        return;
      }
      card.append(createButton("Use", "presentation-ability-btn", () => dispatch("closing_burst_use")));
      return;
    }
    if (sceneAbilityUsed(view, entry)) {
      card.classList.add("is-used");
      const usedLabel = document.createElement("p");
      usedLabel.className = "presentation-ability-used";
      usedLabel.textContent = "USED THIS SCENE";
      card.append(usedLabel);
      card.append(createButton("Reset", "presentation-ability-btn subtle", () => {
        dispatch("scene_reset", { presentationId: view.id, abilityId: entry.id });
      }));
      return;
    }
    card.append(createButton("Use", "presentation-ability-btn", () => {
      dispatch("scene_use", { presentationId: view.id, abilityId: entry.id });
    }));
  }

  function appendActiveAbilityCard(card, entry, view, dispatch) {
    if (entry.interaction === "reference") return;
    if (entry.interaction === "blood_surge") {
      appendBloodSurgeCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "resonant_read") {
      appendResonantReadCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "second_pass") {
      appendSecondPassCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "slip_notice") {
      appendSlipNoticeCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "daemon_push") {
      appendDaemonPushCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "feral_drive") {
      appendFeralDriveCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "borrowed_force") {
      appendBorrowedForceCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "function_surge") {
      appendFunctionSurgeCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "anomaly_push") {
      appendAnomalyPushCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "once_per_scene") {
      appendOncePerSceneCard(card, entry, view, dispatch);
      return;
    }
    if (entry.interaction === "load_shift_center") {
      card.append(createButton("Anchor Pull", "presentation-ability-btn", () => dispatch("anchor_pull")));
      return;
    }
    if (entry.interaction === "essence_transfer_note") {
      card.append(createButton("Queue Transfer", "presentation-ability-btn", () => dispatch("essence_transfer_note")));
      return;
    }
    if (entry.interaction === "countdown_timer") {
      const pending = (view.runtimeSceneTimers || []).find((timer) => timer.abilityId === entry.id);
      if (pending) {
        const marked = document.createElement("p");
        marked.className = "presentation-ability-meta";
        marked.textContent = pending.awaitingResolution
          ? `Pending: ${entry.name} ready to resolve.`
          : `Pending: ${entry.name} — ${pending.remainingRounds} round${pending.remainingRounds === 1 ? "" : "s"} remaining.`;
        card.append(marked);
        card.append(createButton("Cancel", "presentation-ability-btn subtle", () => dispatch("re_corporealize_cancel")));
        return;
      }
      card.append(createButton("Begin Countdown", "presentation-ability-btn", () => dispatch("re_corporealize_start")));
      return;
    }
  }

  function appendPassiveCard(card, entry, view, dispatch) {
    if (entry.handlerNote) {
      const note = document.createElement("p");
      note.className = "presentation-ability-meta";
      note.textContent = entry.handlerNote;
      card.append(note);
    }
  }

  function appendHauntInterface(block, view, runtime) {
    if (!view.hauntInterface?.enabled) return;
    const state = view.runtimeState || {};
    const editable = Boolean(runtime?.editable);
    const dispatch = runtime?.dispatch;

    const haunt = document.createElement("div");
    haunt.className = "haunt-interface";

    const title = document.createElement("p");
    title.className = "haunt-interface-title";
    title.textContent = view.displayLabel || view.label;
    haunt.append(title);

    const track = document.createElement("p");
    track.className = "haunt-interface-track";
    track.textContent = `${view.pressureTrack.trackLabel} ${view.pressureTrack.value}/${6} — ${view.pressureTrack.band}`;
    haunt.append(track);

    const grid = document.createElement("div");
    grid.className = "haunt-interface-grid";
    (view.hauntInterface.fields || []).forEach((field) => {
      const row = document.createElement("label");
      row.className = "haunt-interface-field";
      const label = document.createElement("span");
      label.textContent = field.label;
      const input = document.createElement(editable ? "input" : "span");
      if (editable) {
        input.type = "text";
        input.value = state[field.id] || "";
        input.placeholder = field.placeholder || "";
        input.addEventListener("change", () => {
          dispatch("wraith_field", { field: field.id, value: input.value });
        });
      } else {
        input.textContent = state[field.id] || "—";
      }
      row.append(label, input);
      grid.append(row);
    });
    haunt.append(grid);

    const tetherWrap = document.createElement("div");
    tetherWrap.className = "haunt-tether-tracker";
    const tetherTitle = document.createElement("p");
    tetherTitle.className = "presentation-ability-group-label";
    tetherTitle.textContent = "Tether Tracker";
    tetherWrap.append(tetherTitle);

    const table = document.createElement("div");
    table.className = "haunt-tether-table";
    const header = document.createElement("div");
    header.className = "haunt-tether-row haunt-tether-header";
    header.innerHTML = "<span>Tether</span><span>Type</span><span>Essence</span><span>Status</span>";
    table.append(header);

    const tethers = Array.isArray(state.tethers) ? state.tethers : [];
    if (!tethers.length) {
      const empty = document.createElement("p");
      empty.className = "haunt-tether-empty";
      empty.textContent = "No Tethers logged. Add what you are bound to.";
      tetherWrap.append(empty);
    }

    tethers.forEach((tether, index) => {
      const row = document.createElement("div");
      row.className = "haunt-tether-row";
      if (editable) {
        ["name", "type", "essence", "status"].forEach((key) => {
          const input = document.createElement("input");
          input.type = "text";
          input.value = tether[key] || "";
          input.addEventListener("change", () => {
            dispatch("wraith_tether_upsert", {
              tether: { ...tether, [key]: input.value, id: tether.id || `tether-${index + 1}` }
            });
          });
          row.append(input);
        });
        row.append(createButton("Remove", "presentation-ability-btn ghost", () => {
          dispatch("wraith_tether_remove", { id: tether.id });
        }));
      } else {
        row.innerHTML = `<span>${tether.name || "—"}</span><span>${tether.type || "—"}</span><span>${tether.essence || "0"}</span><span>${tether.status || "—"}</span>`;
      }
      table.append(row);
    });
    tetherWrap.append(table);

    if (editable) {
      tetherWrap.append(createButton("Add Tether", "presentation-ability-btn subtle", () => {
        dispatch("wraith_tether_upsert", {
          tether: {
            id: `tether-${Date.now()}`,
            name: "",
            type: "",
            essence: "0",
            status: "Intact"
          }
        });
      }));
    }

    const activeSummary = tethers.filter((t) => t.name).map((t) => `${t.name}: ${t.essence || 0} Essence`).join(" · ");
    if (activeSummary) {
      const summary = document.createElement("p");
      summary.className = "haunt-tether-summary";
      summary.textContent = `Active Tethers: ${activeSummary}`;
      tetherWrap.prepend(summary);
    }

    haunt.append(tetherWrap);
    block.append(haunt);
  }

  function appendContainmentInterface(block, view, runtime) {
    if (!view.containmentInterface?.enabled) return;
    const state = view.runtimeState || {};
    const editable = Boolean(runtime?.editable);
    const dispatch = runtime?.dispatch;
    const options = view.containmentInterface.containedTypeOptions || CONTAINED_TYPE_OPTIONS;

    const wrap = document.createElement("div");
    wrap.className = "containment-interface";

    const title = document.createElement("p");
    title.className = "containment-interface-title";
    title.textContent = "Contained Presence";
    wrap.append(title);

    const typeRow = document.createElement("div");
    typeRow.className = "containment-type-row";
    const typeLabel = document.createElement("span");
    typeLabel.className = "containment-type-label";
    typeLabel.textContent = "Contained Type";
    typeRow.append(typeLabel);

    if (editable && dispatch) {
      const select = document.createElement("select");
      select.className = "containment-type-select";
      options.forEach((option) => {
        const entry = document.createElement("option");
        entry.value = option.id;
        entry.textContent = option.label;
        select.append(entry);
      });
      select.value = state.containedType || "unknown";
      select.addEventListener("change", () => {
        dispatch("vessel_contained_type", { containedType: select.value });
      });
      typeRow.append(select);
    } else {
      const current = options.find((option) => option.id === state.containedType) || options[0];
      const value = document.createElement("span");
      value.textContent = current?.label || "Unknown";
      typeRow.append(value);
    }
    wrap.append(typeRow);

    if (state.containedType === "custom" || state.containedNotes) {
      if (editable && dispatch) {
        const notes = document.createElement("input");
        notes.type = "text";
        notes.className = "containment-notes-input";
        notes.placeholder = "Handler notes for custom subtype";
        notes.value = state.containedNotes || "";
        notes.addEventListener("change", () => {
          dispatch("vessel_contained_notes", { value: notes.value });
        });
        wrap.append(notes);
      } else if (state.containedNotes) {
        const notes = document.createElement("p");
        notes.className = "presentation-ability-meta";
        notes.textContent = state.containedNotes;
        wrap.append(notes);
      }
    }

    const archivePaths = view.containmentInterface.archivePaths || {};
    const archiveHint = archivePaths[state.containedType];
    if (archiveHint) {
      const archive = document.createElement("p");
      archive.className = "presentation-ability-meta";
      archive.textContent = `Archive path: ${archiveHint}`;
      wrap.append(archive);
    }

    const coreLaw = document.createElement("p");
    coreLaw.className = "presentation-ability-meta";
    coreLaw.textContent = "At 5, the Vessel borrows from what is inside. At 6, what is inside borrows the Vessel.";
    wrap.append(coreLaw);

    block.append(wrap);
  }

  function mountPresentationPermissionsReadout(body, view, runtime) {
    if (!body || !view) return;
    const dispatch = (action, payload) => {
      if (typeof runtime?.dispatch === "function") runtime.dispatch(action, payload);
    };

    const block = document.createElement("div");
    block.className = `presentation-permissions-readout presentation-permissions-${view.id}`;

    if (view.id === "sanguine") {
      appendActiveTag(block, view, dispatch);
    }
    if (view.id === "sensitive") {
      appendResonantReadTag(block, view, dispatch);
    }
    if (view.id === "echo") {
      appendSecondPassTag(block, view, dispatch);
    }
    if (view.id === "silence") {
      appendSlipNoticeTag(block, view, dispatch);
    }
    if (view.id === "technomancer") {
      appendDaemonPushTag(block, view, dispatch);
    }
    if (view.id === "therian") {
      appendFeralDriveTag(block, view, dispatch);
    }
    if (view.id === "vessel") {
      appendBorrowedForceTag(block, view, dispatch);
    }
    if (view.id === "construct") {
      appendFunctionSurgeTag(block, view, dispatch);
    }
    if (view.id === "void_shard") {
      appendAnomalyPushTag(block, view, dispatch);
    }

    appendContainmentInterface(block, view, runtime);
    appendHauntInterface(block, view, runtime);

    const heading = document.createElement("p");
    heading.className = "pressure-readout-subheading";
    heading.textContent = view.hauntInterface?.enabled
      ? "Haunt permissions"
      : (view.containmentInterface?.enabled ? "Containment permissions" : "Presentation permissions");
    block.append(heading);

    if (view.identityLine && !view.hauntInterface?.enabled && !view.containmentInterface?.enabled) {
      const identity = document.createElement("p");
      identity.className = "presentation-identity-line";
      identity.textContent = view.identityLine;
      block.append(identity);
    }

    const renderAbilityCard = (entry, groupKind) => {
      const card = document.createElement("article");
      card.className = `presentation-ability presentation-ability-${groupKind}${entry.headline ? " presentation-ability-headline" : ""}`;
      const title = document.createElement("p");
      title.className = "presentation-ability-title";
      title.textContent = entry.name;
      card.append(title);
      if (entry.cost) {
        const cost = document.createElement("p");
        cost.className = "presentation-ability-meta";
        cost.textContent = entry.cost;
        card.append(cost);
      }
      if (entry.cadence) {
        const cadence = document.createElement("p");
        cadence.className = "presentation-ability-meta";
        cadence.textContent = entry.cadence;
        card.append(cadence);
      }
      if (entry.when) {
        const when = document.createElement("p");
        when.className = "presentation-ability-meta";
        when.textContent = entry.when;
        card.append(when);
      }
      const effect = document.createElement("p");
      effect.className = "presentation-ability-effect";
      effect.textContent = [entry.effect, entry.roll].filter(Boolean).join(" ");
      card.append(effect);
      if (groupKind === "active") appendActiveAbilityCard(card, entry, view, dispatch);
      else appendPassiveCard(card, entry, view, dispatch);
      return card;
    };

    const headline = view.headlineAbility;
    if (headline) {
      block.append(renderAbilityCard(headline, "active"));
    }

    const otherActives = view.activeAbilities.filter((entry) => entry.id !== headline?.id && entry.interaction !== "reference");
    if (otherActives.length) {
      const activeWrap = document.createElement("div");
      activeWrap.className = "presentation-ability-group";
      const activeTitle = document.createElement("p");
      activeTitle.className = "presentation-ability-group-label";
      activeTitle.textContent = "Active";
      activeWrap.append(activeTitle);
      otherActives.forEach((entry) => activeWrap.append(renderAbilityCard(entry, "active")));
      block.append(activeWrap);
    }

    const referenceActives = view.activeAbilities.filter((entry) => entry.interaction === "reference");
    if (referenceActives.length) {
      const refWrap = document.createElement("div");
      refWrap.className = "presentation-ability-group";
      const refTitle = document.createElement("p");
      refTitle.className = "presentation-ability-group-label";
      refTitle.textContent = "Active Reference";
      refWrap.append(refTitle);
      referenceActives.forEach((entry) => refWrap.append(renderAbilityCard(entry, "passive")));
      block.append(refWrap);
    }

    if (view.passivePermissions.length) {
      const passiveWrap = document.createElement("div");
      passiveWrap.className = "presentation-ability-group";
      const passiveTitle = document.createElement("p");
      passiveTitle.className = "presentation-ability-group-label";
      passiveTitle.textContent = "Passive Permissions";
      passiveWrap.append(passiveTitle);
      view.passivePermissions.forEach((entry) => passiveWrap.append(renderAbilityCard(entry, "passive")));
      block.append(passiveWrap);
    }

    if (view.activeBandState) {
      const state = document.createElement("article");
      state.className = `presentation-band-state presentation-band-state-${view.activeBandState.type || view.activeBandState.kind || "edge"}`;
      const bandTitle = document.createElement("p");
      bandTitle.className = "presentation-ability-group-label";
      bandTitle.textContent = "Pressure Effects";
      state.append(bandTitle);
      const label = document.createElement("p");
      label.className = "presentation-ability-title";
      label.textContent = view.activeBandState.type === "collapse"
        ? `${view.activeBandState.name} (${view.activeBandState.atLoad || 6})`
        : `${view.activeBandState.bandLabel} (${view.pressureTrack.value}/6)`;
      state.append(label);
      ["bonus", "helps", "hurts", "effect", "risk", "note"].forEach((key) => {
        if (!view.activeBandState[key]) return;
        const line = document.createElement("p");
        line.className = key === "risk" ? "presentation-ability-meta presentation-ability-risk" : "presentation-ability-effect";
        line.textContent = view.activeBandState[key];
        state.append(line);
      });
      block.append(state);
    }

    const notes = view.runtimeState?.notes;
    if (Array.isArray(notes) && notes.length) {
      const noteBlock = document.createElement("div");
      noteBlock.className = "presentation-ability-notes";
      notes.forEach((line) => {
        const note = document.createElement("p");
        note.className = "presentation-ability-meta";
        note.textContent = line;
        noteBlock.append(note);
      });
      block.append(noteBlock);
    }

    body.append(block);
  }

  function appendPresentationPermissionsReadout(body, view, runtime) {
    mountPresentationPermissionsReadout(body, view, runtime);
  }

  function armedRollActiveLabel(view) {
    const spec = PRESENTATION_ROLL_ACTIVE_SPECS[view?.id];
    if (!spec) return "";
    const state = view.runtimeState?.[spec.stateKey];
    return state?.active ? spec.label : "";
  }

  function mountPresentationPowersQuickStrip(container, view, runtime) {
    if (!container || !view) return;
    const dispatch = typeof runtime?.dispatch === "function" ? runtime.dispatch : null;
    if (!dispatch) return;

    const wrap = document.createElement("div");
    wrap.className = "presentation-powers-quick";

    const title = document.createElement("p");
    title.className = "scene-timer-active-label";
    title.textContent = "Presentation Powers";
    wrap.append(title);

    const actions = document.createElement("div");
    actions.className = "presentation-powers-quick-actions";

    const rollSpec = PRESENTATION_ROLL_ACTIVE_SPECS[view.id];
    if (rollSpec) {
      const rollState = view.runtimeState?.[rollSpec.stateKey];
      if (rollState?.active) {
        const armed = document.createElement("div");
        armed.className = "presentation-powers-quick-armed";
        const armedCopy = document.createElement("span");
        armedCopy.textContent = `${rollSpec.label}: +1 next roll`;
        armed.append(
          armedCopy,
          createButton("Clear", "presentation-ability-btn subtle", () => dispatch(rollSpec.clearAction))
        );
        actions.append(armed);
      } else {
        const rollBtn = createButton(rollSpec.label, "presentation-ability-btn", () => {
          actions.querySelector(".presentation-powers-quick-confirm")?.remove();
          const confirm = document.createElement("div");
          confirm.className = "presentation-powers-quick-confirm presentation-ability-confirm";
          const prompt = document.createElement("p");
          prompt.className = "presentation-ability-confirm-prompt";
          prompt.textContent = rollSpec.prompt;
          const confirmActions = document.createElement("div");
          confirmActions.className = "presentation-ability-confirm-actions";
          confirmActions.append(
            createButton(rollSpec.spendLabel, "presentation-ability-btn", () => dispatch(rollSpec.spendAction)),
            createButton(rollSpec.riskLabel, "presentation-ability-btn subtle", () => dispatch(rollSpec.riskAction)),
            createButton("Cancel", "presentation-ability-btn ghost", () => confirm.remove())
          );
          confirm.append(prompt, confirmActions);
          actions.append(confirm);
        });
        actions.append(rollBtn);
      }
    }

    view.activeAbilities.forEach((entry) => {
      if (entry.interaction === "once_per_scene") {
        const used = sceneAbilityUsed(view, entry);
        const button = createButton(
          used ? `${entry.name} (used)` : `Use: ${entry.name}`,
          `presentation-ability-btn${used ? " subtle" : ""}`,
          () => {
            if (used) {
              dispatch("scene_reset", { presentationId: view.id, abilityId: entry.id });
            } else {
              dispatch("scene_use", { presentationId: view.id, abilityId: entry.id });
            }
          }
        );
        actions.append(button);
        return;
      }
      if (entry.interaction === "load_shift_center") {
        actions.append(createButton(entry.name, "presentation-ability-btn", () => dispatch("anchor_pull")));
        return;
      }
      if (entry.interaction === "essence_transfer_note") {
        actions.append(createButton("Queue Transfer", "presentation-ability-btn", () => dispatch("essence_transfer_note")));
        return;
      }
      if (entry.interaction === "countdown_timer") {
        const pending = (view.runtimeSceneTimers || []).find((timer) => timer.abilityId === entry.id);
        if (pending) {
          actions.append(createButton("Cancel Countdown", "presentation-ability-btn subtle", () => dispatch("re_corporealize_cancel")));
        } else {
          actions.append(createButton("Begin Countdown", "presentation-ability-btn", () => dispatch("re_corporealize_start")));
        }
      }
    });

    if (typeof runtime?.openPermissions === "function") {
      actions.append(createButton("All Permissions", "presentation-ability-btn ghost", () => runtime.openPermissions()));
    }

    if (!actions.children.length) return;
    wrap.append(actions);
    container.append(wrap);
  }

  window.PresentationAbilities = {
    passivePermission,
    activeAbility,
    bandModifier,
    collapseBehavior,
    presentationAbilityContract,
    presentations: PRESENTATION_ABILITIES,
    abilityForCatalogKey,
    abilityForPresentationId,
    presentationAbilityView,
    normalizePresentationAbilityState,
    normalizeSceneTimer,
    presentationState,
    applyPresentationAbilityAction,
    applySceneTimerAction,
    activeTimerDisplayEntries,
    checkedRecoveryKeys,
    resolveDeclaredRecovery,
    RECOVERY_ACTIONS,
    treatHarmEligibility,
    namedPressureRollBonus,
    consumeNamedPressureOnRoll,
    bloodSurgeAppliesToRoll,
    bloodSurgeRollBonus,
    consumeBloodSurgeOnRoll,
    resonantReadAppliesToRoll,
    resonantReadRollBonus,
    consumeResonantReadOnRoll,
    RESONANT_READ_APPLIES_COPY,
    secondPassAppliesToRoll,
    secondPassRollBonus,
    consumeSecondPassOnRoll,
    SECOND_PASS_APPLIES_COPY,
    slipNoticeAppliesToRoll,
    slipNoticeRollBonus,
    consumeSlipNoticeOnRoll,
    SLIP_NOTICE_APPLIES_COPY,
    daemonPushAppliesToRoll,
    daemonPushRollBonus,
    consumeDaemonPushOnRoll,
    DAEMON_PUSH_APPLIES_COPY,
    feralDriveAppliesToRoll,
    feralDriveRollBonus,
    consumeFeralDriveOnRoll,
    FERAL_DRIVE_APPLIES_COPY,
    borrowedForceAppliesToRoll,
    borrowedForceRollBonus,
    consumeBorrowedForceOnRoll,
    BORROWED_FORCE_APPLIES_COPY,
    functionSurgeAppliesToRoll,
    functionSurgeRollBonus,
    consumeFunctionSurgeOnRoll,
    FUNCTION_SURGE_APPLIES_COPY,
    anomalyPushAppliesToRoll,
    anomalyPushRollBonus,
    consumeAnomalyPushOnRoll,
    ANOMALY_PUSH_APPLIES_COPY,
    CONTAINED_TYPE_OPTIONS,
    mountPresentationPermissionsReadout,
    appendPresentationPermissionsReadout,
    mountPresentationPowersQuickStrip,
    armedRollActiveLabel,
    accessTierFromCatalog,
    SURGE_APPLIES_COPY
  };
}());
