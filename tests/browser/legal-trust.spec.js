const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");

test("VeilDaemon privacy and terms routes are public and cross-linked", async ({ page }) => {
  for (const route of ["/privacy/", "/terms/"]) {
    const response = await page.goto(route);
    expect(response && response.ok(), route).toBeTruthy();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('a[href="/privacy/"]').first()).toBeVisible();
    await expect(page.locator('a[href="/terms/"]').first()).toBeVisible();
  }
});

test("submission surfaces disclose storage and preserve separate publication approval", async ({ page }) => {
  await page.goto("/debrief/");
  await expect(page.locator(".submission-terms")).toContainText(/stored for review/i);
  await expect(page.locator('.submission-terms a[href="/privacy/"]')).toBeVisible();
  await expect(page.locator('.submission-terms a[href="/terms/"]')).toBeVisible();
  const approval = page.locator("#draft-approved");
  await expect(approval).toBeDisabled();
  await expect(approval).not.toHaveAttribute("required", "");

  await page.goto("/operator/");
  await expect(page.locator('#anomaly-form a[href="/privacy/"]')).toHaveCount(1);
  await expect(page.locator('#anomaly-form a[href="/terms/"]')).toHaveCount(1);

  await page.goto("/play-report/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/debrief\/$/);
  await expect(page.locator(".submission-terms")).toContainText(/stored for review/i);
});

test("YouTube is not requested until the transmission viewer opens", async ({ page }) => {
  const youtubeRequests = [];
  page.on("request", (request) => {
    if (/youtube/i.test(request.url())) youtubeRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#primary-feed-video iframe")).toHaveCount(0);
  expect(youtubeRequests).toHaveLength(0);
  await page.locator("#open-transmission").click();
  const iframe = page.locator("#primary-feed-video iframe");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", /youtube-nocookie\.com/);
  await expect(iframe).toHaveAttribute("loading", "lazy");
});

test("license scope describes proprietary repository and reserves marks", async () => {
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
  const scope = fs.readFileSync(path.join(root, "LICENSE_SCOPE.md"), "utf8");
  expect(license).toMatch(/VeilDaemon Core source code.*Apache License, Version 2\.0/is);
  expect(license).toMatch(/SigilForge Rights Framework.*All Rights Reserved/is);
  expect(license).toMatch(/Trademarks, logos, studio names/is);
  expect(license).toMatch(/SigilForge Studios/i);
  expect(scope).toMatch(/open core software logic from proprietary rights infrastructure, assets, and brand identity/i);
  expect(scope).toMatch(/All Rights Reserved/i);
  expect(scope).toMatch(/No trademark rights are granted/i);
  expect(scope).toMatch(/SigilForge Studios/i);
});

test("public pages avoid false entity and all-data-local claims", async () => {
  const publicFiles = [
    "index.html",
    "debrief/index.html",
    "operator/index.html",
    "privacy/index.html",
    "terms/index.html",
    "studio/about/index.html",
    "studio/copyright/index.html",
  ];
  const text = publicFiles.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  expect(text).not.toMatch(/all (?:user )?(?:data|records).*remain local/i);
  expect(text).not.toMatch(/SigilForge Studios (?:LLC|Inc\.|Corporation)/i);
  expect(text).not.toMatch(/registered trademark/i);
});
