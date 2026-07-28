const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const rightsRecords = fs.readdirSync(path.join(process.cwd(), "rights"))
  .filter((file) => file.endsWith(".json") && file !== "creator-rights-record.schema.json")
  .map((file) => {
    const record = JSON.parse(fs.readFileSync(path.join(process.cwd(), "rights", file), "utf8"));
    return { slug: file.replace(/\.json$/, ""), title: record.title, permissionCount: Object.keys(record.permissions).length + 1 };
  });

async function qrContrast(locator) {
  const image = await locator.screenshot();
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  let light = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const luminance = (data[i] * 0.2126) + (data[i + 1] * 0.7152) + (data[i + 2] * 0.0722);
    if (luminance < 80) dark += 1;
    if (luminance > 170) light += 1;
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);
  }
  const pixels = info.width * info.height;
  return { darkRatio: dark / pixels, lightRatio: light / pixels, contrast: max - min };
}

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

  await expect(page.locator('header.site-header a.nav-cta[href="https://app.veildaemon.app/rights/create"]')).toHaveText("Register product");
  await expect(page.locator('header.site-header a[href="https://app.veildaemon.app/account/rights"]')).toHaveCount(0);
  await expect(page.locator('footer.site-footer a[href="https://app.veildaemon.app/account/rights"]')).toHaveText("Account");
  await expect(page.locator("#rights-work-filter")).toBeVisible();
  await expect(page.locator("#rights-license-filter")).toBeVisible();
  await expect(page.locator("#rights-permission-filter")).toBeVisible();
  await expect(page.locator("#rights-verification-filter")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "horizontal overflow").toBeLessThanOrEqual(1);
});

test("Creator Rights overview uses the lean product shell on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/studio/creator-rights/", { waitUntil: "networkidle" });

  await expect(page.locator("header.site-header")).toHaveAttribute("data-product", "creator-rights");
  await expect(page.locator("header.site-header nav a")).toHaveText([
    "Registry",
    "Overview",
    "Register product",
  ]);
  await expect(page.locator('header.site-header a[href="https://app.veildaemon.app/account/rights"]')).toHaveCount(0);
  await expect(page.locator("footer.site-footer")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "desktop horizontal overflow").toBeLessThanOrEqual(1);
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
    await expect(page.locator("footer.site-footer")).toBeVisible();
    await expect(page.locator('footer.site-footer a[href="https://app.veildaemon.app/rights/create"]')).toHaveText("Register product");
    await expect(page.locator(".permission-row")).toHaveCount(record.permissionCount);
    const contrast = await qrContrast(page.locator(".rights-qr"));
    expect(contrast.darkRatio, `${record.slug} QR dark modules`).toBeGreaterThan(0.05);
    expect(contrast.lightRatio, `${record.slug} QR light field`).toBeGreaterThan(0.15);
    expect(contrast.contrast, `${record.slug} QR contrast`).toBeGreaterThan(140);

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
    await expect(page.locator('header.site-header a.nav-cta[href="https://app.veildaemon.app/rights/create"]')).toHaveText("Register product");
    await expect(page.locator(".rights-record-grid")).toBeVisible();
    await expect(page.locator(".rights-support-grid")).toBeVisible();
    await expect(page.locator(".rights-qr svg")).toBeVisible();
    await expect(page.locator("footer.site-footer")).toBeVisible();
    await expect(page.locator(".permission-row")).toHaveCount(12);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${name} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
