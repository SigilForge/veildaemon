const { test, expect } = require("@playwright/test");

const publicSurfaces = {
  "/": ["CASE FILE", "OPERATOR FILE", "REPORTS"],
  "/operator/": ["CASE FILE", "HOME", "REPORTS"],
  "/debrief/": ["CASE FILE", "OPERATOR FILE", "HOME"],
  "/recovered-operator-reports/": ["CASE FILE", "OPERATOR FILE", "HOME"],
  "/updates/": ["CASE FILE", "OPERATOR FILE", "REPORTS", "HOME"]
};

for (const [path, labels] of Object.entries(publicSurfaces)) {
  test(`surface navigation is visible on ${path}`, async ({ page }) => {
    await page.goto(path);

    const nav = page.getByRole("navigation", { name: "Surface files" });
    await expect(nav).toBeVisible();
    for (const label of labels) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
  });
}

test("operator file opens local anomaly preview before routing", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();

  const preview = page.locator("#operator-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("heading", { name: "LOCAL OPERATOR RECORD" })).toBeVisible();
  await expect(preview.getByText("DESIGNATION")).toBeVisible();
  await expect(preview.getByRole("link", { name: "Edit Personal File" })).toHaveAttribute("href", "/operator/");
});

test("local operator record preview mirrors saved operator file fields", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorConsole.v1", JSON.stringify({
      version: 1,
      operatorStatus: {
        operatorName: "Mara Vale",
        designation: "RECORD-MV-7",
        activeNeedlepoint: "Viridian House",
        stability: "8",
        harmBoxes: "2",
        attentionState: "Noted",
        misfireSeverity: "Minor",
        voidMarks: "4",
        breachPoints: "9",
        attributes: { Body: "1", Agility: "2", Mind: "3" },
        skills: { Investigation: "2", Occult: "1" }
      }
    }));
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "RECORD-MV-7",
      primaryFrequency: "Silence",
      observerClassification: "POTENTIAL OPERATOR",
      attentionStatus: "NOTED"
    }));
  });

  await page.goto("/updates/");
  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();

  const preview = page.locator("#operator-preview");
  await expect(preview.getByText("Mara Vale")).toBeVisible();
  await expect(preview.getByText("Silence")).toBeVisible();
  await expect(preview.getByText("Viridian House")).toBeVisible();
  await expect(preview.getByText("8/10")).toBeVisible();
  await expect(preview.getByText("2/5")).toBeVisible();
  await expect(preview.getByText("Investigation 2 // Occult 1")).toBeVisible();
});

test("surface drawers allow only one open preview", async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 1000 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();
  await expect(page.locator("#operator-preview")).toBeVisible();

  await nav.getByText("REPORTS").click();
  await expect(page.locator("#operator-preview")).not.toBeVisible();
  await expect(page.locator("#recovered-reports-drawer")).toBeVisible();
});

test("secondary surface tabs stay inside the console model", async ({ page }) => {
  for (const path of ["/operator/", "/debrief/", "/recovered-operator-reports/", "/updates/"]) {
    await page.goto(path);

    const links = await page.locator(".surface-tabs .surface-tab").evaluateAll((tabs) =>
      tabs.map((tab) => ({
        label: tab.querySelector("span")?.textContent?.trim(),
        detail: tab.querySelector("strong")?.textContent?.trim(),
        href: tab.getAttribute("href")
      }))
    );

    expect(links.find((link) => link.label === "CASE FILE")?.href).toBe("#casefile-drawer");
    expect(links.find((link) => link.label === "HOME")?.href).toBe("/");
    expect(links.some((link) => link.href?.includes("itch.io"))).toBe(false);
  }

  await page.goto("/operator/");
  await expect(page.locator(".surface-tabs .return-main-tab")).toHaveAttribute("href", "/");
  await expect(page.locator(".surface-tabs .return-main-tab strong")).toHaveText("RETURN HOME");
  await expect(page.locator("#casefile-drawer")).not.toBeVisible();
  await page.getByRole("navigation", { name: "Surface files" }).getByText("CASE FILE").click();
  await expect(page.locator("#casefile-drawer")).toBeVisible();

  for (const path of ["/debrief/", "/recovered-operator-reports/", "/updates/"]) {
    await page.goto(path);
    const nav = page.getByRole("navigation", { name: "Surface files" });
    await expect(nav.locator(".active-case-tab")).toHaveAttribute("href", "#operator-preview");
    await nav.getByText("OPERATOR FILE").click();
    await expect(page.locator("#operator-preview")).toBeVisible();
  }

  await page.goto("/recovered-operator-reports/");
  await expect(page.locator(".surface-tabs .return-main-tab")).toHaveAttribute("href", "/");
  await expect(page.locator(".surface-tabs .return-main-tab strong")).toHaveText("RETURN HOME");
});

test("preview panels normalize to the surface tab rack", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("CASE FILE").click();

  const homeHeights = await page.evaluate(() => {
    const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect().height || 0;
    const panel = document.querySelector(".casefile-panel")?.getBoundingClientRect().height || 0;
    return { tabs, panel };
  });
  expect(homeHeights.panel).toBeGreaterThanOrEqual(homeHeights.tabs - 2);

  await page.goto("/updates/#operator-preview");
  const noticeHeights = await page.evaluate(() => {
    const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect().height || 0;
    const panel = document.querySelector(".operator-preview-panel")?.getBoundingClientRect().height || 0;
    return { tabs, panel };
  });
  expect(noticeHeights.panel).toBeGreaterThanOrEqual(noticeHeights.tabs - 2);
});

test("report surface tabs ride the active terminal rail", async ({ page }) => {
  await page.goto("/recovered-operator-reports/");

  const rects = await page.evaluate(() => {
    const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
    const terminal = document.querySelector(".report-terminal")?.getBoundingClientRect();
    return {
      tabTop: tabs?.top || 0,
      tabLeft: tabs?.left || 0,
      terminalTop: terminal?.top || 0,
      terminalRight: terminal?.right || 0
    };
  });

  expect(Math.abs(rects.tabTop - rects.terminalTop)).toBeLessThanOrEqual(2);
  expect(Math.abs(rects.tabLeft - rects.terminalRight)).toBeLessThanOrEqual(2);
});
