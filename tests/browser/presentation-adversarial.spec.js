const { test, expect } = require("@playwright/test");

const LOAD_PRESENTATIONS = [
  "sanguine.blood_load",
  "wraith.essence_load",
  "echo.echo_load",
  "silence.silence_load",
  "therian.instinct_load",
  "technomancer.signal_load",
  "construct.function_load",
  "vessel.containment_load",
  "sensitive.sensory_load",
  "void_shard.void_load"
];

test.describe("Presentation Pressure Adversarial & Invariant Suite", () => {
  test("Invariant 1: Presentation Load values strictly clamp to 0-6 bounds across all 10 tracks", async ({ page }) => {
    await page.goto("/operator/");
    const boundsCheck = await page.evaluate((tracks) => {
      const api = window.PresentationPressure;
      return tracks.map((trackId) => {
        let status = api.migrateOperatorStatus({});
        let statusUnder = api.writeTrackValue(status, trackId, -10);
        let statusOver = api.writeTrackValue(status, trackId, 20);
        return {
          trackId,
          minVal: api.readTrackValue(statusUnder, trackId),
          maxVal: api.readTrackValue(statusOver, trackId)
        };
      });
    }, LOAD_PRESENTATIONS);

    boundsCheck.forEach((res) => {
      expect(res.minVal).toBe(0);
      expect(res.maxVal).toBe(6);
    });
  });

  test("Invariant 2: Presentation Pressure view calculates current band and risk deterministically", async ({ page }) => {
    await page.goto("/operator/");
    const viewCheck = await page.evaluate(() => {
      const api = window.PresentationPressure;
      let status = api.migrateOperatorStatus({
        ontologyPresentation: "SANGUINE",
        presentationPressures: { "sanguine.blood_load": 4 }
      });
      const view = api.presentationPressureView(status, "SANGUINE");
      return {
        id: view.id,
        trackLabel: view.trackLabel,
        value: view.value,
        band: view.band
      };
    });

    expect(viewCheck.id).toBe("sanguine");
    expect(viewCheck.trackLabel).toBe("Blood Load");
    expect(viewCheck.value).toBe(4);
    expect(viewCheck.band).toBe("Coherent");
  });

  test("Invariant 3: Safe migration preserves legacy single-track pressure and defaults unassigned tracks to 3", async ({ page }) => {
    await page.goto("/operator/");
    const migrationCheck = await page.evaluate(() => {
      const api = window.PresentationPressure;
      const status = api.migrateOperatorStatus({
        ontologyPresentation: "SANGUINE",
        presentationPressures: { "sanguine.blood_load": 5 }
      });
      return {
        bloodLoad: api.readTrackValue(status, "sanguine.blood_load"),
        unassignedTrack: api.readTrackValue(status, "wraith.essence_load")
      };
    });

    expect(migrationCheck.bloodLoad).toBe(5);
    expect(migrationCheck.unassignedTrack).toBe(3);
  });
});
