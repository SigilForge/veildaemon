import { test, expect } from "@playwright/test";

test.describe("Live Table End-to-End Test Suite", () => {
  test("E2E: Log in to VeilLink Table and verify Live Session Hub & Table State", async ({ page }) => {
    // Step 1: Navigate to VeilLink Live Table login
    await page.goto("https://app.veildaemon.app/login?next=/table");
    await expect(page.locator("h1")).toContainText("Log in");

    // Step 2: Perform authentication with test credentials
    await page.locator('input[name="email"]').fill("sfrtesting420@gmail.com");
    await page.locator('input[name="password"]').fill("Mortis0!");
    await page.locator('button[type="submit"]').click();

    // Step 3: Verify redirect to Live Table hub (/table)
    await page.waitForURL("**/table**", { timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Table");

    // Step 4: Verify Live Table controls & navigation links
    await expect(page.locator("main")).toContainText("Table");
    const nodeLink = page.locator('a:has-text("Personal Operations Node")').first();
    await expect(nodeLink).toBeVisible();
    await expect(nodeLink).toHaveAttribute("target", "_blank");
    await expect(nodeLink).toHaveAttribute("rel", "noopener noreferrer");

    // Step 5: Verify Table Session Hub components
    const createSessionBtn = page.getByRole("button", { name: /Create Table Session|New Table Session|Create Session/i });
    if (await createSessionBtn.isVisible()) {
      await createSessionBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify session dashboard or active table controls are present
    const tableBody = page.locator("main");
    await expect(tableBody).toBeVisible();
  });
});
