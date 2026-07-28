const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const rightsRecords = fs.readdirSync(path.join(process.cwd(), "rights"))
  .filter((file) => file.endsWith(".json") && file !== "creator-rights-record.schema.json")
  .map((file) => {
    const record = JSON.parse(fs.readFileSync(path.join(process.cwd(), "rights", file), "utf8"));
    return { slug: file.replace(/\.json$/, ""), title: record.title, permissionCount: Object.keys(record.permissions).length + 1 };
  });

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

test("Creator Rights license pages expose the full record contract on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });

  for (const record of rightsRecords) {
    await page.goto(`/rights/${record.slug}/license/`, { waitUntil: "networkidle" });

    await expect(page.locator("h1")).toContainText(record.title);
    await expect(page.locator("main")).toContainText("Declared position");
    await expect(page.locator("main")).toContainText("Stable record URL");
    await expect(page.locator("main")).toContainText("AI permissions");
    await expect(page.locator("main")).toContainText("Machine-readable terms, translated for humans.");
    await expect(page.locator("main")).toContainText("Revision history");
    await expect(page.locator("main")).toContainText("Fingerprint");
    await expect(page.locator("main")).toContainText("Licensing");
    await expect(page.locator("main")).toContainText("Request shape");
    await expect(page.locator(".rights-qr svg")).toBeVisible();
    await expect(page.locator(".permission-row")).toHaveCount(record.permissionCount);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${record.slug} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test("Creator Rights record keeps the rich record panels on desktop and mobile", async ({ page }) => {
  const route = "/rights/the-anchor-and-the-glitch/";
  const viewports = [
    ["desktop", { width: 1280, height: 900 }],
    ["mobile", { width: 390, height: 900 }],
  ];

  for (const [name, viewport] of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator(".rights-record-grid")).toBeVisible();
    await expect(page.locator(".rights-support-grid")).toBeVisible();
    await expect(page.locator(".rights-qr svg")).toBeVisible();
    await expect(page.locator(".permission-row")).toHaveCount(12);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${name} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
