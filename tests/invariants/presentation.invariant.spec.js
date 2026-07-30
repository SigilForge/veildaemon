const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "INVARIANT-OP-PRESENTATION",
      primaryFrequency: "Dream",
      observerClassification: "Operator",
      attentionStatus: "Local",
      accessLevel: "LOCAL"
    }));
  });
});

test.describe("Invariant: Simulation Correctness & Pressure Bounds", () => {
  test("Simulation Invariant: Presentation Pressure API exposes 12 ontologies and safe-middle load bands", async ({ page }) => {
    await page.goto("/operator/");
    const summary = await page.evaluate(() => {
      const api = window.PresentationPressure;
      return {
        count: api.presentations.length,
        loadCount: api.presentations.filter((item) => api.isLoadPresentation(item)).length,
        sanguine: api.trackById("sanguine.blood_load").label,
        sanguineBand0: api.bandForTrack("sanguine.blood_load", 0),
        sanguineBand3: api.bandForTrack("sanguine.blood_load", 3),
        sanguineBand6: api.bandForTrack("sanguine.blood_load", 6),
      };
    });

    expect(summary.count).toBe(12);
    expect(summary.loadCount).toBe(10);
    expect(summary.sanguine).toBe("Blood Load");
    expect(summary.sanguineBand0).toBe("Starving");
    expect(summary.sanguineBand3).toBe("Coherent");
    expect(summary.sanguineBand6).toBe("Collapse Risk");
  });

  test("Simulation Invariant: Load step values are strictly bounded to range [0, 6]", async ({ page }) => {
    await page.goto("/operator/");
    const result = await page.evaluate(() => {
      const api = window.PresentationPressure;
      let status = api.migrateOperatorStatus({});

      status = api.adjustTrackLoad(status, "sanguine.blood_load", 3);
      const valAfterAdd = api.readTrackValue(status, "sanguine.blood_load");

      status = api.adjustTrackLoad(status, "sanguine.blood_load", -2);
      const valAfterSub = api.readTrackValue(status, "sanguine.blood_load");

      status = api.adjustTrackLoad(status, "sanguine.blood_load", -10);
      const valClamped = api.readTrackValue(status, "sanguine.blood_load");

      return { valAfterAdd, valAfterSub, valClamped };
    });

    expect(result.valAfterAdd).toBe(6);
    expect(result.valAfterSub).toBe(4);
    expect(result.valClamped).toBe(0);
  });
});
