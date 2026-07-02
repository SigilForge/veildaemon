(function () {
  /**
   * Presentation permissions = ontology-facing abilities separate from Frequency petals.
   * Data shape is shared; each presentation fills its own passive/active/band/collapse entries.
   */
  function passivePermission(spec) {
    return {
      id: spec.id,
      name: spec.name,
      kind: "passive",
      effect: spec.effect || "",
      when: spec.when || "",
      handlerNote: spec.handlerNote || ""
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
      tags: Array.isArray(spec.tags) ? spec.tags.slice() : []
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

  function presentationAbilityContract(spec) {
    return {
      id: spec.id,
      catalogKeys: Array.isArray(spec.catalogKeys) ? spec.catalogKeys.slice() : [],
      label: spec.label,
      accessTier: spec.accessTier || "",
      identityLine: spec.identityLine || "",
      pressureTrack: spec.pressureTrack || null,
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
          effect: "Detect nearby blood, injury, pulse, heat, or living warmth when fiction allows."
        },
        {
          id: "blood_warm_recovery",
          name: "Blood-Warm Recovery",
          when: "Coherent range (Blood Load 2–4)",
          effect: "Recovery, rest, and stabilization read as warmth returning. Handler may allow faster mundane recovery where appropriate."
        }
      ],
      activeAbilities: [
        {
          id: "blood_surge",
          name: "Blood Surge",
          headline: true,
          cost: "Spend or risk Blood Load",
          effect: "+1 on one Body, Agility, or Instinct action involving pursuit, force, escape, predatory movement, or blood-sense.",
          tags: ["pursuit", "force", "escape", "predatory movement", "blood-sense"]
        },
        {
          id: "closing_burst",
          name: "Closing Burst",
          cadence: "Once per scene",
          effect: "Move immediately into close range, cross a short gap, or intercept someone nearby if physically possible.",
          roll: "Roll if contested."
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
    })
  ];

  const abilityById = Object.fromEntries(PRESENTATION_ABILITIES.map((item) => [item.id, item]));
  const catalogKeyIndex = {};
  PRESENTATION_ABILITIES.forEach((entry) => {
    entry.catalogKeys.forEach((key) => {
      catalogKeyIndex[String(key).toUpperCase()] = entry.id;
    });
  });

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
    const entry = catalogs.presentationEntry
      ? catalogs.presentationEntry(catalogKey)
      : null;
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
    return (ability.bandModifiers || []).find((entry) => entry.atLoad === value)
      || (ability.bandModifiers || []).find((entry) => entry.bandLabel === bandLabel)
      || null;
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
      if (!catalogKey && presentation) {
        catalogKey = presentation.catalogKeys?.[0] || "";
      }
    }

    const ability = presentation
      ? abilityForPresentationId(presentation.id) || abilityForCatalogKey(catalogKey)
      : abilityForCatalogKey(catalogKeyOrId) || abilityForPresentationId(catalogKeyOrId);
    if (!ability) return null;

    const track = presentation ? pressure.primaryTrack(presentation) : null;
    const trackId = ability.pressureTrack?.trackId || track?.id || "";
    const loadValue = trackId ? pressure.readTrackValue(status, trackId) : 0;
    const bandLabel = trackId ? pressure.bandForTrack(trackId, loadValue) : "";
    const bandState = bandModifierForLoad(ability, loadValue, bandLabel);

    return {
      id: ability.id,
      label: ability.label,
      accessTier: resolveAccessTier(ability, catalogKey || ability.catalogKeys?.[0] || ""),
      identityLine: ability.identityLine,
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
      headlineAbility: ability.activeAbilities.find((entry) => entry.headline) || ability.activeAbilities[0] || null
    };
  }

  function appendPresentationPermissionsReadout(body, view) {
    if (!body || !view) return;
    const block = document.createElement("div");
    block.className = "presentation-permissions-readout";

    const heading = document.createElement("p");
    heading.className = "pressure-readout-subheading";
    heading.textContent = "Presentation permissions";
    block.append(heading);

    if (view.identityLine) {
      const identity = document.createElement("p");
      identity.className = "presentation-identity-line";
      identity.textContent = view.identityLine;
      block.append(identity);
    }

    if (view.headlineAbility) {
      const headline = document.createElement("article");
      headline.className = "presentation-ability presentation-ability-headline";
      const title = document.createElement("p");
      title.className = "presentation-ability-title";
      title.textContent = view.headlineAbility.name;
      const effect = document.createElement("p");
      effect.className = "presentation-ability-effect";
      effect.textContent = view.headlineAbility.effect;
      headline.append(title);
      if (view.headlineAbility.cost) {
        const cost = document.createElement("p");
        cost.className = "presentation-ability-meta";
        cost.textContent = `Cost: ${view.headlineAbility.cost}`;
        headline.append(cost);
      }
      headline.append(effect);
      block.append(headline);
    }

    const otherActives = view.activeAbilities.filter((entry) => entry.id !== view.headlineAbility?.id);
    if (otherActives.length) {
      const activeWrap = document.createElement("div");
      activeWrap.className = "presentation-ability-group";
      const activeTitle = document.createElement("p");
      activeTitle.className = "presentation-ability-group-label";
      activeTitle.textContent = "Active";
      activeWrap.append(activeTitle);
      otherActives.forEach((entry) => {
        const card = document.createElement("article");
        card.className = "presentation-ability";
        const title = document.createElement("p");
        title.className = "presentation-ability-title";
        title.textContent = entry.name;
        card.append(title);
        if (entry.cadence) {
          const cadence = document.createElement("p");
          cadence.className = "presentation-ability-meta";
          cadence.textContent = entry.cadence;
          card.append(cadence);
        }
        const effect = document.createElement("p");
        effect.className = "presentation-ability-effect";
        effect.textContent = [entry.effect, entry.roll].filter(Boolean).join(" ");
        card.append(effect);
        activeWrap.append(card);
      });
      block.append(activeWrap);
    }

    if (view.passivePermissions.length) {
      const passiveWrap = document.createElement("div");
      passiveWrap.className = "presentation-ability-group";
      const passiveTitle = document.createElement("p");
      passiveTitle.className = "presentation-ability-group-label";
      passiveTitle.textContent = "Passive";
      passiveWrap.append(passiveTitle);
      view.passivePermissions.forEach((entry) => {
        const card = document.createElement("article");
        card.className = "presentation-ability presentation-ability-passive";
        const title = document.createElement("p");
        title.className = "presentation-ability-title";
        title.textContent = entry.name;
        card.append(title);
        if (entry.when) {
          const when = document.createElement("p");
          when.className = "presentation-ability-meta";
          when.textContent = entry.when;
          card.append(when);
        }
        const effect = document.createElement("p");
        effect.className = "presentation-ability-effect";
        effect.textContent = entry.effect;
        card.append(effect);
        passiveWrap.append(card);
      });
      block.append(passiveWrap);
    }

    if (view.activeBandState) {
      const state = document.createElement("article");
      state.className = `presentation-band-state presentation-band-state-${view.activeBandState.type || view.activeBandState.kind || "edge"}`;
      const title = document.createElement("p");
      title.className = "presentation-ability-title";
      title.textContent = view.activeBandState.type === "collapse"
        ? view.activeBandState.name
        : view.activeBandState.bandLabel;
      state.append(title);
      if (view.activeBandState.bonus) {
        const bonus = document.createElement("p");
        bonus.className = "presentation-ability-effect";
        bonus.textContent = view.activeBandState.bonus;
        state.append(bonus);
      }
      if (view.activeBandState.helps) {
        const helps = document.createElement("p");
        helps.className = "presentation-ability-meta";
        helps.textContent = view.activeBandState.helps;
        state.append(helps);
      }
      if (view.activeBandState.hurts) {
        const hurts = document.createElement("p");
        hurts.className = "presentation-ability-meta";
        hurts.textContent = view.activeBandState.hurts;
        state.append(hurts);
      }
      if (view.activeBandState.effect) {
        const effect = document.createElement("p");
        effect.className = "presentation-ability-effect";
        effect.textContent = view.activeBandState.effect;
        state.append(effect);
      }
      if (view.activeBandState.risk) {
        const risk = document.createElement("p");
        risk.className = "presentation-ability-meta presentation-ability-risk";
        risk.textContent = view.activeBandState.risk;
        state.append(risk);
      }
      block.append(state);
    }

    body.append(block);
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
    appendPresentationPermissionsReadout,
    accessTierFromCatalog
  };
}());