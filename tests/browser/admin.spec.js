const { test, expect } = require("@playwright/test");

test("admin hub switches between admin surfaces", async ({ page }) => {
  await page.goto("/admin/?token=test-token");

  const frame = page.locator("#admin-surface");
  await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible();
  await expect(frame).toHaveAttribute("src", "/admin/reports/?token=test-token");

  await page.getByRole("button", { name: "Anomaly Volunteers" }).click();
  await expect(frame).toHaveAttribute("src", "/admin/reports/?token=test-token#anomaly-volunteers");

  await page.getByRole("button", { name: "Attention Events" }).click();
  await expect(frame).toHaveAttribute("src", "/admin/alerts/?token=test-token");
});
