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
      max: null,
      summary: "Permanent aspect, vulnerability, altered recovery need, or evolution gate."
    }
  ];

  const COLLAPSE_DRIFT_TRIGGER = "load_6_collapse_resolved";

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

  function driftTierForValue(value) {
    const numeric = Math.max(0, Number(value) || 0);
    if (numeric <= 0) return null;
    if (numeric <= 2) return DRIFT_THRESHOLDS.find((entry) => entry.id === "surface_tell") || null;
    if (numeric <= 4) return DRIFT_THRESHOLDS.find((entry) => entry.id === "persistent_scar") || null;
    return DRIFT_THRESHOLDS.find((entry) => entry.id === "deep_drift") || null;
  }

  function tierForScar(scarEntry) {
    return DRIFT_THRESHOLDS.find((entry) => entry.id === scarEntry.tier) || null;
  }

  function activeScarsForValue(presentationId, value) {
    const pack = DRIFT_PRESENTATIONS[presentationId];
    if (!pack) return [];
    const numeric = Math.max(0, Number(value) || 0);
    if (numeric <= 0) return [];
    return pack.scars.filter((entry) => {
      if (entry.tier === "surface_tell") return numeric >= 1 && numeric <= 2;
      if (entry.tier === "persistent_scar") return numeric >= 3 && numeric <= 4;
      if (entry.tier === "deep_drift") return numeric >= 5;
      return numeric >= entry.minDrift;
    });
  }

  function accumulatedScarsForValue(presentationId, value) {
    const pack = DRIFT_PRESENTATIONS[presentationId];
    if (!pack) return [];
    const numeric = Math.max(0, Number(value) || 0);
    if (numeric <= 0) return [];
    return pack.scars.filter((entry) => numeric >= entry.minDrift);
  }

  function normalizeDriftLog(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.slice(0, 24).map((entry) => ({
      at: String(entry?.at || "").slice(0, 32),
      trigger: String(entry?.trigger || COLLAPSE_DRIFT_TRIGGER).slice(0, 40),
      load: Math.max(0, Math.min(6, Number(entry?.load) || 6)),
      valueAfter: Math.max(0, Number(entry?.valueAfter) || 0)
    }));
  }

  function normalizePresentationDriftStore(store) {
    const source = store && typeof store === "object" ? store : {};
    const values = {};
    Object.keys(DRIFT_PRESENTATIONS).forEach((presentationId) => {
      const current = source[presentationId];
      if (current && typeof current === "object") {
        values[presentationId] = {
          value: Math.max(0, Number(current.value) || 0),
          log: normalizeDriftLog(current.log)
        };
      } else if (current !== undefined && current !== null && current !== "") {
        values[presentationId] = {
          value: Math.max(0, Number(current) || 0),
          log: []
        };
      } else {
        values[presentationId] = { value: 0, log: [] };
      }
    });
    return values;
  }

  function normalizePresentationDrift(status) {
    const next = { ...(status || {}) };
    if (next.presentationDrift && typeof next.presentationDrift.value === "number" && !next.presentationDrift.byPresentation) {
      const legacyValue = Math.max(0, Number(next.presentationDrift.value) || 0);
      const legacyId = String(next.presentationDrift.presentationId || "").trim();
      next.presentationDrift = {
        byPresentation: normalizePresentationDriftStore(
          legacyId && DRIFT_PRESENTATIONS[legacyId]
            ? { [legacyId]: { value: legacyValue, log: next.presentationDrift.log } }
            : {}
        )
      };
    } else {
      next.presentationDrift = {
        byPresentation: normalizePresentationDriftStore(next.presentationDrift?.byPresentation)
      };
    }
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
      RESONANT_SENSITIVE: "sensitive",
      ECHO_ALTERED: "echo",
      MYTHIC_ECHO: "echo",
      HOLLOW_SILENCE_ALTERED: "silence",
      TECHNOMANCER_DAEMON_ALIGNED: "technomancer",
      THERIAN_ADAPTATION: "therian",
      VESSEL: "vessel",
      CONSTRUCT: "construct",
      CONSTRUCT_VESSEL: "construct",
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

  function collapseDriftEligibility(status, catalogKeyOrId) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const pack = presentationPack(presentationId);
    if (!pack) {
      return { ok: false, presentationId, reason: "This presentation does not accumulate drift." };
    }
    const load = readTrackLoad(status, presentationId);
    if (load < 6) {
      return {
        ok: false,
        presentationId,
        reason: "Resolve a Load 6 collapse before marking Presentation Drift."
      };
    }
    return { ok: true, presentationId, load };
  }

  function applyCollapseDriftResolve(status, catalogKeyOrId) {
    const eligibility = collapseDriftEligibility(status, catalogKeyOrId);
    if (!eligibility.ok) {
      return { status: normalizePresentationDrift(status), ok: false, reason: eligibility.reason };
    }
    const next = normalizePresentationDrift(status);
    const bucket = next.presentationDrift.byPresentation[eligibility.presentationId];
    const nextValue = bucket.value + 1;
    bucket.value = nextValue;
    bucket.log = [
      {
        at: new Date().toISOString(),
        trigger: COLLAPSE_DRIFT_TRIGGER,
        load: eligibility.load,
        valueAfter: nextValue
      },
      ...bucket.log
    ].slice(0, 24);
    return {
      status: next,
      ok: true,
      presentationId: eligibility.presentationId,
      value: nextValue,
      tier: driftTierForValue(nextValue)
    };
  }

  function presentationDriftView(status, catalogKeyOrId) {
    const presentationId = resolvePresentationId(catalogKeyOrId);
    const pack = presentationPack(presentationId);
    if (!pack) return null;
    const normalized = normalizePresentationDrift(status);
    const value = readDriftValue(normalized, presentationId);
    const tier = driftTierForValue(value);
    const activeScars = activeScarsForValue(presentationId, value);
    const accumulatedScars = accumulatedScarsForValue(presentationId, value);
    const eligibility = collapseDriftEligibility(normalized, presentationId);
    const load = readTrackLoad(normalized, presentationId);
    return {
      presentationId,
      label: pack.label,
      tagline: pack.tagline,
      value,
      tier,
      thresholds: DRIFT_THRESHOLDS.slice(),
      activeScars,
      accumulatedScars,
      collapseEligible: eligibility.ok,
      collapseReason: eligibility.reason || "",
      load,
      trigger: COLLAPSE_DRIFT_TRIGGER,
      log: normalized.presentationDrift.byPresentation[presentationId]?.log || []
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

  function mountPresentationDriftReadout(body, view, runtime) {
    if (!body || !view) return;
    const dispatch = typeof runtime?.dispatch === "function" ? runtime.dispatch : null;

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

    if (view.presentationId === "vessel" && view.value >= 5) {
      const evolution = document.createElement("p");
      evolution.className = "presentation-ability-meta presentation-ability-risk";
      evolution.textContent = "Deep Drift: subtype evolution warning — Handler Approval required before archive unlock.";
      block.append(evolution);
    }

    if (view.presentationId === "construct" && view.value >= 5) {
      const evolution = document.createElement("p");
      evolution.className = "presentation-ability-meta presentation-ability-risk";
      evolution.textContent = "Deep Drift: Construct Lineage evolution warning — Handler Approval required before Machine Archive unlock.";
      block.append(evolution);
    }

    if (view.presentationId === "void_shard" && view.value >= 5) {
      const evolution = document.createElement("p");
      evolution.className = "presentation-ability-meta presentation-ability-risk";
      evolution.textContent = "Deep Drift: Deep Void Archive evolution warning — Handler Approval required before archive unlock.";
      block.append(evolution);
    }

    if (view.load >= 6 && dispatch) {
      const collapseWrap = document.createElement("div");
      collapseWrap.className = "presentation-drift-collapse";
      const collapseCopy = document.createElement("p");
      collapseCopy.className = "presentation-ability-meta";
      collapseCopy.textContent = "Load 6 collapse resolved. Mark what the Presentation kept.";
      collapseWrap.append(collapseCopy);
      collapseWrap.append(createButton("Collapse Resolved — Mark Drift", "presentation-ability-btn", () => {
        dispatch("collapse_drift_resolve");
      }));
      block.append(collapseWrap);
    } else if (view.load >= 6) {
      const pending = document.createElement("p");
      pending.className = "presentation-ability-meta presentation-ability-risk";
      pending.textContent = "Load 6 collapse pending drift mark.";
      block.append(pending);
    }

    if (view.accumulatedScars.length) {
      const groups = DRIFT_THRESHOLDS.map((threshold) => ({
        threshold,
        scars: view.accumulatedScars.filter((entry) => entry.tier === threshold.id)
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
            archive.textContent = `Archive unlock: ${entry.archiveUnlock}`;
            card.append(archive);
          }
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

    if (view.log.length) {
      const logWrap = document.createElement("div");
      logWrap.className = "presentation-drift-log";
      const logTitle = document.createElement("p");
      logTitle.className = "presentation-ability-group-label";
      logTitle.textContent = "Drift Log";
      logWrap.append(logTitle);
      view.log.slice(0, 6).forEach((entry) => {
        const line = document.createElement("p");
        line.className = "presentation-ability-meta";
        const stamp = entry.at ? entry.at.replace("T", " ").slice(0, 16) : "—";
        line.textContent = `${stamp} — Load ${entry.load} collapse → Drift ${entry.valueAfter}`;
        logWrap.append(line);
      });
      block.append(logWrap);
    }

    body.append(block);
  }

  window.PresentationDrift = {
    DRIFT_THRESHOLDS,
    DRIFT_PRESENTATIONS,
    COLLAPSE_DRIFT_TRIGGER,
    driftTierForValue,
    activeScarsForValue,
    accumulatedScarsForValue,
    normalizePresentationDrift,
    presentationPack,
    resolvePresentationId,
    readDriftValue,
    collapseDriftEligibility,
    applyCollapseDriftResolve,
    presentationDriftView,
    mountPresentationDriftReadout
  };
}());
