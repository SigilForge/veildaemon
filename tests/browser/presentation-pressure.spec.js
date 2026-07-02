const { test, expect } = require("@playwright/test");

const LOAD_PRESENTATIONS = [
  { id: "sanguine", kind: "blood_load", trackId: "sanguine.blood_load", catalog: "SANGUINE", bands: ["Starving", "Coherent", "Predatory Saturation", "Collapse Risk"] },
  { id: "wraith", kind: "essence_load", trackId: "wraith.essence_load", catalog: "WRAITH", bands: ["Fading", "Anchored", "Possessive Saturation", "Haunting Risk"] },
  { id: "echo", kind: "echo_load", trackId: "echo.echo_load", catalog: "ECHO_ALTERED", bands: ["Dislocated", "In Sequence", "Continuity Saturation", "Loop Risk"] },
  { id: "silence", kind: "silence_load", trackId: "silence.silence_load", catalog: "HOLLOW_SILENCE_ALTERED", bands: ["Overexposed", "Present Enough", "Negative Space", "Erasure Risk"] },
  { id: "therian", kind: "instinct_load", trackId: "therian.instinct_load", catalog: "THERIAN_ADAPTATION", bands: ["Leashed", "Integrated", "Hunting Pitch", "Feral Break"] },
  { id: "technomancer", kind: "signal_load", trackId: "technomancer.signal_load", catalog: "TECHNOMANCER_DAEMON_ALIGNED", bands: ["Desynced", "Linked", "Overclocked Link", "System Breach"] },
  { id: "construct", kind: "function_load", trackId: "construct.function_load", catalog: "CONSTRUCT", bands: ["Degraded", "Operational", "Purpose Lock", "Directive Override"] },
  { id: "vessel", kind: "containment_load", trackId: "vessel.containment_load", catalog: "VESSEL", bands: ["Sealed Shut", "Contained", "Seal Strain", "Emergence Risk"] },
  { id: "sensitive", kind: "sensory_load", trackId: "sensitive.sensory_load", catalog: "RESONANT_SENSITIVE", bands: ["Numbed", "Tuned", "Over-Tuned", "Signal Break"] },
  { id: "void_shard", kind: "void_load", trackId: "void_shard.void_load", catalog: "VOID_SHARD", bands: ["Cold Shard", "Contained Contamination", "Contamination Bloom", "Breach Event"] }
];

test("presentation pressure registry exposes eleven ontology modules", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    return {
      count: api.presentations.length,
      loadCount: api.presentations.filter((item) => api.isLoadPresentation(item)).length,
      sanguine: api.trackById("sanguine.blood_load").label,
      voidShard: api.presentationById("void_shard").trackLabel,
      voidBands: api.bandForTrack("void_shard.void_load", 0),
      echoBand: api.bandForTrack("echo.echo_load", 4),
      modifiers: api.LOAD_MODIFIERS,
      maxRisk: api.formatBandLine(api.trackById("stillness.inertia"), 6)
    };
  });
  expect(summary.count).toBe(12);
  expect(summary.loadCount).toBe(10);
  expect(summary.sanguine).toBe("Blood Load");
  expect(summary.voidShard).toBe("Void Load");
  expect(summary.voidBands).toBe("Cold Shard");
  expect(summary.echoBand).toBe("In Sequence");
  expect(summary.modifiers.edge.bonus).toBe(1);
  expect(summary.modifiers.collapse.penalty).toBe(-2);
  expect(summary.maxRisk).toContain("Stasis Lock");
});

test("universal load presentations share the 0-6 safe-middle grammar", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate((presentations) => {
    const api = window.PresentationPressure;
    return presentations.map((entry) => {
      const presentation = api.presentationById(entry.id);
      const view = api.presentationPressureView(
        api.migrateOperatorStatus({ presentationPressures: { [entry.trackId]: 3 } }),
        entry.catalog
      );
      return {
        id: entry.id,
        ladderLabels: view.bandLadder.map((band) => band.label),
        band0: api.bandForTrack(entry.trackId, 0),
        band3: api.bandForTrack(entry.trackId, 3),
        band5: api.bandForTrack(entry.trackId, 5),
        band6: api.bandForTrack(entry.trackId, 6),
        prompt3: api.promptForTrack(entry.trackId, 3),
        misfireRule: view.misfireRule,
        kind: presentation.tracks[0].kind
      };
    });
  }, LOAD_PRESENTATIONS);

  summary.forEach((entry, index) => {
    const expected = LOAD_PRESENTATIONS[index];
    expect(entry.ladderLabels).toEqual(expected.bands);
    expect(entry.band0).toBe(expected.bands[0]);
    expect(entry.band3).toBe(expected.bands[1]);
    expect(entry.band5).toBe(expected.bands[2]);
    expect(entry.band6).toBe(expected.bands[3]);
    expect(entry.prompt3).toContain("No modifier");
    expect(entry.misfireRule).toContain("Misfire fills");
    expect(entry.kind).toBe(expected.kind);
  });
});

test("blood surge spend reduces load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "sanguine.blood_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "blood_surge_spend");
    return {
      load: pressure.readTrackValue(spent, "sanguine.blood_load"),
      active: spent.presentationAbilityState.sanguine.bloodSurge.active,
      mode: spent.presentationAbilityState.sanguine.bloodSurge.mode,
      bonus: abilities.bloodSurgeRollBonus(spent, "Body"),
      cleared: abilities.bloodSurgeRollBonus(abilities.consumeBloodSurgeOnRoll(spent), "Body")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.mode).toBe("spend");
  expect(summary.bonus).toBe(1);
  expect(summary.cleared).toBe(0);
});

test("wraith haunt interface exposes player-owned locus and tether fields", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const abilities = window.PresentationAbilities;
    const view = abilities.presentationAbilityView(
      abilities.normalizePresentationAbilityState({
        ontologyPresentation: "Wraith-Touched / Anchor-Bound",
        presentationPressures: { "wraith.essence_load": 3 },
        presentationAbilityState: {
          wraith: {
            primaryLocus: "1978 Monte Carlo",
            locusScale: "Vehicle",
            tethers: [{ id: "t1", name: "Silver Locket", type: "Object", essence: "1", status: "Intact" }]
          }
        }
      }),
      "WRAITH_TOUCHED_ANCHOR_BOUND"
    );
    return {
      displayLabel: view.displayLabel,
      haunt: view.hauntInterface.enabled,
      locus: view.runtimeState.primaryLocus,
      passiveCount: view.passivePermissions.length,
      activeNames: view.activeAbilities.map((entry) => entry.name),
      tether: view.runtimeState.tethers[0]?.name
    };
  });
  expect(summary.haunt).toBe(true);
  expect(summary.displayLabel).toContain("Wraith");
  expect(summary.locus).toBe("1978 Monte Carlo");
  expect(summary.passiveCount).toBe(3);
  expect(summary.activeNames).toContain("Poltergeist Touch");
  expect(summary.activeNames).toContain("Anchor Pull");
  expect(summary.tether).toBe("Silver Locket");
});

test("sanguine presentation permissions expose blood surge and band-linked collapse", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const coherent = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "sanguine.blood_load": 3 } }),
      "SANGUINE"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "sanguine.blood_load": 5 } }),
      "SANGUINE"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "sanguine.blood_load": 6 } }),
      "SANGUINE"
    );
    return {
      headline: coherent.headlineAbility?.name,
      surgeEffect: coherent.headlineAbility?.effect,
      passiveNames: coherent.passivePermissions.map((entry) => entry.name),
      activeNames: coherent.activeAbilities.map((entry) => entry.name),
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus,
      accessTier: coherent.accessTier,
      identityLine: coherent.identityLine
    };
  });
  expect(summary.headline).toBe("Blood Surge");
  expect(summary.surgeEffect).toContain("+1");
  expect(summary.passiveNames).toEqual(["Blood Sense", "Blood-Warm Recovery"]);
  expect(summary.activeNames).toEqual(["Blood Surge", "Closing Burst"]);
  expect(summary.edgeBand).toBe("Predatory Saturation");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("Hunger Takes the Wheel");
  expect(summary.collapseBonus).toContain("+2");
  expect(summary.accessTier).toBe("handler_approval");
  expect(summary.identityLine).toContain("too fast");
});

test("sanguine blood load derives state, mechanics, and band ladder from fill level", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const presentation = api.presentationById("sanguine");
    const status = api.migrateOperatorStatus({
      bloodLoad: "4",
      presentationPressures: { "sanguine.blood_load": 4 }
    });
    const view = api.presentationPressureView(status, "SANGUINE");
    return {
      trackLabel: presentation.trackLabel,
      band0: api.bandForTrack("sanguine.blood_load", 0),
      band1: api.bandForTrack("sanguine.blood_load", 1),
      band2: api.bandForTrack("sanguine.blood_load", 2),
      band4: api.bandForTrack("sanguine.blood_load", 4),
      band5: api.bandForTrack("sanguine.blood_load", 5),
      band6: api.bandForTrack("sanguine.blood_load", 6),
      helps5: api.helpsForTrack("sanguine.blood_load", 5),
      hurts0: api.hurtsForTrack("sanguine.blood_load", 0),
      prompt4: api.promptForTrack("sanguine.blood_load", 4),
      bloodLoadBand: api.bloodLoadBand(3),
      modifierRule: view.modifierRule,
      misfireRule: view.misfireRule,
      condition: view.condition,
      ladderLabels: view.bandLadder.map((entry) => entry.label)
    };
  });
  expect(summary.trackLabel).toBe("Blood Load");
  expect(summary.band0).toBe("Starving");
  expect(summary.band1).toBe("Starving");
  expect(summary.band2).toBe("Coherent");
  expect(summary.band4).toBe("Coherent");
  expect(summary.band5).toBe("Predatory Saturation");
  expect(summary.band6).toBe("Collapse Risk");
  expect(summary.helps5).toContain("Body force");
  expect(summary.hurts0).toContain("Nerves restraint");
  expect(summary.prompt4).toContain("No modifier");
  expect(summary.bloodLoadBand).toBe("Coherent");
  expect(summary.modifierRule).toContain("Load applies");
  expect(summary.misfireRule).toContain("Misfire fills Blood Load");
  expect(summary.condition).toBe("Coherent");
  expect(summary.ladderLabels).toEqual([
    "Starving",
    "Coherent",
    "Predatory Saturation",
    "Collapse Risk"
  ]);
});

test("sanguine fill meter maps each level to one state", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    return [0, 1, 2, 3, 4, 5, 6].map((level) => api.resolveSanguineCondition({}, level).label);
  });
  expect(summary).toEqual([
    "Starving",
    "Starving",
    "Coherent",
    "Coherent",
    "Coherent",
    "Predatory Saturation",
    "Collapse Risk"
  ]);
});

test("misfire blood load delta fills the cup and formats table copy", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const status = api.migrateOperatorStatus({
      operatorName: "Knox",
      bloodLoad: "3",
      presentationPressures: { "sanguine.blood_load": 3 }
    });
    const severeDelta = api.misfireBloodLoadDelta("Severe");
    const minorDelta = api.misfireBloodLoadDelta("Minor");
    const next = api.adjustBloodLoad(status, severeDelta);
    const copy = api.formatBloodLoadMisfireTableCopy({
      status: next,
      operatorName: "Knox",
      delta: severeDelta,
      beforeValue: 3,
      afterValue: api.readTrackValue(next, "sanguine.blood_load")
    });
    return {
      severeDelta,
      minorDelta,
      afterValue: api.readTrackValue(next, "sanguine.blood_load"),
      afterBand: api.bloodLoadBand(api.readTrackValue(next, "sanguine.blood_load")),
      copy
    };
  });
  expect(summary.severeDelta).toBe(2);
  expect(summary.minorDelta).toBe(1);
  expect(summary.afterValue).toBe(5);
  expect(summary.afterBand).toBe("Predatory Saturation");
  expect(summary.copy).toContain("Knox: Blood Load rises by 2");
  expect(summary.copy).toContain("Coherent -> Predatory Saturation");
  expect(summary.copy).toContain("warmer than the room");
});

test("wraith essence load uses safe-middle fill bands and mechanics", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const status = api.migrateOperatorStatus({
      essenceLoad: "4",
      presentationPressures: { "wraith.essence_load": 4 }
    });
    const migrated = api.migrateOperatorStatus({
      presentationPressures: { "wraith.anchoring": 0 }
    });
    const view = api.presentationPressureView(status, "WRAITH_TOUCHED_ANCHOR_BOUND");
    return {
      band0: api.bandForTrack("wraith.essence_load", 0),
      band1: api.bandForTrack("wraith.essence_load", 1),
      band4: api.bandForTrack("wraith.essence_load", 4),
      band5: api.bandForTrack("wraith.essence_load", 5),
      helps5: api.helpsForTrack("wraith.essence_load", 5),
      prompt2: api.promptForTrack("wraith.essence_load", 2),
      migrated: api.readTrackValue(migrated, "wraith.essence_load"),
      viewBand: view.band,
      modifierRule: view.modifierRule,
      misfireRule: view.misfireRule,
      ladderLabels: view.bandLadder.map((entry) => entry.label),
      fillMap: [0, 1, 2, 3, 4, 5, 6].map((level) => api.resolveWraithCondition({}, level).label)
    };
  });
  expect(summary.band0).toBe("Fading");
  expect(summary.band1).toBe("Fading");
  expect(summary.band4).toBe("Anchored");
  expect(summary.band5).toBe("Possessive Saturation");
  expect(summary.helps5).toContain("Presence intimidation");
  expect(summary.prompt2).toContain("No modifier");
  expect(summary.migrated).toBe(3);
  expect(summary.viewBand).toBe("Anchored");
  expect(summary.modifierRule).toContain("Load applies");
  expect(summary.misfireRule).toContain("Misfire fills Essence Load");
  expect(summary.ladderLabels).toEqual([
    "Fading",
    "Anchored",
    "Possessive Saturation",
    "Haunting Risk"
  ]);
  expect(summary.fillMap).toEqual([
    "Fading",
    "Fading",
    "Anchored",
    "Anchored",
    "Anchored",
    "Possessive Saturation",
    "Haunting Risk"
  ]);
});

test("misfire essence load delta fills the cup and formats table copy", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const status = api.migrateOperatorStatus({
      operatorName: "Mara",
      essenceLoad: "4",
      presentationPressures: { "wraith.essence_load": 4 }
    });
    const delta = api.misfireEssenceLoadDelta("Severe");
    const next = api.adjustEssenceLoad(status, delta);
    const copy = api.formatEssenceLoadMisfireTableCopy({
      status: next,
      operatorName: "Mara",
      eventLabel: "Mara drains ghost essence",
      delta,
      beforeValue: 4,
      afterValue: api.readTrackValue(next, "wraith.essence_load")
    });
    return {
      delta,
      afterBand: api.essenceLoadBand(api.readTrackValue(next, "wraith.essence_load")),
      copy
    };
  });
  expect(summary.delta).toBe(1);
  expect(summary.afterBand).toBe("Possessive Saturation");
  expect(summary.copy).toContain("Mara drains ghost essence");
  expect(summary.copy).toContain("Anchored -> Possessive Saturation");
  expect(summary.copy).toContain("not hers");
});

test("echo load migrates legacy drift track and formats generic misfire copy", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const migrated = api.migrateOperatorStatus({
      presentationPressures: { "echo.drift": 5 },
      echoRecursionPressure: "5"
    });
    const delta = api.misfireLoadDelta("echo", "Major");
    const status = api.migrateOperatorStatus({
      operatorName: "Rin",
      presentationPressures: { "echo.echo_load": 4 }
    });
    const next = api.adjustTrackLoad(status, "echo.echo_load", delta);
    const copy = api.formatLoadMisfireTableCopy("echo", {
      status: next,
      operatorName: "Rin",
      eventLabel: "Misfire resonance surge",
      delta,
      beforeValue: 4,
      afterValue: api.readTrackValue(next, "echo.echo_load")
    });
    return {
      migratedValue: api.readTrackValue(migrated, "echo.echo_load"),
      migratedBand: api.bandForTrack("echo.echo_load", api.readTrackValue(migrated, "echo.echo_load")),
      afterBand: api.presentationLoadBand("echo", api.readTrackValue(next, "echo.echo_load")),
      trackLabel: api.presentationById("echo").trackLabel,
      copy
    };
  });
  expect(summary.migratedValue).toBe(5);
  expect(summary.migratedBand).toBe("Continuity Saturation");
  expect(summary.afterBand).toBe("Continuity Saturation");
  expect(summary.trackLabel).toBe("Echo Load");
  expect(summary.copy).toContain("Echo Load +1");
  expect(summary.copy).toContain("last move again");
});

test("void load migrates legacy contamination track", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const migrated = api.migrateOperatorStatus({
      voidShardContamination: "5",
      presentationPressures: { "void_shard.contamination": 5 }
    });
    return {
      value: api.readTrackValue(migrated, "void_shard.void_load"),
      band: api.bandForTrack("void_shard.void_load", api.readTrackValue(migrated, "void_shard.void_load"))
    };
  });
  expect(summary.value).toBe(5);
  expect(summary.band).toBe("Contamination Bloom");
});

test("load roll modifiers use the universal 0/-1, 5 +/-1, 6 +/-2 spine", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const starving = { presentationPressures: { "sanguine.blood_load": 1 } };
    const coherent = { presentationPressures: { "sanguine.blood_load": 3 } };
    const saturated = { presentationPressures: { "sanguine.blood_load": 5 } };
    const collapse = { presentationPressures: { "sanguine.blood_load": 6 } };
    return {
      starvingNerves: api.rollLoadModifiers(starving, "SANGUINE", "Nerves", ""),
      starvingInstinct: api.rollLoadModifiers(starving, "SANGUINE", "Instinct", ""),
      starvingBody: api.rollLoadModifiers(starving, "SANGUINE", "Body", ""),
      coherentBody: api.rollLoadModifiers(coherent, "SANGUINE", "Body", ""),
      saturatedBody: api.rollLoadModifiers(saturated, "SANGUINE", "Body", ""),
      saturatedNerves: api.rollLoadModifiers(saturated, "SANGUINE", "Nerves", ""),
      collapseBody: api.rollLoadModifiers(collapse, "SANGUINE", "Body", ""),
      collapseNerves: api.rollLoadModifiers(collapse, "SANGUINE", "Nerves", ""),
      therianLowInstinct: api.rollLoadModifiers(
        { presentationPressures: { "therian.instinct_load": 1 } },
        "THERIAN_ADAPTATION",
        "Instinct",
        "Survival"
      )
    };
  });
  expect(summary.starvingNerves.hurtDelta).toBe(1);
  expect(summary.starvingNerves.helpDelta).toBe(0);
  expect(summary.starvingNerves.delta).toBe(-1);
  expect(summary.starvingInstinct.helpDelta).toBe(1);
  expect(summary.starvingInstinct.hurtDelta).toBe(0);
  expect(summary.starvingInstinct.delta).toBe(1);
  expect(summary.starvingBody.active).toBe(false);
  expect(summary.coherentBody.active).toBe(false);
  expect(summary.saturatedBody.helpDelta).toBe(1);
  expect(summary.saturatedBody.delta).toBe(1);
  expect(summary.saturatedNerves.hurtDelta).toBe(1);
  expect(summary.saturatedNerves.delta).toBe(-1);
  expect(summary.collapseBody.helpDelta).toBe(2);
  expect(summary.collapseBody.delta).toBe(2);
  expect(summary.collapseBody.handlerFramed).toBe(true);
  expect(summary.collapseNerves.hurtDelta).toBe(2);
  expect(summary.collapseNerves.delta).toBe(-2);
  expect(summary.therianLowInstinct.hurtDelta).toBe(1);
  expect(summary.therianLowInstinct.helpDelta).toBe(0);
  expect(summary.therianLowInstinct.delta).toBe(-1);
});

test("load pip styles use horizontal grid and presentation tint variables", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const mount = document.createElement("div");
    mount.innerHTML = `
      <article class="line-tracker echo_load fill-meter presentation-echo load-band-regulated">
        <div class="line-pips echo-load-pips">
          <button class="pip is-filled" type="button"></button>
          <button class="pip is-filled" type="button"></button>
          <button class="pip is-filled" type="button"></button>
          <button class="pip" type="button"></button>
          <button class="pip" type="button"></button>
          <button class="pip" type="button"></button>
        </div>
      </article>
    `;
    document.body.append(mount);
    const tracker = mount.querySelector(".line-tracker.echo_load");
    const pips = mount.querySelector(".echo-load-pips");
    const first = mount.querySelector(".pip");
    const pipStyle = getComputedStyle(pips);
    const filledStyle = getComputedStyle(first);
    const result = {
      gridTemplateColumns: pipStyle.gridTemplateColumns,
      filledBackground: filledStyle.backgroundColor,
      echoAccent: getComputedStyle(tracker).getPropertyValue("--load-pip-5").trim()
    };
    mount.remove();
    return result;
  });
  expect(summary.gridTemplateColumns.split(/\s+/).filter(Boolean).length).toBe(6);
  expect(summary.filledBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(summary.echoAccent).toBe("#00b8a8");
});

test("hollow silence-altered permissions expose leave a blank and slip notice", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const tuned = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "silence.silence_load": 3 } }),
      "HOLLOW_SILENCE_ALTERED"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "silence.silence_load": 5 } }),
      "HOLLOW_SILENCE_ALTERED"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "silence.silence_load": 6 } }),
      "HOLLOW_SILENCE_ALTERED"
    );
    return {
      headline: tuned.headlineAbility?.name,
      passiveNames: tuned.passivePermissions.map((entry) => entry.name),
      activeNames: tuned.activeAbilities.map((entry) => entry.name),
      accessTier: tuned.accessTier,
      identityLine: tuned.identityLine,
      trackLabel: tuned.pressureTrack.trackLabel,
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus
    };
  });
  expect(summary.headline).toBe("Leave a Blank");
  expect(summary.passiveNames).toEqual(["Omitted Presence", "Quiet Cut"]);
  expect(summary.activeNames).toEqual(["Leave a Blank", "Slip Notice"]);
  expect(summary.accessTier).toBe("open");
  expect(summary.identityLine).toContain("Too quiet");
  expect(summary.trackLabel).toBe("Silence Load");
  expect(summary.edgeBand).toBe("Negative Space");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("The Missing Part Wins");
  expect(summary.collapseBonus).toContain("+2");
});

test("slip notice spend reduces silence load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "silence.silence_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "slip_notice_spend");
    return {
      load: pressure.readTrackValue(spent, "silence.silence_load"),
      active: spent.presentationAbilityState.silence.slipNotice.active,
      bonus: abilities.slipNoticeRollBonus(spent, "Agility"),
      cleared: abilities.slipNoticeRollBonus(abilities.consumeSlipNoticeOnRoll(spent), "Agility")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.bonus).toBe(1);
  expect(summary.cleared).toBe(0);
});

test("technomancer daemon-aligned permissions expose soft override and daemon push", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const linked = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "technomancer.signal_load": 3 } }),
      "TECHNOMANCER_DAEMON_ALIGNED"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "technomancer.signal_load": 5 } }),
      "TECHNOMANCER_DAEMON_ALIGNED"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "technomancer.signal_load": 6 } }),
      "TECHNOMANCER_DAEMON_ALIGNED"
    );
    return {
      headline: linked.headlineAbility?.name,
      passiveNames: linked.passivePermissions.map((entry) => entry.name),
      activeNames: linked.activeAbilities.map((entry) => entry.name),
      accessTier: linked.accessTier,
      identityLine: linked.identityLine,
      trackLabel: linked.pressureTrack.trackLabel,
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus
    };
  });
  expect(summary.headline).toBe("Soft Override");
  expect(summary.passiveNames).toEqual(["Signal Sight", "Interface Sympathy"]);
  expect(summary.activeNames).toEqual(["Soft Override", "Daemon Push"]);
  expect(summary.accessTier).toBe("open");
  expect(summary.identityLine).toContain("Too connected");
  expect(summary.trackLabel).toBe("Signal Load");
  expect(summary.edgeBand).toBe("Overclocked Link");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("The System Writes Back");
  expect(summary.collapseBonus).toContain("+2");
});

test("therian adaptation permissions expose claim ground and feral drive", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const integrated = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "therian.instinct_load": 3 } }),
      "THERIAN_ADAPTATION"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "therian.instinct_load": 5 } }),
      "THERIAN_ADAPTATION"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "therian.instinct_load": 6 } }),
      "THERIAN_ADAPTATION"
    );
    return {
      headline: integrated.headlineAbility?.name,
      passiveNames: integrated.passivePermissions.map((entry) => entry.name),
      activeNames: integrated.activeAbilities.map((entry) => entry.name),
      accessTier: integrated.accessTier,
      identityLine: integrated.identityLine,
      trackLabel: integrated.pressureTrack.trackLabel,
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus
    };
  });
  expect(summary.headline).toBe("Claim Ground");
  expect(summary.passiveNames).toEqual(["Animal Read", "Body Memory"]);
  expect(summary.activeNames).toEqual(["Claim Ground", "Feral Drive"]);
  expect(summary.accessTier).toBe("open");
  expect(summary.identityLine).toContain("Too alert");
  expect(summary.trackLabel).toBe("Instinct Load");
  expect(summary.edgeBand).toBe("Hunting Pitch");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("The Body Decides");
  expect(summary.collapseBonus).toContain("+2");
});

test("feral drive spend reduces instinct load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "therian.instinct_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "feral_drive_spend");
    return {
      load: pressure.readTrackValue(spent, "therian.instinct_load"),
      active: spent.presentationAbilityState.therian.feralDrive.active,
      bonus: abilities.feralDriveRollBonus(spent, "Instinct"),
      wrongAttr: abilities.feralDriveRollBonus(spent, "Mind"),
      cleared: abilities.feralDriveRollBonus(abilities.consumeFeralDriveOnRoll(spent), "Instinct")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.bonus).toBe(1);
  expect(summary.wrongAttr).toBe(0);
  expect(summary.cleared).toBe(0);
});

test("daemon push spend reduces signal load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "technomancer.signal_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "daemon_push_spend");
    return {
      load: pressure.readTrackValue(spent, "technomancer.signal_load"),
      active: spent.presentationAbilityState.technomancer.daemonPush.active,
      bonus: abilities.daemonPushRollBonus(spent, "Mind"),
      wrongAttr: abilities.daemonPushRollBonus(spent, "Body"),
      cleared: abilities.daemonPushRollBonus(abilities.consumeDaemonPushOnRoll(spent), "Mind")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.bonus).toBe(1);
  expect(summary.wrongAttr).toBe(0);
  expect(summary.cleared).toBe(0);
});

test("echo-altered permissions expose replay slip and second pass", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const tuned = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "echo.echo_load": 3 } }),
      "ECHO_ALTERED"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "echo.echo_load": 5 } }),
      "ECHO_ALTERED"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "echo.echo_load": 6 } }),
      "ECHO_ALTERED"
    );
    return {
      headline: tuned.headlineAbility?.name,
      passiveNames: tuned.passivePermissions.map((entry) => entry.name),
      activeNames: tuned.activeAbilities.map((entry) => entry.name),
      accessTier: tuned.accessTier,
      identityLine: tuned.identityLine,
      trackLabel: tuned.pressureTrack.trackLabel,
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus
    };
  });
  expect(summary.headline).toBe("Replay Slip");
  expect(summary.passiveNames).toEqual(["Echo Recognition", "Residual Familiarity"]);
  expect(summary.activeNames).toEqual(["Replay Slip", "Second Pass"]);
  expect(summary.accessTier).toBe("open");
  expect(summary.identityLine).toContain("Too familiar");
  expect(summary.trackLabel).toBe("Echo Load");
  expect(summary.edgeBand).toBe("Continuity Saturation");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("The Loop Closes");
  expect(summary.collapseBonus).toContain("+2");
});

test("second pass spend reduces echo load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "echo.echo_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "second_pass_spend");
    return {
      load: pressure.readTrackValue(spent, "echo.echo_load"),
      active: spent.presentationAbilityState.echo.secondPass.active,
      bonus: abilities.secondPassRollBonus(spent, "Mind"),
      cleared: abilities.secondPassRollBonus(abilities.consumeSecondPassOnRoll(spent), "Mind")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.bonus).toBe(1);
  expect(summary.cleared).toBe(0);
});

test("resonant sensitive permissions expose bad room read and resonant read", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const tuned = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "sensitive.sensory_load": 3 } }),
      "RESONANT_SENSITIVE"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "sensitive.sensory_load": 5 } }),
      "RESONANT_SENSITIVE"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "sensitive.sensory_load": 6 } }),
      "RESONANT_SENSITIVE"
    );
    return {
      headline: tuned.headlineAbility?.name,
      passiveNames: tuned.passivePermissions.map((entry) => entry.name),
      activeNames: tuned.activeAbilities.map((entry) => entry.name),
      accessTier: tuned.accessTier,
      identityLine: tuned.identityLine,
      trackLabel: tuned.pressureTrack.trackLabel,
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus
    };
  });
  expect(summary.headline).toBe("Bad Room Read");
  expect(summary.passiveNames).toEqual(["Pressure Sense", "Signal Bruising"]);
  expect(summary.activeNames).toEqual(["Bad Room Read", "Resonant Read"]);
  expect(summary.accessTier).toBe("open");
  expect(summary.identityLine).toContain("Too aware");
  expect(summary.trackLabel).toBe("Resonance Load");
  expect(summary.edgeBand).toBe("Over-Tuned");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("The Signal Reads Back");
  expect(summary.collapseBonus).toContain("+2");
});

test("resonant read spend reduces load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "sensitive.sensory_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "resonant_read_spend");
    return {
      load: pressure.readTrackValue(spent, "sensitive.sensory_load"),
      active: spent.presentationAbilityState.sensitive.resonantRead.active,
      bonus: abilities.resonantReadRollBonus(spent, "Instinct"),
      cleared: abilities.resonantReadRollBonus(abilities.consumeResonantReadOnRoll(spent), "Instinct")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.bonus).toBe(1);
  expect(summary.cleared).toBe(0);
});

test("recovery checkboxes resolve deterministically on next round", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const abilities = window.PresentationAbilities;
    const pressure = window.PresentationPressure;
    let status = pressure.migrateOperatorStatus({
      stability: "6",
      harmBoxes: "2",
      recoveryGround: true,
      presentationPressures: { "sanguine.blood_load": 3 },
      ontologyPresentation: "Sanguine"
    });
    status = abilities.applySceneTimerAction(status, "next_round", { catalogKey: "SANGUINE" });
    return {
      stability: status.stability,
      round: status.sceneTimer.round,
      log: status.sceneTimer.log[0] || ""
    };
  });
  expect(summary.stability).toBe("7");
  expect(summary.round).toBe(2);
  expect(summary.log).toContain("Ground resolved");
  expect(summary.log).toContain("Stability +1");
});

test("treat harm creates pending timer and resolves harm on next round", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const abilities = window.PresentationAbilities;
    const pressure = window.PresentationPressure;
    let status = pressure.migrateOperatorStatus({
      harmBoxes: "2",
      attentionState: "Noticed",
      presentationPressures: { "sanguine.blood_load": 3 },
      ontologyPresentation: "Sanguine"
    });
    status = abilities.applyPresentationAbilityAction(status, "treat_harm_start", { catalogKey: "SANGUINE" });
    const pending = status.sceneTimer.timers.some((timer) => timer.abilityId === "treat_harm");
    status = abilities.applySceneTimerAction(status, "next_round", { catalogKey: "SANGUINE" });
    return {
      pending,
      harm: status.harmBoxes,
      harmRecovered: status.sceneTimer.harmRecoveredThisScene,
      log: status.sceneTimer.log[0] || ""
    };
  });
  expect(summary.pending).toBe(true);
  expect(summary.harm).toBe("1");
  expect(summary.harmRecovered).toBe(true);
  expect(summary.log).toContain("Treat Harm resolved");
});

test("breathe clears blood surge before stabilizing", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const abilities = window.PresentationAbilities;
    const pressure = window.PresentationPressure;
    let status = pressure.migrateOperatorStatus({
      stability: "6",
      recoveryBreathe: true,
      presentationAbilityState: {
        sanguine: { bloodSurge: { active: true, mode: "risk", riskQueued: true } }
      }
    });
    status = abilities.applySceneTimerAction(status, "next_round", { catalogKey: "SANGUINE" });
    return {
      stability: status.stability,
      surgeActive: status.presentationAbilityState.sanguine.bloodSurge.active,
      log: status.sceneTimer.log[0] || ""
    };
  });
  expect(summary.stability).toBe("6");
  expect(summary.surgeActive).toBe(false);
  expect(summary.log).toContain("Cleared temporary pressure tag");
});

test("handler summary formats coherent blood load at four", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const status = api.migrateOperatorStatus({
      presentationPressures: { "sanguine.blood_load": 4 }
    });
    return api.handlerSummaryText(status, "SANGUINE");
  });
  expect(summary).toContain("Blood Load 4/6 (Coherent)");
});

test("presentation drift tiers follow the universal 1-2, 3-4, 5+ scale", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const drift = window.PresentationDrift;
    return {
      surface: drift.driftTierForValue(2)?.id,
      scar: drift.driftTierForValue(4)?.id,
      deep: drift.driftTierForValue(6)?.id,
      zero: drift.driftTierForValue(0)
    };
  });
  expect(summary.surface).toBe("surface_tell");
  expect(summary.scar).toBe("persistent_scar");
  expect(summary.deep).toBe("deep_drift");
  expect(summary.zero).toBeNull();
});

test("collapse drift resolve increments only at load 6", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const drift = window.PresentationDrift;
    const atFive = pressure.migrateOperatorStatus({
      presentationPressures: { "sanguine.blood_load": 5 }
    });
    const blocked = drift.applyCollapseDriftResolve(atFive, "SANGUINE");
    const atSix = pressure.migrateOperatorStatus({
      presentationPressures: { "sanguine.blood_load": 6 }
    });
    const resolved = drift.applyCollapseDriftResolve(atSix, "SANGUINE");
    return {
      blocked: blocked.ok,
      blockedReason: blocked.reason,
      value: drift.readDriftValue(resolved.status, "sanguine"),
      tier: resolved.tier?.label,
      tagline: drift.presentationDriftView(resolved.status, "SANGUINE")?.tagline
    };
  });
  expect(summary.blocked).toBe(false);
  expect(summary.blockedReason).toContain("Load 6");
  expect(summary.value).toBe(1);
  expect(summary.tier).toBe("Surface Tell");
  expect(summary.tagline).toContain("body remembers hunger");
});

test("sanguine drift exposes cumulative scars by tier", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const drift = window.PresentationDrift;
    const atTwo = drift.presentationDriftView(
      drift.normalizePresentationDrift({
        presentationDrift: { byPresentation: { sanguine: { value: 2, log: [] } } }
      }),
      "SANGUINE"
    );
    const atFour = drift.presentationDriftView(
      drift.normalizePresentationDrift({
        presentationDrift: { byPresentation: { sanguine: { value: 4, log: [] } } }
      }),
      "SANGUINE"
    );
    const atFive = drift.presentationDriftView(
      drift.normalizePresentationDrift({
        presentationDrift: { byPresentation: { sanguine: { value: 5, log: [] } } }
      }),
      "SANGUINE"
    );
    return {
      twoCount: atTwo.accumulatedScars.length,
      fourCount: atFour.accumulatedScars.length,
      fiveHasEvolution: atFive.accumulatedScars.some((entry) => entry.id === "sanguine_evolution"),
      fiveTier: atFive.tier?.id
    };
  });
  expect(summary.twoCount).toBe(2);
  expect(summary.fourCount).toBe(4);
  expect(summary.fiveHasEvolution).toBe(true);
  expect(summary.fiveTier).toBe("deep_drift");
});

test("vessel permissions expose let it look and borrowed force", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const contained = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "vessel.containment_load": 3 } }),
      "VESSEL"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "vessel.containment_load": 5 } }),
      "VESSEL"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "vessel.containment_load": 6 } }),
      "VESSEL"
    );
    return {
      headline: contained.headlineAbility?.name,
      passiveNames: contained.passivePermissions.map((entry) => entry.name),
      activeNames: contained.activeAbilities.map((entry) => entry.name),
      accessTier: contained.accessTier,
      identityLine: contained.identityLine,
      trackLabel: contained.pressureTrack.trackLabel,
      containedType: contained.runtimeState.containedType,
      containmentEnabled: contained.containmentInterface?.enabled,
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus
    };
  });
  expect(summary.headline).toBe("Let It Look");
  expect(summary.passiveNames).toEqual(["Inner Pressure", "Sealed Resilience"]);
  expect(summary.activeNames).toEqual(["Let It Look", "Borrowed Force"]);
  expect(summary.accessTier).toBe("handler_approval");
  expect(summary.identityLine).toContain("Too full");
  expect(summary.trackLabel).toBe("Containment Load");
  expect(summary.containedType).toBe("unknown");
  expect(summary.containmentEnabled).toBe(true);
  expect(summary.edgeBand).toBe("Seal Strain");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("Something Opens Its Eyes");
  expect(summary.collapseBonus).toContain("+2");
});

test("borrowed force spend reduces containment load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "vessel.containment_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "borrowed_force_spend");
    return {
      load: pressure.readTrackValue(spent, "vessel.containment_load"),
      active: spent.presentationAbilityState.vessel.borrowedForce.active,
      bonus: abilities.borrowedForceRollBonus(spent, "Presence"),
      wrongAttr: abilities.borrowedForceRollBonus(spent, "Agility"),
      cleared: abilities.borrowedForceRollBonus(abilities.consumeBorrowedForceOnRoll(spent), "Presence")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.bonus).toBe(1);
  expect(summary.wrongAttr).toBe(0);
  expect(summary.cleared).toBe(0);
});

test("vessel drift resolves from load 6 collapse", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const drift = window.PresentationDrift;
    const resolved = drift.applyCollapseDriftResolve(
      pressure.migrateOperatorStatus({ presentationPressures: { "vessel.containment_load": 6 } }),
      "VESSEL"
    );
    return {
      value: drift.readDriftValue(resolved.status, "vessel"),
      tagline: drift.presentationDriftView(resolved.status, "VESSEL")?.tagline,
      evolutionWarning: drift.presentationDriftView(
        drift.normalizePresentationDrift({
          presentationDrift: { byPresentation: { vessel: { value: 5, log: [] } } }
        }),
        "VESSEL"
      )?.value
    };
  });
  expect(summary.value).toBe(1);
  expect(summary.tagline).toContain("door is");
  expect(summary.evolutionWarning).toBe(5);
});

test("construct permissions expose execute directive and function surge", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const contained = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "construct.function_load": 3 } }),
      "CONSTRUCT"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "construct.function_load": 5 } }),
      "CONSTRUCT"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "construct.function_load": 6 } }),
      "CONSTRUCT"
    );
    return {
      headline: contained.headlineAbility?.name,
      passiveNames: contained.passivePermissions.map((entry) => entry.name),
      activeNames: contained.activeAbilities.map((entry) => entry.name),
      accessTier: contained.accessTier,
      identityLine: contained.identityLine,
      trackLabel: contained.pressureTrack.trackLabel,
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus
    };
  });
  expect(summary.headline).toBe("Execute Directive");
  expect(summary.passiveNames).toEqual(["Diagnostic Sense", "Built To Continue"]);
  expect(summary.activeNames).toEqual(["Execute Directive", "Function Surge"]);
  expect(summary.accessTier).toBe("handler_approval");
  expect(summary.identityLine).toContain("Too useful");
  expect(summary.trackLabel).toBe("Function Load");
  expect(summary.edgeBand).toBe("Purpose Lock");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("The Directive Overrides");
  expect(summary.collapseBonus).toContain("+2");
});

test("function surge spend reduces function load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "construct.function_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "function_surge_spend");
    return {
      load: pressure.readTrackValue(spent, "construct.function_load"),
      active: spent.presentationAbilityState.construct.functionSurge.active,
      bonus: abilities.functionSurgeRollBonus(spent, "Mind"),
      wrongAttr: abilities.functionSurgeRollBonus(spent, "Agility"),
      cleared: abilities.functionSurgeRollBonus(abilities.consumeFunctionSurgeOnRoll(spent), "Mind")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.bonus).toBe(1);
  expect(summary.wrongAttr).toBe(0);
  expect(summary.cleared).toBe(0);
});

test("construct drift resolves from load 6 collapse", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const drift = window.PresentationDrift;
    const resolved = drift.applyCollapseDriftResolve(
      pressure.migrateOperatorStatus({ presentationPressures: { "construct.function_load": 6 } }),
      "CONSTRUCT"
    );
    return {
      value: drift.readDriftValue(resolved.status, "construct"),
      tagline: drift.presentationDriftView(resolved.status, "CONSTRUCT")?.tagline,
      evolution: drift.presentationDriftView(
        drift.normalizePresentationDrift({
          presentationDrift: { byPresentation: { construct: { value: 5, log: [] } } }
        }),
        "CONSTRUCT"
      )?.accumulatedScars.some((entry) => entry.id === "construct_evolution")
    };
  });
  expect(summary.value).toBe(1);
  expect(summary.tagline).toContain("purpose found");
  expect(summary.evolution).toBe(true);
});

test("void-shard permissions expose break pattern and anomaly push", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const contained = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "void_shard.void_load": 3 } }),
      "VOID_SHARD"
    );
    const edge = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "void_shard.void_load": 5 } }),
      "VOID_SHARD"
    );
    const collapse = abilities.presentationAbilityView(
      pressure.migrateOperatorStatus({ presentationPressures: { "void_shard.void_load": 6 } }),
      "VOID_SHARD"
    );
    return {
      headline: contained.headlineAbility?.name,
      passiveNames: contained.passivePermissions.map((entry) => entry.name),
      activeNames: contained.activeAbilities.map((entry) => entry.name),
      accessTier: contained.accessTier,
      identityLine: contained.identityLine,
      trackLabel: contained.pressureTrack.trackLabel,
      edgeBand: edge.activeBandState?.bandLabel,
      edgeHelps: edge.activeBandState?.helps,
      collapseName: collapse.activeBandState?.name,
      collapseBonus: collapse.activeBandState?.bonus
    };
  });
  expect(summary.headline).toBe("Break Pattern");
  expect(summary.passiveNames).toEqual(["Breach Tolerance", "Wrongness Sense"]);
  expect(summary.activeNames).toEqual(["Break Pattern", "Anomaly Push"]);
  expect(summary.accessTier).toBe("handler_approval");
  expect(summary.identityLine).toContain("Too contaminated");
  expect(summary.trackLabel).toBe("Void Load");
  expect(summary.edgeBand).toBe("Contamination Bloom");
  expect(summary.edgeHelps).toContain("+1");
  expect(summary.collapseName).toBe("The Breach Answers");
  expect(summary.collapseBonus).toContain("+2");
});

test("anomaly push spend reduces void load and arms roll tag", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const abilities = window.PresentationAbilities;
    const status = pressure.migrateOperatorStatus({
      presentationPressures: { "void_shard.void_load": 4 }
    });
    const spent = abilities.applyPresentationAbilityAction(status, "anomaly_push_spend");
    return {
      load: pressure.readTrackValue(spent, "void_shard.void_load"),
      active: spent.presentationAbilityState.void_shard.anomalyPush.active,
      bonus: abilities.anomalyPushRollBonus(spent, "Instinct"),
      wrongAttr: abilities.anomalyPushRollBonus(spent, "Presence"),
      cleared: abilities.anomalyPushRollBonus(abilities.consumeAnomalyPushOnRoll(spent), "Instinct")
    };
  });
  expect(summary.load).toBe(3);
  expect(summary.active).toBe(true);
  expect(summary.bonus).toBe(1);
  expect(summary.wrongAttr).toBe(0);
  expect(summary.cleared).toBe(0);
});

test("void-shard drift resolves from load 6 collapse", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const pressure = window.PresentationPressure;
    const drift = window.PresentationDrift;
    const resolved = drift.applyCollapseDriftResolve(
      pressure.migrateOperatorStatus({ presentationPressures: { "void_shard.void_load": 6 } }),
      "VOID_SHARD"
    );
    return {
      value: drift.readDriftValue(resolved.status, "void_shard"),
      tagline: drift.presentationDriftView(resolved.status, "VOID_SHARD")?.tagline,
      evolution: drift.presentationDriftView(
        drift.normalizePresentationDrift({
          presentationDrift: { byPresentation: { void_shard: { value: 5, log: [] } } }
        }),
        "VOID_SHARD"
      )?.accumulatedScars.some((entry) => entry.id === "void_shard_evolution")
    };
  });
  expect(summary.value).toBe(1);
  expect(summary.tagline).toContain("wound learned");
  expect(summary.evolution).toBe(true);
});