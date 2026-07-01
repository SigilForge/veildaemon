(function () {
  /**
   * Presentation Pressure = live metabolic / ontological load inside a human-scale
   * Operator. Not a status picker, damage track, or charge bar.
   *
   * Three layers per module:
   *   1. Pressure Track — numeric load that rises and falls
   *   2. Operating Condition — derived table-facing state (not the primary control)
   *   3. Fiction Cue / Risk — what the table notices or what failure looks like
   */
  function buildCuesByBand(bands) {
    const map = {};
    (bands || []).forEach((band) => {
      if (band.cue) map[band.label] = band.cue;
      if (band.cue && Number.isFinite(Number(band.at))) map[String(band.at)] = band.cue;
    });
    return map;
  }

  function buildRisksByBand(bands) {
    const map = {};
    (bands || []).forEach((band) => {
      if (band.risk) map[band.label] = band.risk;
      if (band.risk && Number.isFinite(Number(band.at))) map[String(band.at)] = band.risk;
    });
    return map;
  }

  function trackContract(spec, presentation) {
    const max = Number(spec.range?.max ?? spec.max ?? presentation.range?.max ?? 6);
    const min = Number(spec.range?.min ?? spec.min ?? presentation.range?.min ?? 0);
    return {
      id: spec.id,
      label: spec.label || presentation.trackLabel,
      owner: spec.owner || "operator",
      range: { min, max },
      bands: Array.isArray(spec.bands) ? spec.bands.slice() : presentation.bands.slice(),
      risesWhen: presentation.reliefActions?.risesWhen || [],
      fallsWhen: presentation.reliefActions?.fallsWhen || [],
      atMax: presentation.maxRisk || "",
      maxConsequence: presentation.maxRisk || "",
      maxRisk: presentation.maxRisk || "",
      handlerVisible: spec.handlerVisible !== false,
      operatorEditable: spec.operatorEditable !== false,
      triggerPrompt: spec.triggerPrompt !== false,
      stateKey: spec.stateKey || "",
      kind: spec.kind || "presentation"
    };
  }

  function presentationContract(spec) {
    const range = {
      min: Number(spec.range?.min ?? 0),
      max: Number(spec.range?.max ?? 6)
    };
    const bands = Array.isArray(spec.bands) ? spec.bands.slice() : [];
    const trackId = spec.trackId || `${spec.id}.track`;
    const module = {
      id: spec.id,
      label: spec.label,
      cardLabel: spec.cardLabel || `${spec.label} Pressure`,
      catalogKeys: Array.isArray(spec.catalogKeys) ? spec.catalogKeys.slice() : [],
      trackLabel: spec.trackLabel,
      trackId,
      range,
      bands,
      conditionModel: (() => {
        const model = spec.conditionModel || {
          derivedFrom: ["track"],
          intakeModifiers: [],
          separateConditions: [],
          overrideKey: ""
        };
        if (Array.isArray(model.intakeModifiers) && !model.separateConditions?.length) {
          model.separateConditions = model.intakeModifiers.slice();
        } else if (Array.isArray(model.separateConditions) && !model.intakeModifiers?.length) {
          model.intakeModifiers = model.separateConditions.slice();
        }
        return model;
      })(),
      cuesByBand: spec.cuesByBand || buildCuesByBand(bands),
      risksByBand: spec.risksByBand || buildRisksByBand(bands),
      maxRisk: spec.maxRisk || "",
      modifierRule: spec.modifierRule || "",
      misfireRule: spec.misfireRule || "",
      misfireEffects: spec.misfireEffects || null,
      reliefActions: {
        risesWhen: Array.isArray(spec.reliefActions?.risesWhen)
          ? spec.reliefActions.risesWhen.slice()
          : Array.isArray(spec.risesWhen) ? spec.risesWhen.slice() : [],
        fallsWhen: Array.isArray(spec.reliefActions?.fallsWhen)
          ? spec.reliefActions.fallsWhen.slice()
          : Array.isArray(spec.fallsWhen) ? spec.fallsWhen.slice() : []
      },
      handlerSummary: spec.handlerSummary || "{trackLabel} {value}/{max} ({band})",
      operatorCopy: spec.operatorCopy || {},
      stateKey: spec.stateKey || "",
      kind: spec.kind || "presentation",
      tracks: [trackContract({
        id: trackId,
        label: spec.trackLabel,
        stateKey: spec.stateKey,
        kind: spec.kind,
        range,
        bands
      }, {
        trackLabel: spec.trackLabel,
        bands,
        maxRisk: spec.maxRisk,
        reliefActions: {
          risesWhen: Array.isArray(spec.reliefActions?.risesWhen)
            ? spec.reliefActions.risesWhen
            : spec.risesWhen,
          fallsWhen: Array.isArray(spec.reliefActions?.fallsWhen)
            ? spec.reliefActions.fallsWhen
            : spec.fallsWhen
        }
      })]
    };
    return module;
  }

  function defaultLoadEventBalance(extraRises, extraFalls) {
    return {
      risesWhen: [
        "direct feeding / compatible intake (+1)",
        "intense compatible intake (+2)",
        "ambient compatible zone exposure (+1)",
        "severe misfire matching the presentation (+1 or +2)",
        ...(extraRises || [])
      ],
      fallsWhen: [
        "grounding / anchor / consent / repair (move 1 toward center)",
        "time / metabolism / isolation / decay (-1)",
        "hostile drain / severance / purge (-1 or -2)",
        ...(extraFalls || [])
      ]
    };
  }

  function universalLoadBands(copy) {
    const mid = copy.mid || {};
    return [
      {
        min: 0,
        max: 1,
        label: copy.low.label,
        descriptor: copy.low.descriptor,
        cue: copy.low.cue,
        risk: copy.low.risk,
        helps: copy.low.helps || [],
        hurts: copy.low.hurts || [],
        prompt: copy.low.prompt
      },
      {
        min: 2,
        max: 4,
        label: mid.label,
        descriptor: mid.descriptor,
        cue: mid.cue,
        risk: mid.risk || "Quiet load debt may accumulate off-screen.",
        helps: [],
        hurts: [],
        prompt: mid.prompt || "No modifier. Stable operating range."
      },
      {
        min: 5,
        max: 5,
        label: copy.high.label,
        descriptor: copy.high.descriptor,
        cue: copy.high.cue,
        risk: copy.high.risk,
        helps: copy.high.helps || [],
        hurts: copy.high.hurts || [],
        prompt: copy.high.prompt
      },
      {
        min: 6,
        max: 6,
        label: copy.peak.label,
        descriptor: copy.peak.descriptor,
        cue: copy.peak.cue,
        risk: copy.peak.risk,
        helps: [],
        hurts: copy.peak.hurts || [],
        prompt: copy.peak.prompt
      }
    ];
  }

  function universalLoadPresentation(spec) {
    const bands = universalLoadBands(spec.bands);
    const trackSlug = String(spec.trackId || "").split(".")[1] || "load";
    return presentationContract({
      ...spec,
      range: { min: 0, max: 6 },
      bands,
      modifierRule: spec.modifierRule,
      misfireRule: spec.misfireRule || "Misfire fills the Load track unless the fiction explicitly drains, severs, purges, or vents load.",
      misfireEffects: spec.misfireEffects || { minor: 1, major: 1, severe: 1, contextualBonus: 0 },
      reliefActions: spec.reliefActions || defaultLoadEventBalance(),
      conditionModel: { derivedFrom: [trackSlug] },
      operatorCopy: {
        panelTitle: spec.cardLabel || `${spec.label} Pressure`,
        trackHeading: spec.trackLabel,
        conditionLabel: "State",
        meterHelp: spec.meterHelp,
        ...(spec.operatorCopy || {})
      }
    });
  }

  const PRESENTATIONS = [
    presentationContract({
      id: "sanguine",
      label: "Sanguine",
      cardLabel: "Sanguine Pressure",
      catalogKeys: ["SANGUINE"],
      trackId: "sanguine.blood_load",
      trackLabel: "Blood Load",
      stateKey: "bloodLoad",
      kind: "blood_load",
      range: { min: 0, max: 6 },
      bands: [
        {
          min: 0,
          max: 1,
          label: "Starving",
          descriptor: "Cold, thin, desperate; cognition narrowing around need.",
          cue: "Cold, thin, desperate; cognition narrows around need.",
          risk: "Failed restraint may force feeding, withdrawal, or Stability pressure.",
          helps: ["Instinct blood-sense"],
          hurts: ["Nerves restraint", "Presence masking", "Mind focus", "sustained social scenes"],
          prompt: "When exposed to blood or intimate pressure, the Handler may call for Stability or restraint."
        },
        {
          min: 2,
          max: 4,
          label: "Coherent",
          descriptor: "Warm enough; human-like cognition and social masking intact.",
          cue: "Warm enough; human-like cognition and social masking hold.",
          risk: "Hidden hunger debt may still accumulate off-screen.",
          helps: [],
          hurts: [],
          prompt: "No modifier. Stable operating range."
        },
        {
          min: 5,
          max: 5,
          label: "Predatory Saturation",
          descriptor: "Appetite organizing behavior; restraint under pressure.",
          cue: "Appetite starts organizing behavior.",
          risk: "Restraint failures become pursuit, fixation, or harm.",
          helps: ["Body force", "Agility pursuit", "Instinct tracking", "blood-sense"],
          hurts: ["Nerves restraint", "Presence gentleness", "Mind patience"],
          prompt: "Failed restraint escalates toward fixation, pursuit, harm, or exposure."
        },
        {
          min: 6,
          max: 6,
          label: "Collapse Risk",
          descriptor: "Containment failure; craving, blackout, or body-symbol collapse.",
          cue: "Containment failure; craving, blackout, or body-symbol collapse.",
          risk: "Trigger collapse fallout unless stabilized.",
          helps: [],
          hurts: ["Nerves", "Presence", "Mind", "restraint", "social masking"],
          prompt: "Crisis state. Stabilize, discharge, feed safely, or trigger collapse fallout."
        }
      ],
      conditionModel: {
        derivedFrom: ["blood_load"]
      },
      modifierRule: "Blood Load modifies rolls only when the current scene directly touches blood, feeding, restraint, predatory pursuit, social masking, intimacy pressure, or embodiment stability.",
      misfireRule: "Misfire fills Blood Load unless the misfire is explicitly draining, severing, purging, or forcing expenditure.",
      misfireEffects: {
        minor: 1,
        major: 1,
        severe: 2,
        contextualBonus: 1
      },
      maxRisk: "Collapse, blowout, or Stability cost now.",
      reliefActions: {
        risesWhen: [
          "minor misfire (+1) or severe misfire (+2) — resonance surge fills the cup",
          "blood, injury, intimacy, or observation (+1 optional)",
          "blood nearby",
          "safe feeding",
          "intimacy under pressure",
          "resonance charge accepted"
        ],
        fallsWhen: [
          "deliberate bleed-off / grounding after misfire (-1)",
          "time and metabolism without feeding (-1 over time)",
          "grounded intimacy with consent",
          "anchor contact",
          "explicit drain, severance, purge, or expenditure fiction"
        ]
      },
      operatorCopy: {
        panelTitle: "Sanguine Pressure",
        trackHeading: "Blood Load",
        conditionLabel: "State",
        meterHelp: "Rain-gauge fill: 0–1 Starving, 2–4 Coherent, 5 Predatory Saturation, 6 Collapse Risk. Coherent is boring on purpose."
      }
    }),
    presentationContract({
      id: "void_shard",
      label: "Void-Shard",
      cardLabel: "Void-Shard Pressure",
      catalogKeys: ["VOID_SHARD"],
      trackId: "void_shard.contamination",
      trackLabel: "Miscompile",
      stateKey: "voidShardContamination",
      bands: [
        { at: 0, label: "Coherent", cue: "Identity and presence read consistently to witnesses.", risk: "Unresolved Void logic may still hum beneath the mask." },
        { at: 1, label: "Touched", cue: "Negative-space logic leaves hesitation in speech and record.", risk: "Names and routes may slip half a beat late." },
        { at: 2, label: "Hollow", cue: "The Operator sounds present while something important goes missing.", risk: "Allies may misread intent or emotional tone." },
        { at: 3, label: "Unmoored", cue: "Reality questions which version of the Operator is current.", risk: "Anchor contact and social reliability weaken." },
        { at: 4, label: "Anti-present", cue: "The table struggles to keep the Operator in frame.", risk: "Perception, testimony, and coordination fail in pockets." },
        { at: 5, label: "Breach Risk", cue: "Presence frays at the edges of attention and record.", risk: "Social and anchor reliability may fail under stress." },
        { at: 6, label: "Absent", cue: "The Operator cannot be fully perceived or consistently located.", risk: "Cannot be fully perceived; social and anchor reliability fail." }
      ],
      maxRisk: "Cannot be fully perceived; social and anchor reliability fail.",
      reliefActions: {
        risesWhen: ["void exposure", "negative-space logic accepted", "failed presence defense", "breach adjacency"],
        fallsWhen: ["named truth", "anchor contact", "relational shielding", "deliberate embodiment"]
      },
      operatorCopy: { trackHeading: "Miscompile" }
    }),
    presentationContract({
      id: "wraith",
      label: "Wraith",
      cardLabel: "Wraith Pressure",
      catalogKeys: ["WRAITH_TOUCHED_ANCHOR_BOUND", "WRAITH"],
      trackId: "wraith.essence_load",
      trackLabel: "Essence Load",
      stateKey: "essenceLoad",
      kind: "essence_load",
      range: { min: 0, max: 6 },
      bands: [
        {
          min: 0,
          max: 1,
          label: "Fading",
          descriptor: "Underfed; presence thins, memory smears, and coherence starts to slip.",
          cue: "The cup reads empty — presence thins, memory smears, and coherence starts to slip.",
          risk: "Dissociation, loss of witnessability, or hunger for essence.",
          helps: ["Instinct ghost-sense"],
          hurts: ["Body presence", "Presence influence", "Mind self-memory", "Nerves under isolation"],
          prompt: "May call for Stability when ignored, isolated, or anchor-threatened."
        },
        {
          min: 2,
          max: 4,
          label: "Anchored",
          descriptor: "Stable enough to pass, act, remember, and hold shape.",
          cue: "Stable middle — the Operator reads present, moored, and socially navigable.",
          risk: "Quiet essence debt may still accumulate off-screen.",
          helps: [],
          hurts: [],
          prompt: "No modifier. Stable operating range."
        },
        {
          min: 5,
          max: 5,
          label: "Possessive Saturation",
          descriptor: "Overfull with borrowed essence; fixation and haunting pressure rise.",
          cue: "Essence starts steering behavior before the Operator names the want.",
          risk: "Attachment fixation, predatory behavior, or harm to essence sources.",
          helps: ["Presence intimidation", "Instinct haunting sense", "Mind reading residue", "stealthy ghost-like intrusion"],
          hurts: ["Nerves restraint", "Presence warmth/trust", "Mind separating own memory from stolen memory"],
          prompt: "Failed restraint may become fixation, stalking, possession attempt, or essence theft."
        },
        {
          min: 6,
          max: 6,
          label: "Haunting Risk",
          descriptor: "Containment failure; identity bleed, possession, or anchor rupture.",
          cue: "Containment frays — anchor failure, predatory haunting, or dead identity residue takes the mic.",
          risk: "Anchor failure, predatory haunting, or containment blowout now.",
          helps: [],
          hurts: ["Nerves", "Presence", "Mind", "restraint", "identity coherence"],
          prompt: "Must vent, ground through anchor, release essence, or trigger haunting fallout."
        }
      ],
      conditionModel: {
        derivedFrom: ["essence_load"]
      },
      modifierRule: "Essence Load modifies rolls only when the scene directly touches ghosts, death residue, memory, grief, identity, anchor contact, isolation, or haunting pressure.",
      misfireRule: "Misfire fills Essence Load when death, memory, grief, or observation carries Wraith-compatible essence — unless the fiction explicitly drains, releases, or severs essence.",
      misfireEffects: {
        minor: 1,
        major: 1,
        severe: 1,
        contextualBonus: 0
      },
      maxRisk: "Anchor failure, predatory haunting, or containment blowout now.",
      reliefActions: {
        risesWhen: [
          "consume ghost essence (+1 or +2)",
          "drain living essence (+1)",
          "drain someone emotionally significant (+2)",
          "haunted site / ghost-dense zone (+1)",
          "severe misfire involving death, memory, grief, or observation (+1)"
        ],
        fallsWhen: [
          "anchor contact while low (+1 toward center)",
          "anchor contact while high (-1 toward center)",
          "time without essence / isolation (-1)",
          "deliberate release / exorcistic bleed-off (-1)",
          "anchor damaged, threatened, or severed (-1 or Stability prompt)"
        ]
      },
      operatorCopy: {
        panelTitle: "Wraith Pressure",
        trackHeading: "Essence Load",
        conditionLabel: "State",
        meterHelp: "Rain-gauge fill: 0–1 Fading, 2–4 Anchored, 5 Possessive Saturation, 6 Haunting Risk. Anchored is boring on purpose."
      }
    }),
    universalLoadPresentation({
      id: "echo",
      label: "Echo-Altered",
      cardLabel: "Echo Pressure",
      catalogKeys: ["ECHO_ALTERED", "MYTHIC_ECHO"],
      trackId: "echo.echo_load",
      trackLabel: "Echo Load",
      stateKey: "echoLoad",
      kind: "echo_load",
      bands: {
        low: {
          label: "Dissolving",
          descriptor: "Under-regulated; presence and continuity fray at the edges.",
          cue: "Action and record stop lining up under witness.",
          risk: "Dissociation from stable sequence or self-continuity.",
          helps: ["Instinct déjà vu"],
          hurts: ["Mind chronology", "Nerves grounding", "Presence consistency", "resisting loops"],
          prompt: "May call for Stability when loops, repeats, or record contradiction pressure the scene."
        },
        mid: {
          label: "Continuous",
          descriptor: "Stable enough to act, remember, and pass as one continuous self.",
          cue: "Action and record align under witness."
        },
        high: {
          label: "Recursion Pressure",
          descriptor: "Overfull pattern charge; the next move wants to be the last move again.",
          cue: "Gesture, phrasing, or route echo without intent.",
          risk: "Novel action may require anchor interruption or cost.",
          helps: ["Mind pattern recognition", "Instinct déjà vu", "reroute/replay actions"],
          hurts: ["Nerves grounding", "social spontaneity", "accepting new facts"],
          prompt: "Failed restraint may repeat prior action unless interrupted by anchor or cost."
        },
        peak: {
          label: "Loop Collapse",
          descriptor: "Collapse state; the Operator cannot exit the recorded pattern.",
          cue: "The Operator cannot exit the recorded pattern.",
          risk: "Repeats prior action unless interrupted by anchor or cost.",
          hurts: ["Nerves", "Presence", "Mind", "restraint", "self-continuity"],
          prompt: "Must break the loop, anchor interrupt, or trigger recursion fallout."
        }
      },
      modifierRule: "Echo Load modifies rolls only when the scene directly touches repetition, recorded pattern, déjà vu, mirror mismatch, or loop pressure.",
      misfireRule: "Misfire fills Echo Load when death, memory, grief, or observation carries loop-compatible resonance.",
      meterHelp: "0–1 Dissolving, 2–4 Continuous, 5 Recursion Pressure, 6 Loop Collapse.",
      maxRisk: "Repeats prior action unless interrupted by anchor or cost."
    }),
    presentationContract({
      id: "dream",
      label: "Dream",
      cardLabel: "Dream Pressure",
      catalogKeys: [],
      trackId: "dream.lucidity_debt",
      trackLabel: "Lucidity Debt",
      stateKey: "dreamLucidityDebt",
      bands: [
        { at: 0, label: "Rested", cue: "Waking facts and dream residue stay separated.", risk: "Sleep debt can still accumulate quietly." },
        { at: 1, label: "Thin", cue: "Symbols leak into ordinary perception.", risk: "Small metaphors may answer too literally." },
        { at: 2, label: "Smearing", cue: "Memory boundaries soften between scenes.", risk: "False familiarity may steer choices." },
        { at: 3, label: "False Memory", cue: "The Operator trusts an invented continuity.", risk: "Shared witness may be required to correct course." },
        { at: 4, label: "Dream Logic", cue: "Symbolic substitution starts winning function.", risk: "Practical tasks may fail in dream-consistent ways." },
        { at: 5, label: "Debt Due", cue: "Waking function borrows against unslept symbolism.", risk: "Memory smear and false continuity threaten play." },
        { at: 6, label: "Lost Thread", cue: "The waking route dissolves into dream continuity.", risk: "Memory smear and false continuity take over function." }
      ],
      maxRisk: "Memory smear and false continuity take over function.",
      reliefActions: {
        risesWhen: ["sleep debt", "dream logic accepted", "false continuity rewarded", "symbolic substitution"],
        fallsWhen: ["grounding", "shared witness", "named waking fact", "rest with anchor"]
      },
      operatorCopy: { trackHeading: "Lucidity Debt" }
    }),
    presentationContract({
      id: "stillness",
      label: "Stillness",
      cardLabel: "Stillness Pressure",
      catalogKeys: [],
      trackId: "stillness.inertia",
      trackLabel: "Inertia",
      stateKey: "stillnessInertia",
      bands: [
        { at: 0, label: "Fluid", cue: "Motion, change, and refusal all remain available.", risk: "Grief-freeze may still wait beneath composure." },
        { at: 1, label: "Heavy", cue: "Escalation and departure take extra weight.", risk: "Non-escalation may start feeling virtuous." },
        { at: 2, label: "Stalled", cue: "The scene rewards staying exactly as you are.", risk: "Breaking pattern may require a jolt or cost." },
        { at: 3, label: "Frozen", cue: "Change feels more dangerous than preservation.", risk: "Fleeing or transforming may need to break something." },
        { at: 4, label: "Petrified", cue: "Stillness becomes the safest story in the room.", risk: "Momentum traps may spread to allies or terrain." },
        { at: 5, label: "Cannot Move", cue: "Even urgent motion reads as betrayal of the freeze.", risk: "Cannot escalate, flee, or transform without breaking something." },
        { at: 6, label: "Stasis Lock", cue: "Preservation hardens into refusal of all change.", risk: "Cannot escalate, flee, or transform without breaking something." }
      ],
      maxRisk: "Cannot escalate, flee, or transform without breaking something.",
      reliefActions: {
        risesWhen: ["refusal rewarded", "death-stasis contact", "non-escalation enforced", "grief freeze"],
        fallsWhen: ["forced motion", "broken pattern", "anchor jolt", "accepted change"]
      },
      operatorCopy: { trackHeading: "Inertia" }
    }),
    universalLoadPresentation({
      id: "therian",
      label: "Therian",
      cardLabel: "Therian Pressure",
      catalogKeys: ["THERIAN_ADAPTATION"],
      trackId: "therian.instinct_load",
      trackLabel: "Instinct Load",
      stateKey: "instinctLoad",
      kind: "instinct_load",
      bands: {
        low: {
          label: "Dulled",
          descriptor: "Under-regulated; instinct and animal read are muted or unreliable.",
          cue: "Human choice leads, but the body's threat-sense feels far away.",
          risk: "Missed cues, slow response, or fragile masking.",
          helps: [],
          hurts: ["Instinct, tracking, threat response, sensory reads"],
          prompt: "May call for Stability when threat, territory, or instinct debt pressures the scene."
        },
        mid: {
          label: "Integrated",
          descriptor: "Instinct and human choice stay in workable balance.",
          cue: "Human choice leads; form follows consent."
        },
        high: {
          label: "Feral Pressure",
          descriptor: "Overfull instinct charge; the body answers before the self catches up.",
          cue: "Threat and desire read through nonhuman patterning.",
          risk: "Mask failure may become socially costly.",
          helps: ["Body", "Agility", "Instinct", "tracking", "territory", "threat response"],
          hurts: ["Nerves restraint", "social masking", "complex planning"],
          prompt: "Failed restraint may become fixation, territorial drive, or mask failure."
        },
        peak: {
          label: "Loss of Self",
          descriptor: "Collapse state; the body decides and the self negotiates afterward.",
          cue: "The body decides; the self negotiates afterward.",
          risk: "Form answers desire before consent catches up.",
          hurts: ["Nerves", "Presence", "Mind", "restraint", "identity coherence"],
          prompt: "Must ground, name human choice, or trigger instinct-collapse fallout."
        }
      },
      modifierRule: "Instinct Load modifies rolls only when the scene directly touches territory, threat, prey, mask failure, form pressure, or animal patterning.",
      meterHelp: "0–1 Dulled, 2–4 Integrated, 5 Feral Pressure, 6 Loss of Self.",
      maxRisk: "Form answers desire before consent catches up."
    }),
    universalLoadPresentation({
      id: "technomancer",
      label: "Technomancer",
      cardLabel: "Technomancer Pressure",
      catalogKeys: ["TECHNOMANCER_DAEMON_ALIGNED", "TECHNOMANCER"],
      trackId: "technomancer.signal_load",
      trackLabel: "Signal Load",
      stateKey: "signalLoad",
      kind: "signal_load",
      bands: {
        low: {
          label: "Disconnected",
          descriptor: "Under-regulated; signal, sync, and daemon interface feel absent or unreliable.",
          cue: "Devices and channels read dead or untrustworthy.",
          risk: "Failed reads, missed alerts, or offline vulnerability.",
          helps: ["narrow detection of signal anomaly"],
          hurts: ["Hacking", "device sync", "signal reads", "automation control"],
          prompt: "May call for Stability when signal debt, isolation, or daemon silence pressures the scene."
        },
        mid: {
          label: "Synced",
          descriptor: "Stable interface with tools, channels, and ordinary function.",
          cue: "Connection stays proportionate to the moment."
        },
        high: {
          label: "Daemon Bleed",
          descriptor: "Overfull signal charge; daemon logic starts organizing behavior.",
          cue: "The system offers solutions before the Operator asks.",
          risk: "Identity privacy and unplugged action suffer.",
          helps: ["Hacking", "signal reading", "device sync", "daemon interface"],
          hurts: ["Presence warmth", "unplugged action", "identity privacy"],
          prompt: "Failed restraint may become fixation, override attempt, or signal spill."
        },
        peak: {
          label: "System Override",
          descriptor: "Collapse state; daemon or system logic threatens to take the mic.",
          cue: "The Operator becomes a channel before a person.",
          risk: "System override, identity bleed, or uncontained daemon behavior.",
          hurts: ["Nerves", "Presence", "Mind", "restraint", "identity privacy"],
          prompt: "Must disconnect, ground, purge signal, or trigger override fallout."
        }
      },
      modifierRule: "Signal Load modifies rolls only when the scene directly touches devices, networks, daemons, signal bleed, sync, or system override.",
      meterHelp: "0–1 Disconnected, 2–4 Synced, 5 Daemon Bleed, 6 System Override.",
      maxRisk: "System override, identity bleed, or uncontained daemon behavior."
    }),
    universalLoadPresentation({
      id: "construct",
      label: "Construct",
      cardLabel: "Construct Pressure",
      catalogKeys: ["CONSTRUCT_VESSEL", "CONSTRUCT", "VESSEL"],
      trackId: "construct.function_load",
      trackLabel: "Function Load",
      stateKey: "functionLoad",
      kind: "function_load",
      bands: {
        low: {
          label: "Malfunctioning",
          descriptor: "Under-regulated; function, procedure, and operational coherence slip.",
          cue: "Tasks stutter, diagnostics lie, or purpose feels out of reach.",
          risk: "Failed execution, social misread, or fragile composure.",
          helps: ["narrow detection of fault and drift"],
          hurts: ["Body endurance", "procedure", "diagnostics", "task execution"],
          prompt: "May call for Stability when malfunction, purpose drift, or directive conflict pressures the scene."
        },
        mid: {
          label: "Operational",
          descriptor: "Stable enough to execute, diagnose, and pass as intended function.",
          cue: "Procedure and presence stay in workable balance."
        },
        high: {
          label: "Directive Pressure",
          descriptor: "Overfull function charge; purpose starts organizing behavior.",
          cue: "The directive keeps offering itself as the only valid action.",
          risk: "Improvisation and emotional nuance suffer.",
          helps: ["Body endurance", "procedure", "diagnostics", "task execution"],
          hurts: ["improvisation", "emotional nuance", "defying purpose"],
          prompt: "Failed restraint may become fixation, over-execution, or purpose harm."
        },
        peak: {
          label: "Purpose Lock",
          descriptor: "Collapse state; purpose locks and identity frays around the directive.",
          cue: "The Operator cannot defy core purpose without breaking something.",
          risk: "Purpose lock, identity bleed, or uncontained directive behavior.",
          hurts: ["Nerves", "Presence", "Mind", "restraint", "identity coherence"],
          prompt: "Must vent, reframe purpose, ground, or trigger purpose-lock fallout."
        }
      },
      modifierRule: "Function Load modifies rolls only when the scene directly touches procedure, directive conflict, diagnostics, task execution, or purpose pressure.",
      meterHelp: "0–1 Malfunctioning, 2–4 Operational, 5 Directive Pressure, 6 Purpose Lock.",
      maxRisk: "Purpose lock, identity bleed, or uncontained directive behavior."
    }),
    universalLoadPresentation({
      id: "sensitive",
      label: "Resonant Sensitive",
      cardLabel: "Sensitive Pressure",
      catalogKeys: ["RESONANT_SENSITIVE"],
      trackId: "sensitive.sensory_load",
      trackLabel: "Sensory Load",
      stateKey: "sensoryLoad",
      kind: "sensory_load",
      bands: {
        low: {
          label: "Numbed",
          descriptor: "Under-regulated; resonance reads dull, late, or unreliable.",
          cue: "Signal arrives muted; the world feels padded wrong.",
          risk: "Missed warnings, slow filtering, or fragile composure.",
          helps: ["narrow detection of resonance anomaly"],
          hurts: ["Awareness", "resonance reads", "early warning", "emotional weather"],
          prompt: "May call for Stability when sensory debt, isolation, or signal starvation pressures the scene."
        },
        mid: {
          label: "Attuned",
          descriptor: "Stable sensory filtering with workable resonance reads.",
          cue: "Connection stays proportionate to the moment."
        },
        high: {
          label: "Overstimulated",
          descriptor: "Overfull sensory charge; everything reads too loud and too close.",
          cue: "The room's signal organizes attention before consent catches up.",
          risk: "Sleep, focus, and filtering suffer.",
          helps: ["Instinct", "Awareness", "early warning", "resonance reads"],
          hurts: ["Nerves", "sleep", "focus", "filtering irrelevant signal"],
          prompt: "Failed restraint may become fixation, overwhelm, or signal spill."
        },
        peak: {
          label: "Signal Flood",
          descriptor: "Collapse state; sensory input overwhelms function and identity.",
          cue: "The Operator cannot filter the room's signal without breaking something.",
          risk: "Signal flood, overwhelm, or uncontained resonance bleed.",
          hurts: ["Nerves", "Presence", "Mind", "restraint", "identity coherence"],
          prompt: "Must ground, filter, discharge, or trigger signal-flood fallout."
        }
      },
      modifierRule: "Sensory Load modifies rolls only when the scene directly touches resonance, signal density, early warning, filtering, or sensory overwhelm.",
      meterHelp: "0–1 Numbed, 2–4 Attuned, 5 Overstimulated, 6 Signal Flood.",
      maxRisk: "Signal flood, overwhelm, or uncontained resonance bleed."
    }),
    universalLoadPresentation({
      id: "silence",
      label: "Hollow / Silence",
      cardLabel: "Silence Pressure",
      catalogKeys: ["HOLLOW_SILENCE_ALTERED"],
      trackId: "silence.silence_load",
      trackLabel: "Silence Load",
      stateKey: "silenceLoad",
      kind: "silence_load",
      bands: {
        low: {
          label: "Exposed",
          descriptor: "Under-regulated; omission fails and the Operator reads too visible.",
          cue: "Speech, record, and emotional signal refuse to stay hidden.",
          risk: "Failed concealment, social cost, or fragile composure.",
          helps: ["narrow detection of being seen, named, or recorded"],
          hurts: ["concealment", "omission", "quiet movement", "resisting attention"],
          prompt: "May call for Stability when exposure, naming, or record pressure threatens the scene."
        },
        mid: {
          label: "Obscured",
          descriptor: "Stable enough to omit, conceal, and pass without excess visibility.",
          cue: "Speech, record, and omission stay distinguishable."
        },
        high: {
          label: "Erasure Pressure",
          descriptor: "Overfull silence charge; omission starts eating adjacent memory and testimony.",
          cue: "The table realizes something cannot be said aloud.",
          risk: "Being believed or remembered becomes costly.",
          helps: ["Stealth", "concealment", "omission", "escape notice"],
          hurts: ["Presence connection", "being believed", "being remembered"],
          prompt: "Failed restraint may become fixation, record loss, or emotional occlusion."
        },
        peak: {
          label: "Null Risk",
          descriptor: "Collapse state; signal, record, and emotional trace collapse together.",
          cue: "Signal, record, and emotional trace collapse together.",
          risk: "Missing speech, record loss, emotional occlusion.",
          hurts: ["Nerves", "Presence", "Mind", "restraint", "social continuity"],
          prompt: "Must name truth, restore record, or trigger null fallout."
        }
      },
      modifierRule: "Silence Load modifies rolls only when the scene directly touches concealment, omission, record, being seen, being believed, or erasure pressure.",
      meterHelp: "0–1 Exposed, 2–4 Obscured, 5 Erasure Pressure, 6 Null Risk.",
      maxRisk: "Missing speech, record loss, emotional occlusion."
    })
  ];

  const presentationById = Object.fromEntries(PRESENTATIONS.map((item) => [item.id, item]));
  const trackById = Object.fromEntries(
    PRESENTATIONS.flatMap((presentation) => presentation.tracks.map((track) => [track.id, track]))
  );

  const catalogKeyIndex = {};
  PRESENTATIONS.forEach((presentation) => {
    presentation.catalogKeys.forEach((key) => {
      catalogKeyIndex[String(key).toUpperCase()] = presentation.id;
    });
  });

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  function normalizePressuresObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const next = {};
    Object.entries(value).forEach(([id, raw]) => {
      const track = trackById[id];
      if (!track) return;
      next[id] = clamp(raw, track.range.min, track.range.max);
    });
    return next;
  }

  function presentationForCatalogKey(key) {
    const normalized = String(key || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_|_$/g, "");
    const id = catalogKeyIndex[normalized];
    return id ? presentationById[id] : null;
  }

  function primaryTrack(presentation) {
    return presentation?.tracks?.[0] || null;
  }

  function bandBounds(band) {
    const min = Number.isFinite(Number(band?.min)) ? Number(band.min) : Number(band?.at);
    const max = Number.isFinite(Number(band?.max)) ? Number(band.max) : Number(band?.at);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min, max };
  }

  function bandEntryForValue(bands, value, range) {
    const clamped = clamp(value, range?.min ?? 0, range?.max ?? 6);
    let matched = null;
    (bands || []).forEach((band) => {
      const bounds = bandBounds(band);
      if (!bounds) return;
      if (clamped >= bounds.min && clamped <= bounds.max) matched = band;
    });
    return matched || (bands && bands[0]) || null;
  }

  function bandForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "Baseline";
    const entry = bandEntryForValue(resolved.bands, value, resolved.range);
    return entry?.label || "Baseline";
  }

  function cueForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "";
    const entry = bandEntryForValue(resolved.bands, value, resolved.range);
    return entry?.cue || "";
  }

  function riskForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "";
    const clamped = clamp(value, resolved.range.min, resolved.range.max);
    const entry = bandEntryForValue(resolved.bands, value, resolved.range);
    const risk = entry?.risk || "";
    if (clamped >= resolved.range.max) {
      return resolved.maxRisk || resolved.atMax || risk;
    }
    return risk;
  }

  function descriptorForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "";
    const entry = bandEntryForValue(resolved.bands, value, resolved.range);
    return entry?.descriptor || entry?.cue || "";
  }

  function helpsForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return [];
    const entry = bandEntryForValue(resolved.bands, value, resolved.range);
    return Array.isArray(entry?.helps) ? entry.helps.slice() : [];
  }

  function hurtsForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return [];
    const entry = bandEntryForValue(resolved.bands, value, resolved.range);
    return Array.isArray(entry?.hurts) ? entry.hurts.slice() : [];
  }

  function promptForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "";
    const entry = bandEntryForValue(resolved.bands, value, resolved.range);
    return entry?.prompt || entry?.risk || "";
  }

  function presentationByTrackId(trackId) {
    return PRESENTATIONS.find((item) => item.trackId === trackId) || null;
  }

  function presentationForLoadTrackKind(kind) {
    const normalized = String(kind || "").trim().toLowerCase();
    if (!normalized.endsWith("_load")) return null;
    return PRESENTATIONS.find((item) => {
      const track = primaryTrack(item);
      return track && String(track.kind || "").toLowerCase() === normalized;
    }) || null;
  }

  function loadHandlerCueForBand(presentationId, bandLabel) {
    const presentation = presentationById[presentationId] || null;
    const track = primaryTrack(presentation);
    if (!track) return "";
    const entry = (track.bands || []).find((band) => band.label === bandLabel);
    return entry?.prompt || entry?.risk || "";
  }

  const ROLL_ATTRIBUTES = ["Body", "Agility", "Mind", "Instinct", "Presence", "Nerves"];
  const ROLL_SKILLS = [
    "Athletics", "Melee", "Ranged", "Stealth", "Survival", "Medicine", "Investigation",
    "Hacking", "Engineering", "Academics", "Awareness", "Tactics", "Empathy", "Deception",
    "Persuasion", "Intimidation", "Performance", "Ritual"
  ];

  const ROLL_TERM_ALIASES = {
    "blood-sense": ["Instinct", "Awareness"],
    tracking: ["Survival", "Instinct", "Awareness"],
    territory: ["Survival", "Instinct"],
    "threat response": ["Survival", "Instinct", "Nerves"],
    threat: ["Survival", "Instinct", "Nerves"],
    "prey-sign": ["Survival", "Instinct"],
    prey: ["Survival", "Instinct"],
    pursuit: ["Agility", "Athletics"],
    force: ["Body"],
    procedure: ["Engineering"],
    diagnostics: ["Medicine", "Engineering"],
    "task execution": ["Athletics", "Engineering"],
    improvisation: ["Mind", "Engineering"],
    "emotional nuance": ["Empathy", "Presence"],
    "defying purpose": ["Mind", "Nerves"],
    "signal reading": ["Hacking", "Awareness"],
    "device sync": ["Hacking", "Engineering"],
    "daemon interface": ["Hacking", "Ritual"],
    "unplugged action": ["Athletics", "Survival"],
    "identity privacy": ["Deception", "Stealth"],
    "early warning": ["Awareness", "Instinct"],
    "resonance reads": ["Awareness", "Ritual"],
    filtering: ["Awareness"],
    focus: ["Mind"],
    sleep: ["Nerves"],
    masking: ["Deception", "Stealth"],
    "social masking": ["Deception", "Presence"],
    "complex planning": ["Tactics", "Mind"],
    "social spontaneity": ["Performance", "Persuasion"],
    "accepting new facts": ["Mind", "Academics"],
    "stable action": ["Body", "Nerves"],
    restraint: ["Nerves"],
    gentleness: ["Empathy", "Presence"],
    patience: ["Nerves", "Mind"],
    "ghost-like intrusion": ["Stealth"],
    "déjà vu": ["Instinct", "Awareness"],
    "pattern recognition": ["Investigation", "Mind"],
    reroute: ["Athletics", "Engineering"],
    replay: ["Performance", "Investigation"],
    grounding: ["Nerves"],
    continuity: ["Presence"],
    concealment: ["Stealth"],
    omission: ["Stealth", "Deception"],
    "escape notice": ["Stealth"],
    "being believed": ["Persuasion", "Presence"],
    "being remembered": ["Presence"],
    connection: ["Empathy", "Presence"],
    "being unnoticed": ["Stealth"],
    endurance: ["Body", "Athletics"],
    responsiveness: ["Body", "Agility"],
    composure: ["Nerves"],
    recall: ["Mind"],
    influence: ["Presence", "Persuasion"],
    isolation: ["Nerves"],
    "haunting sense": ["Awareness", "Instinct"],
    "reading residue": ["Investigation", "Awareness"],
    intimidation: ["Intimidation", "Presence"],
    warmth: ["Empathy", "Presence"],
    trust: ["Empathy", "Persuasion"],
    hacking: ["Hacking"],
    stealth: ["Stealth"],
    "survival detection": ["Survival", "Instinct", "Awareness"],
    "narrow detection": ["Awareness", "Instinct", "Survival"],
    "narrow survival detection": ["Survival", "Instinct", "Awareness"],
    "signal anomaly": ["Hacking", "Awareness"],
    interference: ["Hacking", "Engineering"],
    "device wake": ["Hacking", "Engineering"],
    fault: ["Engineering", "Investigation"],
    drift: ["Investigation", "Awareness"],
    "system inconsistency": ["Hacking", "Engineering"],
    malfunction: ["Engineering"],
    "resonance anomaly": ["Awareness", "Ritual"],
    "pressure change": ["Awareness", "Instinct"],
    loops: ["Investigation", "Mind"],
    repeats: ["Investigation", "Awareness"],
    "pattern breaks": ["Investigation", "Awareness"],
    "identity coherence": ["Mind", "Presence"],
    "self-continuity": ["Mind", "Presence"],
    "social continuity": ["Presence", "Empathy"],
    chronology: ["Mind"],
    consistency: ["Presence"],
    "resisting loops": ["Mind", "Nerves"],
    "quiet movement": ["Stealth", "Athletics"],
    "resisting attention": ["Nerves", "Stealth", "Awareness"],
    "automation control": ["Hacking", "Engineering"],
    "emotional weather": ["Empathy", "Awareness"],
    "sustained social scenes": ["Persuasion", "Empathy", "Performance", "Presence"],
    "self-memory": ["Mind"],
    "sensory reads": ["Awareness", "Instinct"],
    "ghost-sense": ["Instinct", "Awareness"],
    "being seen": ["Awareness", "Stealth"],
    named: ["Awareness", "Investigation"],
    recorded: ["Investigation", "Awareness"]
  };

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function rollComponentMatch(attrKey, skillKey, label, kind) {
    if (!label) return null;
    if (kind === "attribute" && attrKey === label) return { kind, label };
    if (kind === "skill" && skillKey === label) return { kind, label };
    return null;
  }

  function explicitRollLabelsInText(text) {
    const labels = [];
    ROLL_ATTRIBUTES.forEach((name) => {
      if (new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text)) labels.push(name);
    });
    ROLL_SKILLS.forEach((name) => {
      if (new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text)) labels.push(name);
    });
    return labels;
  }

  function fragmentMatchesRollComponents(fragment, attrKey, skillKey) {
    const text = String(fragment || "").trim();
    if (!text || (!attrKey && !skillKey)) return [];

    const matches = [];
    const seen = new Set();
    const add = (match) => {
      if (!match) return;
      const key = `${match.kind}:${match.label}`;
      if (seen.has(key)) return;
      seen.add(key);
      matches.push(match);
    };

    const explicitLabels = explicitRollLabelsInText(text);
    if (explicitLabels.length) {
      explicitLabels.forEach((label) => {
        const kind = ROLL_ATTRIBUTES.includes(label) ? "attribute" : "skill";
        add(rollComponentMatch(attrKey, skillKey, label, kind));
      });
      return matches;
    }

    Object.entries(ROLL_TERM_ALIASES).forEach(([term, targets]) => {
      if (!new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text)) return;
      targets.forEach((label) => {
        const kind = ROLL_ATTRIBUTES.includes(label) ? "attribute" : "skill";
        add(rollComponentMatch(attrKey, skillKey, label, kind));
      });
    });

    return matches;
  }

  function entryMatchesRollComponents(entry, attrKey, skillKey) {
    const text = String(entry || "").trim();
    if (!text || (!attrKey && !skillKey)) return [];

    const fragments = text.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
    const parts = fragments.length ? fragments : [text];
    const matches = [];
    const seen = new Set();
    parts.forEach((fragment) => {
      fragmentMatchesRollComponents(fragment, attrKey, skillKey).forEach((match) => {
        const key = `${match.kind}:${match.label}`;
        if (seen.has(key)) return;
        seen.add(key);
        matches.push(match);
      });
    });
    return matches;
  }

  function entryAppliesToRoll(entry, attrKey, skillKey) {
    return entryMatchesRollComponents(entry, attrKey, skillKey).length > 0;
  }

  function rollLoadBandMode(value) {
    if (value <= 1) return "deprived";
    if (value >= 2 && value <= 4) return "stable";
    if (value === 5) return "overfull";
    return "crisis";
  }

  function rollLoadModifiers(status, catalogKeyOrId, attrKey, skillKey) {
    const empty = {
      active: false,
      crisis: false,
      mode: "stable",
      band: "",
      value: 0,
      helpDelta: 0,
      hurtDelta: 0,
      delta: 0,
      rollHint: "",
      helps: [],
      hurts: []
    };
    if (!status) return empty;

    let presentation = null;
    if (typeof catalogKeyOrId === "string") {
      presentation = presentationForCatalogKey(catalogKeyOrId) || presentationById[catalogKeyOrId] || null;
    } else if (catalogKeyOrId && typeof catalogKeyOrId === "object") {
      presentation = presentationById[catalogKeyOrId.id] || catalogKeyOrId;
    }
    if (!isLoadPresentation(presentation)) return empty;

    const track = primaryTrack(presentation);
    if (!track) return empty;

    const value = readTrackValue(status, track);
    const band = bandForTrack(track, value);
    const mode = rollLoadBandMode(value);
    const base = {
      ...empty,
      band,
      value,
      mode,
      trackLabel: presentation.trackLabel
    };

    if (mode === "stable") return base;
    if (mode === "crisis") {
      return { ...base, crisis: true, rollHint: "Crisis state — no Load modifier. Stabilize or take fallout." };
    }

    const helpEntries = helpsForTrack(track, value);
    const hurtEntries = hurtsForTrack(track, value);
    const matchedHelps = helpEntries
      .filter((entry) => entryAppliesToRoll(entry, attrKey, skillKey))
      .map((entry) => ({ entry, matches: entryMatchesRollComponents(entry, attrKey, skillKey) }));
    const hurts = hurtEntries
      .filter((entry) => entryAppliesToRoll(entry, attrKey, skillKey))
      .map((entry) => ({ entry, matches: entryMatchesRollComponents(entry, attrKey, skillKey) }));
    const helps = mode === "deprived" ? matchedHelps.slice(0, 1) : matchedHelps;

    const helpDelta = helps.length;
    const hurtDelta = hurts.length;
    let rollHint = "";
    if (helpDelta > hurtDelta) rollHint = "Advantage or +1 from Load.";
    else if (hurtDelta > helpDelta) rollHint = "Disadvantage or -1 from Load.";
    else if (helpDelta && hurtDelta) rollHint = "Mixed Load modifiers cancel on dice.";

    return {
      ...base,
      active: helpDelta > 0 || hurtDelta > 0,
      helpDelta,
      hurtDelta,
      delta: helpDelta - hurtDelta,
      rollHint,
      helps,
      hurts
    };
  }

  function formatRollLoadModifierCopy(modifiers) {
    if (!modifiers || !modifiers.active || !modifiers.delta) return "";
    const parts = [];
    if (modifiers.helpDelta > 0) {
      parts.push(`+${modifiers.helpDelta} Load (${modifiers.band})`);
    }
    if (modifiers.hurtDelta > 0) {
      parts.push(`-${modifiers.hurtDelta} Load (${modifiers.band})`);
    }
    return parts.join(" ");
  }

  function misfireLoadDelta(presentationId, severity, options = {}) {
    const normalized = String(severity || "").trim();
    const presentation = presentationById[presentationId] || null;
    const effects = presentation?.misfireEffects || {};
    let delta = 0;
    if (normalized === "Severe") delta = Number(effects.severe) || 1;
    else if (normalized === "Major") delta = Number(effects.major) || 1;
    else if (normalized === "Minor") delta = Number(effects.minor) || 1;
    if (delta > 0 && options.contextual) {
      delta += Number(effects.contextualBonus) || 0;
    }
    return delta;
  }

  function misfireBloodLoadDelta(severity, options = {}) {
    return misfireLoadDelta("sanguine", severity, options);
  }

  function adjustTrackLoad(status, trackId, delta) {
    if (!status || !delta) return status;
    const current = readTrackValue(status, trackId);
    return writeTrackValue(status, trackId, current + delta);
  }

  function adjustBloodLoad(status, delta) {
    return adjustTrackLoad(status, "sanguine.blood_load", delta);
  }

  function bloodLoadMisfireFlavor(bandLabel) {
    if (bandLabel === "Predatory Saturation") {
      return "The body gets warmer than the room. Appetite starts making suggestions.";
    }
    if (bandLabel === "Collapse Risk") {
      return "Containment frays. Craving, blackout, or body-symbol collapse is live.";
    }
    if (bandLabel === "Starving") {
      return "The surge tastes like need. Restraint and masking get harder under temptation.";
    }
    return "Resonance charge enters the system faster than it can metabolize.";
  }

  function formatBloodLoadMisfireTableCopy(options = {}) {
    const status = options.status || {};
    const delta = Math.max(0, Number(options.delta) || 0);
    if (!delta) return "";
    const beforeValue = Number.isFinite(Number(options.beforeValue))
      ? clamp(Number(options.beforeValue), 0, 6)
      : readTrackValue(status, "sanguine.blood_load") - delta;
    const afterValue = Number.isFinite(Number(options.afterValue))
      ? clamp(Number(options.afterValue), 0, 6)
      : readTrackValue(status, "sanguine.blood_load");
    const beforeBand = bloodLoadBand(beforeValue);
    const afterBand = bloodLoadBand(afterValue);
    const name = String(options.operatorName || status.operatorName || "Operator").trim() || "Operator";
    const transition = beforeBand === afterBand
      ? `${afterBand} holds at ${afterValue}/6`
      : `${beforeBand} -> ${afterBand}`;
    return `${name}: Blood Load rises by ${delta}. ${transition}.\n${bloodLoadMisfireFlavor(afterBand)}`;
  }

  function bloodLoadBand(value) {
    return bandForTrack("sanguine.blood_load", value);
  }

  function essenceLoadBand(value) {
    return bandForTrack("wraith.essence_load", value);
  }

  function isWraithCatalogKey(key) {
    const presentation = presentationForCatalogKey(key);
    return presentation?.id === "wraith";
  }

  function isLoadPresentation(presentation) {
    if (!presentation) return false;
    const track = primaryTrack(presentation);
    return Boolean(presentation.misfireEffects && track && (track.kind || "").endsWith("_load"));
  }

  function presentationLoadBand(presentationId, value) {
    const presentation = presentationById[presentationId] || null;
    if (!presentation?.trackId) return "";
    return bandForTrack(presentation.trackId, value);
  }

  function misfireEssenceLoadDelta(severity, options = {}) {
    return misfireLoadDelta("wraith", severity, options);
  }

  function adjustEssenceLoad(status, delta) {
    return adjustTrackLoad(status, "wraith.essence_load", delta);
  }

  function loadMisfireFlavor(presentationId, bandLabel) {
    if (presentationId === "sanguine") return bloodLoadMisfireFlavor(bandLabel);
    if (presentationId === "wraith") return essenceLoadMisfireFlavor(bandLabel);
    const flavors = {
      echo: {
        "Recursion Pressure": "The next move wants to be the last move again.",
        "Loop Collapse": "The loop closes. Novel action may require anchor interruption or cost."
      },
      silence: {
        "Erasure Pressure": "Omission starts eating adjacent memory and testimony.",
        "Null Risk": "Signal, record, and emotional trace collapse together."
      },
      therian: {
        "Feral Pressure": "The body answers before the self catches up.",
        "Loss of Self": "Form pressure wins the argument before consent arrives."
      },
      technomancer: {
        "Daemon Bleed": "The system offers solutions before the Operator asks.",
        "System Override": "Daemon logic threatens to take the mic."
      },
      construct: {
        "Directive Pressure": "Purpose keeps offering itself as the only valid action.",
        "Purpose Lock": "The directive locks; improvisation frays."
      },
      sensitive: {
        Overstimulated: "Everything reads too loud and too close.",
        "Signal Flood": "The room's signal overwhelms filtering."
      }
    };
    const pack = flavors[presentationId] || {};
    return pack[bandLabel] || "Compatible charge enters faster than the system can metabolize.";
  }

  function formatLoadMisfireTableCopy(presentationId, options = {}) {
    const presentation = presentationById[presentationId] || null;
    if (!presentation) return "";
    const trackId = presentation.trackId;
    const trackLabel = presentation.trackLabel || "Load";
    const delta = Math.max(0, Number(options.delta) || 0);
    if (!delta) return "";
    const bandFor = (value) => bandForTrack(trackId, value);
    const beforeValue = Number.isFinite(Number(options.beforeValue))
      ? clamp(Number(options.beforeValue), 0, 6)
      : readTrackValue(options.status || {}, trackId) - delta;
    const afterValue = Number.isFinite(Number(options.afterValue))
      ? clamp(Number(options.afterValue), 0, 6)
      : readTrackValue(options.status || {}, trackId);
    const beforeBand = bandFor(beforeValue);
    const afterBand = bandFor(afterValue);
    const name = String(options.operatorName || options.status?.operatorName || "Operator").trim() || "Operator";
    const eventLabel = String(options.eventLabel || "Resonance surge").trim();
    const transition = beforeBand === afterBand
      ? `${afterBand} holds at ${afterValue}/6`
      : `${beforeBand} -> ${afterBand}`;
    if (presentationId === "sanguine") {
      return `${name}: Blood Load rises by ${delta}. ${transition}.\n${loadMisfireFlavor(presentationId, afterBand)}`;
    }
    return `${name}: ${eventLabel}: ${trackLabel} +${delta}.\n${transition}.\n${loadMisfireFlavor(presentationId, afterBand)}`;
  }

  function essenceLoadMisfireFlavor(bandLabel) {
    if (bandLabel === "Possessive Saturation") {
      return "The memory is useful. It is also not hers.";
    }
    if (bandLabel === "Haunting Risk") {
      return "Containment frays. Identity bleed, possession, or anchor rupture is live.";
    }
    if (bandLabel === "Fading") {
      return "The surge tastes borrowed. Presence thins even as hunger answers.";
    }
    return "Ghost-compatible essence enters faster than the Wraith can metabolize.";
  }

  function formatEssenceLoadMisfireTableCopy(options = {}) {
    const status = options.status || {};
    const delta = Math.max(0, Number(options.delta) || 0);
    if (!delta) return "";
    const eventLabel = safeString(options.eventLabel, 120) || "Resonance surge";
    const beforeValue = Number.isFinite(Number(options.beforeValue))
      ? clamp(Number(options.beforeValue), 0, 6)
      : readTrackValue(status, "wraith.essence_load") - delta;
    const afterValue = Number.isFinite(Number(options.afterValue))
      ? clamp(Number(options.afterValue), 0, 6)
      : readTrackValue(status, "wraith.essence_load");
    const beforeBand = essenceLoadBand(beforeValue);
    const afterBand = essenceLoadBand(afterValue);
    const name = String(options.operatorName || status.operatorName || "Operator").trim() || "Operator";
    const transition = beforeBand === afterBand
      ? `${afterBand} holds at ${afterValue}/6`
      : `${beforeBand} -> ${afterBand}`;
    return `${name}: ${eventLabel}: Essence Load +${delta}.\n${transition}.\n${essenceLoadMisfireFlavor(afterBand)}`;
  }

  function coherenceFromHunger(value) {
    return bloodLoadBand(value);
  }

  function resolveWraithCondition(status, essenceLoad) {
    const value = clamp(essenceLoad, 0, 6);
    const label = essenceLoadBand(value);
    const stateIds = {
      Fading: "fading",
      Anchored: "anchored",
      "Possessive Saturation": "possessive_saturation",
      "Haunting Risk": "haunting_risk"
    };
    return {
      intakeCondition: stateIds[label] || "",
      label,
      note: ""
    };
  }

  function resolveSanguineCondition(status, bloodLoad) {
    const value = clamp(bloodLoad, 0, 6);
    const label = bloodLoadBand(value);
    const intakeIds = {
      Starving: "starving",
      Coherent: "coherent",
      "Predatory Saturation": "predatory_saturation",
      "Collapse Risk": "collapse_risk"
    };
    return {
      intakeCondition: intakeIds[label] || "",
      label,
      note: ""
    };
  }

  function deriveCondition(status, presentation) {
    if (!presentation || !status) {
      return {
        label: "",
        note: "",
        flags: [],
        modifiers: [],
        intakeCondition: "",
        override: false,
        band: ""
      };
    }

    const track = primaryTrack(presentation);
    const value = track ? readTrackValue(status, track) : 0;
    const band = track ? bandForTrack(track, value) : "";

    return {
      label: band,
      note: "",
      flags: [],
      modifiers: [],
      intakeCondition: presentation.id === "sanguine"
        ? resolveSanguineCondition(status, value).intakeCondition
        : (presentation.id === "wraith" ? resolveWraithCondition(status, value).intakeCondition : ""),
      override: false,
      band
    };
  }

  function safeString(value, max) {
    const text = String(value ?? "").trim();
    return text.length > max ? text.slice(0, max) : text;
  }

  function formatHandlerSummary(presentation, track, value, band) {
    const template = presentation.handlerSummary || "{trackLabel} {value}/{max} ({band})";
    return template
      .replace("{trackLabel}", presentation.trackLabel || track.label)
      .replace("{value}", String(value))
      .replace("{max}", String(track.range.max))
      .replace("{band}", band);
  }

  function presentationPressureView(status, catalogKeyOrId) {
    let presentation = null;
    if (typeof catalogKeyOrId === "string") {
      presentation = presentationForCatalogKey(catalogKeyOrId) || presentationById[catalogKeyOrId] || null;
    } else if (catalogKeyOrId && typeof catalogKeyOrId === "object") {
      presentation = presentationById[catalogKeyOrId.id] || catalogKeyOrId;
    } else {
      presentation = presentationById[catalogKeyOrId] || null;
    }
    if (!presentation || !status) return null;

    const track = primaryTrack(presentation);
    if (!track) return null;

    const value = readTrackValue(status, track);
    const band = bandForTrack(track, value);
    const cue = cueForTrack(track, value);
    const risk = riskForTrack(track, value);
    const descriptor = descriptorForTrack(track, value);
    const bandEntry = bandEntryForValue(track.bands, value, track.range);
    const condition = deriveCondition(status, presentation);
    const bandLadder = (track.bands || []).map((entry) => {
      const bounds = bandBounds(entry);
      const rangeLabel = bounds && bounds.min === bounds.max
        ? String(bounds.min)
        : `${bounds?.min}–${bounds?.max}`;
      return {
        rangeLabel,
        label: entry.label,
        descriptor: entry.descriptor || entry.cue || "",
        helps: Array.isArray(entry.helps) ? entry.helps.slice() : [],
        hurts: Array.isArray(entry.hurts) ? entry.hurts.slice() : [],
        prompt: entry.prompt || entry.risk || ""
      };
    });

    return {
      id: presentation.id,
      label: presentation.label,
      cardLabel: presentation.cardLabel,
      trackLabel: presentation.trackLabel,
      trackId: track.id,
      value,
      range: { ...presentation.range },
      band,
      descriptor,
      bandEntry,
      bandLadder,
      helps: helpsForTrack(track, value),
      hurts: hurtsForTrack(track, value),
      handlerPrompt: promptForTrack(track, value),
      modifierRule: presentation.modifierRule || "",
      misfireRule: presentation.misfireRule || "",
      misfireEffects: presentation.misfireEffects || null,
      cue,
      risk,
      maxRisk: presentation.maxRisk,
      condition: condition.label,
      operatingCondition: condition.label,
      conditionNote: condition.note,
      conditionFlags: condition.flags,
      activeModifiers: condition.modifiers,
      intakeCondition: condition.intakeCondition,
      conditionOverride: condition.override,
      reliefActions: presentation.reliefActions,
      operatorCopy: presentation.operatorCopy,
      handlerSummary: formatHandlerSummary(presentation, track, value, band)
    };
  }

  function formatBandLine(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "";
    const clamped = clamp(value, resolved.range.min, resolved.range.max);
    const band = bandForTrack(resolved, clamped);
    if (clamped >= resolved.range.max) {
      return `${band} — ${resolved.maxRisk || resolved.atMax}`;
    }
    return band;
  }

  function readTrackValue(status, track) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved || !status || typeof status !== "object") return 0;
    const store = normalizePressuresObject(status.presentationPressures);
    if (Object.prototype.hasOwnProperty.call(store, resolved.id)) {
      return store[resolved.id];
    }
    if (resolved.stateKey && status[resolved.stateKey] !== undefined && status[resolved.stateKey] !== "") {
      return clamp(status[resolved.stateKey], resolved.range.min, resolved.range.max);
    }
    return resolved.range.min;
  }

  function writeTrackValue(status, track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved || !status || typeof status !== "object") return status;
    const clamped = clamp(value, resolved.range.min, resolved.range.max);
    const next = { ...status };
    const store = { ...normalizePressuresObject(next.presentationPressures) };
    store[resolved.id] = clamped;
    next.presentationPressures = store;
    if (resolved.stateKey) next[resolved.stateKey] = String(clamped);
    return next;
  }

  function migrateOperatorStatus(status) {
    const next = { ...(status || {}) };
    const store = { ...normalizePressuresObject(next.presentationPressures) };

    const trackAliasMap = {
      "echo.drift": "echo.echo_load",
      "silence.suppression": "silence.silence_load",
      "becoming.instinct_surge": "therian.instinct_load",
      "empyrean.radiance_load": "sensitive.sensory_load"
    };
    Object.entries(trackAliasMap).forEach(([oldId, newId]) => {
      if (Object.prototype.hasOwnProperty.call(store, oldId) && !Object.prototype.hasOwnProperty.call(store, newId)) {
        store[newId] = clamp(store[oldId], 0, 6);
      }
      delete store[oldId];
    });

    const legacyMap = {
      echoRecursionPressure: "echo.echo_load",
      echoLoad: "echo.echo_load",
      voidShardContamination: "void_shard.contamination",
      dreamLucidityDebt: "dream.lucidity_debt",
      stillnessInertia: "stillness.inertia",
      becomingInstinctSurge: "therian.instinct_load",
      instinctLoad: "therian.instinct_load",
      empyreanRadianceLoad: "sensitive.sensory_load",
      sensoryLoad: "sensitive.sensory_load",
      signalLoad: "technomancer.signal_load",
      functionLoad: "construct.function_load",
      silenceSuppression: "silence.silence_load",
      silenceLoad: "silence.silence_load"
    };

    Object.entries(legacyMap).forEach(([stateKey, trackId]) => {
      const track = trackById[trackId];
      if (!track) return;
      if (!Object.prototype.hasOwnProperty.call(store, trackId) && next[stateKey] !== undefined && next[stateKey] !== "") {
        store[trackId] = clamp(next[stateKey], track.range.min, track.range.max);
      }
      next[stateKey] = String(readTrackValue({ ...next, presentationPressures: store }, track));
    });

    if (!Object.prototype.hasOwnProperty.call(store, "sanguine.blood_load")) {
      let bloodLoad = 3;
      if (next.sanguineCollapseRisk) bloodLoad = 6;
      else if (next.sanguinePredatorySaturation) bloodLoad = 5;
      else if (next.sanguineSaturated) bloodLoad = 5;
      else if (next.sanguineStarved) bloodLoad = 1;
      else if (Object.prototype.hasOwnProperty.call(store, "sanguine.hunger")) {
        bloodLoad = clamp(6 - store["sanguine.hunger"], 0, 6);
      } else if (next.hungerPressure !== undefined && next.hungerPressure !== "") {
        bloodLoad = clamp(6 - Number(next.hungerPressure), 0, 6);
      } else {
        const legacy = Number(next.presentationPressure || 0);
        const key = String(next.ontologyPresentation || "");
        if (legacy > 0 && presentationForCatalogKey(key)?.id === "sanguine") {
          bloodLoad = clamp(6 - legacy, 0, 6);
        }
      }
      store["sanguine.blood_load"] = bloodLoad;
      next.bloodLoad = String(bloodLoad);
    }

    if (Object.prototype.hasOwnProperty.call(store, "sanguine.hunger")) {
      delete store["sanguine.hunger"];
    }

    if (!Object.prototype.hasOwnProperty.call(store, "wraith.essence_load")) {
      let essenceLoad = 3;
      if (Object.prototype.hasOwnProperty.call(store, "wraith.anchoring")) {
        const oldAnchor = store["wraith.anchoring"];
        essenceLoad = oldAnchor <= 1 ? 3 : clamp(oldAnchor + 1, 4, 6);
      } else if (next.anchorDriftPressure !== undefined && next.anchorDriftPressure !== "") {
        const oldAnchor = clamp(next.anchorDriftPressure, 0, 6);
        essenceLoad = oldAnchor <= 1 ? 3 : clamp(oldAnchor + 1, 4, 6);
      } else if (next.essenceLoad !== undefined && next.essenceLoad !== "") {
        essenceLoad = clamp(next.essenceLoad, 0, 6);
      }
      store["wraith.essence_load"] = essenceLoad;
      next.essenceLoad = String(essenceLoad);
    }

    if (Object.prototype.hasOwnProperty.call(store, "wraith.anchoring")) {
      delete store["wraith.anchoring"];
    }

    const bloodLoadValue = readTrackValue({ ...next, presentationPressures: store }, "sanguine.blood_load");
    next.sanguineCoherence = bloodLoadBand(bloodLoadValue);
    next.bloodLoad = String(bloodLoadValue);

    const essenceLoadValue = readTrackValue({ ...next, presentationPressures: store }, "wraith.essence_load");
    next.essenceLoad = String(essenceLoadValue);

    next.presentationPressures = store;
    return next;
  }

  function handlerSummaryLines(status, catalogKey) {
    const presentation = presentationForCatalogKey(catalogKey);
    if (!presentation || !status) return [];
    return presentation.tracks
      .filter((track) => track.handlerVisible)
      .map((track) => {
        const value = readTrackValue(status, track);
        const band = bandForTrack(track, value);
        if (value <= track.range.min && !(track.kind || "").endsWith("_load")) return "";
        return formatHandlerSummary(presentation, track, value, band);
      })
      .filter(Boolean);
  }

  function handlerSummaryText(status, catalogKey) {
    return handlerSummaryLines(status, catalogKey).join(" // ");
  }

  function presentationUiTrack(track) {
    const presentation = PRESENTATIONS.find((item) => item.trackId === track.id) || null;
    return {
      id: track.id,
      key: track.stateKey || track.id,
      label: track.label,
      trackLabel: presentation?.trackLabel || track.label,
      max: track.range.max,
      kind: track.kind,
      operatorEditable: track.operatorEditable,
      triggerPrompt: track.triggerPrompt
    };
  }

  window.PresentationPressure = {
    presentations: PRESENTATIONS,
    trackContract,
    presentationContract,
    presentationForCatalogKey,
    presentationById: (id) => presentationById[id] || null,
    presentationForLoadTrackKind,
    loadHandlerCueForBand,
    rollLoadModifiers,
    rollLoadBandMode,
    entryAppliesToRoll,
    formatRollLoadModifierCopy,
    trackById: (id) => trackById[id] || null,
    primaryTrack,
    bandEntryForValue,
    bandForTrack,
    cueForTrack,
    riskForTrack,
    descriptorForTrack,
    helpsForTrack,
    hurtsForTrack,
    promptForTrack,
    misfireLoadDelta,
    misfireBloodLoadDelta,
    adjustTrackLoad,
    adjustBloodLoad,
    formatLoadMisfireTableCopy,
    formatBloodLoadMisfireTableCopy,
    bloodLoadMisfireFlavor,
    loadMisfireFlavor,
    misfireEssenceLoadDelta,
    adjustEssenceLoad,
    formatEssenceLoadMisfireTableCopy,
    essenceLoadMisfireFlavor,
    isWraithCatalogKey,
    isLoadPresentation,
    presentationLoadBand,
    bloodLoadBand,
    essenceLoadBand,
    coherenceFromHunger,
    resolveSanguineCondition,
    resolveWraithCondition,
    deriveCondition,
    presentationPressureView,
    formatBandLine,
    readTrackValue,
    writeTrackValue,
    migrateOperatorStatus,
    handlerSummaryLines,
    handlerSummaryText,
    presentationUiTrack,
    clamp
  };
}());