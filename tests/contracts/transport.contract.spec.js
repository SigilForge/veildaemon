const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "CONTRACT-OP-TRANSPORT",
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

test.describe("Contract: Transport Abstraction", () => {
  test("Design Contract: Local and Live Table transports preserve identical underlying game state", async ({ page }) => {
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await ensureEditSheetOn(page);
    await applyCoreStart(page);

    // Set skills in Local Mode
    await page.locator("#skill-picker").selectOption("Stealth");
    await page.locator("#skill-rank").fill("2");
    await page.getByRole("button", { name: "Add Skill" }).click();

    await page.locator("#skill-picker").selectOption("Athletics");
    await page.locator("#skill-rank").fill("3");
    await page.getByRole("button", { name: "Add Skill" }).click();

    // Capture Local state
    const localStateBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    expect(localStateBefore.operatorStatus.skills.Stealth).toBe("2");
    expect(localStateBefore.operatorStatus.skills.Athletics).toBe("3");

    // Switch to Live Mode and enter Session Code
    await page.locator('[data-mode="live"]').click();
    await page.locator("#live-join-code-input").fill("LIVE01");
    await page.locator("#live-session-join-form button[type='submit']").click();

    // Verify session bar UI reflects live mode without altering character state
    await expect(page.locator("#live-session-code-display")).toContainText("SESSION: LIVE01");

    const liveModeState = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    expect(liveModeState.operationMode).toBe("live");
    expect(liveModeState.activeLiveSession).toBe("LIVE01");
    expect(liveModeState.operatorStatus.skills.Stealth).toBe(localStateBefore.operatorStatus.skills.Stealth);
    expect(liveModeState.operatorStatus.skills.Athletics).toBe(localStateBefore.operatorStatus.skills.Athletics);
    expect(liveModeState.operatorStatus.breachPoints).toBe(localStateBefore.operatorStatus.breachPoints);

    // Switch back to Local Mode
    await page.locator('[data-mode="local"]').click();
    const localStateAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1")));
    expect(localStateAfter.operationMode).toBe("local");
    expect(localStateAfter.operatorStatus.skills.Stealth).toBe("2");
    expect(localStateAfter.operatorStatus.skills.Athletics).toBe("3");
  });
});
