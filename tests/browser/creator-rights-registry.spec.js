const { test, expect } = require("@playwright/test");

test("Creator Rights registry filters against structured catalog facets", async ({ page }) => {
  await page.goto("/registry/", { waitUntil: "networkidle" });

  await page.locator('[data-rights-filter="work.type"]').selectOption("software");
  await expect(page.locator("[data-rights-summary]")).toContainText("2 of 12 records match 1 filter");

  await page.locator('[data-rights-filter="licensing.availability"]').selectOption("paid_license");
  await expect(page.locator("[data-rights-summary]")).toContainText("2 of 12 records match 2 filters");

  await page.locator("[data-rights-permission-filter]").selectOption("rag:allowed");
  await expect(page.locator("[data-rights-summary]")).toContainText("1 of 12 records match 3 filters");
  await expect(page.locator("[data-rights-card]:not([hidden]) h3")).toHaveText("VeilForge");

  await page.locator('[data-rights-filter="work.type"]').selectOption("");
  await page.locator('[data-rights-filter="licensing.availability"]').selectOption("");
  await page.locator("[data-rights-permission-filter]").selectOption("fineTuning:prohibited");
  await expect(page.locator("[data-rights-summary]")).toContainText("12 of 12 records match 1 filter");

  await page.locator("[data-rights-search]").fill("publisher_profile");
  await expect(page.locator("[data-rights-summary]")).toContainText('0 of 12 records match "publisher profile" and 1 filter');

  await page.locator("[data-rights-permission-filter]").selectOption("");
  await page.locator("[data-rights-search]").fill("inquiry_only");
  await expect(page.locator("[data-rights-summary]")).toContainText('12 of 12 records match "inquiry only"');
});

test("Creator Rights registry facet controls fit on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/registry/", { waitUntil: "networkidle" });

  await expect(page.locator("#rights-work-filter")).toBeVisible();
  await expect(page.locator("#rights-license-filter")).toBeVisible();
  await expect(page.locator("#rights-permission-filter")).toBeVisible();
  await expect(page.locator("#rights-verification-filter")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "horizontal overflow").toBeLessThanOrEqual(1);
});
