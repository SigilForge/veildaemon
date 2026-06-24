const { test, expect } = require("@playwright/test");

test("handler overview exposes modular control cards", async ({ page }) => {
  await page.goto("/handler/");

  await expect(page.getByRole("heading", { name: "HANDLER OVERVIEW" })).toBeVisible();
  await expect(page.locator(".status-strip").getByText("Handler", { exact: true })).toBeVisible();
  await expect(page.getByText("Handler Exterior")).toHaveCount(0);
  const overview = page.getByLabel("Handler subsystem overview");
  await expect(overview.getByRole("link", { name: "Open Live Dashboard" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Manage NPCs" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open Entity Library" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Manage Clocks" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open Case File" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open Residue Log" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "View Operator Summaries" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open Player View" })).toBeVisible();

  await page.getByLabel("Template").selectOption("veilcorp-intake");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await expect(page.locator("#overview-case")).toContainText("VeilCorp Intake");
  await expect(page.locator("#overview-scene-state")).toContainText("Echoed");
});

test("handler live dashboard exposes at-table controls", async ({ page }) => {
  await page.goto("/handler/live/");

  await expect(page.getByRole("heading", { name: "LIVE DASHBOARD" })).toBeVisible();
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Stable/ })).toHaveClass(/is-active/);
  await expect(page.getByLabel("Primary clock segments")).toBeVisible();
  await expect(page.locator(".status-strip").getByText("Handler", { exact: true })).toBeVisible();
  await expect(page.getByText("Handler Exterior")).toHaveCount(0);
  await expect(page.getByText("Need -> Lure -> Pressure -> Gift -> Violence -> Exit")).toBeVisible();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toBeVisible();

  await page.getByLabel("Template").selectOption("veilcorp-intake");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await expect(page.locator('[name="session.caseTitle"]')).toHaveValue("VeilCorp Intake");
  await expect(page.getByLabel("Current Attention")).toHaveValue("Observed");
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Echoed/ })).toHaveClass(/is-active/);

  await page.locator('[name="roll.attribute"]').fill("3");
  await page.locator('[name="roll.skill"]').fill("2");
  await page.getByRole("button", { name: "Roll 3d6" }).click();
  await expect(page.locator("#roll-output")).toContainText("3d6");
  await expect(page.locator("#roll-output")).toContainText("Attribute 3 + Skill 2");

  await page.getByLabel("Player View").check();
  await expect(page.getByLabel("Player-facing display")).toBeVisible();
  await expect(page.getByLabel("Player-facing display")).toContainText("Intake pressure rising");
  await expect(page.getByLabel("Player-facing display")).not.toContainText("PRIVATE HANDLER NOTES");
});

test("handler module pages share case state", async ({ page }) => {
  await page.goto("/handler/cases/");
  await page.locator('[name="session.caseTitle"]').fill("Silence Gap");
  await page.locator('[name="caseFile.nextClue"]').fill("The exit sign points inward.");

  await page.goto("/handler/");
  await expect(page.locator("#overview-case")).toContainText("Silence Gap");
  await expect(page.locator("#overview-next-clue")).toContainText("The exit sign points inward.");

  await page.goto("/handler/player-view/");
  await expect(page.getByRole("heading", { name: "PLAYER VIEW" })).toBeVisible();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toHaveCount(0);
});

test("handler imports Operator JSON summaries", async ({ page }) => {
  await page.goto("/handler/operators/");

  const exportPayload = {
    exportType: "cradlepoint.operator",
    version: 1,
    exportedAt: "2026-06-24T20:00:00.000Z",
    operatorName: "June Rook",
    operatorId: "june-rook",
    operatorRecord: {
      designation: "JR-01",
      primaryFrequency: "Dream"
    },
    operatorStatus: {
      stability: "8",
      stabilityBand: "Echoed",
      harm: "Bruised",
      harmBoxes: "1",
      activeMisfire: "Door remembers the wrong name.",
      voidMarks: "2",
      breachPoints: "5",
      anchorPerson: "Blue lighter",
      emotionalState: "Afraid but focused",
      relationshipPressure: "Trust strained",
      selectedLotusPetal: "Dream",
      lotus: {
        Dream: "2",
        Hunger: "0",
        Silence: "1",
        Stillness: "0",
        Empyrean: "0",
        Becoming: "0"
      }
    }
  };

  await page.locator("#import-operator-file").setInputFiles({
    name: "june-rook.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exportPayload))
  });

  await expect(page.locator("#operator-import-results")).toContainText("ACCEPTED - June Rook");
  await expect(page.locator('[data-operator="0"][data-field="name"]')).toHaveValue("June Rook");
  await expect(page.locator('[data-operator="0"][data-field="stability"]')).toHaveValue("Echoed (8/10)");
  await expect(page.locator('[data-operator="0"][data-field="frequencyPips"]')).toHaveValue("Dream 2 // Silence 1");
  await expect(page.locator("#operator-grid")).toContainText("Last Imported");

  await page.goto("/handler/");
  await expect(page.locator("#overview-operators")).toContainText("June Rook");
  await expect(page.locator("#overview-operators")).toContainText("Dream");
});
