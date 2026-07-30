const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "TEST-OP",
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

test.describe("Operator Rules Abuse & Invariants Suite", () => {
  test("Invariant 1 & 4: Background bonuses never change baseRank & effectiveRank = baseRank + bonus", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    await page.locator('[name="background"]').selectOption("Tech");
    await expect(page.locator("#background-grant-preview")).toHaveText("Grants: Hacking +1, Engineering +1");

    await page.locator("#skill-picker").selectOption("Hacking");
    await page.locator("#skill-rank").fill("2");
    await page.getByRole("button", { name: "Add Skill" }).click();

    let state = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    expect(state.operatorStatus.skills.Hacking).toBe("1");

    const hackingRow = page.locator(".skill-summary-row", { hasText: "Hacking" });
    await expect(hackingRow.locator(".skill-summary-rank")).toHaveText("+2 (1+1)");
  });

  test("Invariant 2 & 3: Total free skill ranks <= 8 & Breach >= 0 (no negative Breach allowed)", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    const skills = ["Athletics", "Deception", "Stealth", "Awareness"];
    for (const s of skills) {
      await page.locator("#skill-picker").selectOption(s);
      await page.locator("#skill-rank").fill("2");
      await page.getByRole("button", { name: "Add Skill" }).click();
    }
    // Click [+] on 3 skills to spend 3 Bonus Breach points (1 Breach per rank step beyond 8) -> Bonus Breach becomes 0/3
    await page.getByRole("button", { name: "Increase Athletics rank" }).click();
    await page.getByRole("button", { name: "Increase Deception rank" }).click();
    await page.getByRole("button", { name: "Increase Stealth rank" }).click();
    await expect(page.getByText("Creation: skills 8/8 // attribute spread 0/6 // Bonus Breach 0/3")).toBeVisible();

    // Attempt to click [+] on Awareness (requires 1 Breach, but 0 available) -> MUST be rejected
    await page.getByRole("button", { name: "Increase Awareness rank" }).click();
    await expect(page.locator("#storage-status")).toContainText("Insufficient Breach");

    let state = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    expect(Number(state.operatorStatus.breachPoints)).toBe(0);
    expect(state.operatorStatus.skills.Awareness).toBe("2");
  });

  test("Invariant 5: Save & reload cannot alter point totals or corrupt sheet state", async ({ page }) => {
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
    await expect(page.locator("#skill-summary-list")).toContainText("Investigation");
    await expect(page.locator("#skill-summary-list")).toContainText("+3 (2+1)");
  });

  test("Invariant 6: UI Independence — Form dropdown vs inline [+] buttons produce identical JSON state", async ({ page }) => {
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

  test("Invariant 7: Background rapid swap loop preserves accounting integrity", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    await page.locator('[name="background"]').selectOption("Tech");
    await page.locator("#skill-picker").selectOption("Hacking");
    await page.locator("#skill-rank").fill("3");
    await page.getByRole("button", { name: "Add Skill" }).click();

    await page.locator('[name="background"]').selectOption("Burnout Professional");
    await page.locator('[name="background"]').selectOption("Local Witness");
    await page.locator('[name="background"]').selectOption("Tech");

    await page.reload();
    await page.getByRole("button", { name: "Sheet", exact: true }).click();

    const hackingRow = page.locator(".skill-summary-row", { hasText: "Hacking" });
    await expect(hackingRow.locator(".skill-summary-rank")).toHaveText("+3 (2+1)");

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    expect(state.operatorStatus.skills.Hacking).toBe("2");
    expect(Number(state.operatorStatus.breachPoints)).toBe(3);
  });

  test("Invariant 8: Local ↔ Live Table mode toggle does not mutate local character state", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    await page.locator("#skill-picker").selectOption("Athletics");
    await page.locator("#skill-rank").fill("3");
    await page.getByRole("button", { name: "Add Skill" }).click();

    const stateLocalBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));

    await page.locator('[data-mode="live"]').click();
    await page.locator("#live-join-code-input").fill("OPERATOR-075");
    await page.locator("#live-session-join-form button[type='submit']").click();

    await page.locator('[data-mode="local"]').click();

    const stateLocalAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    expect(stateLocalAfter.operatorStatus.skills.Athletics).toBe("3");
    expect(String(stateLocalAfter.operatorStatus.breachPoints)).toBe(String(stateLocalBefore.operatorStatus.breachPoints));
  });
});
