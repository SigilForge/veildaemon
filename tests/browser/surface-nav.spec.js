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

test("operator file opens local node dossier before routing", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();

  const preview = page.locator("#operator-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("heading", { name: "OPERATOR FILE" })).toBeVisible();
  await expect(preview.getByText("PERSONAL OPERATIONS RECORD")).toBeVisible();
  await expect(preview.getByText("ATTRIBUTES // SKILLS // FREQUENCY // CASE NOTES")).toBeVisible();
  await expect(preview.getByText("MANUAL ONLY")).toBeVisible();
  await expect(preview.getByRole("link", { name: "Enter Local Node" })).toHaveAttribute("href", "/operator/");
  await expect(preview.getByRole("link", { name: "Return To Intake" })).toHaveAttribute("href", "/#intake-node");
  await expect(preview.getByRole("link", { name: "Review Reports" })).toHaveCount(0);
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
  await nav.getByText("CASE FILE").click();

  const preview = page.locator("#casefile-drawer");
  await expect(preview.getByText("Mara Vale")).toBeVisible();
  await expect(preview.getByText("Silence")).toBeVisible();
  await expect(preview.getByText("Viridian House")).toBeVisible();
  await expect(preview.getByText("8/10")).toBeVisible();
  await expect(preview.getByText("2/5")).toBeVisible();
  await expect(preview.getByText("Investigation 2 // Occult 1")).toBeVisible();
});

test("home case file grounds intake record with operator file data", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "RECORD-MV-7",
      primaryFrequency: "Silence",
      observerClassification: "POTENTIAL OPERATOR",
      attentionStatus: "NOTED",
      accessLevel: "INTAKE ACCEPTED",
      assignmentGroup: "THE REDACTED",
      handlerSignal: "SHADE",
      archiveAuthority: "VEILCORP",
      intakeNode: "VEILDAEMON",
      observedTraits: [],
      frequencyDrift: [{ frequency: "Silence", value: 2 }],
      knownIncidents: ["Silence Gap"],
      incidentExposure: ["Silence Gap"],
      archiveFlags: ["OBSERVED: Operator Intake"],
      relatedRecords: [],
      recommendedTraining: "Document absences.",
      archiveRoute: "https://wiki.veildaemon.app/",
      classificationHistory: [],
      visits: 1,
      filesReviewed: 2,
      lastSeen: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    }));
    window.localStorage.setItem("veildaemon.operatorConsole.v1", JSON.stringify({
      version: 1,
      operatorStatus: {
        operatorName: "Mara Vale",
        activeNeedlepoint: "Viridian House",
        stability: "8",
        harmBoxes: "2",
        voidMarks: "4",
        breachPoints: "9",
        attributes: { Body: "1", Mind: "3" },
        skills: { Investigation: "2" }
      }
    }));
  });

  await page.goto("/");
  await page.getByRole("navigation", { name: "Surface files" }).getByText("CASE FILE").click();

  const caseFile = page.locator("#casefile-drawer");
  await expect(caseFile.getByText("Mara Vale")).toBeVisible();
  await expect(caseFile.getByText("Viridian House")).toBeVisible();
  await expect(caseFile.getByText("8/10")).toBeVisible();
  await expect(caseFile.getByText("4 / 9")).toBeVisible();
  await expect(caseFile.getByText("Investigation 2")).toBeVisible();
});

test("empty home case file opens intake", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("CASE FILE").click();

  await expect(page.locator("#casefile-empty")).toBeVisible();
  await page.getByRole("button", { name: "Complete Intake" }).click();

  await expect(page.locator("#intake-node")).toBeVisible();
  await expect(page.locator("#casefile-drawer")).not.toBeVisible();
});

test("empty subpage case file offers intake route", async ({ page }) => {
  await page.goto("/updates/");
  await page.getByRole("navigation", { name: "Surface files" }).getByText("CASE FILE").click();

  const caseFile = page.locator("#casefile-drawer");
  await expect(caseFile.getByText("INTAKE REQUIRED")).toBeVisible();
  await expect(caseFile.getByRole("link", { name: "Complete Intake" })).toHaveAttribute("href", "/#intake-node");
});

test("operator file edits sync into local record preview on other surfaces", async ({ page }) => {
  await page.goto("/operator/");

  await page.getByRole("button", { name: "Sheet" }).click();
  await page.locator('[name="operatorName"]').fill("June Rook");
  await page.locator('[name="activeNeedlepoint"]').fill("Silence Gap");
  await page.locator('[name="voidMarks"]').fill("3");
  await page.locator('[name="breachPoints"]').fill("7");

  await page.goto("/debrief/");
  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("CASE FILE").click();

  const preview = page.locator("#casefile-drawer");
  await expect(preview.getByText("June Rook")).toBeVisible();
  await expect(preview.getByText("Silence Gap")).toBeVisible();
  await expect(preview.getByText("3 / 7")).toBeVisible();
});

test("shift clicking file tabs bypasses preview and routes directly", async ({ page }) => {
  await page.goto("/updates/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();
  await expect(page.locator("#operator-preview")).toBeVisible();

  await page.goto("/updates/");
  await nav.getByText("OPERATOR FILE").click({ modifiers: ["Shift"] });
  await expect(page).toHaveURL(/\/operator\/$/);

  await page.goto("/updates/");
  await page.getByRole("navigation", { name: "Surface files" }).getByText("REPORTS").click({ modifiers: ["Shift"] });
  await expect(page).toHaveURL(/\/recovered-operator-reports\/$/);
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

test("home operator drawer moves the tab rack to the open file rail", async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 1000 });
  await page.goto("/");

  await page.getByRole("navigation", { name: "Surface files" }).getByText("OPERATOR FILE").click();
  await expect(page.locator("#operator-preview")).toBeVisible();
  await page.waitForTimeout(300);

  const rects = await page.evaluate(() => {
    const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
    const drawer = document.querySelector("#operator-preview")?.getBoundingClientRect();
    return {
      tabLeft: tabs?.left || 0,
      drawerRight: drawer?.right || 0
    };
  });

  expect(Math.abs(rects.tabLeft - rects.drawerRight)).toBeLessThanOrEqual(2);
});

test("operator file tab toggles the open drawer closed", async ({ page }) => {
  await page.setViewportSize({ width: 2600, height: 1000 });
  await page.goto("/updates/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();
  await expect(page.locator("#operator-preview")).toBeVisible();

  await nav.getByText("OPERATOR FILE").click();
  await expect(page.locator("#operator-preview")).not.toBeVisible();
  await expect(page).not.toHaveURL(/#operator-preview$/);
});

test("operator drawer close restores the tab rack to the terminal rail", async ({ page }) => {
  await page.setViewportSize({ width: 2600, height: 1000 });
  await page.goto("/updates/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();
  await expect(page.locator("#operator-preview")).toBeVisible();

  await page.locator("#operator-preview").getByRole("link", { name: "Close" }).click();
  await expect(page.locator("#operator-preview")).not.toBeVisible();

  const rects = await page.evaluate(() => {
    const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
    const terminal = document.querySelector(".report-terminal")?.getBoundingClientRect();
    return {
      tabLeft: tabs?.left || 0,
      terminalRight: terminal?.right || 0
    };
  });

  expect(Math.abs(rects.tabLeft - rects.terminalRight)).toBeLessThanOrEqual(2);
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

test("updates four-tab rack sits below the status rail", async ({ page }) => {
  await page.goto("/updates/");

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

  expect(rects.tabTop - rects.terminalTop).toBeGreaterThanOrEqual(18);
  expect(rects.tabTop - rects.terminalTop).toBeLessThanOrEqual(70);
  expect(Math.abs(rects.tabLeft - rects.terminalRight)).toBeLessThanOrEqual(2);
});

test("updates file tabs have enough room for their labels", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 680 });
  await page.goto("/updates/");

  const tabs = await page.locator(".surface-tabs .surface-tab").evaluateAll((items) =>
    items.map((tab) => ({
      label: tab.querySelector("span")?.textContent?.trim(),
      clientHeight: tab.clientHeight,
      scrollHeight: tab.scrollHeight
    }))
  );

  expect(tabs.map((tab) => tab.label)).toEqual(["CASE FILE", "OPERATOR FILE", "REPORTS", "HOME"]);
  for (const tab of tabs) {
    expect(tab.clientHeight).toBeGreaterThanOrEqual(tab.scrollHeight - 1);
  }
});

test("updates drawers open on the same vertical rail as their tabs", async ({ page }) => {
  await page.setViewportSize({ width: 2600, height: 1000 });
  await page.goto("/updates/");

  const checks = [
    { label: "CASE FILE", drawer: "#casefile-drawer" },
    { label: "OPERATOR FILE", drawer: "#operator-preview" },
    { label: "REPORTS", drawer: "#recovered-reports-drawer" }
  ];

  for (const check of checks) {
    await page.getByRole("navigation", { name: "Surface files" }).getByText(check.label).click();
    await expect(page.locator(check.drawer)).toBeVisible();

    const rects = await page.evaluate((drawerSelector) => {
      const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
      const drawer = document.querySelector(drawerSelector)?.getBoundingClientRect();
      return {
        tabTop: tabs?.top || 0,
        drawerTop: drawer?.top || 0
      };
    }, check.drawer);

    expect(Math.abs(rects.tabTop - rects.drawerTop)).toBeLessThanOrEqual(2);

    await page.locator(check.drawer).getByRole("link", { name: "Close" }).click();
    await expect(page.locator(check.drawer)).not.toBeVisible();
  }
});
