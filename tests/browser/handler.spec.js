const { test, expect } = require("@playwright/test");

test("handler overview exposes modular control cards", async ({ page }) => {
  await page.goto("/handler/");

  await expect(page.getByRole("heading", { name: "HANDLER OVERVIEW" })).toBeVisible();
  await expect(page.getByText("JSON")).toHaveCount(0);
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
  await expect(page.getByText("JSON")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "LIVE MODE" })).toHaveClass(/is-active/);
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Stable/ })).toHaveClass(/is-active/);
  await expect(page.getByLabel("Primary clock segments")).toBeVisible();
  await expect(page.locator(".status-strip").getByText("Handler", { exact: true })).toBeVisible();
  await expect(page.getByText("Handler Exterior")).toHaveCount(0);
  await expect(page.getByText("Need -> Lure -> Pressure -> Gift -> Violence -> Exit")).toBeVisible();
  await expect(page.getByText("THE ROOM ANSWERS", { exact: true })).toBeVisible();
  await expect(page.getByText("Misfire / target guide")).toBeVisible();
  await expect(page.locator("#operator-risk-strip")).toBeVisible();
  await expect(page.getByText("NPC / ROSTER")).toBeVisible();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toBeHidden();
  await expect(page.getByLabel("Template")).toBeHidden();

  const layoutMetrics = await page.evaluate(() => {
    const widths = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => node.getBoundingClientRect().width);
    return {
      loop: widths("#entity-loop-grid textarea"),
      roomFields: widths(".room-answer-fields input"),
      clockTicks: document.querySelector('[name="primaryClock.ticksWhen"]')?.getBoundingClientRect().width || 0
    };
  });
  expect(Math.min(...layoutMetrics.loop)).toBeGreaterThan(250);
  expect(Math.min(...layoutMetrics.roomFields)).toBeGreaterThan(250);
  expect(layoutMetrics.clockTicks).toBeGreaterThan(250);

  await expect(page.locator("#room-answer-preview")).toContainText("Object");
  await expect(page.locator("#room-answer-preview")).toContainText("ordinary detail not selected");
  await expect(page.locator("#room-answer-preview")).toContainText("Choose one ordinary detail, one emotional pressure, and one consequence.");
  await page.getByLabel("Ordinary Object").fill("mirror");
  await page.getByLabel("Emotional Input").fill("refused self");
  await page.getByLabel("Consequence", { exact: true }).fill("the reflected version answers first");
  await expect(page.locator("#room-answer-preview")).toContainText("Make mirror answer refused self by revealing the reflected version answers first.");
  await expect(page.locator("#room-answer-preview")).toContainText("The mirror changes first.");

  const rollMetrics = await page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { width: rect.width, top: rect.top } : { width: 0, top: 0 };
    };
    return {
      attribute: box('[name="roll.attribute"]'),
      skill: box('[name="roll.skill"]'),
      modifier: box('[name="roll.modifier"]'),
      mode: box(".roll-mode"),
      button: box("#roll-button")
    };
  });
  expect(rollMetrics.attribute.width).toBeGreaterThan(90);
  expect(rollMetrics.skill.width).toBeGreaterThan(90);
  expect(rollMetrics.modifier.width).toBeGreaterThan(90);
  expect(rollMetrics.mode.top).toBeGreaterThan(rollMetrics.attribute.top);
  expect(rollMetrics.button.top).toBeGreaterThan(rollMetrics.attribute.top);

  await page.getByRole("button", { name: "PREP" }).click();
  await expect(page.getByRole("button", { name: "PREP" })).toHaveClass(/is-active/);
  await expect(page.locator("#npc-grid")).toBeVisible();
  const secondaryClockMetrics = await page.evaluate(() => {
    const panel = document.querySelector(".secondary-panel details");
    const fields = Array.from(document.querySelectorAll(".secondary-clock-grid input, .secondary-clock-grid select"));
    return {
      overflow: panel ? panel.scrollWidth - panel.clientWidth : 0,
      narrowestField: Math.min(...fields.map((field) => field.getBoundingClientRect().width))
    };
  });
  expect(secondaryClockMetrics.overflow).toBeLessThanOrEqual(2);
  expect(secondaryClockMetrics.narrowestField).toBeGreaterThan(110);
  await expect(page.getByLabel("Template")).toHaveValue("veilcorp-intake");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await expect(page.locator('[name="session.caseTitle"]')).toHaveValue("VeilCorp Intake");
  await expect(page.locator('[name="entityLoop.Need"]')).toHaveValue("A complete self to copy, correct, or preserve.");
  await expect(page.locator('[name="entityLoop.Exit"]')).toHaveValue("Refuse the false self, speak one specific truth while witnessed, and leave together before the chamber chooses.");
  await expect(page.getByLabel("Current Attention")).toHaveValue("Observed");
  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Echoed/ })).toHaveClass(/is-active/);
  await page.getByRole("button", { name: "PREP" }).click();
  await page.getByLabel("Template").selectOption("viridian-house");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await expect(page.locator('[name="session.caseTitle"]')).toHaveValue("Viridian House");
  await expect(page.locator('[name="entityLoop.Need"]')).toHaveValue("The moment before confession, when someone edits themselves to survive being seen.");
  await expect(page.locator('[name="primaryClock.name"]')).toHaveValue("Audience Before Clock");

  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await page.locator('[name="roll.attribute"]').fill("3");
  await page.locator('[name="roll.skill"]').fill("2");
  await page.getByRole("button", { name: "Roll 3d6" }).click();
  await expect(page.locator("#roll-output")).toContainText("3d6");
  await expect(page.locator("#roll-output")).toContainText("Attribute 3 + Skill 2");

  await page.getByLabel("Player View").check();
  await expect(page.getByLabel("Player-facing display")).toBeVisible();
  await expect(page.getByLabel("Player-facing display")).toContainText("Mara Venn missing inside the building");
  await expect(page.getByLabel("Player-facing display")).not.toContainText("PRIVATE HANDLER NOTES");

  await page.getByRole("button", { name: "ARCHIVE" }).click();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toBeVisible();
  await expect(page.getByLabel("Dashboard controls")).toBeVisible();
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

test("handler imports Operator Record summaries", async ({ page }) => {
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
    },
    operatorEquipment: [
      { category: "Default Kit", item: "Phone" },
      { category: "Optional Carry", item: "Chalk or marker" },
      { category: "Background Tool", item: "Technician: toolkit, cables, diagnostic meter" }
    ]
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
  await expect(page.locator('[data-operator="0"][data-field="equipment"]')).toHaveValue("Chalk or marker // Technician: toolkit, cables, diagnostic meter");
  await expect(page.locator("#operator-grid")).toContainText("Last Imported");

  await page.goto("/handler/");
  await expect(page.locator("#overview-operators")).toContainText("June Rook");
  await expect(page.locator("#overview-operators")).toContainText("Dream");
});

test("handler exports Operator authorization packets", async ({ page }) => {
  await page.goto("/handler/operators/");

  await expect(page.getByLabel("Presentation / Ontology")).toContainText("Sanguine Presentation");
  await expect(page.getByLabel("Presentation / Ontology")).toContainText("Void-Shard");
  await expect(page.getByLabel("Background")).toContainText("Field Medic");
  await expect(page.getByLabel("Background")).toContainText("Sanguine Adjacent");
  await page.getByLabel("Presentation / Ontology").selectOption(["SANGUINE", "VOID_SHARD"]);
  await page.getByLabel("Background").selectOption(["FIELD_MEDIC", "LOCAL_WITNESS"]);
  await page.getByLabel("Case Unlock").selectOption("NEEDLEPOINT_SURVIVOR");
  await page.getByLabel("Target Operator Name / Record ID").fill("June Rook");
  await page.getByLabel("Void Reward").fill("2");
  await page.getByLabel("Breach Reward").fill("5");
  await expect(page.locator("#authorization-preview")).toContainText("ONTOLOGY_UNLOCK:SANGUINE");
  await expect(page.locator("#authorization-preview")).toContainText("BREACH_REWARD:5");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Authorization Packet" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("cradlepoint-authorization-june-rook");
  const payload = JSON.parse(require("fs").readFileSync(await download.path(), "utf8"));
  expect(payload.exportType).toBe("cradlepoint.authorization");
  expect(payload.flags).toEqual([
    "ONTOLOGY_UNLOCK:SANGUINE",
    "ONTOLOGY_UNLOCK:VOID_SHARD",
    "BACKGROUND_UNLOCK:FIELD_MEDIC",
    "BACKGROUND_UNLOCK:LOCAL_WITNESS",
    "CASE_UNLOCK:NEEDLEPOINT_SURVIVOR",
    "VOID_REWARD:2",
    "BREACH_REWARD:5"
  ]);
  expect(payload.operatorName).toBe("June Rook");
  expect(payload.note).toContain("Sanguine Presentation, Void-Shard available for review");
});
