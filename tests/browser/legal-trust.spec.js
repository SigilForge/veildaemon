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
  await expect(page.locator('#anomaly-form a[href="/privacy/"]')).toBeVisible();
  await expect(page.locator('#anomaly-form a[href="/terms/"]')).toBeVisible();

  await page.goto("/play-report/");
  await expect(page.locator('a[href="/privacy/"]')).toHaveCount(1);
  await expect(page.locator('a[href="/terms/"]')).toHaveCount(1);
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

test("license scope reserves marks outside the Creative Commons grant", async () => {
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
  const scope = fs.readFileSync(path.join(root, "LICENSE_SCOPE.md"), "utf8");
  for (const text of [license, scope]) {
    expect(text).toMatch(/excluded from the Creative Commons grant/i);
    expect(text).toMatch(/No trademark rights are granted/i);
    expect(text).toMatch(/J\. Donavon Love/i);
    expect(text).toMatch(/Knoxmortis/i);
  }
  expect(scope).toMatch(/UI implementation code.*Apache/i);
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
  expect(text).not.toMatch(/Cradlepoint Studio (?:LLC|Inc\.|Corporation)/i);
  expect(text).not.toMatch(/registered trademark/i);
});
