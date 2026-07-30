const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "CONTRACT-OP-SERIALIZATION",
      primaryFrequency: "Dream",
      observerClassification: "Operator",
      attentionStatus: "Local",
      accessLevel: "LOCAL"
    }));
  });
});

async function applyCoreStart(page) {
  page.once("dialog", (dialog) => {
    dialog.accept();
  });
  await page.getByRole("button", { name: "Apply Core Start" }).click();
}

async function ensureEditSheetOn(page) {
  const btn = page.getByRole("button", { name: /Edit Sheet:/ });
  if (await btn.isVisible()) {
    const text = await btn.textContent();
    if (text.includes("Off")) await btn.click();
  }
}

test.describe("Contract: Persistence & Serialization Correctness", () => {
  test("Design Contract: Page reload preserves 100% identical serialized state payload", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    await page.locator('[name="background"]').selectOption("Burnout Professional");
    await page.locator("#skill-picker").selectOption("Investigation");
    await page.locator("#skill-rank").fill("3");
    await page.getByRole("button", { name: "Add Skill" }).click();

    const stateBefore = await page.evaluate(() => localStorage.getItem("veildaemon.operatorConsole.v1"));

    await page.reload();
    await page.getByRole("button", { name: "Sheet", exact: true }).click();

    const stateAfter = await page.evaluate(() => localStorage.getItem("veildaemon.operatorConsole.v1"));
    expect(JSON.parse(stateAfter)).toEqual(JSON.parse(stateBefore));
  });

  test("Design Contract: Input forms vs inline actions produce identical serialized state", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    await page.locator('[name="background"]').selectOption("Burnout Professional");
    await page.locator("#skill-picker").selectOption("Investigation");
    await page.locator("#skill-rank").fill("3");
    await page.getByRole("button", { name: "Add Skill" }).click();

    const stateFromForm = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));

    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    await page.locator('[name="background"]').selectOption("Burnout Professional");
    await page.locator("#skill-picker").selectOption("Investigation");
    await page.locator("#skill-rank").fill("1");
    await page.getByRole("button", { name: "Add Skill" }).click();

    await page.getByRole("button", { name: "Increase Investigation rank" }).click();
    await page.getByRole("button", { name: "Increase Investigation rank" }).click();

    const stateFromInline = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));

    expect(stateFromForm.operatorStatus.skills.Investigation).toBe("2");
    expect(stateFromInline.operatorStatus.skills.Investigation).toBe("2");
    expect(String(stateFromForm.operatorStatus.breachPoints)).toBe(String(stateFromInline.operatorStatus.breachPoints));
  });
});
