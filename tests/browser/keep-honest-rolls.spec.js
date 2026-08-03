const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "HONEST-OP-01",
      primaryFrequency: "Dream",
      observerClassification: "Operator",
      attentionStatus: "Local",
      accessLevel: "LOCAL"
    }));
  });
});

test.describe("Operator Quick Lobby Join & Handler Keep-Honest Roll Sync", () => {
  test("Operator quick lobby join button switches to live mode and focuses join input", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();

    // Verify Quick Join Lobby button is visible in header & roll dock
    const quickBtn = page.locator("#lobby-quick-btn");
    await expect(quickBtn).toBeVisible();
    await expect(quickBtn).toHaveText("⚡ JOIN LOBBY");

    // Click quick join button
    await quickBtn.click();

    // Verify session bar becomes visible and mode switches to Live Table
    await expect(page.locator("#live-session-bar")).toBeVisible();
    await expect(page.locator("#live-join-code-input")).toBeFocused();

    // Fill session code and join
    await page.locator("#live-join-code-input").fill("LOBBY1");
    await page.locator("#live-session-join-form button[type='submit']").click();

    // Verify badge updates to connected state
    await expect(quickBtn).toHaveText("🟢 LOBBY: LOBBY1");
  });

  test("Operator roll broadcasts to Cell sync and updates Handler Keep-Honest Roll Audit feed", async ({ page, context }) => {
    // Page 1: Operator
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();

    // Perform an action roll
    await page.locator("#roll-action").click();

    // Verify roll output and sync notice appear on Operator sheet
    await expect(page.locator("#roll-output")).not.toHaveText("Awaiting action.");
    await expect(page.locator("#roll-sync-status")).toBeVisible();
    await expect(page.locator("#roll-sync-status")).toContainText("Roll logged to Cell & Live Table");

    // Verify roll item is in VeilDaemonCellSync roll feed
    const rolls = await page.evaluate(() => window.VeilDaemonCellSync.listRollFeed());
    expect(rolls.length).toBeGreaterThan(0);
    expect(rolls[rolls.length - 1].name).toBe("HONEST-OP-01");

    // Page 2: Handler Live Dashboard in same context
    const handlerPage = await context.newPage();
    await handlerPage.goto("/handler/live/");

    // Verify Keep Honest Roll Feed displays the operator roll
    // (lives in the REFERENCE live-view tab -- see Docs/DESIGN_CONSTRAINTS.md)
    await handlerPage.locator('.live-view-switch [data-live-toggle="reference"]').click();
    await expect(handlerPage.locator("#roll-feed-list")).toBeVisible();
    await expect(handlerPage.locator("#roll-feed-list")).toContainText("HONEST-OP-01");
    await expect(handlerPage.locator("#roll-feed-list")).toContainText("TOTAL");
  });
});
