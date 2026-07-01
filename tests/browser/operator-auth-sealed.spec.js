const { test, expect } = require("@playwright/test");

test("authorized unlocks reachable without operator record", async ({ page }) => {
  await page.goto("/operator/");
  await expect(page.locator("#operator-sealed-panel")).toBeVisible();
  await expect(page.getByLabel("Console modules").getByRole("button", { name: "Authorized Unlocks" })).toBeVisible();
  await expect(page.locator("#module-authorizations")).toHaveClass(/is-active/);
  await expect(page.locator("#import-authorization")).toBeAttached();

  await page.locator("#import-authorization").setInputFiles({
    name: "authorization.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      exportType: "cradlepoint.authorization",
      version: 1,
      exportedAt: "2026-07-01T12:00:00.000Z",
      operatorName: "Sealed Operator",
      flags: ["BACKGROUND_UNLOCK:FIELD_MEDIC", "VOID_REWARD:1"],
      note: ""
    }))
  });

  await expect(page.locator("#storage-status")).toContainText("authorization flag processed");
  await expect(page.locator("#authorized-background-list")).toContainText("Field Medic");
  await expect(page.locator("#authorized-reward-list")).toContainText("1 Void");
});