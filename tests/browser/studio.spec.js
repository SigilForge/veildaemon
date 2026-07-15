const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const reviewDir = "/tmp/studio-review";
const studioRoutes = [
  { path: "/studio/", name: "portal", title: /Cradlepoint Studio/, h1: /One universe/ },
  { path: "/studio/about/", name: "about", title: /About/, h1: /Translation before mythology/ },
  { path: "/studio/web-design/", name: "web-design", title: /Small Business Web Design/, h1: /Websites Built/ },
  { path: "/studio/projects/", name: "projects", title: /Projects/, h1: /One system/ },
  { path: "/studio/publishing/", name: "publishing", title: /Publishing/, h1: /publishing line already in market/ },
  { path: "/studio/technology/", name: "technology", title: /Technology/, h1: /Shipping infrastructure first/ },
  { path: "/studio/funding/", name: "funding", title: /Funding and Partnerships/, h1: /funding and partnership case/i },
  { path: "/studio/traction/", name: "traction", title: /Traction/, h1: /Built before permission/ },
  { path: "/studio/press/", name: "press", title: /Press/, h1: /Approved materials/ },
  { path: "/studio/data-room/", name: "data-room", title: /Data Room/, h1: /Summaries open/ },
  { path: "/studio/privacy/", name: "privacy", title: /Privacy/, h1: /Privacy notice/ },
  { path: "/studio/copyright/", name: "copyright", title: /Copyright/, h1: /Copyright and intellectual property/ },
  { path: "/studio/media-usage/", name: "media-usage", title: /Media Usage/, h1: /Media usage guidance/ },
];

const summaryRoutes = [
  "/studio/data-room/public/executive-overview.html",
  "/studio/data-room/public/traction-summary.html",
  "/studio/data-room/public/product-catalog.html",
  "/studio/data-room/public/roadmap-public.html",
  "/studio/data-room/public/publishing-prospectus-summary.html",
  "/studio/data-room/public/mobile-ar-prospectus-summary.html",
];

function ensureReviewDir() {
  fs.mkdirSync(reviewDir, { recursive: true });
}

async function noHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "horizontal overflow").toBeLessThanOrEqual(1);
}

async function assertLocalAssets(page, routePath) {
  const assets = await page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll("img[src], a[href], link[href], script[src]").forEach((el) => {
      const raw = el.getAttribute("src") || el.getAttribute("href");
      if (!raw) return;
      if (raw.startsWith("mailto:") || raw.startsWith("http") || raw.startsWith("//") || raw.startsWith("#")) return;
      if (raw.startsWith("data:")) return;
      if (raw.includes("/_vercel/")) return;
      urls.add(raw);
    });
    return [...urls];
  });

  for (const rel of assets) {
    const resolved = new URL(rel, page.url()).pathname;
    // Skip font CDN css already absolute; only local
    if (resolved.includes("fonts.googleapis") || resolved.includes("fonts.gstatic")) continue;
    const response = await page.request.get(resolved);
    expect(response.ok(), `${routePath} asset ${resolved}`).toBeTruthy();
  }
}

test.describe("studio subtree routes", () => {
  test("desktop route matrix, screenshots, and local assets", async ({ page }) => {
    ensureReviewDir();
    await page.setViewportSize({ width: 1440, height: 1000 });

    for (const route of studioRoutes) {
      const response = await page.goto(route.path);
      expect(response && response.ok(), route.path).toBeTruthy();
      await expect(page).toHaveTitle(route.title);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.locator("h1").first()).toContainText(route.h1);
      await expect(page.locator('a[href="/studio/privacy/"]').first()).toBeVisible();
      await expect(page.locator('a[href="/studio/media-usage/"]').first()).toBeVisible();
      // Unified chrome: primary Contact CTA + explore footer links
      await expect(page.locator("header.site-header a.nav-cta")).toHaveCount(1);
      await expect(page.locator('header.site-header a[href="/studio/projects/"]')).toHaveCount(1);
      await expect(page.locator('header.site-header a[href="/studio/data-room/"]')).toHaveCount(1);
      await expect(page.locator("footer.site-footer")).toHaveCount(1);
      await expect(page.locator('footer.site-footer a[href="/studio/projects/"]')).toHaveCount(1);
      await expect(page.locator('footer.site-footer a[href="/studio/about/"]')).toHaveCount(1);
      await expect(page.locator('footer.site-footer a[href="/studio/press/"]')).toHaveCount(1);
      await expect(page.locator('footer.site-footer a[href="/studio/traction/"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(route.path.replace(/\/$/, "") + "/?$"));
      await noHorizontalOverflow(page);
      await assertLocalAssets(page, route.path);
      await page.screenshot({
        path: path.join(reviewDir, `studio-${route.name}-desktop.png`),
        fullPage: true,
      });
    }

    // Portal-specific checks on a dedicated revisit (not last route)
    await page.goto("/studio/");
    await expect(page.getByRole("link", { name: /Open the Funding Case/ })).toHaveAttribute(
      "href",
      "/studio/funding/"
    );
    await expect(page.getByRole("link", { name: /Explore Publishing/ })).toHaveAttribute(
      "href",
      "/studio/publishing/"
    );
    await expect(page.getByRole("link", { name: /Explore the Platform/ })).toHaveAttribute(
      "href",
      "/studio/technology/"
    );
    await expect(page.locator('a.service-callout[href="/studio/web-design/"]')).toBeVisible();
    await expect(page.locator('footer.site-footer a[href="/studio/web-design/"]')).toHaveCount(1);
    await expect(page.locator('script[src="/_vercel/insights/script.js"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await page.screenshot({
      path: path.join(reviewDir, "cradlepoint-studio-desktop.png"),
      fullPage: true,
    });

    await page.goto("/studio/projects/");
    await expect(page.locator(".portfolio-card")).toHaveCount(7);
    await expect(page.locator(".portfolio-card .card-media")).toHaveCount(7);
    await expect(page.locator(".portfolio-card img.art-zoom")).toHaveCount(2);
    await expect(page.locator(".portfolio-card h3")).toHaveText([
      "Cradlepoint TTRPG",
      "VeilDaemon",
      "Operator + Handler Systems",
      "Fiction + public archive",
      "Mobile AR",
      "Ritual Sites",
      "VeilForge",
    ]);
    await expect(page.locator('.dual-system-card a[href="/operator/"]')).toHaveCount(1);
    await expect(page.locator('.dual-system-card a[href="/handler/"]')).toHaveCount(1);
    await expect(page.locator('.narrative-card a[href="https://wiki.veildaemon.app/"]')).toHaveCount(1);
    await expect(page.locator('.narrative-card a[href="https://www.youtube.com/@CradlepointArchive"]')).toHaveCount(1);
    await expect(page.locator(".narrative-card")).toContainText(/fiction in development/i);
    const projectTileMetrics = await page.locator(".portfolio-card").evaluateAll((cards) => cards.map((card) => {
      const cardBox = card.getBoundingClientRect();
      const mediaBox = card.querySelector(".card-media").getBoundingClientRect();
      return { height: cardBox.height, mediaHeight: mediaBox.height };
    }));
    for (let index = 0; index < projectTileMetrics.length; index += 2) {
      const row = projectTileMetrics.slice(index, index + 2);
      expect(Math.max(...row.map((item) => item.height)) - Math.min(...row.map((item) => item.height))).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...projectTileMetrics.map((item) => item.mediaHeight)) - Math.min(...projectTileMetrics.map((item) => item.mediaHeight))).toBeLessThanOrEqual(1);
    const [gridBox, forgeBox] = await Promise.all([
      page.locator(".portfolio-grid").boundingBox(),
      page.locator(".veilforge-card").boundingBox(),
    ]);
    expect(Math.abs((forgeBox.x + forgeBox.width / 2) - (gridBox.x + gridBox.width / 2))).toBeLessThanOrEqual(1);

    await page.goto("/studio/funding/");
    await expect(page.locator("#structure")).toContainText(/Funding instruments/i);
    await expect(page.locator("#structure")).toContainText(/Partial founder stipend/i);
    await expect(page.locator("#structure")).toContainText(/\$18,000/);

    await page.goto("/studio/press/");
    await expect(page.getByRole("link", { name: /Download short boilerplate/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Studio, product, and in-universe identity/i })).toBeVisible();

    await page.goto("/studio/data-room/");
    await expect(page.locator('a[href="public/executive-overview.html"]').first()).toBeVisible();

    for (const summary of summaryRoutes) {
      const response = await page.goto(summary);
      expect(response && response.ok(), summary).toBeTruthy();
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("main")).not.toContainText("**");
      await expect(page.getByRole("link", { name: /Download Markdown/i })).toBeVisible();
      await assertLocalAssets(page, summary);
    }

    await page.goto("/studio/data-room/");
    await expect(page.locator(".doc-index .doc-row").first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText("sit on this site as Markdown");
  });

  test("funding conversion summary and scope boundaries", async ({ page }) => {
    await page.goto("/studio/funding/");
    await expect(page.locator(".funding-glance")).toContainText("Shipping tabletop products + live software");
    await expect(page.locator(".funding-glance")).toContainText("Professional tabletop publishing");
    await expect(page.locator(".funding-glance")).toContainText("$67K over 12 months");
    await expect(page.locator(".funding-glance")).toContainText("Separately scoped Mobile AR");
    await expect(page.locator("#capital h2")).toHaveText("What changes within twelve months?");
    await expect(page.locator("#founder h2")).toHaveText("Why this founder can execute");
    await expect(page.locator("#structure")).toContainText(/separate publishing budget covers title-specific editorial production/i);
    await expect(page.locator("#structure")).toContainText(/does not include a full Mobile AR product budget/i);
    await expect(page.locator("#structure")).toContainText("Illustrative contribution: up to $20K");
    await expect(page.locator("#structure")).toContainText(/separate from the \$67K studio-growth request/i);
    await expect(page.locator("#structure")).not.toContainText("Digital Sandbox KC");
    await noHorizontalOverflow(page);
  });

  test("web design service page scope, pricing, and inquiry form", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/studio/web-design/");
    await expect(page).toHaveTitle(/Small Business Web Design/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://veildaemon.app/studio/web-design/"
    );
    await expect(page.locator("h1")).toContainText(/Websites Built/);
    await expect(page.locator("main")).toContainText(/introductory portfolio-building rates/i);
    await expect(page.locator("main")).toContainText(/internally developed Cradlepoint properties/i);
    await expect(page.locator("main")).toContainText(/Guaranteed rankings are not offered/i);
    await expect(page.locator("main")).not.toContainText(/client testimonial/i);
    await expect(page.locator("main")).not.toContainText(/500% increase/i);
    await expect(page.locator(".wd-price-card")).toHaveCount(3);
    await expect(page.locator(".wd-price-card.featured")).toContainText("Most common");
    await expect(page.locator(".wd-price-card.featured")).toContainText("Starting at $500");
    await expect(page.locator("#existing-work a[href='https://veildaemon.app']")).toHaveCount(1);
    await expect(page.locator("#existing-work a[href='/studio/']")).toHaveCount(1);
    await expect(page.locator("#project-review-form")).toBeVisible();
    await expect(page.locator('#project-review-form [name="budget"] option')).toHaveCount(7);
    await expect(page.getByRole("button", { name: /Request a Project Review/i })).toBeVisible();
    await expect(page.locator(".wd-faq details")).toHaveCount(10);
    await noHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio/web-design/");
    await noHorizontalOverflow(page);
    await expect(page.locator("#project-review-form")).toBeVisible();
  });

  test("publishing page leads with the existing commercial opportunity", async ({ page }) => {
    await page.goto("/studio/publishing/");
    await expect(page.locator("h1")).toHaveText("A publishing line already in market.");
    await expect(page.locator(".publishing-brief")).toContainText("Operator Core · Handler Core · recurring Needlepoints");
    await expect(page.locator(".publishing-brief")).toContainText("Direct digital sales · combined Full Core Set");
    await expect(page.locator(".publishing-brief")).toContainText("Professional production, print, distribution, and audience growth");
    await expect(page.locator(".release-inventory > a")).toHaveCount(4);
    await expect(page.locator('.release-inventory > a[href="https://the-cradlepoint-archives.itch.io/needlepoint"]')).toHaveCount(1);
    await expect(page.locator('.release-inventory > a[href="https://the-cradlepoint-archives.itch.io/cradlepoint-handler-core"]')).toHaveCount(1);
    await expect(page.locator('.release-inventory > a[href="https://the-cradlepoint-archives.itch.io/cradlepoint-operator-core"]')).toHaveCount(1);
    await expect(page.locator('.release-inventory > a[href="https://play.veildaemon.app/"]')).toHaveCount(1);
    await expect(page.locator('a[href="https://itch.io/s/195935/the-cradlepoint-archive-full-core-set"]')).toHaveCount(1);
    await expect(page.locator("#partner-frame")).toContainText(/rights, exclusivity, marketing obligations/i);
    await expect(page.getByRole("heading", { name: "Choose the route around an existing catalog" })).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test("technology page leads with live tools and bounded partner work", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/studio/technology/");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://veildaemon.app/studio/assets/social/technology-social-preview.jpg");
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", "https://veildaemon.app/studio/assets/social/technology-social-preview.jpg");
    await expect(page.locator(".technology-brief")).toContainText("VeilDaemon + Operator and Handler browser tools");
    await expect(page.locator(".technology-brief")).toContainText("Local-first tools · open core · protected creative layer");
    await expect(page.locator("#trust-boundaries")).toContainText(/remain in the browser by default/i);
    await expect(page.locator("#trust-boundaries")).toContainText(/separate Studio review/i);
    await expect(page.locator("#next-platform-work")).toContainText(/Reliability and operations/i);
    await expect(page.locator("#poc")).toContainText(/Full MVP development and the studio-growth envelope remain separately budgeted/i);
    await expect(page.locator("#hypotheses")).not.toContainText("Paid acquisition");
    await expect(page.locator("#technology-partner")).toContainText(/One defined barrier, prototype, audit, or pilot/i);
    await expect(page.locator("#validation")).toContainText(/return to local records/i);
    await noHorizontalOverflow(page);
  });

  test("traction separates production proof, market evidence, and measurement next", async ({ page }) => {
    await page.goto("/studio/traction/");
    await expect(page.locator("h1")).toHaveText("Built before permission arrived.");
    await expect(page.locator("#production-proof")).toContainText("Automated browser test suite");
    await expect(page.locator("#production-proof")).not.toContainText("100+ Passing browser tests");
    await expect(page.locator("#market-evidence")).toContainText(/itch.io analytics · latest tracked month · organic · reach \+ action/i);
    await expect(page.locator("#market-evidence")).toContainText("$0 paid acquisition");
    await expect(page.locator("#measurement-next")).toContainText(/VeilDaemon Operator or Handler use/i);
    await expect(page.locator(".traction-disclosure")).toHaveCount(1);
    await expect(page.locator(".disclosure-box")).toHaveCount(0);
    await noHorizontalOverflow(page);
  });

  test("data room guides reviewer decisions without exposing private files", async ({ page }) => {
    await page.goto("/studio/data-room/");
    await expect(page.locator(".reviewer-path")).toContainText("First read");
    await expect(page.locator(".reviewer-path")).toContainText("Then verify");
    await expect(page.locator(".reviewer-path")).toContainText("Then discuss");
    for (const id of ["understand-studio", "commercial-opportunity", "technology-review", "press-public", "private-diligence"]) {
      await expect(page.locator("#" + id)).toHaveCount(1);
    }
    await expect(page.locator("#commercial-opportunity")).toContainText(/Near-term tabletop publishing/i);
    await expect(page.locator("#technology-review")).toContainText(/live local-first software/i);
    await expect(page.locator("#private-diligence")).toContainText(/Access is scoped to the conversation/i);
    await expect(page.locator("#private-diligence")).toContainText(/In development/i);
    const accessLinks = page.locator('a[href^="mailto:J.Donavon.Love@gmail.com?subject=Cradlepoint%20Studio%20Data%20Room%20Request"]');
    await expect(accessLinks).toHaveCount(2);
    const privateFileLinks = page.locator('main a[href*="/private/"], main a[href$=".xlsx"], main a[href$=".docx"], main a[href$=".zip"]');
    await expect(privateFileLinks).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]')).not.toHaveAttribute("content", /technology-ar|mobile-ar/i);
    await assertLocalAssets(page, "/studio/data-room/");
    for (const summary of summaryRoutes) {
      const response = await page.request.get(summary);
      expect(response.ok(), summary).toBeTruthy();
    }
    const firstPath = page.locator(".reviewer-path a").first();
    await firstPath.focus();
    await expect(firstPath).toBeFocused();
    const outline = await firstPath.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await noHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await noHorizontalOverflow(page);
  });

  test("press room provides a five-minute public asset grab", async ({ page }) => {
    await page.goto("/studio/press/");
    const kitLink = page.getByRole("link", { name: /Download complete press kit/i });
    await expect(kitLink).toBeVisible();
    await expect(kitLink).toHaveAttribute("href", "downloads/cradlepoint-studio-press-kit-july-2026.zip");
    await expect(page.locator(".press-copy-grid .long-copy")).toContainText(/Cradlepoint Studio is an independent creative technology studio/i);
    await expect(page.locator(".press-copy-grid").first()).not.toContainText("See full text in download");
    await expect(page.locator(".press-copy-grid")).toContainText(/Cradlepoint Studio is an independent founder-operated studio/i);
    for (const id of ["studio-assets", "veildaemon-assets", "veilcorp-assets"]) {
      await expect(page.locator("#" + id)).toHaveCount(1);
    }
    await expect(page.locator("#veildaemon-assets").locator("xpath=following-sibling::*[1]")).toContainText(/Technology social graphic/i);
    await expect(page.locator(".asset-caption").first()).toContainText(/Approved caption/i);
    await expect(page.locator(".metric-board")).toContainText(/Jul 10 2026/i);
    await expect(page.locator(".metric-board")).toContainText(/Automated browser test suite/i);
    await assertLocalAssets(page, "/studio/press/");
    await noHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await noHorizontalOverflow(page);
  });

  test("about page tells the human founder and discovery story", async ({ page }) => {
    await page.goto("/studio/about/");
    await expect(page.locator(".about-portrait img")).toHaveAttribute("alt", /J\. Donavon Love/i);
    await expect(page.locator("#original-problem")).toContainText(/What could AI meaningfully support through mobile tools/i);
    await expect(page.locator("#original-problem")).toContainText(/without flattening it into a label/i);
    const chain = page.locator("#discovery-chain");
    await expect(chain).toContainText(/Mobile support posed the question/i);
    await expect(chain).toContainText(/Story supplied lived context/i);
    await expect(chain).toContainText(/Tabletop made the laws testable/i);
    await expect(chain).toContainText(/VeilDaemon returned it to software/i);
    await expect(page.locator("#operating-model")).toContainText(/AI supports drafting, retrieval, comparison, and pressure-testing/i);
    await expect(page.locator("#operating-model")).toContainText(/Human release authority/i);
    await expect(page.locator("#founder-and-collaborators")).toContainText(/Where collaborators enter/i);
    await expect(page.locator("#current-chapter")).toContainText(/revealed itself as a studio/i);
    await expect(page.locator("#current-chapter")).toContainText(/Long-form fiction/i);
    await expect(page.locator("main")).not.toContainText(/Formal contracting, ownership, and entity details/i);
    await assertLocalAssets(page, "/studio/about/");
    await noHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await noHorizontalOverflow(page);
  });

  test("VeilForge is consistently public-showcase, private-core, and in development", async ({ page }) => {
    const showcase = "https://github.com/SigilForge/veilforge-showcase";
    await page.goto("/studio/projects/");
    const project = page.locator('.veilforge-card[href="' + showcase + '"]');
    await expect(project).toHaveCount(1);
    await expect(project).toContainText("Public showcase · private core · active MVP development");
    await expect(project).not.toContainText(/shipping product/i);
    await noHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await noHorizontalOverflow(page);

    await page.goto("/studio/technology/");
    await expect(page.locator("#veilforge-track")).toContainText(/emotional runtime state/i);
    await expect(page.locator("#veilforge-track")).toContainText(/implementation core remains private/i);
    await expect(page.locator("#veilforge-track")).toContainText(/streamer-facing daemon persona/i);
    await expect(page.locator("#veilforge-track")).toContainText(/broader agent capabilities later/i);
    await expect(page.locator("#veilforge-track")).not.toContainText(/production-ready|shipping|reliable general-purpose agent|completed framework/i);
    await expect(page.locator('#veilforge-track a[href="' + showcase + '"]')).toHaveCount(1);
    await noHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await noHorizontalOverflow(page);

    await page.goto("/studio/data-room/");
    const dataRow = page.locator('.doc-row[href="' + showcase + '"]');
    await expect(dataRow).toContainText("VeilForge public showcase");
    await expect(dataRow).toContainText("Public showcase · Private core · Active MVP development");

    await page.goto("/studio/about/");
    await expect(page.locator("#operating-model")).toContainText(/active AI-daemon development track/i);
    await expect(page.locator('#operating-model a[href="' + showcase + '"]')).toHaveCount(1);
  });

  test("positioning stays mythpunk, publishing-first, and technically bounded", async ({ page }) => {
    await page.goto("/studio/");
    await expect(page.locator(".portal-hero-copy")).toContainText(/mythpunk studio/i);
    await expect(page.locator(".portal-hero-copy")).toContainText(/emotional-physics framework/i);
    await expect(page.locator(".portal-proof")).toContainText(/internally audited rules words/i);

    await page.goto("/studio/technology/");
    await expect(page.locator("#veildaemon-today")).toContainText(/studio-controlled browser infrastructure/i);
    await expect(page.locator("#veildaemon-today")).toContainText(/open core and protected creative layer/i);
    await expect(page.locator("#veildaemon-today")).toContainText(/not presented as a proprietary AI framework/i);

    await page.goto("/studio/projects/");
    await expect(page.locator(".ecosystem")).toContainText(/Audience & IP validation/i);
    await expect(page.locator(".ecosystem")).toContainText(/local-first Operator and Handler tools/i);
  });

  test("unique titles, JSON-LD validity, fragments, and focus", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const titles = [];
    for (const route of studioRoutes) {
      await page.goto(route.path);
      const title = await page.title();
      expect(title.length, route.path + " title length").toBeGreaterThan(8);
      titles.push(title);

      // Visible focus treatment on primary skip + a footer privacy link
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          outline: cs.outlineStyle + " " + cs.outlineWidth,
          outlineColor: cs.outlineColor,
          className: el.className,
        };
      });
      expect(focused, route.path + " focus target").toBeTruthy();
    }
    const unique = new Set(titles);
    expect(unique.size, "duplicate titles: " + titles.join(" | ")).toBe(titles.length);

    await page.goto("/studio/");
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(jsonLd);
    expect(data["@type"]).toBe("Organization");
    expect(data.name).toBe("Cradlepoint Studio");
    expect(data.logo || "", "Organization logo should be Cradlepoint Studio mark").toMatch(
      /cradlepoint-studio/
    );
    expect(String(data.logo || "")).not.toContain("veilcorp-avatar");
    expect(data.founder.name).toBe("J. Donavon Love");
    expect(Array.isArray(data.sameAs)).toBeTruthy();
    expect(data.sameAs.join(" ")).not.toContain("veilcorp-avatar");
    expect(data.sameAs).toContain("https://github.com/SigilForge/veildaemon");

    // Fragment targets on funding pitch must exist
    await page.goto("/studio/funding/");
    for (const id of ["problem", "customer", "revenue", "capital", "founder", "structure", "ask"]) {
      await expect(page.locator("#" + id)).toHaveCount(1);
    }
    // Click a fragment nav link and confirm destination is in view-ish
    await page.locator('a[href="#structure"]').first().click();
    await expect(page.locator("#structure")).toBeVisible();

    // Portal pathways fragment
    await page.goto("/studio/");
    await page.locator('a[href="#pathways"]').first().click();
    await expect(page.locator("#pathways")).toBeVisible();

    // Cache-bust query present on Studio CSS
    const cssHref = await page.locator('link[rel="stylesheet"][href*="studio.css"]').first().getAttribute("href");
    expect(cssHref).toMatch(/studio\.css\?v=20260713-brand2/);

    // Portal images must load and use versioned currentSrc
    await page.goto("/studio/");
    await page.waitForLoadState("networkidle");
    const imgReport = await page.evaluate(() => {
      return [...document.images].map((img) => ({
        src: img.getAttribute("src"),
        currentSrc: img.currentSrc,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
      }));
    });
    const broken = imgReport.filter((i) => !i.complete || i.naturalWidth === 0);
    expect(broken, JSON.stringify(broken, null, 2)).toEqual([]);
    const portalArt = imgReport.filter(
      (i) =>
        (i.src || "").includes("/studio/assets/site-") ||
        (i.src || "").includes("/studio/assets/site-hd/") ||
        (i.src || "").includes("/studio/assets/site-cards/")
    );
    expect(portalArt.length).toBeGreaterThan(3);
    for (const img of portalArt) {
      expect(img.src, img.src).toMatch(/\?v=20260712-srcfix1|20260712-navunity1/);
      // versioned src still required for art plates
      expect(img.src.includes("?v="), img.src).toBeTruthy();
    }
    // Brand mark is Cradlepoint Studio, not only VeilCorp
    expect(imgReport.some((i) => (i.src || "").includes("cradlepoint-studio-emblem"))).toBeTruthy();

    // Build marker present
    await expect(page.locator('meta[name="build-version"]')).toHaveAttribute(
      "content",
      /20260713-brand2/
    );
    const version = await page.request.get("/studio/version.json");
    expect(version.ok()).toBeTruthy();
  });

  test("static html rejects malformed cache-bust attributes", async () => {
    const fs = require("fs");
    const path = require("path");
    const root = path.join(__dirname, "../../studio");
    const bad = [];
    function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full);
        else if (name.endsWith(".html")) {
          const text = fs.readFileSync(full, "utf8");
          if (/\.(webp|png|jpe?g|css)"\?v=/i.test(text) || /"\?v=/.test(text)) {
            bad.push(full);
          }
        }
      }
    }
    walk(root);
    expect(bad, "malformed cache-bust outside quotes:\n" + bad.join("\n")).toEqual([]);
  });

  test("every studio route renders all images", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const route of studioRoutes) {
      await page.goto(route.path, { waitUntil: "networkidle" });
      // force lazy images
      await page.evaluate(async () => {
        for (const img of document.images) {
          img.loading = "eager";
          if (!img.complete) {
            await new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            });
          }
        }
      });
      const broken = await page.locator("img").evaluateAll((images) =>
        images
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.getAttribute("src"))
      );
      expect(broken, route.path + " broken images: " + JSON.stringify(broken)).toEqual([]);
    }
  });

  test("mobile route matrix and screenshots", async ({ page }) => {
    ensureReviewDir();
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of studioRoutes) {
      const response = await page.goto(route.path);
      expect(response && response.ok(), route.path + " mobile").toBeTruthy();
      await expect(page.locator("h1").first()).toBeVisible();
      await noHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(reviewDir, `studio-${route.name}-mobile.png`),
        fullPage: true,
      });
    }

    await page.goto("/studio/");
    await expect(page.locator(".pathway")).toHaveCount(6);
    await page.screenshot({
      path: path.join(reviewDir, "cradlepoint-studio-mobile.png"),
      fullPage: true,
    });
  });

  test("studio subtree crawler for local href and src", async ({ page }) => {
    const queue = new Set(["/studio/"]);
    const seen = new Set();
    const broken = [];

    while (queue.size) {
      const current = queue.values().next().value;
      queue.delete(current);
      if (seen.has(current)) continue;
      seen.add(current);

      const response = await page.request.get(current);
      if (!response.ok()) {
        broken.push({ url: current, status: response.status() });
        continue;
      }

      // Only crawl HTML studio pages
      const ct = response.headers()["content-type"] || "";
      if (!ct.includes("text/html")) continue;
      if (!current.startsWith("/studio")) continue;

      await page.goto(current);
      const links = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll("a[href], img[src], link[href], script[src]").forEach((el) => {
          const raw = el.getAttribute("href") || el.getAttribute("src");
          if (!raw) return;
          out.push(raw);
        });
        return out;
      });

      for (const raw of links) {
        if (raw.startsWith("mailto:") || raw.startsWith("http") || raw.startsWith("//") || raw.startsWith("data:")) {
          continue;
        }
        // Validate same-page fragments resolve to an element id
        if (raw.startsWith("#")) {
          if (raw === "#") continue;
          const id = raw.slice(1);
          const exists = await page.evaluate((frag) => !!document.getElementById(frag), id);
          if (!exists) broken.push({ url: raw, status: "missing-fragment", from: current });
          continue;
        }
        const absolute = new URL(raw, "https://veildaemon.app" + current).pathname;
        // Only assert local studio-related and shared site assets
        if (
          absolute.startsWith("/studio") ||
          absolute.startsWith("/assets") ||
          absolute.startsWith("/favicon") ||
          absolute.startsWith("/handler") ||
          absolute === "/" ||
          absolute.startsWith("/_vercel")
        ) {
          const assetResponse = await page.request.get(absolute);
          if (!assetResponse.ok() && !absolute.startsWith("/_vercel")) {
            broken.push({ url: absolute, status: assetResponse.status(), from: current });
          }
          if (absolute.startsWith("/studio") && absolute.endsWith("/")) {
            queue.add(absolute);
          }
          if (absolute.startsWith("/studio") && absolute.endsWith(".html")) {
            queue.add(absolute);
          }
        }
      }
    }

    expect(broken, JSON.stringify(broken, null, 2)).toEqual([]);
    expect(seen.size).toBeGreaterThan(8);
  });
});
