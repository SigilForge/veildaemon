const { test, expect } = require("@playwright/test");

test("presentation pressure registry exposes nine ontology modules", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    return {
      count: api.presentations.length,
      sanguine: api.trackById("sanguine.blood_load").label,
      voidShard: api.presentationById("void_shard").maxRisk,
      echoBand: api.bandForTrack("echo.drift", 4),
      maxRisk: api.formatBandLine(api.trackById("stillness.inertia"), 6)
    };
  });
  expect(summary.count).toBe(9);
  expect(summary.sanguine).toBe("Blood Load");
  expect(summary.voidShard).toContain("perceived");
  expect(summary.echoBand).toBe("Loop");
  expect(summary.maxRisk).toContain("Stasis Lock");
});

test("sanguine blood load derives state, cue, and risk from fill level", async ({ page }) => {
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
      band2: api.bandForTrack("sanguine.blood_load", 2),
      band4: api.bandForTrack("sanguine.blood_load", 4),
      band6: api.bandForTrack("sanguine.blood_load", 6),
      cue4: api.cueForTrack("sanguine.blood_load", 4),
      risk4: api.riskForTrack("sanguine.blood_load", 4),
      bloodLoadBand: api.bloodLoadBand(3),
      maxRisk: presentation.maxRisk,
      condition: view.condition,
      cue: view.cue
    };
  });
  expect(summary.trackLabel).toBe("Blood Load");
  expect(summary.band0).toBe("Starved");
  expect(summary.band2).toBe("Coherent");
  expect(summary.band4).toBe("Saturated");
  expect(summary.band6).toBe("Collapse Risk");
  expect(summary.cue4).toContain("intake overload");
  expect(summary.risk4).toContain("intimacy");
  expect(summary.bloodLoadBand).toBe("Coherent");
  expect(summary.maxRisk).toContain("Collapse");
  expect(summary.condition).toBe("Saturated");
  expect(summary.cue).toContain("intake overload");
});

test("sanguine fill meter maps each level to one state", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    return [0, 1, 2, 3, 4, 5, 6].map((level) => api.resolveSanguineCondition({}, level).label);
  });
  expect(summary).toEqual([
    "Starved",
    "Starved",
    "Coherent",
    "Coherent",
    "Saturated",
    "Predatory Saturation",
    "Collapse Risk"
  ]);
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
  expect(summary.find((item) => item.id === "sanguine").maxRisk).toContain("Collapse");
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
        bloodLoad: "4",
        presentationPressures: { "sanguine.blood_load": 4 }
      },
      stabilityBand: "Calm",
      harmBoxes: 0
    }];
    state = api.normalizeState(state);
    api.writeState(state);
  });
  await page.reload();
  await expect(page.locator("#operator-risk-strip")).toContainText("Mara");
  await expect(page.locator("#operator-risk-strip")).toContainText("Blood Load 4/6 (Saturated)");
});