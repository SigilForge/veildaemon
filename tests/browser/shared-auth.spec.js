const { test, expect } = require("@playwright/test");

test("shared auth widget mounts and restores local mode across operator and handler", async ({ page }) => {
  await page.goto("/operator/");
  await expect(page.locator("#operator-auth-mount")).toBeVisible();
  await expect(page.locator(".veil-auth-status")).toContainText("LOCAL RECORD");

  await page.goto("/handler/");
  await expect(page.locator("#handler-auth-mount")).toBeVisible();
  await expect(page.locator(".veil-auth-status")).toContainText("LOCAL RECORD");
});
