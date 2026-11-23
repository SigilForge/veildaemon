const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");

test("The People routes load cleanly with WebP portraits, full-spread links, and no horizontal overflow on mobile", async ({ page }) => {
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
      expect(info.complete && info.naturalWidth > 0, `${route} image loaded: ${img.src}`).toBeTruthy();
    }

    // Expand "More places to find us" and confirm Facebook, X, Mastodon, Twitch are present
    const morePlatforms = page.locator("details.more-platforms");
    await expect(morePlatforms).toHaveCount(1);
    await morePlatforms.locator("summary").click();
    await expect(morePlatforms.locator('a[href*="facebook.com"]')).toBeVisible();
    await expect(morePlatforms.locator('a[href*="x.com"]')).toBeVisible();
    await expect(morePlatforms.locator('a[href*="social.veildaemon.app"]')).toBeVisible();
    await expect(morePlatforms.locator('a[href*="twitch.tv"]')).toBeVisible();

    const badExternalLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="http"]'))
        .filter((a) => a.getAttribute("target") !== "_blank" || !/noopener/i.test(a.getAttribute("rel") || "") || !/noreferrer/i.test(a.getAttribute("rel") || ""))
        .map((a) => a.getAttribute("href"))
    );
    expect(badExternalLinks, `${route} external link security attributes`).toEqual([]);
  }

  expect(errors).toEqual([]);
});

test("Cathy pilot defers YouTube until click, emits people_episode_open, and manifest stays public-only", async ({ page }) => {
  const youtubeRequests = [];
  page.on("request", (req) => {
    if (/youtube/i.test(req.url())) youtubeRequests.push(req.url());
  });

  await page.addInitScript(() => {
    window.__trackedEvents = [];
    window.umami = {
      track(name, payload) {
        window.__trackedEvents.push({ name, payload });
      }
    };
  });

  await page.goto("/people/", { waitUntil: "networkidle" });
  expect(youtubeRequests).toHaveLength(0);
  await expect(page.locator("#watch-cathy iframe")).toHaveCount(0);

  await page.locator("#watch-cathy [data-play-trigger]").click();
  const iframe = page.locator("#watch-cathy iframe");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/jO3uMKsvORI/);

  const tracked = await page.evaluate(() => window.__trackedEvents);
  expect(tracked.some((e) => e.name === "people_episode_open")).toBeTruthy();
  expect(tracked.some((e) => e.name === "people_episode_play")).toBeFalsy();

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "people/assets/episodes.json"), "utf8"));
  expect(Array.isArray(manifest.episodes)).toBeTruthy();
  for (const ep of manifest.episodes) {
    expect(ep.status).toBe("published");
    expect(ep.visibility).toBe("public");
  }
});

test("adding a published Wednesday episode to episodes.json activates her player on both hub and profile", async ({ page }) => {
  const syntheticManifest = {
    schemaVersion: 1,
    updatedAt: "2026-11-24",
    episodes: [
      {
        id: "wednesday-test-release",
        episodeNumber: 1,
        title: "Unqualified",
        characterId: "wednesday",
        characterName: "W3DN35D47 (Wednesday)",
        environment: "The Interface",
        description: "Test release description for manifest-driven activation.",
        runtime: "0:42",
        runtimeSeconds: 42,
        publishedAt: "2026-11-24",
        aspect: "9:16",
        thumbnail: "/people/assets/portraits/wednesday-contact.webp",
        thumbnailAlt: "Wednesday in her interface.",
        youtubeId: "dQw4w9WgXcQ",
        nativeUrls: { youtube: "https://www.youtube.com/shorts/dQw4w9WgXcQ" },
        topics: ["Arguments"],
        relatedEpisodeIds: ["cathy-two-different-things"],
        visibility: "public",
        status: "published"
      }
    ]
  };

  await page.route("**/people/assets/episodes.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(syntheticManifest) })
  );

  // Hub activates Wednesday's panel + conversation player automatically
  await page.goto("/people/", { waitUntil: "networkidle" });
  await expect(page.locator('[data-panel-featured="wednesday"] [data-panel-ep-title]')).toHaveText("Unqualified");
  await expect(page.locator("#watch-wednesday [data-featured-title]")).toHaveText("Unqualified");
  await page.locator("#watch-wednesday [data-play-trigger]").click();
  await expect(page.locator("#watch-wednesday iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);

  // Profile activates Wednesday's featured player + More from me list automatically
  await page.goto("/people/wednesday/", { waitUntil: "networkidle" });
  await expect(page.locator("#featured-video [data-featured-title]")).toHaveText("Unqualified");
  await expect(page.locator("[data-episode-list-section]")).toBeVisible();
  await expect(page.locator('[data-episode-list=""] .episode-row, [data-episode-list] .episode-row')).toHaveCount(1);
  await page.locator("#featured-video [data-play-trigger]").click();
  await expect(page.locator("#featured-video iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
});

test("The People copy preserves kayfabe and avoids out-of-world framing terms", async () => {
  const htmlFiles = [
    "people/index.html",
    "people/cathy/index.html",
    "people/wednesday/index.html"
  ];
  const forbidden = /\b(?:in-world|ARG|fiction|lore|canon|continuity|game|leaked|hacker|novel|table-ready|tabletop|TTRPG)\b/i;
  for (const rel of htmlFiles) {
    const content = fs.readFileSync(path.join(root, rel), "utf8");
    const match = content.match(forbidden);
    expect(match, `${rel} contains out-of-world framing term: ${match ? match[0] : ""}`).toBeNull();
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
