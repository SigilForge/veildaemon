const { test, expect } = require("@playwright/test");

const publicSurfaces = [
  "/",
  "/operator/",
  "/play-report/",
  "/recovered-operator-reports/",
  "/updates/"
];

for (const path of publicSurfaces) {
  test(`surface navigation is visible on ${path}`, async ({ page }) => {
    await page.goto(path);

    const nav = page.getByRole("navigation", { name: "Surface files" });
    await expect(nav).toBeVisible();
    await expect(nav.getByText("CASE FILE")).toBeVisible();
    await expect(nav.getByText("OPERATOR FILE")).toBeVisible();
    await expect(nav.getByText("REPORTS")).toBeVisible();
  });
}
