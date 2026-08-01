/**
 * Handler-only Collapse / Rewrite consequence engine (Handler Guide §4.2-4.4, §11.4-11.6).
 * Loaded ONLY by handler/live/index.html -- never by anything Operator-facing. The leak
 * boundary (no Collapse Severity number, Fracture/Break label, or Rewrite Outcome name may
 * ever reach the Operator sheet -- see root CLAUDE.md) is enforced by construction:
 * planCollapseConsequence()'s only public output is a scene-state `change` shaped for the
 * existing HandlerPressureControls.buildManualPressureChange/HandlerTriggers preview pipeline
 * (the same one Entity Loop advances use). That pipeline's own resolveTriggerStabilityCost
 * already adds +1 Stability damage for a Breached scene and +2 for Collapse, so this engine
 * never needs to compute or transmit a Stability number itself -- it only ever hands the
 * pipeline a target scene state and lets the existing, already-safe machinery take it from
 * there. Severity detail, Fracture/Break effects, and Rewrite Outcome descriptions stay in
 * `handlerOnlyNarrative`, read only by this Handler console's own panel.
 */
(function () {
  // Handler Guide §4.2 -- GM-only 5-band read on the SAME public 0-10 Stability number.
  // Never replaces or overwrites the Operator-facing 4-band bandFromLegacyStability taxonomy.
  const STABILITY_BANDS = [
    { min: 8, max: 10, label: "Stable", guidance: "No penalties." },
    { min: 6, max: 7, label: "Strained", guidance: "-1 to Collapse checks." },
    { min: 4, max: 5, label: "Instability Risk", guidance: "Collapse on 10- = mild effects." },
    { min: 2, max: 3, label: "Severe Instability", guidance: "Collapse on any failure; effects intensify." },
    { min: 0, max: 1, label: "Collapse Imminent", guidance: "Automatic Collapse in next stress scene." }
  ];

  // Handler Guide §4.3.
  const SEVERITY_TABLE = [
    { severity: 1, label: "Mild", effects: "Visual distortion, symbolic bleed, emotional feedback.", recovery: "1 scene of grounding." },
    { severity: 2, label: "Moderate", effects: "Entity hallucinations, resonance misfires, loss of motor precision.", recovery: "1-3 scenes; roll Stability." },
    { severity: 3, label: "Severe", effects: "Partial loss of self, physical anomalies, environmental bleed.", recovery: "Long rest + Handler event." },
    { severity: 4, label: "Critical", effects: "Identity fragmentation, uncontrollable Frequency surge, temporary Operator agency loss.", recovery: "Handler event + Void cost." },
    { severity: 5, label: "Catastrophic", effects: "Reality rejects Operator, full Etheric bleed, mythic echo event.", recovery: "Campaign-level consequence." }
  ];

  // Handler Guide §11.4.
  const COLLAPSE_STATES = {
    Fracture: {
      label: "Fracture",
      effects: "+1-2 Void, Emotional Distortion, minor destabilization form, temporary skill penalties. Teammates can intervene.",
      recovery: "Grounding, bonds, Synergy, ritual, exit Zone, or catharsis."
    },
    Break: {
      label: "Break",
      effects: "+2-4 Void, cannot resist Zone hazards, lose one core skill temporarily, manifest two distortions, gain one monster-class trait.",
      recovery: "Reversible until the Maw intervenes."
    }
  };

  // Handler Guide §11.6.
  const REWRITE_OUTCOMES = [
    { id: "restoration", label: "Restoration", description: "Stabilize, reduce Void, gain clarity.", sceneTarget: "relief" },
    { id: "transformation", label: "Transformation", description: "Emotional/presentational shift without exceeding pip 6 -- clarity, new stability, or altered Synergy hooks, not a rank gain.", sceneTarget: "hold" },
    { id: "divergence", label: "Divergence", description: "Gain Destabilization traits -- monster-adjacent manifestations with emotional cost.", sceneTarget: "escalate" },
    { id: "shard_event", label: "Shard Event", description: "Rare: part of identity becomes autonomous (Echo-self, Shadow-self, Mask persona, Desire construct, Silence avatar, Stillness reflection, Empathic phantom). Major future plot thread.", sceneTarget: "major_escalate" }
  ];

  function clampSeverity(value) {
    return Math.max(1, Math.min(5, Math.round(Number(value)) || 1));
  }

  function bandForStability(points) {
    const raw = Number(points);
    const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(10, raw)) : 10;
    return STABILITY_BANDS.find((band) => clamped >= band.min && clamped <= band.max) || STABILITY_BANDS[0];
  }

  function severityEntry(severity) {
    const n = clampSeverity(severity);
    return SEVERITY_TABLE.find((entry) => entry.severity === n) || SEVERITY_TABLE[0];
  }

  function collapseStateForSeverity(severity) {
    return clampSeverity(severity) >= 4 ? COLLAPSE_STATES.Break : COLLAPSE_STATES.Fracture;
  }

  /** Suggestion only, from the worst seated Operator's Stability band. Handler confirms/overrides. */
  function suggestSeverity(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    if (!players.length) return 1;
    const worstPoints = players.reduce((min, player) => {
      const points = Number(player.stabilityPoints);
      return Number.isFinite(points) ? Math.min(min, points) : min;
    }, 10);
    const band = bandForStability(worstPoints);
    return Math.min(5, STABILITY_BANDS.indexOf(band) + 1);
  }

  function rewriteOutcomeOptions() {
    return REWRITE_OUTCOMES.slice();
  }

  function sceneTargetForRewrite(state, outcomeId) {
    const outcome = REWRITE_OUTCOMES.find((item) => item.id === outcomeId) || REWRITE_OUTCOMES[0];
    const current = state?.sceneState?.current || "Stable";
    if (outcome.sceneTarget === "relief") return "Stable";
    if (outcome.sceneTarget === "escalate") return "Breached";
    if (outcome.sceneTarget === "major_escalate") return "Collapse";
    return current; // "hold" — Transformation is narrative, no scene-state change.
  }

  /**
   * The only function allowed to shape what crosses to the Operator: a scene-state `change`
   * ready for HandlerPressureControls.buildManualPressureChange (same shape as the Entity
   * Loop's target). Handler-only detail comes back separately in `handlerOnlyNarrative` and
   * must never be attached to the change itself.
   */
  function planCollapseConsequence(state, options = {}) {
    const severity = clampSeverity(options.severity);
    const stateKind = collapseStateForSeverity(severity);
    const targetScene = stateKind.label === "Break" ? "Collapse" : "Breached";
    const change = {
      kind: "scene",
      before: state?.sceneState?.current,
      after: targetScene,
      label: `Collapse Resolved — ${stateKind.label} (Severity ${severity})`,
      hint: severityEntry(severity).effects
    };
    return {
      change,
      handlerOnlyNarrative: {
        severity,
        severityLabel: severityEntry(severity).label,
        severityEffects: severityEntry(severity).effects,
        severityRecovery: severityEntry(severity).recovery,
        stateKind: stateKind.label,
        stateEffects: stateKind.effects,
        stateRecovery: stateKind.recovery
      }
    };
  }

  function planRewriteConsequence(state, options = {}) {
    const outcome = REWRITE_OUTCOMES.find((item) => item.id === options.outcomeId) || REWRITE_OUTCOMES[0];
    const targetScene = sceneTargetForRewrite(state, outcome.id);
    const change = {
      kind: "scene",
      before: state?.sceneState?.current,
      after: targetScene,
      label: `Rewrite Resolved — ${outcome.label}`,
      hint: outcome.description
    };
    return {
      change,
      handlerOnlyNarrative: {
        outcome: outcome.label,
        description: outcome.description
      }
    };
  }

  window.HandlerCollapseEngine = {
    STABILITY_BANDS,
    SEVERITY_TABLE,
    REWRITE_OUTCOMES,
    bandForStability,
    severityEntry,
    collapseStateForSeverity,
    suggestSeverity,
    rewriteOutcomeOptions,
    planCollapseConsequence,
    planRewriteConsequence
  };
}());
