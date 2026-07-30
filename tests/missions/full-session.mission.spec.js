const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "MISSION-OP",
      primaryFrequency: "Dream",
      observerClassification: "Operator",
      attentionStatus: "Local",
      accessLevel: "LOCAL"
    }));
  });
});

test.describe("Mission: Full Tabletop Game Session Loop", () => {
  test("Mission Test: End-to-End Game Session Lifecycle (Join Table, Modify State, Sync, Reload, Reconnect)", async ({ page }) => {
    // Phase 1: Initialize Operator Console
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();

    // Enable edit sheet if needed
    const editBtn = page.getByRole("button", { name: /Edit Sheet:/ });
    if (await editBtn.isVisible()) {
      const text = await editBtn.textContent();
      if (text.includes("Off")) await editBtn.click();
    }

    // Apply Core Start to establish baseline character state
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Apply Core Start" }).click();

    // Select Background & Skill
    await page.locator('[name="background"]').selectOption("Tech");
    await page.locator("#skill-picker").selectOption("Hacking");
    await page.locator("#skill-rank").fill("2");
    await page.getByRole("button", { name: "Add Skill" }).click();

    // Phase 2: Connect Operator to Live Session
    await page.locator('[data-mode="live"]').click();
    await page.locator("#live-join-code-input").fill("MISSION-1");
    await page.locator("#live-session-join-form button[type='submit']").click();

    await expect(page.locator("#live-session-code-display")).toContainText("SESSION: MISSIO");

    // Phase 3: Modify State in Active Session (Take Damage / Adjust Load)
    const initialHackingState = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1"));
      return state.operatorStatus.skills.Hacking;
    });
    expect(initialHackingState).toBe("1");

    // Phase 4: Reload Browser (Simulate Connection Drop / Page Refresh)
    await page.reload();
    await page.getByRole("button", { name: "Sheet", exact: true }).click();

    // Phase 5: Verify Identical State Preserved
    const reloadedState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1"));
    });

    expect(reloadedState.operationMode).toBe("live");
    expect(reloadedState.operatorStatus.skills.Hacking).toBe("1");

    // Phase 6: Disconnect and Verify Clean Reversion to Local Mode
    await page.locator("#live-session-disconnect").click();
    await page.locator('[data-mode="local"]').click();

    const disconnectedState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("veildaemon.operatorConsole.v1"));
    });

    expect(disconnectedState.operationMode).toBe("local");
    expect(disconnectedState.activeLiveSession).toBe("");
    expect(disconnectedState.operatorStatus.skills.Hacking).toBe("1");
  });
});
