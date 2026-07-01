(function () {
  /**
   * Presentation Pressure = metabolic load of a nonbaseline ontology inside a
   * human-scale Operator. Not damage, XP, or corruption by default.
   */
  function trackContract(spec) {
    const max = Number(spec.range?.max ?? spec.max ?? 6);
    const min = Number(spec.range?.min ?? spec.min ?? 0);
    return {
      id: spec.id,
      label: spec.label,
      owner: spec.owner || "operator",
      range: { min, max },
      bands: Array.isArray(spec.bands) ? spec.bands.slice() : [],
      risesWhen: Array.isArray(spec.risesWhen) ? spec.risesWhen.slice() : [],
      fallsWhen: Array.isArray(spec.fallsWhen) ? spec.fallsWhen.slice() : [],
      atMax: spec.atMax || spec.maxConsequence || "",
      maxConsequence: spec.maxConsequence || spec.atMax || "",
      handlerVisible: spec.handlerVisible !== false,
      operatorEditable: spec.operatorEditable !== false,
      triggerPrompt: spec.triggerPrompt !== false,
      stateKey: spec.stateKey || "",
      kind: spec.kind || "presentation"
    };
  }

  function presentationContract(spec) {
    return {
      id: spec.id,
      label: spec.label,
      cardLabel: spec.cardLabel || `${spec.label} Pressure`,
      catalogKeys: Array.isArray(spec.catalogKeys) ? spec.catalogKeys.slice() : [],
      coherenceStates: Array.isArray(spec.coherenceStates) ? spec.coherenceStates.slice() : [],
      tracks: (spec.tracks || []).map(trackContract)
    };
  }

  const PRESENTATIONS = [
    presentationContract({
      id: "sanguine",
      label: "Sanguine",
      cardLabel: "Sanguine Pressure",
      catalogKeys: ["SANGUINE"],
      coherenceStates: [
        "Coherent",
        "Hungry",
        "Starved",
        "Heightened",
        "Saturated",
        "Predatory Saturation",
        "Collapse Risk"
      ],
      tracks: [{
        id: "sanguine.hunger",
        label: "Hunger",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Stirred" },
          { at: 2, label: "Hungry" },
          { at: 3, label: "Hungry" },
          { at: 4, label: "Predatory" },
          { at: 5, label: "Predatory" },
          { at: 6, label: "Feeding Risk" }
        ],
        risesWhen: [
          "blood nearby",
          "intimacy under pressure",
          "failed restraint",
          "charge denied",
          "severe misfire under observation"
        ],
        fallsWhen: [
          "safe feeding",
          "grounded intimacy with consent",
          "anchor contact",
          "deliberate withdrawal"
        ],
        atMax: "Must feed, lash out, or resist at Stability cost.",
        maxConsequence: "Must feed, lash out, or resist at Stability cost.",
        stateKey: "hungerPressure",
        kind: "hunger"
      }]
    }),
    presentationContract({
      id: "void_shard",
      label: "Void-Shard",
      cardLabel: "Void-Shard Pressure",
      catalogKeys: ["VOID_SHARD"],
      tracks: [{
        id: "void_shard.contamination",
        label: "Contamination",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Touched" },
          { at: 2, label: "Hollow" },
          { at: 3, label: "Unmoored" },
          { at: 4, label: "Anti-present" },
          { at: 5, label: "Breach Risk" },
          { at: 6, label: "Absent" }
        ],
        risesWhen: [
          "void exposure",
          "negative-space logic accepted",
          "failed presence defense",
          "breach adjacency"
        ],
        fallsWhen: [
          "named truth",
          "anchor contact",
          "relational shielding",
          "deliberate embodiment"
        ],
        atMax: "Cannot be fully perceived; social and anchor reliability fail.",
        maxConsequence: "Cannot be fully perceived; social and anchor reliability fail.",
        stateKey: "voidShardContamination"
      }]
    }),
    presentationContract({
      id: "wraith",
      label: "Wraith",
      cardLabel: "Wraith Pressure",
      catalogKeys: ["WRAITH_TOUCHED_ANCHOR_BOUND", "WRAITH"],
      tracks: [{
        id: "wraith.anchoring",
        label: "Anchoring",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Loosened" },
          { at: 2, label: "Pulling" },
          { at: 3, label: "Bound" },
          { at: 4, label: "Commanded" },
          { at: 5, label: "Possession Risk" },
          { at: 6, label: "Anchor Lock" }
        ],
        risesWhen: [
          "anchor threatened",
          "continuity denied",
          "death-memory surfacing",
          "unmoored travel"
        ],
        fallsWhen: [
          "anchor restored",
          "witnessed continuity",
          "shared memory named",
          "safe return to mooring"
        ],
        atMax: "Anchor can command, trap, or overwrite priority.",
        maxConsequence: "Anchor can command, trap, or overwrite priority.",
        stateKey: "anchorDriftPressure"
      }]
    }),
    presentationContract({
      id: "echo",
      label: "Echo",
      cardLabel: "Echo Pressure",
      catalogKeys: ["ECHO_ALTERED", "MYTHIC_ECHO"],
      tracks: [{
        id: "echo.drift",
        label: "Drift",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Echoing" },
          { at: 2, label: "Repeating" },
          { at: 3, label: "Mimic" },
          { at: 4, label: "Loop" },
          { at: 5, label: "Recursion Risk" },
          { at: 6, label: "Stuck Loop" }
        ],
        risesWhen: [
          "recorded repetition",
          "mirror mismatch",
          "prior action replayed",
          "camera contradiction"
        ],
        fallsWhen: [
          "novel action under witness",
          "anchor interruption",
          "named difference",
          "route change"
        ],
        atMax: "Repeats prior action unless interrupted by Anchor or cost.",
        maxConsequence: "Repeats prior action unless interrupted by Anchor or cost.",
        stateKey: "echoRecursionPressure"
      }]
    }),
    presentationContract({
      id: "dream",
      label: "Dream",
      cardLabel: "Dream Pressure",
      catalogKeys: [],
      tracks: [{
        id: "dream.lucidity_debt",
        label: "Lucidity Debt",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Thin" },
          { at: 2, label: "Smearing" },
          { at: 3, label: "False Memory" },
          { at: 4, label: "Dream Logic" },
          { at: 5, label: "Debt Due" },
          { at: 6, label: "Lost Thread" }
        ],
        risesWhen: [
          "sleep debt",
          "dream logic accepted",
          "false continuity rewarded",
          "symbolic substitution"
        ],
        fallsWhen: [
          "grounding",
          "shared witness",
          "named waking fact",
          "rest with anchor"
        ],
        atMax: "Memory smear and false continuity take over function.",
        maxConsequence: "Memory smear and false continuity take over function.",
        stateKey: "dreamLucidityDebt"
      }]
    }),
    presentationContract({
      id: "stillness",
      label: "Stillness",
      cardLabel: "Stillness Pressure",
      catalogKeys: [],
      tracks: [{
        id: "stillness.inertia",
        label: "Inertia",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Heavy" },
          { at: 2, label: "Stalled" },
          { at: 3, label: "Frozen" },
          { at: 4, label: "Petrified" },
          { at: 5, label: "Cannot Move" },
          { at: 6, label: "Stasis Lock" }
        ],
        risesWhen: [
          "refusal rewarded",
          "death-stasis contact",
          "non-escalation enforced",
          "grief freeze"
        ],
        fallsWhen: [
          "forced motion",
          "broken pattern",
          "anchor jolt",
          "accepted change"
        ],
        atMax: "Cannot escalate, flee, or transform without breaking something.",
        maxConsequence: "Cannot escalate, flee, or transform without breaking something.",
        stateKey: "stillnessInertia"
      }]
    }),
    presentationContract({
      id: "becoming",
      label: "Becoming",
      cardLabel: "Becoming Pressure",
      catalogKeys: ["THERIAN_ADAPTATION"],
      tracks: [{
        id: "becoming.instinct_surge",
        label: "Instinct Surge",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Stirring" },
          { at: 2, label: "Yielding" },
          { at: 3, label: "Feral Read" },
          { at: 4, label: "Form Calling" },
          { at: 5, label: "Surge" },
          { at: 6, label: "Body Rule" }
        ],
        risesWhen: [
          "desired form rewarded",
          "instinct validated",
          "mask failure",
          "territorial pressure"
        ],
        fallsWhen: [
          "human choice named",
          "consent check",
          "anchor grounding",
          "deliberate restraint"
        ],
        atMax: "Form answers desire before consent catches up.",
        maxConsequence: "Form answers desire before consent catches up.",
        stateKey: "becomingInstinctSurge"
      }]
    }),
    presentationContract({
      id: "empyrean",
      label: "Empyrean",
      cardLabel: "Empyrean Pressure",
      catalogKeys: [],
      tracks: [{
        id: "empyrean.radiance_load",
        label: "Radiance Load",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Glowing" },
          { at: 2, label: "Beacon" },
          { at: 3, label: "Martyrdom" },
          { at: 4, label: "Impossible Weight" },
          { at: 5, label: "Radiance Risk" },
          { at: 6, label: "Singularity" }
        ],
        risesWhen: [
          "impossible significance witnessed",
          "savior logic rewarded",
          "attention magnetism",
          "shared grief elevation"
        ],
        fallsWhen: [
          "ordinary detail named",
          "distributed burden",
          "refused canonization",
          "private truth"
        ],
        atMax: "Beaconing, attention magnet, martyr logic.",
        maxConsequence: "Beaconing, attention magnet, martyr logic.",
        stateKey: "empyreanRadianceLoad"
      }]
    }),
    presentationContract({
      id: "silence",
      label: "Silence",
      cardLabel: "Silence Pressure",
      catalogKeys: ["HOLLOW_SILENCE_ALTERED"],
      tracks: [{
        id: "silence.suppression",
        label: "Suppression",
        owner: "operator",
        range: { min: 0, max: 6 },
        bands: [
          { at: 0, label: "Baseline" },
          { at: 1, label: "Muted" },
          { at: 2, label: "Unnamed" },
          { at: 3, label: "Occluded" },
          { at: 4, label: "Missing Speech" },
          { at: 5, label: "Record Loss" },
          { at: 6, label: "Total Silence" }
        ],
        risesWhen: [
          "truth swallowed",
          "name withheld",
          "record gap rewarded",
          "emotional occlusion"
        ],
        fallsWhen: [
          "named aloud",
          "witnessed speech",
          "record restored",
          "anchor asks directly"
        ],
        atMax: "Missing speech, record loss, emotional occlusion.",
        maxConsequence: "Missing speech, record loss, emotional occlusion.",
        stateKey: "silenceSuppression"
      }]
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

  function formatBandLine(track, value) {
    const resolved = trackById[track?.id || track] || null;
    if (!resolved) return "";
    const clamped = clamp(value, resolved.range.min, resolved.range.max);
    const band = bandForTrack(resolved, clamped);
    if (clamped >= resolved.range.max) {
      return `${band} — ${resolved.atMax}`;
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
      hungerPressure: "sanguine.hunger",
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

    if (!Object.prototype.hasOwnProperty.call(store, "sanguine.hunger")) {
      const legacy = Number(next.presentationPressure || 0);
      const key = String(next.ontologyPresentation || "");
      if (legacy > 0 && presentationForCatalogKey(key)?.id === "sanguine") {
        store["sanguine.hunger"] = clamp(legacy, 0, 6);
        next.hungerPressure = String(store["sanguine.hunger"]);
      }
    }

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
        return `${track.label} ${value}/${track.range.max} (${band})`;
      })
      .filter(Boolean);
  }

  function handlerSummaryText(status, catalogKey) {
    return handlerSummaryLines(status, catalogKey).join(" // ");
  }

  function presentationUiTrack(track) {
    return {
      id: track.id,
      key: track.stateKey || track.id,
      label: track.label,
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
    bandForTrack,
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