const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");

test("The People routes load cleanly with WebP portraits and no horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  for (const route of ["/people/", "/people/cathy/", "/people/wednesday/"]) {
    const res = await page.goto(route, { waitUntil: "networkidle" });
    expect(res && res.ok(), route).toBeTruthy();
    await expect(page.locator("h1")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${route} horizontal overflow on 375px viewport`).toBeFalsy();

    const imgs = page.locator("img");
    const imgCount = await imgs.count();
    expect(imgCount, `${route} should render portraits`).toBeGreaterThan(0);
    for (let i = 0; i < imgCount; i++) {
      const img = imgs.nth(i);
      await img.scrollIntoViewIfNeeded();
      const info = await img.evaluate(async (el) => {
        if (!el.complete) {
          await new Promise((resolve) => {
            el.addEventListener("load", resolve, { once: true });
            el.addEventListener("error", resolve, { once: true });
            setTimeout(resolve, 3000);
          });
        }
        return {
          src: el.getAttribute("src") || "",
          complete: el.complete,
          naturalWidth: el.naturalWidth
        };
      });
      expect(info.src, `${route} image must be WebP`).toMatch(/\.webp(?:\?|$)/i);
      expect(info.complete && info.naturalWidth > 0, `${route} image loaded: ${info.src}`).toBeTruthy();
    }

    const badExternalLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="http"]'))
        .filter((a) => a.getAttribute("target") !== "_blank" || !/noopener/i.test(a.getAttribute("rel") || "") || !/noreferrer/i.test(a.getAttribute("rel") || ""))
        .map((a) => a.getAttribute("href"))
    );
    expect(badExternalLinks, `${route} external link security attributes`).toEqual([]);
  }

  expect(errors).toEqual([]);
});

test("Cathy pilot video defers YouTube until click and Wednesday does not leak unpublished media", async ({ page }) => {
  const youtubeRequests = [];
  page.on("request", (req) => {
    if (/youtube/i.test(req.url())) youtubeRequests.push(req.url());
  });

  await page.goto("/people/", { waitUntil: "networkidle" });
  expect(youtubeRequests).toHaveLength(0);
  await expect(page.locator("#watch-cathy iframe")).toHaveCount(0);

  await page.locator("#watch-cathy [data-play-trigger]").click();
  const iframe = page.locator("#watch-cathy iframe");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/jO3uMKsvORI/);

  // Manifest must contain only public published episodes
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "people/assets/episodes.json"), "utf8"));
  expect(Array.isArray(manifest.episodes)).toBeTruthy();
  for (const ep of manifest.episodes) {
    expect(ep.status).toBe("published");
    expect(ep.visibility).toBe("public");
  }
});

test("visitors can move directly between Cathy and Wednesday and reach /people/ from homepage", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const homePeopleLink = page.locator('a[href="/people/"]').first();
  await expect(homePeopleLink).toBeVisible();
  await homePeopleLink.click();
  await expect(page).toHaveURL(/\/people\/$/);

  await page.locator('a[href="/people/cathy/"]').first().click();
  await expect(page).toHaveURL(/\/people\/cathy\/$/);
  await expect(page.locator("h1")).toContainText("Cathy Holloway");

  await page.locator('main a[href="/people/wednesday/"]').first().click();
  await expect(page).toHaveURL(/\/people\/wednesday\/$/);
  await expect(page.locator("h1")).toContainText("Wednesday");

  await page.locator('main a[href="/people/cathy/"]').first().click();
  await expect(page).toHaveURL(/\/people\/cathy\/$/);
});
