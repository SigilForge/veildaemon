const { test, expect } = require("@playwright/test");

test("presentation pressure registry exposes nine ontology modules", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    return {
      count: api.presentations.length,
      sanguine: api.trackById("sanguine.hunger").label,
      voidShard: api.presentationById("void_shard").maxRisk,
      echoBand: api.bandForTrack("echo.drift", 4),
      maxRisk: api.formatBandLine(api.trackById("stillness.inertia"), 6)
    };
  });
  expect(summary.count).toBe(9);
  expect(summary.sanguine).toBe("Hunger");
  expect(summary.voidShard).toContain("perceived");
  expect(summary.echoBand).toBe("Loop");
  expect(summary.maxRisk).toContain("Stasis Lock");
});

test("sanguine hunger derives band, cue, risk, and condition from pressure value", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const presentation = api.presentationById("sanguine");
    const status = api.migrateOperatorStatus({
      hungerPressure: "2",
      presentationPressures: { "sanguine.hunger": 2 },
      sanguineSaturated: true
    });
    const view = api.presentationPressureView(status, "SANGUINE");
    return {
      trackLabel: presentation.trackLabel,
      hasConditionModel: presentation.conditionModel.separateConditions.length >= 4,
      band0: api.bandForTrack("sanguine.hunger", 0),
      band2: api.bandForTrack("sanguine.hunger", 2),
      band4: api.bandForTrack("sanguine.hunger", 4),
      cue2: api.cueForTrack("sanguine.hunger", 2),
      risk2: api.riskForTrack("sanguine.hunger", 2),
      coherence: api.coherenceFromHunger(3),
      maxRisk: presentation.maxRisk,
      condition: view.condition,
      conditionNote: view.conditionNote,
      cue: view.cue
    };
  });
  expect(summary.trackLabel).toBe("Hunger");
  expect(summary.hasConditionModel).toBe(true);
  expect(summary.band0).toBe("Coherent");
  expect(summary.band2).toBe("Hungry");
  expect(summary.band4).toBe("Predatory");
  expect(summary.cue2).toContain("Attention narrows");
  expect(summary.risk2).toContain("Failed restraint");
  expect(summary.coherence).toBe("Hungry");
  expect(summary.maxRisk).toContain("withdraw");
  expect(summary.condition).toBe("Saturated");
  expect(summary.conditionNote).toContain("emotional bleed");
  expect(summary.cue).toContain("pulse");
});

test("presentation modules expose distinct track labels and failure modes", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    return api.presentations.map((item) => ({
      id: item.id,
      trackLabel: item.trackLabel,
      maxRisk: item.maxRisk,
      reliefCount: item.reliefActions.fallsWhen.length
    }));
  });
  expect(summary.find((item) => item.id === "wraith").trackLabel).toBe("Anchor Strain");
  expect(summary.find((item) => item.id === "echo").trackLabel).toBe("Relevance Drift");
  expect(summary.find((item) => item.id === "void_shard").trackLabel).toBe("Miscompile");
  expect(summary.find((item) => item.id === "sanguine").maxRisk).toContain("Stability");
  expect(summary.find((item) => item.id === "stillness").maxRisk).toContain("escalate");
  expect(summary.every((item) => item.reliefCount > 0)).toBe(true);
});

test("registry resolves echo drift bands from operator status", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    const status = api.migrateOperatorStatus({
      ontologyPresentation: "Echo-Altered Presentation",
      echoRecursionPressure: "3"
    });
    return {
      cardLabel: api.presentationForCatalogKey("ECHO_ALTERED")?.cardLabel,
      value: api.readTrackValue(status, "echo.drift"),
      band: api.bandForTrack("echo.drift", 3),
      line: api.formatBandLine(api.trackById("echo.drift"), 3)
    };
  });
  expect(summary.cardLabel).toBe("Echo Pressure");
  expect(summary.value).toBe(3);
  expect(summary.band).toBe("Mimic");
  expect(summary.line).toBe("Mimic");
});

test("handler live risk strip shows presentation pressure summary", async ({ page }) => {
  await page.goto("/handler/live/");
  await page.evaluate(() => {
    const api = window.HandlerState;
    let state = api.readState();
    state.players = [{
      id: "operator-mara",
      name: "Mara",
      ontologyPresentation: "Sanguine Presentation",
      operatorStatus: {
        ontologyPresentation: "Sanguine Presentation",
        hungerPressure: "4",
        presentationPressures: { "sanguine.hunger": 4 }
      },
      stabilityBand: "Calm",
      harmBoxes: 0
    }];
    state = api.normalizeState(state);
    api.writeState(state);
  });
  await page.reload();
  await expect(page.locator("#operator-risk-strip")).toContainText("Mara");
  await expect(page.locator("#operator-risk-strip")).toContainText("Hunger 4/6 (Predatory)");
});