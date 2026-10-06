const { test, expect } = require("@playwright/test");

// The static test server has no /api; capture observer beacons instead.
async function captureObserverEvents(page) {
  const events = [];
  // Force the fetch fallback so every event goes through page.route.
  await page.addInitScript(() => {
    navigator.sendBeacon = () => false;
  });
  await page.route("**/api/observe", async (route) => {
    events.push({
      contentType: route.request().headers()["content-type"] || "",
      body: JSON.parse(route.request().postData() || "{}"),
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  return events;
}

async function completeIntake(page) {
  const panel = page.locator("#answer-panel");
  if (!(await page.locator("#intake-node").isVisible())) {
    await page.locator("#start-intake").click();
  }

  await panel.locator("[data-continue-intake]").first().click();
  for (let question = 0; question < 3; question += 1) {
    await panel.locator('.answer-choice[data-index="0"]').click();
  }

  await expect(page.locator("#intake-result")).toContainText("INTAKE STATUS:", { timeout: 60_000 });
}

function completions(events) {
  return events.filter((entry) => entry.body.event === "intake_completed").map((entry) => entry.body);
}

test.describe("intake attribution", () => {
  test.setTimeout(120_000);

  test("utm tags survive in-tab navigation and ride the completion event", async ({ page }) => {
    const events = await captureObserverEvents(page);

    await page.goto("/?utm_source=bsky&utm_medium=Social&utm_campaign=oct-drop");
    await page.goto("/#intake-node");

    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("veildaemon.attribution.v1")));
    expect(stored).toMatchObject({ source: "bluesky", medium: "social", campaign: "oct-drop", content: "" });

    await completeIntake(page);
    await expect.poll(() => completions(events).length).toBe(1);

    const [completion] = completions(events);
    expect(completion).toMatchObject({
      utmSource: "bluesky",
      utmMedium: "social",
      utmCampaign: "oct-drop",
      utmContent: "",
      reclassified: false,
    });
    expect(["operator", "triage"]).toContain(completion.intakeRoute);
    const status = await page.locator("#intake-result").innerText();
    expect(completion.intakeRoute).toBe(status.includes("INTAKE STATUS: TRIAGE") ? "triage" : "operator");
    expect(events.every((entry) => entry.contentType.startsWith("text/plain"))).toBe(true);
    expect(events.find((entry) => entry.body.event === "intake_opened").body.utmSource).toBe("bluesky");
  });

  test("a later explicit tag replaces the earlier one", async ({ page }) => {
    const events = await captureObserverEvents(page);

    await page.goto("/?utm_source=bsky");
    await page.goto("/?utm_source=twitter#intake-node");
    await completeIntake(page);

    await expect.poll(() => completions(events).length).toBe(1);
    expect(completions(events)[0].utmSource).toBe("x");
  });

  test("untagged visits count as site", async ({ page }) => {
    const events = await captureObserverEvents(page);

    await page.goto("/#intake-node");
    await completeIntake(page);

    await expect.poll(() => completions(events).length).toBe(1);
    expect(completions(events)[0]).toMatchObject({ utmSource: "site", utmCampaign: "" });
  });
});
