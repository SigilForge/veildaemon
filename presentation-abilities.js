(function () {
  /**
   * Presentation permissions = ontology-facing abilities separate from Frequency petals.
   * Only actives with interaction contracts are clickable; passives stay reference unless marked optional.
   */
  const SURGE_ATTRS = ["Body", "Agility", "Instinct"];
  const SURGE_APPLIES_COPY = "Applies to next pursuit, force, escape, predatory movement, or blood-sense roll.";
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
          { id: "hauntRange", label: "Haunt Range", placeholder: "Full in/through Locus. Limited through Tethers." }
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
          name: "Haunt Reach",
          effect: "You may attempt Wraith actions through your Locus without physical contact.",
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

  function appendActiveTag(block, view, dispatch) {
    const surge = view.runtimeState?.bloodSurge;
    if (!surge?.active) return;
    const tag = document.createElement("div");
    tag.className = "presentation-active-tag";
    const title = document.createElement("p");
    title.className = "presentation-active-tag-title";
    title.textContent = "ACTIVE: Blood Surge +1";
    const copy = document.createElement("p");
    copy.className = "presentation-active-tag-copy";
    copy.textContent = SURGE_APPLIES_COPY;
    tag.append(title, copy);
    if (surge.mode === "risk" || surge.riskQueued) {
      const risk = document.createElement("p");
      risk.className = "presentation-active-tag-risk";
      risk.textContent = "RISK: On miss or severe consequence, Blood Load +1 or Handler escalates.";
      tag.append(risk);
    }
    tag.append(createButton("Clear", "presentation-ability-btn subtle", () => {
      dispatch("blood_surge_clear");
    }));
    block.append(tag);
  }

  function appendBloodSurgeCard(card, entry, view, dispatch) {
    const surge = view.runtimeState?.bloodSurge;
    if (surge?.active) {
      card.classList.add("is-resolved");
      return;
    }
    const open = createButton(entry.headline ? "Activate" : "Use", "presentation-ability-btn", () => {
      card.querySelector(".presentation-ability-confirm")?.remove();
      const confirm = document.createElement("div");
      confirm.className = "presentation-ability-confirm";
      const prompt = document.createElement("p");
      prompt.className = "presentation-ability-confirm-prompt";
      prompt.textContent = "Spend or risk Blood Load?";
      const actions = document.createElement("div");
      actions.className = "presentation-ability-confirm-actions";
      actions.append(
        createButton("Spend 1 Blood Load", "presentation-ability-btn", () => dispatch("blood_surge_spend")),
        createButton("Risk Blood Load", "presentation-ability-btn subtle", () => dispatch("blood_surge_risk")),
        createButton("Cancel", "presentation-ability-btn ghost", () => confirm.remove())
      );
      confirm.append(prompt, actions);
      card.append(confirm);
    });
    card.append(open);
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

    appendHauntInterface(block, view, runtime);

    const heading = document.createElement("p");
    heading.className = "pressure-readout-subheading";
    heading.textContent = view.hauntInterface?.enabled ? "Haunt permissions" : "Presentation permissions";
    block.append(heading);

    if (view.identityLine && !view.hauntInterface?.enabled) {
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
    mountPresentationPermissionsReadout,
    appendPresentationPermissionsReadout,
    accessTierFromCatalog,
    SURGE_APPLIES_COPY
  };
}());