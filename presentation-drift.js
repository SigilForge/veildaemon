(function () {
  const DRIFT_THRESHOLDS = [
    {
      id: "surface_tell",
      label: "Surface Tell",
      min: 1,
      max: 2,
      summary: "Cosmetic or behavioral residue; mostly fiction, occasional complication."
    },
    {
      id: "persistent_scar",
      label: "Persistent Scar",
      min: 3,
      max: 4,
      summary: "Harder to mask; small permission expands; clear social/surveillance cost."
    },
    {
      id: "deep_drift",
      label: "Deep Drift",
      min: 5,
      max: 5,
      summary: "Permanent aspect, vulnerability, altered recovery need, or evolution gate."
    },
    {
      id: "threshold_state",
      label: "Threshold State",
      min: 6,
      max: 6,
      summary: "The Presentation is becoming load-bearing to identity. Further advancement requires Handler approval, Operator consent, and a campaign-level decision."
    }
  ];

  const THRESHOLD_DECISIONS = [
    {
      id: "integrate",
      label: "Integrate",
      description: "The Operator accepts the Presentation as part of identity. One existing Deep Drift permission stabilizes, but its complication becomes permanent."
    },
    {
      id: "contain",
      label: "Contain",
      description: "The Operator builds a dependency, ritual, Anchor, medical regime, device, or relationship structure that holds further change back."
    },
    {
      id: "evolve",
      label: "Evolve",
      description: "Open a Presentation-specific advanced path, lineage, archive, or posthuman form. Handler approval required."
    },
    {
      id: "rewrite",
      label: "Rewrite",
      description: "Attempt to alter, seal, split, transfer, or replace the Presentation. This becomes a major operation, not a menu click."
    },
    {
      id: "fail_forward",
      label: "Fail Forward",
      description: "The Operator remains playable, but consensus life can no longer fully classify them. Their Presentation becomes a campaign-level fact."
    }
  ];

  // Stamped onto every Scar/Scar Development snapshot so a future catalog edit can never
  // silently change the meaning of an already-recorded, already-printed Scar.
  const DRIFT_CATALOG_VERSION = 1;

  const SCAR_CHANGE_TYPES = ["benefit", "complication", "new_tell", "new_interface"];

  const COLLAPSE_DRIFT_TRIGGER = "load_6_collapse_resolved";

  function makeId(prefix) {
    const rand = Math.random().toString(16).slice(2, 10);
    return `${prefix || "cd"}-${Date.now().toString(16)}-${rand}`;
  }

  function scar(spec) {
    return {
      id: spec.id,
      label: spec.label,
      tier: spec.tier,
      minDrift: Number(spec.minDrift),
      benefit: spec.benefit || "",
      cost: spec.cost || "",
      handlerApproval: Boolean(spec.handlerApproval),
      archiveUnlock: spec.archiveUnlock || ""
    };
  }

  const DRIFT_PRESENTATIONS = {
    sanguine: {
      id: "sanguine",
      label: "Sanguine",
      tagline: "The body remembers hunger.",
      scars: [
        scar({
          id: "too_warm_skin",
          label: "Too-warm skin, visible pulse, flushed eyes",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Blood-Warm Recovery reads easier",
          cost: "Medical attention, cameras, and close contact feel wrong"
        }),
        scar({
          id: "hunger_tells",
          label: "Hunger tells: staring at throats, breath syncing",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Blood Sense gets more vivid",
          cost: "Restraint and masking become visibly harder"
        }),
        scar({
          id: "vein_darkening",
          label: "Vein-darkening, red eye shine, sharpened teeth",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Intimidation and predatory reads strengthen",
          cost: "Passing as ordinary gets harder under stress"
        }),
        scar({
          id: "pulse_attraction",
          label: "Pulse attraction",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Easier to locate living warmth",
          cost: "Injured people become Handler pressure"
        }),
        scar({
          id: "predatory_aspect",
          label: "Fangs, altered metabolism, predatory aura",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Feeding/pursuit permissions expand",
          cost: "Consent, concealment, and hunger become campaign-weight"
        }),
        scar({
          id: "sanguine_evolution",
          label: "Sanguine evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens Predatory Archive path",
          cost: "Handler Approval required",
          handlerApproval: true,
          archiveUnlock: "Predatory Archive"
        })
      ]
    },
    wraith: {
      id: "wraith",
      label: "Wraith-Touched / Anchor-Bound",
      tagline: "The Locus remembers harder than the body does.",
      scars: [
        scar({
          id: "cold_spots",
          label: "Cold spots, flickering lights, delayed reflection",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Locus Sense becomes sharper",
          cost: "People notice the room reacting"
        }),
        scar({
          id: "voice_distortion",
          label: "Voice distortion near recordings",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Easier to affect audio/video tied to Locus",
          cost: "Records become suspicious or corrupted"
        }),
        scar({
          id: "shadow_lag",
          label: "Shadow lag, partial transparency, object attachment",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Locus Reach improves through Tethers",
          cost: "Distance from Locus feels unsafe"
        }),
        scar({
          id: "identity_desync",
          label: "Name/identity desync",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Dead Route and Poltergeist Touch gain stronger fiction",
          cost: "Legal/social identity becomes unstable"
        }),
        scar({
          id: "anchor_mark",
          label: "Anchor mark, death pallor, impossible absence",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Re-Corporealize/return permissions expand",
          cost: "Locus vulnerability becomes existential"
        }),
        scar({
          id: "wraith_evolution",
          label: "Wraith evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens Death Archive path",
          cost: "Handler Approval required",
          handlerApproval: true,
          archiveUnlock: "Death Archive"
        })
      ]
    },
    sensitive: {
      id: "sensitive",
      label: "Resonant Sensitive",
      tagline: "The signal learned the shape of the receiver.",
      scars: [
        scar({
          id: "static_headaches",
          label: "Static headaches, emotional aftertaste, pressure flinches",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Pressure Sense gets faster",
          cost: "Crowds and charged rooms become exhausting"
        }),
        scar({
          id: "eyes_water",
          label: "Eyes water near residue",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Easier to detect violence, grief, fear, obsession",
          cost: "False positives become possible"
        }),
        scar({
          id: "empathy_bleed",
          label: "Unwanted empathy bleed",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Resonant Read strengthens",
          cost: "Other people's panic can stick"
        }),
        scar({
          id: "attention_magnet",
          label: "Attention magnet",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Bad Room Read becomes sharper",
          cost: "The room notices the Sensitive sooner"
        }),
        scar({
          id: "signal_scar",
          label: "Signal scar: voice, eyes, or skin reacts to pressure",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Strong supernatural detection permission",
          cost: "Entities and Zones can read them more easily"
        }),
        scar({
          id: "sensitive_evolution",
          label: "Sensitive evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens oracle/seer-style archive later",
          cost: "Handler Approval recommended",
          handlerApproval: true,
          archiveUnlock: "Oracle / Seer Archive"
        })
      ]
    },
    echo: {
      id: "echo",
      label: "Echo-Altered",
      tagline: "The mistake wants another chance.",
      scars: [
        scar({
          id: "repeated_phrases",
          label: "Repeated phrases, deja vu ticks, route familiarity",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Echo Recognition improves",
          cost: "Operator hesitates when scenes rhyme"
        }),
        scar({
          id: "memory_overlap",
          label: "Memory overlap",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Residual Familiarity gets clearer",
          cost: "May confuse current facts with prior residue"
        }),
        scar({
          id: "timeline_stutter",
          label: "Timeline stutter",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Second Pass strengthens",
          cost: "Improvisation gets harder under pressure"
        }),
        scar({
          id: "duplicate_habits",
          label: "Duplicate habits",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Replay Slip becomes more reliable",
          cost: "The Operator repeats mistakes unless grounded"
        }),
        scar({
          id: "loop_scar",
          label: "Loop scar: doubled shadow, delayed voice, recurring wound",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Scene-loop and retrace permissions expand",
          cost: "The Handler can pressure compulsive repetition"
        }),
        scar({
          id: "echo_evolution",
          label: "Echo evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens continuity/loop archive later",
          cost: "Handler Approval recommended",
          handlerApproval: true,
          archiveUnlock: "Continuity / Loop Archive"
        })
      ]
    },
    silence: {
      id: "silence",
      label: "Hollow / Silence-Altered",
      tagline: "The world got better at not keeping them.",
      scars: [
        scar({
          id: "softened_presence",
          label: "Softened presence, forgotten name, missed eye contact",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Omitted Presence improves",
          cost: "Allies may overlook them too"
        }),
        scar({
          id: "record_blur",
          label: "Record blur",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Cameras/files lose small details",
          cost: "Proof of identity becomes weaker"
        }),
        scar({
          id: "social_absence",
          label: "Social absence",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Slip Notice strengthens",
          cost: "Asking for help or being believed gets harder"
        }),
        scar({
          id: "missing_reflection",
          label: "Missing reflection/voice drop",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Leave a Blank gets more potent",
          cost: "The Operator may vanish from important moments"
        }),
        scar({
          id: "erasure_scar",
          label: "Erasure scar: partial record deletion, name instability",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Omission/null permissions expand",
          cost: "Anchor relationships and identity require active upkeep"
        }),
        scar({
          id: "hollow_evolution",
          label: "Hollow evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens Silence/Null archive later",
          cost: "Handler Approval recommended",
          handlerApproval: true,
          archiveUnlock: "Silence / Null Archive"
        })
      ]
    },
    technomancer: {
      id: "technomancer",
      label: "Technomancer / Daemon-Aligned",
      tagline: "The system saved them as an input device.",
      scars: [
        scar({
          id: "screen_wake",
          label: "Screen wake, static halo, device attention",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Signal Sight improves",
          cost: "Devices notice them back"
        }),
        scar({
          id: "ui_bleed",
          label: "UI bleed in vision/hearing",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Interface Sympathy gets easier",
          cost: "Offline focus becomes harder"
        }),
        scar({
          id: "biometric_mismatch",
          label: "Biometric mismatch, corrupted metadata",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Daemon Push strengthens",
          cost: "Surveillance and logs become weird around them"
        }),
        scar({
          id: "prompt_bleed",
          label: "Prompt bleed",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Soft Override gets sharper",
          cost: "Daemon/system prompts may intrude"
        }),
        scar({
          id: "interface_scar",
          label: "Interface scar: voice modulation, eye-glitch, signal signature",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Myth-tech/device permissions expand",
          cost: "Traceability and hostile systems become real threats"
        }),
        scar({
          id: "machine_evolution",
          label: "Machine evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens Machine Archive path",
          cost: "Handler Approval required",
          handlerApproval: true,
          archiveUnlock: "Machine Archive"
        })
      ]
    },
    therian: {
      id: "therian",
      label: "Therian Adaptation",
      tagline: "The body kept the useful shape.",
      scars: [
        scar({
          id: "reflective_eyes",
          label: "Reflective eyes, sharper nails, scent fixation",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Animal Read improves",
          cost: "Stress tells become obvious"
        }),
        scar({
          id: "predator_stillness",
          label: "Predator stillness, altered posture",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Body Memory gets easier",
          cost: "People feel watched"
        }),
        scar({
          id: "animal_aspect",
          label: "Teeth, pupils, voice, ears, whisker-like sensory changes",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Feral Drive strengthens",
          cost: "Social masking and calm negotiation suffer"
        }),
        scar({
          id: "territorial_reflex",
          label: "Territorial reflex",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Claim Ground becomes stronger",
          cost: "Leaving claimed ground can create pressure"
        }),
        scar({
          id: "permanent_aspect",
          label: "Permanent animal aspect",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Tracking, pursuit, defense permissions expand",
          cost: "Passing as ordinary becomes difficult"
        }),
        scar({
          id: "therian_evolution",
          label: "Therian evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens Predatory Archive path",
          cost: "Handler Approval required",
          handlerApproval: true,
          archiveUnlock: "Predatory Archive"
        })
      ]
    },
    construct: {
      id: "construct",
      label: "Construct",
      tagline: "The purpose found the handle.",
      scars: [
        scar({
          id: "diagnostic_stare",
          label: "Diagnostic stare, too-steady posture, flat affect under stress",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Diagnostic Sense reads sharper",
          cost: "People feel assessed rather than met"
        }),
        scar({
          id: "repetitive_motion",
          label: "Repetitive motion, command echo in speech",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Built To Continue has stronger fiction",
          cost: "Stress makes function-read obvious"
        }),
        scar({
          id: "purpose_fixation",
          label: "Purpose fixation, repair seams, panel lines, maintenance marks",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Function Surge strengthens",
          cost: "Improvisation and emotional flexibility suffer"
        }),
        scar({
          id: "command_hierarchy",
          label: "Command hierarchy bleed",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Execute Directive gets sharper",
          cost: "Social softness and unassigned behavior become pressure"
        }),
        scar({
          id: "purpose_scar",
          label: "Permanent purpose scar",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Directive, repair, and endurance permissions expand",
          cost: "Personhood and cover become campaign-weight"
        }),
        scar({
          id: "construct_evolution",
          label: "Construct Lineage evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens Machine Archive path",
          cost: "Handler Approval required",
          handlerApproval: true,
          archiveUnlock: "Machine Archive / Construct Lineage"
        })
      ]
    },
    void_shard: {
      id: "void_shard",
      label: "Void-Shard",
      tagline: "The wound learned how to open.",
      scars: [
        scar({
          id: "cold_patch",
          label: "Cold patch on skin, hesitation in speech, thin reality at edges",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Wrongness Sense becomes sharper",
          cost: "Ordinary grounding feels unreliable"
        }),
        scar({
          id: "wrong_reflection",
          label: "Wrong reflections, delayed shadows, spatial slip at the margins",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Breach Tolerance has stronger fiction",
          cost: "Cameras and witnesses catch inconsistency"
        }),
        scar({
          id: "contamination_marks",
          label: "Contamination marks, breach residue in records",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Anomaly Push strengthens",
          cost: "Masking contamination gets harder"
        }),
        scar({
          id: "reality_fit_fracture",
          label: "Reality-fit fracture near thresholds and impossible geometry",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Break Pattern gets sharper",
          cost: "Stability and social grounding suffer"
        }),
        scar({
          id: "void_wound_scar",
          label: "Permanent void wound scar",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Breach survival and anomaly permissions expand",
          cost: "The room can negotiate with the wound"
        }),
        scar({
          id: "void_shard_evolution",
          label: "Deep Void Archive evolution marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Opens Deep Void Archive path",
          cost: "Handler Approval required",
          handlerApproval: true,
          archiveUnlock: "Deep Void Archive"
        })
      ]
    },
    vessel: {
      id: "vessel",
      label: "Vessel",
      tagline: "The thing inside learned where the door is.",
      scars: [
        scar({
          id: "voice_overlap",
          label: "Voice overlap, second pulse, pressure behind the eyes",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Inner Pressure becomes clearer",
          cost: "Stress makes the contained presence easier to notice"
        }),
        scar({
          id: "heartbeat_mismatch",
          label: "Temperature, shadow, reflection, or heartbeat mismatch",
          tier: "surface_tell",
          minDrift: 1,
          benefit: "Sealed Resilience has stronger fiction",
          cost: "Medical/social/surveillance reads become strange"
        }),
        scar({
          id: "waking_tells",
          label: "Waking tells: different posture, alien gaze, borrowed words",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Borrowed Force strengthens",
          cost: "Masking selfhood gets harder"
        }),
        scar({
          id: "containment_marks",
          label: "Containment marks on skin, aura, dreams, or records",
          tier: "persistent_scar",
          minDrift: 3,
          benefit: "Let It Look gives sharper answers",
          cost: "The presence starts having preferences"
        }),
        scar({
          id: "partial_emergence",
          label: "Partial emergence scar",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Subtype permissions begin opening",
          cost: "Handler Approval required for evolution",
          handlerApproval: true
        }),
        scar({
          id: "vessel_evolution",
          label: "Host/Vessel archive marker",
          tier: "deep_drift",
          minDrift: 5,
          benefit: "Unlocks subtype path",
          cost: "What is inside becomes campaign-weight",
          handlerApproval: true,
          archiveUnlock: "Subtype Archive"
        })
      ]
    }
  };

  function clampDrift(value) {
    return Math.max(0, Math.min(6, Math.floor(Number(value)) || 0));
  }

  function driftTierForValue(value) {
    const numeric = clampDrift(value);
    if (numeric <= 0) return null;
    return DRIFT_THRESHOLDS.find((entry) => numeric >= entry.min && numeric <= entry.max) || null;
  }

  function eligibleScarOptions(presentationId, tier) {
    const pack = DRIFT_PRESENTATIONS[presentationId];
    if (!pack || !tier) return [];
    return pack.scars.filter((entry) => entry.tier === tier);
  }

  function normalizeScarEntry(entry) {
    if (!entry || typeof entry !== "object" || !entry.scarId) return null;
    return {
      scarId: String(entry.scarId),
      tier: String(entry.tier || ""),
      label: String(entry.label || ""),
      benefit: String(entry.benefit || ""),
      cost: String(entry.cost || ""),
      archiveUnlock: String(entry.archiveUnlock || ""),
      handlerApproval: Boolean(entry.handlerApproval),
      catalogVersion: Number(entry.catalogVersion) || DRIFT_CATALOG_VERSION,
      chosenAt: String(entry.chosenAt || "")
    };
  }

  // Snapshot a raw catalog scar (shape: {id, label, tier, benefit, cost, archiveUnlock, ...})
  // into the stored/synced scar shape at the moment it's chosen -- copies text, not a live
  // lookup, so a later catalog edit can never change what was already recorded and printed.
  function snapshotCatalogScar(candidate, chosenAt) {
    return normalizeScarEntry({
      scarId: candidate.id,
      tier: candidate.tier,
      label: candidate.label,
      benefit: candidate.benefit,
      cost: candidate.cost,
      archiveUnlock: candidate.archiveUnlock,
      handlerApproval: candidate.handlerApproval,
      catalogVersion: DRIFT_CATALOG_VERSION,
      chosenAt
    });
  }

  function normalizePendingEntry(entry) {
    if (!entry || typeof entry !== "object" || !entry.tier) return null;
    return {
      id: String(entry.id || makeId("pending")),
      tier: String(entry.tier),
      unlockedAtDrift: clampDrift(entry.unlockedAtDrift),
      collapseId: String(entry.collapseId || ""),
      status: entry.status === "refused" ? "refused" : "deferred",
      deferredAt: String(entry.deferredAt || "")
    };
  }

  function normalizeDevelopmentEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    return {
      scarId: entry.scarId ? String(entry.scarId) : null,
      tier: entry.tier ? String(entry.tier) : null,
      driftValue: clampDrift(entry.driftValue),
      changeType: SCAR_CHANGE_TYPES.includes(entry.changeType) ? entry.changeType : "benefit",
      note: String(entry.note || ""),
      catalogVersion: Number(entry.catalogVersion) || DRIFT_CATALOG_VERSION,
      chosenAt: String(entry.chosenAt || "")
    };
  }

  function normalizeThresholdDecision(entry) {
    if (!entry || typeof entry !== "object" || !entry.id) return null;
    if (!THRESHOLD_DECISIONS.some((decision) => decision.id === entry.id)) return null;
    return {
      id: String(entry.id),
      label: String(entry.label || ""),
      note: String(entry.note || ""),
      chosenAt: String(entry.chosenAt || "")
    };
  }

  function normalizeCollapseRecord(entry) {
    if (!entry || typeof entry !== "object") return null;
    return {
      collapseId: String(entry.collapseId || ""),
      presentationId: String(entry.presentationId || ""),
      loadBefore: 6,
      loadAfter: Number.isFinite(Number(entry.loadAfter)) ? Math.max(0, Math.min(5, Number(entry.loadAfter))) : 0,
      driftBefore: clampDrift(entry.driftBefore),
      driftAfter: clampDrift(entry.driftAfter),
      resolvedAt: String(entry.resolvedAt || ""),
      recoveredFromLegacyState: Boolean(entry.recoveredFromLegacyState)
    };
  }

  // "transition" -- minted by notePresentationLoadTransition off a real Load crossing.
  // "legacy_recovery" -- minted once by recognizeExistingCollapse for a pre-existing save
  // that reached Load 6 before this workflow existed. Read at resolve time to stamp the
  // Collapse Record's recoveredFromLegacyState flag honestly, without parsing the id string.
  function normalizeDriftBucket(bucket) {
    const source = bucket && typeof bucket === "object" ? bucket : {};
    const collapseId = String(source.driftEligibleCollapseId || "");
    const source_ = collapseId
      ? (source.driftEligibleCollapseSource === "legacy_recovery" ? "legacy_recovery" : "transition")
      : "";
    return {
      value: clampDrift(source.value),
      scars: Array.isArray(source.scars) ? source.scars.map(normalizeScarEntry).filter(Boolean).slice(0, 12) : [],
      pendingScarChoices: Array.isArray(source.pendingScarChoices)
        ? source.pendingScarChoices.map(normalizePendingEntry).filter(Boolean).slice(0, 12)
        : [],
      scarDevelopments: Array.isArray(source.scarDevelopments)
        ? source.scarDevelopments.map(normalizeDevelopmentEntry).filter(Boolean).slice(0, 24)
        : [],
      thresholdDecision: normalizeThresholdDecision(source.thresholdDecision),
      driftEligibleCollapseId: collapseId,
      driftEligibleCollapseSource: source_,
      log: Array.isArray(source.log) ? source.log.map(normalizeCollapseRecord).filter(Boolean).slice(0, 40) : []
    };
  }

  function normalizePresentationDriftStore(store) {
    const source = store && typeof store === "object" ? store : {};
    const values = {};
    Object.keys(DRIFT_PRESENTATIONS).forEach((presentationId) => {
      values[presentationId] = normalizeDriftBucket(source[presentationId]);
    });
    return values;
  }

  function normalizePresentationDrift(status) {
    const next = { ...(status || {}) };
    next.presentationDrift = {
      byPresentation: normalizePresentationDriftStore(next.presentationDrift?.byPresentation)
    };
    return next;
  }

  function presentationPack(presentationId) {
    return DRIFT_PRESENTATIONS[presentationId] || null;
  }

  function resolvePresentationId(catalogKeyOrId) {
    const raw = String(catalogKeyOrId || "").trim();
    if (!raw) return "";
    if (DRIFT_PRESENTATIONS[raw]) return raw;
    const pressure = window.PresentationPressure;
    if (pressure?.presentationForCatalogKey) {
      const presentation = pressure.presentationForCatalogKey(raw);
      if (presentation?.id && DRIFT_PRESENTATIONS[presentation.id]) return presentation.id;
    }
    const normalized = raw.toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_|_$/g, "");
    const alias = {
      SANGUINE: "sanguine",
      WRAITH: "wraith",
      WRAITH_TOUCHED_ANCHOR_BOUND: "wraith",
      SENSITIVE: "sensitive",
      RESONANT_SENSITIVE: "sensitive",
      ECHO_ALTERED: "echo",
      MYTHIC_ECHO: "echo",
      HOLLOW: "silence",
      SILENCE_ALTERED: "silence",
      HOLLOW_SILENCE_ALTERED: "silence",
      TECHNOMANCER: "technomancer",
      TECHNOMANCER_DAEMON_ALIGNED: "technomancer",
      THERIAN: "therian",
      THERIAN_ADAPTATION: "therian",
      VESSEL: "vessel",
      CONSTRUCT: "construct",
      CONSTRUCT_VESSEL: "construct",
      VOID: "void_shard",
      VOID_SHARD: "void_shard"
    };
    return alias[normalized] || "";
  }

  function readDriftValue(status, presentationId) {
    const normalized = normalizePresentationDrift(status);
    const bucket = normalized.presentationDrift?.byPresentation?.[presentationId];
    return Math.max(0, Number(bucket?.value) || 0);
  }

  function readTrackLoad(status, presentationId) {
    const pressure = window.PresentationPressure;
    const pack = presentationPack(presentationId);
    if (!pressure || !pack) return 0;
    const presentation = pressure.presentationById?.(presentationId);
    const track = presentation?.tracks?.[0];
    if (!track) return 0;
    return pressure.readTrackValue(status, track.id);
  }

  // Eligibility is a pure read of whatever driftEligibleCollapseId is already stored -- it
  // never mints one. Minting only ever happens in notePresentationLoadTransition (a real Load
  // write) or recognizeExistingCollapse (an explicit one-time Handler recovery action).
  function collapseDriftEligibility(status, catalogKeyOrId) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const pack = presentationPack(presentationId);
    if (!pack) {
      return { ok: false, presentationId, reason: "This presentation does not accumulate drift." };
    }
    const normalized = normalizePresentationDrift(status);
    const bucket = normalized.presentationDrift.byPresentation[presentationId];
    const load = readTrackLoad(normalized, presentationId);
    if (!bucket.driftEligibleCollapseId) {
      return {
        ok: false,
        presentationId,
        load,
        reason: load >= 6
          ? "This Load 6 state has no eligible Collapse ID -- if this is a pre-existing save, use Recognize Existing Unresolved Collapse."
          : "Resolve a Load 6 collapse before marking Presentation Drift."
      };
    }
    return { ok: true, presentationId, load, collapseId: bucket.driftEligibleCollapseId };
  }

  // Called from the Handler-only writeHandlerPresentationLoad helper (handler/handler-state.js)
  // right after every real Load write -- never from a render or normalization pass. Mints
  // driftEligibleCollapseId on a genuine <6 -> >=6 crossing; clears a still-unresolved one on
  // the reverse crossing (an undone Track Prompt), so a stale "eligible" state never survives
  // a Load change that walked back below 6. Stays pure -- returns a new operatorStatus.
  function notePresentationLoadTransition(operatorStatus, presentationId, previousLoad, nextLoad) {
    const pack = presentationPack(presentationId);
    if (!pack) return operatorStatus;
    const normalized = normalizePresentationDrift(operatorStatus);
    const bucket = normalized.presentationDrift.byPresentation[presentationId];
    const prev = Math.max(0, Number(previousLoad) || 0);
    const next = Math.max(0, Number(nextLoad) || 0);
    if (prev < 6 && next >= 6 && !bucket.driftEligibleCollapseId) {
      bucket.driftEligibleCollapseId = makeId("collapse");
      bucket.driftEligibleCollapseSource = "transition";
    } else if (prev >= 6 && next < 6 && bucket.driftEligibleCollapseId) {
      bucket.driftEligibleCollapseId = "";
      bucket.driftEligibleCollapseSource = "";
    }
    return normalized;
  }

  // Legacy-migration escape hatch: a save that reached Load 6 before this workflow existed
  // has no driftEligibleCollapseId (nothing ever minted one for it) and would otherwise be
  // permanently stuck. Handler-only, one-time -- mints the id exactly once via the same field
  // notePresentationLoadTransition uses, flagged so the eventual Collapse Record can honestly
  // record recoveredFromLegacyState instead of pretending it came from a tracked transition.
  function recognizeExistingCollapse(status, catalogKeyOrId) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const pack = presentationPack(presentationId);
    const normalized = normalizePresentationDrift(status);
    if (!pack) {
      return { status: normalized, ok: false, reason: "This presentation does not accumulate drift." };
    }
    const bucket = normalized.presentationDrift.byPresentation[presentationId];
    const load = readTrackLoad(normalized, presentationId);
    if (load < 6) {
      return { status: normalized, ok: false, reason: "Load is below 6 -- nothing to recognize." };
    }
    if (bucket.driftEligibleCollapseId) {
      return { status: normalized, ok: false, reason: "A Collapse is already eligible for resolution." };
    }
    bucket.driftEligibleCollapseId = makeId("collapse");
    bucket.driftEligibleCollapseSource = "legacy_recovery";
    return { status: normalized, ok: true, presentationId, collapseId: bucket.driftEligibleCollapseId };
  }

  // One Collapse creates at most one Drift: requires and consumes driftEligibleCollapseId in
  // the same call that increments Drift and resets Load, so a double-click or a reload always
  // finds it already cleared. loadAfter is validated to 0-5 -- a resolved Collapse must always
  // end strictly below the threshold it just consumed, or the Operator is left wedged at Load
  // 6 with the id already spent and nothing left to resolve it again.
  function applyCollapseDriftResolve(status, catalogKeyOrId, options = {}) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const pack = presentationPack(presentationId);
    const normalized = normalizePresentationDrift(status);
    if (!pack) {
      return { status: normalized, ok: false, reason: "This presentation does not accumulate drift." };
    }
    const bucket = normalized.presentationDrift.byPresentation[presentationId];
    if (!bucket.driftEligibleCollapseId) {
      return { status: normalized, ok: false, reason: "No eligible Collapse to resolve." };
    }
    const loadAfter = Number(options.loadAfter);
    if (!Number.isFinite(loadAfter) || loadAfter < 0 || loadAfter >= 6) {
      return {
        status: normalized,
        ok: false,
        reason: "loadAfter must be between 0 and 5 -- a resolved Collapse must end below the Collapse threshold."
      };
    }
    const driftBefore = bucket.value;
    const driftAfter = clampDrift(driftBefore + 1);
    const isScarThreshold = driftAfter === 1 || driftAfter === 3 || driftAfter === 5;
    const thresholdDecisionId = driftAfter === 6 ? String(options.thresholdDecisionId || "") : "";
    const decision = thresholdDecisionId
      ? THRESHOLD_DECISIONS.find((entry) => entry.id === thresholdDecisionId)
      : null;
    if (driftAfter === 6 && !decision) {
      return {
        status: normalized,
        ok: false,
        reason: "Drift 6 requires a Threshold Decision before resolution can complete."
      };
    }

    const collapseId = bucket.driftEligibleCollapseId;
    const recoveredFromLegacyState = bucket.driftEligibleCollapseSource === "legacy_recovery";
    const resolvedAt = new Date().toISOString();

    // Atomic Load reset -- the other half of "one Collapse creates at most one Drift". Without
    // actually writing Load back down here, in the same call that consumes the collapse id,
    // Load would stay at 6 and a fresh notePresentationLoadTransition/Recognize path could
    // make this same Collapse resolvable again.
    const pressure = window.PresentationPressure;
    const presentationForLoad = pressure?.presentationById?.(presentationId);
    const loadTrack = presentationForLoad ? pressure.primaryTrack(presentationForLoad) : null;
    if (pressure && loadTrack) {
      const written = pressure.writeTrackValue(normalized, loadTrack.id, loadAfter);
      normalized.presentationPressures = written.presentationPressures;
      if (loadTrack.stateKey) normalized[loadTrack.stateKey] = written[loadTrack.stateKey];
      if (presentationId === "sanguine" && pressure.presentationLoadBand) {
        normalized.sanguineCoherence = pressure.presentationLoadBand("sanguine", loadAfter);
      }
    }

    bucket.value = driftAfter;
    bucket.driftEligibleCollapseId = "";
    bucket.driftEligibleCollapseSource = "";
    bucket.log = [
      normalizeCollapseRecord({
        collapseId, presentationId, loadBefore: 6, loadAfter, driftBefore, driftAfter,
        resolvedAt, recoveredFromLegacyState
      }),
      ...bucket.log
    ].slice(0, 40);

    const tier = driftTierForValue(driftAfter);
    let scarOutcome = null;
    if (isScarThreshold) {
      const choice = options.chosenScarId;
      if (choice === "refuse" || choice === "defer") {
        bucket.pendingScarChoices.push(normalizePendingEntry({
          tier: tier?.id, unlockedAtDrift: driftAfter, collapseId,
          status: choice === "refuse" ? "refused" : "deferred", deferredAt: resolvedAt
        }));
        scarOutcome = choice === "refuse" ? "refused" : "deferred";
      } else {
        const candidate = eligibleScarOptions(presentationId, tier?.id).find((entry) => entry.id === choice);
        if (candidate) {
          bucket.scars.push(snapshotCatalogScar(candidate, resolvedAt));
          scarOutcome = "chosen";
        } else {
          bucket.pendingScarChoices.push(normalizePendingEntry({
            tier: tier?.id, unlockedAtDrift: driftAfter, collapseId,
            status: "deferred", deferredAt: resolvedAt
          }));
          scarOutcome = "deferred";
        }
      }
    }

    if (decision) {
      bucket.thresholdDecision = normalizeThresholdDecision({
        id: decision.id, label: decision.label, note: String(options.consequenceNote || ""), chosenAt: resolvedAt
      });
    }

    return { status: normalized, ok: true, presentationId, value: driftAfter, tier, scarOutcome, collapseId };
  }

  // Independent of Resolve Collapse entirely: does not touch value, does not require Load 6,
  // does not create a Collapse Record. Only ever offered for "deferred" entries -- a "refused"
  // entry is a conscious, permanent decision the table already made, not an open task.
  function resolveDeferredScar(status, catalogKeyOrId, pendingId, chosenScarId) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const pack = presentationPack(presentationId);
    const normalized = normalizePresentationDrift(status);
    if (!pack) {
      return { status: normalized, ok: false, reason: "This presentation does not accumulate drift." };
    }
    const bucket = normalized.presentationDrift.byPresentation[presentationId];
    const index = bucket.pendingScarChoices.findIndex((entry) => entry.id === pendingId && entry.status === "deferred");
    if (index === -1) {
      return { status: normalized, ok: false, reason: "No deferred Scar choice found for that id." };
    }
    const pending = bucket.pendingScarChoices[index];
    const candidate = eligibleScarOptions(presentationId, pending.tier).find((entry) => entry.id === chosenScarId);
    if (!candidate) {
      return { status: normalized, ok: false, reason: "Unrecognized Scar option for that tier." };
    }
    bucket.scars.push(snapshotCatalogScar(candidate, new Date().toISOString()));
    bucket.pendingScarChoices.splice(index, 1);
    // Any Scar Development that was attached to this tier generically (scarId null, because
    // no Scar existed yet to attach to) now has a home -- re-parent it so it displays under
    // the actual Scar instead of staying an orphaned "General Adaptation" line forever.
    bucket.scarDevelopments = bucket.scarDevelopments.map((entry) => (
      entry.scarId === null && entry.tier === pending.tier
        ? { ...entry, scarId: candidate.id }
        : entry
    ));
    return { status: normalized, ok: true, presentationId, scarId: candidate.id };
  }

  // Drift 2/4 (Scar Development): structural, not free-text-only, and must not deadlock when
  // the relevant tier's Scar was deferred or refused -- develop an existing Scar (scarId set),
  // attach to a still-open pending tier (scarId null, tier set), or record a standalone
  // adaptation note (both null).
  function applyScarDevelopment(status, catalogKeyOrId, options = {}) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const pack = presentationPack(presentationId);
    const normalized = normalizePresentationDrift(status);
    if (!pack) {
      return { status: normalized, ok: false, reason: "This presentation does not accumulate drift." };
    }
    const bucket = normalized.presentationDrift.byPresentation[presentationId];
    const scarId = options.scarId ? String(options.scarId) : null;
    if (scarId && !bucket.scars.some((entry) => entry.scarId === scarId)) {
      return { status: normalized, ok: false, reason: "No matching chosen Scar to develop." };
    }
    bucket.scarDevelopments.push(normalizeDevelopmentEntry({
      scarId,
      tier: options.tier || null,
      driftValue: options.driftValue,
      changeType: options.changeType,
      note: options.note,
      catalogVersion: DRIFT_CATALOG_VERSION,
      chosenAt: new Date().toISOString()
    }));
    return { status: normalized, ok: true, presentationId };
  }

  function presentationDriftLog(status, catalogKeyOrId) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const normalized = normalizePresentationDrift(status);
    return normalized.presentationDrift.byPresentation[presentationId]?.log || [];
  }

  // Deliberately omits pendingScarChoices' collapseId internals and the Collapse Record log
  // from anything Operator-facing renders -- log stays Handler-only (use
  // presentationDriftLog for that), and pendingScarChoices is exposed here only so a Handler
  // panel can list them; mountPresentationDriftReadout below never renders it.
  function presentationDriftView(status, catalogKeyOrId) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const pack = presentationPack(presentationId);
    if (!pack) return null;
    const normalized = normalizePresentationDrift(status);
    const bucket = normalized.presentationDrift.byPresentation[presentationId];
    const tier = driftTierForValue(bucket.value);
    const eligibility = collapseDriftEligibility(normalized, presentationId);
    const load = readTrackLoad(normalized, presentationId);
    return {
      presentationId,
      label: pack.label,
      tagline: pack.tagline,
      value: bucket.value,
      tier,
      thresholds: DRIFT_THRESHOLDS.slice(),
      scars: bucket.scars.slice(),
      pendingScarChoices: bucket.pendingScarChoices.slice(),
      scarDevelopments: bucket.scarDevelopments.slice(),
      thresholdDecision: bucket.thresholdDecision,
      collapseEligible: eligibility.ok,
      collapseReason: eligibility.reason || "",
      driftEligibleCollapseId: bucket.driftEligibleCollapseId,
      load,
      trigger: COLLAPSE_DRIFT_TRIGGER
    };
  }

  function mountPresentationDriftReadout(body, view) {
    if (!body || !view) return;

    const block = document.createElement("div");
    block.className = `presentation-drift-readout presentation-drift-${view.presentationId}`;

    const heading = document.createElement("p");
    heading.className = "pressure-readout-subheading";
    heading.textContent = "Presentation Drift";
    block.append(heading);

    const rule = document.createElement("p");
    rule.className = "presentation-drift-rule";
    rule.textContent = "Drift is not sin. Drift is evidence. The Presentation kept something.";
    block.append(rule);

    const summary = document.createElement("p");
    summary.className = "presentation-drift-summary";
    const tierLabel = view.tier ? `${view.tier.label} (${view.value})` : "Unmarked";
    summary.innerHTML = `<strong>Drift ${view.value}</strong> · ${tierLabel}`;
    block.append(summary);

    if (view.tier?.summary) {
      const tierCopy = document.createElement("p");
      tierCopy.className = "presentation-ability-meta";
      tierCopy.textContent = view.tier.summary;
      block.append(tierCopy);
    }

    if (view.tagline) {
      const tagline = document.createElement("p");
      tagline.className = "presentation-drift-tagline";
      tagline.textContent = view.tagline;
      block.append(tagline);
    }

    // Marking Drift is a Handler call, not an Operator self-service action -- a Load 6
    // collapse is read-only here regardless of eligibility. There is no Operator-facing
    // control that increments Drift; only the Handler side may authorize that.
    if (view.collapseEligible) {
      const pending = document.createElement("p");
      pending.className = "presentation-ability-meta presentation-ability-risk";
      pending.textContent = "Load 6 collapse resolved. Ask your Handler to confirm it and mark Drift.";
      block.append(pending);
    }

    if (view.thresholdDecision) {
      const decision = document.createElement("p");
      decision.className = "presentation-ability-meta presentation-ability-risk";
      const decisionMeta = THRESHOLD_DECISIONS.find((entry) => entry.id === view.thresholdDecision.id);
      decision.textContent = `Threshold Decision: ${view.thresholdDecision.label.toUpperCase()} — ${decisionMeta?.description || ""}`;
      block.append(decision);
    }

    function developmentLine(entry) {
      const line = document.createElement("p");
      line.className = "presentation-ability-meta";
      line.textContent = `Drift ${entry.driftValue} (${entry.changeType.replace("_", " ")}): ${entry.note}`;
      return line;
    }

    if (view.scars.length) {
      const groups = DRIFT_THRESHOLDS.map((threshold) => ({
        threshold,
        scars: view.scars.filter((entry) => entry.tier === threshold.id)
      })).filter((group) => group.scars.length);

      groups.forEach((group) => {
        const groupWrap = document.createElement("div");
        groupWrap.className = `presentation-drift-tier presentation-drift-tier-${group.threshold.id}`;
        const groupTitle = document.createElement("p");
        groupTitle.className = "presentation-ability-group-label";
        groupTitle.textContent = group.threshold.label;
        groupWrap.append(groupTitle);

        group.scars.forEach((entry) => {
          const card = document.createElement("article");
          card.className = "presentation-drift-scar";
          const title = document.createElement("p");
          title.className = "presentation-ability-title";
          title.textContent = entry.label;
          card.append(title);
          if (entry.benefit) {
            const benefit = document.createElement("p");
            benefit.className = "presentation-ability-effect";
            benefit.textContent = `Benefit: ${entry.benefit}`;
            card.append(benefit);
          }
          if (entry.cost) {
            const cost = document.createElement("p");
            cost.className = "presentation-ability-meta presentation-ability-risk";
            cost.textContent = `Cost: ${entry.cost}`;
            card.append(cost);
          }
          if (entry.archiveUnlock) {
            const archive = document.createElement("p");
            archive.className = "presentation-ability-meta";
            archive.textContent = entry.handlerApproval
              ? `Archive unlock: ${entry.archiveUnlock} — Handler Approval required.`
              : `Archive unlock: ${entry.archiveUnlock}`;
            card.append(archive);
          }
          view.scarDevelopments
            .filter((development) => development.scarId === entry.scarId)
            .forEach((development) => card.append(developmentLine(development)));
          groupWrap.append(card);
        });
        block.append(groupWrap);
      });
    } else {
      const empty = document.createElement("p");
      empty.className = "presentation-ability-meta";
      empty.textContent = "No drift scars yet. Resolve a Load 6 collapse to mark what stayed.";
      block.append(empty);
    }

    const generalDevelopments = view.scarDevelopments.filter((entry) => !entry.scarId && entry.tier);
    DRIFT_THRESHOLDS.forEach((threshold) => {
      const entries = generalDevelopments.filter((entry) => entry.tier === threshold.id);
      if (!entries.length) return;
      const wrap = document.createElement("div");
      wrap.className = "presentation-drift-general-adaptation";
      const label = document.createElement("p");
      label.className = "presentation-ability-group-label";
      label.textContent = `General Adaptation — ${threshold.label}`;
      wrap.append(label);
      entries.forEach((entry) => wrap.append(developmentLine(entry)));
      block.append(wrap);
    });

    const standaloneDevelopments = view.scarDevelopments.filter((entry) => !entry.scarId && !entry.tier);
    if (standaloneDevelopments.length) {
      const wrap = document.createElement("div");
      wrap.className = "presentation-drift-general-adaptation";
      const label = document.createElement("p");
      label.className = "presentation-ability-group-label";
      label.textContent = "Adaptation";
      wrap.append(label);
      standaloneDevelopments.forEach((entry) => wrap.append(developmentLine(entry)));
      block.append(wrap);
    }

    body.append(block);
  }

  window.PresentationDrift = {
    DRIFT_THRESHOLDS,
    THRESHOLD_DECISIONS,
    DRIFT_PRESENTATIONS,
    DRIFT_CATALOG_VERSION,
    SCAR_CHANGE_TYPES,
    COLLAPSE_DRIFT_TRIGGER,
    driftTierForValue,
    eligibleScarOptions,
    normalizePresentationDrift,
    presentationPack,
    resolvePresentationId,
    readDriftValue,
    readTrackLoad,
    collapseDriftEligibility,
    notePresentationLoadTransition,
    recognizeExistingCollapse,
    applyCollapseDriftResolve,
    resolveDeferredScar,
    applyScarDevelopment,
    presentationDriftView,
    presentationDriftLog,
    mountPresentationDriftReadout
  };
}());
