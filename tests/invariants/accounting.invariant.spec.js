const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "INVARIANT-OP-ACCOUNTING",
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

test.describe("Invariant: Economy & Accounting Laws", () => {
  test("Mathematical Invariant: effectiveRank = baseRank + grantedBonus (baseRank is never mutated by grants)", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    await page.locator('[name="background"]').selectOption("Tech");
    await expect(page.locator("#background-grant-preview")).toHaveText("Grants: Hacking +1, Engineering +1");

    await page.locator("#skill-picker").selectOption("Hacking");
    await page.locator("#skill-rank").fill("2");
    await page.getByRole("button", { name: "Add Skill" }).click();

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    // Base rank must be 1 (effective 2 = 1 base + 1 bonus)
    expect(state.operatorStatus.skills.Hacking).toBe("1");

    const hackingRow = page.locator(".skill-summary-row", { hasText: "Hacking" });
    await expect(hackingRow.locator(".skill-summary-rank")).toHaveText("+2 (1+1)");
  });

  test("Mathematical Invariant: Creation skill budget is strictly capped & Bonus Breach point accounting cannot go negative", async ({ page }) => {
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
    // Spend 3 Bonus Breach points (1 Breach per step beyond free budget 8)
    await page.getByRole("button", { name: "Increase Athletics rank" }).click();
    await page.getByRole("button", { name: "Increase Deception rank" }).click();
    await page.getByRole("button", { name: "Increase Stealth rank" }).click();

    await expect(page.getByText("Creation: skills 8/8 // attribute spread 0/6 // Bonus Breach 0/3")).toBeVisible();

    // Reject further skill increases when Bonus Breach budget is exhausted
    await page.getByRole("button", { name: "Increase Awareness rank" }).click();
    await expect(page.locator("#storage-status")).toContainText("Insufficient Breach");

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    expect(Number(state.operatorStatus.breachPoints)).toBe(0);
    expect(state.operatorStatus.skills.Awareness).toBe("2");
  });
});
