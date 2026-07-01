const { test, expect } = require("@playwright/test");

test("presentation pressure registry exposes nine ontology modules", async ({ page }) => {
  await page.goto("/operator/");
  const summary = await page.evaluate(() => {
    const api = window.PresentationPressure;
    return {
      count: api.presentations.length,
      sanguine: api.trackById("sanguine.hunger").label,
      voidShard: api.trackById("void_shard.contamination").atMax,
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