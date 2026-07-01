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
          at: 0,
          label: "Starved",
          cue: "The cup reads empty — cold embodiment, narrowing empathy, predatory problem-solving.",
          risk: "Deprivation fiction may force unsafe intake or Stability pressure."
        },
        {
          at: 1,
          label: "Starved",
          cue: "Blood load is still too low — warmth thins and appetite starts listening too closely.",
          risk: "Small wants may read louder than intended."
        },
        {
          at: 2,
          label: "Coherent",
          cue: "Human-like warmth returns; cognition and social masking hold in the safe middle.",
          risk: "Hidden debt may still accumulate off-screen if intake stays uneven."
        },
        {
          at: 3,
          label: "Coherent",
          cue: "Steady resonance in the cup — controlled presence, readable empathy, stable bleed.",
          risk: "Comfort can hide how fast load is drifting."
        },
        {
          at: 4,
          label: "Saturated",
          cue: "Recent intake overload — warmth spikes and emotional bleed amplifies.",
          risk: "Donor fixation or unsafe intimacy pressure may surface."
        },
        {
          at: 5,
          label: "Predatory Saturation",
          cue: "The cup is too full — appetite starts organizing choices before consent catches up.",
          risk: "Pursuit, coercion pressure, or performative humanity may surface at the table."
        },
        {
          at: 6,
          label: "Collapse Risk",
          cue: "Overflow — identity fragmentation or uncontrolled resonance venting.",
          risk: "Collapse, blowout, or Stability cost now."
        }
      ],
      conditionModel: {
        derivedFrom: ["blood_load"]
      },
      maxRisk: "Collapse, blowout, or Stability cost now.",
      reliefActions: {
        risesWhen: [
          "blood nearby",
          "safe feeding",
          "intimacy under pressure",
          "resonance charge accepted",
          "severe misfire under observation"
        ],
        fallsWhen: [
          "time and metabolism",
          "grounded intimacy with consent",
          "anchor contact",
          "deliberate bleed-off toward center"
        ]
      },
      operatorCopy: {
        panelTitle: "Sanguine Pressure",
        trackHeading: "Blood Load",
        conditionLabel: "State",
        meterHelp: "Rain-gauge fill: low is Starved, center is Coherent, high is Saturated. Overflow is Collapse Risk."
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
      trackId: "wraith.anchoring",
      trackLabel: "Anchor Strain",
      stateKey: "anchorDriftPressure",
      bands: [
        { at: 0, label: "Moored", cue: "Continuity with the Anchor reads steady.", risk: "Old death-memory may still pull in quiet moments." },
        { at: 1, label: "Loosened", cue: "Distance or damage tugs at mooring.", risk: "Small continuity breaks become easier to miss." },
        { at: 2, label: "Pulling", cue: "The Anchor's gravity reorganizes priorities.", risk: "Travel and refusal may cost extra attention." },
        { at: 3, label: "Bound", cue: "Behavior bends toward Anchor preservation.", risk: "Independent choices may require explicit resistance." },
        { at: 4, label: "Commanded", cue: "The Anchor can steer intent before the Operator names it.", risk: "Shared memory and command pressure intensify." },
        { at: 5, label: "Possession Risk", cue: "Agency and Anchor voice compete in the same breath.", risk: "Anchor can trap, redirect, or overwrite priority." },
        { at: 6, label: "Anchor Lock", cue: "Continuity collapses into Anchor command.", risk: "Anchor can command, trap, or overwrite priority." }
      ],
      maxRisk: "Anchor can command, trap, or overwrite priority.",
      reliefActions: {
        risesWhen: ["anchor threatened", "continuity denied", "death-memory surfacing", "unmoored travel"],
        fallsWhen: ["anchor restored", "witnessed continuity", "shared memory named", "safe return to mooring"]
      },
      operatorCopy: { trackHeading: "Anchor Strain" }
    }),
    presentationContract({
      id: "echo",
      label: "Echo",
      cardLabel: "Echo Pressure",
      catalogKeys: ["ECHO_ALTERED", "MYTHIC_ECHO"],
      trackId: "echo.drift",
      trackLabel: "Relevance Drift",
      stateKey: "echoRecursionPressure",
      bands: [
        { at: 0, label: "Present", cue: "Action and record align under witness.", risk: "Old repetition may still lurk in footage or memory." },
        { at: 1, label: "Echoing", cue: "Prior beats feel too close to the current moment.", risk: "Small repeats may pass as coincidence." },
        { at: 2, label: "Repeating", cue: "Gesture, phrasing, or route echo without intent.", risk: "Cameras and testimony may contradict the body." },
        { at: 3, label: "Mimic", cue: "The Operator mirrors a prior version too cleanly.", risk: "Difference becomes hard to prove at the table." },
        { at: 4, label: "Loop", cue: "Attention and repetition literalize into behavior.", risk: "Novel action may require anchor interruption or cost." },
        { at: 5, label: "Recursion Risk", cue: "The next move wants to be the last move again.", risk: "Repeats prior action unless interrupted by Anchor or cost." },
        { at: 6, label: "Stuck Loop", cue: "The Operator cannot exit the recorded pattern.", risk: "Repeats prior action unless interrupted by Anchor or cost." }
      ],
      maxRisk: "Repeats prior action unless interrupted by Anchor or cost.",
      reliefActions: {
        risesWhen: ["recorded repetition", "mirror mismatch", "prior action replayed", "camera contradiction"],
        fallsWhen: ["novel action under witness", "anchor interruption", "named difference", "route change"]
      },
      operatorCopy: { trackHeading: "Relevance Drift" }
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
    presentationContract({
      id: "becoming",
      label: "Becoming",
      cardLabel: "Becoming Pressure",
      catalogKeys: ["THERIAN_ADAPTATION"],
      trackId: "becoming.instinct_surge",
      trackLabel: "Instinct Surge",
      stateKey: "becomingInstinctSurge",
      bands: [
        { at: 0, label: "Chosen", cue: "Human choice leads; form follows consent.", risk: "Validated instinct may still warm beneath the mask." },
        { at: 1, label: "Stirring", cue: "The body notices the desired shape before speech does.", risk: "Small tells may leak into posture or appetite." },
        { at: 2, label: "Yielding", cue: "Form pressure answers want a beat too early.", risk: "Consent checks may arrive after the body moves." },
        { at: 3, label: "Feral Read", cue: "Threat and desire read through nonhuman patterning.", risk: "Allies may misread intent or boundaries." },
        { at: 4, label: "Form Calling", cue: "The desired form keeps offering itself as solution.", risk: "Mask failure may become socially costly." },
        { at: 5, label: "Surge", cue: "Instinct answers before self catches up.", risk: "Form answers desire before consent catches up." },
        { at: 6, label: "Body Rule", cue: "The body decides; the self negotiates afterward.", risk: "Form answers desire before consent catches up." }
      ],
      maxRisk: "Form answers desire before consent catches up.",
      reliefActions: {
        risesWhen: ["desired form rewarded", "instinct validated", "mask failure", "territorial pressure"],
        fallsWhen: ["human choice named", "consent check", "anchor grounding", "deliberate restraint"]
      },
      operatorCopy: { trackHeading: "Instinct Surge" }
    }),
    presentationContract({
      id: "empyrean",
      label: "Empyrean",
      cardLabel: "Empyrean Pressure",
      catalogKeys: [],
      trackId: "empyrean.radiance_load",
      trackLabel: "Radiance Load",
      stateKey: "empyreanRadianceLoad",
      bands: [
        { at: 0, label: "Ordinary", cue: "Connection stays proportionate to the moment.", risk: "Awe and grief may still magnetize attention quietly." },
        { at: 1, label: "Glowing", cue: "Emotional presence reads brighter than intended.", risk: "Small bonds may feel heavier than agreed." },
        { at: 2, label: "Beacon", cue: "The room orients around the Operator's feeling.", risk: "Attention magnetism may outpace consent." },
        { at: 3, label: "Martyrdom", cue: "Burden and significance invite shared elevation.", risk: "Distributed burden may collapse back onto one body." },
        { at: 4, label: "Impossible Weight", cue: "Awe synchronizes pain, duty, and visibility.", risk: "Refusal of canonization may require explicit cost." },
        { at: 5, label: "Radiance Risk", cue: "Connection overload threatens individual boundary.", risk: "Beaconing, attention magnet, martyr logic." },
        { at: 6, label: "Singularity", cue: "The Operator becomes the scene's emotional sun.", risk: "Beaconing, attention magnet, martyr logic." }
      ],
      maxRisk: "Beaconing, attention magnet, martyr logic.",
      reliefActions: {
        risesWhen: ["impossible significance witnessed", "savior logic rewarded", "attention magnetism", "shared grief elevation"],
        fallsWhen: ["ordinary detail named", "distributed burden", "refused canonization", "private truth"]
      },
      operatorCopy: { trackHeading: "Radiance Load" }
    }),
    presentationContract({
      id: "silence",
      label: "Silence",
      cardLabel: "Silence Pressure",
      catalogKeys: ["HOLLOW_SILENCE_ALTERED"],
      trackId: "silence.suppression",
      trackLabel: "Suppression",
      stateKey: "silenceSuppression",
      bands: [
        { at: 0, label: "Named", cue: "Speech, record, and omission stay distinguishable.", risk: "Swallowed truth may still press against composure." },
        { at: 1, label: "Muted", cue: "The Operator chooses quiet over precision.", risk: "Allies may fill silence with the wrong story." },
        { at: 2, label: "Unnamed", cue: "Important facts lack a speakable handle.", risk: "Direct questions may cost extra Stability." },
        { at: 3, label: "Occluded", cue: "Emotional signal drops out of the scene.", risk: "Record gaps may start feeling safer than speech." },
        { at: 4, label: "Missing Speech", cue: "The table realizes something cannot be said aloud.", risk: "Witnessed speech may require anchor intervention." },
        { at: 5, label: "Record Loss", cue: "Omission starts eating adjacent memory and testimony.", risk: "Missing speech, record loss, emotional occlusion." },
        { at: 6, label: "Total Silence", cue: "Signal, record, and emotional trace collapse together.", risk: "Missing speech, record loss, emotional occlusion." }
      ],
      maxRisk: "Missing speech, record loss, emotional occlusion.",
      reliefActions: {
        risesWhen: ["truth swallowed", "name withheld", "record gap rewarded", "emotional occlusion"],
        fallsWhen: ["named aloud", "witnessed speech", "record restored", "anchor asks directly"]
      },
      operatorCopy: { trackHeading: "Suppression" }
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

  function bandForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "Baseline";
    const clamped = clamp(value, resolved.range.min, resolved.range.max);
    let label = resolved.bands[0]?.label || "Baseline";
    resolved.bands.forEach((band) => {
      if (Number(band.at) === clamped) label = band.label;
    });
    return label;
  }

  function cueForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "";
    const clamped = clamp(value, resolved.range.min, resolved.range.max);
    let cue = "";
    resolved.bands.forEach((band) => {
      if (Number(band.at) === clamped && band.cue) cue = band.cue;
    });
    return cue;
  }

  function riskForTrack(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "";
    const clamped = clamp(value, resolved.range.min, resolved.range.max);
    let risk = "";
    resolved.bands.forEach((band) => {
      if (Number(band.at) === clamped && band.risk) risk = band.risk;
    });
    if (clamped >= resolved.range.max) {
      return resolved.maxRisk || resolved.atMax || risk;
    }
    return risk;
  }

  function bloodLoadBand(value) {
    return bandForTrack("sanguine.blood_load", value);
  }

  function coherenceFromHunger(value) {
    return bloodLoadBand(value);
  }

  function resolveSanguineCondition(status, bloodLoad) {
    const value = clamp(bloodLoad, 0, 6);
    const label = bloodLoadBand(value);
    const intakeIds = {
      Starved: "starved",
      Coherent: "coherent",
      Saturated: "saturated",
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
      intakeCondition: presentation.id === "sanguine" ? resolveSanguineCondition(status, value).intakeCondition : "",
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
    const condition = deriveCondition(status, presentation);

    return {
      id: presentation.id,
      label: presentation.label,
      cardLabel: presentation.cardLabel,
      trackLabel: presentation.trackLabel,
      trackId: track.id,
      value,
      range: { ...presentation.range },
      band,
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

    const legacyMap = {
      echoRecursionPressure: "echo.drift",
      anchorDriftPressure: "wraith.anchoring",
      voidShardContamination: "void_shard.contamination",
      dreamLucidityDebt: "dream.lucidity_debt",
      stillnessInertia: "stillness.inertia",
      becomingInstinctSurge: "becoming.instinct_surge",
      empyreanRadianceLoad: "empyrean.radiance_load",
      silenceSuppression: "silence.suppression"
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
      else if (next.sanguineSaturated) bloodLoad = 4;
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

    const bloodLoadValue = readTrackValue({ ...next, presentationPressures: store }, "sanguine.blood_load");
    next.sanguineCoherence = bloodLoadBand(bloodLoadValue);
    next.bloodLoad = String(bloodLoadValue);

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
        if (value <= track.range.min) return "";
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
    trackById: (id) => trackById[id] || null,
    primaryTrack,
    bandForTrack,
    cueForTrack,
    riskForTrack,
    bloodLoadBand,
    coherenceFromHunger,
    resolveSanguineCondition,
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