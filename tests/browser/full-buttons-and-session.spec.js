const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "EXHAUSTIVE-OP-42",
      primaryFrequency: "Dream",
      observerClassification: "Operator",
      attentionStatus: "Local",
      accessLevel: "LOCAL"
    }));
  });
});

async function ensureEditSheetOn(page) {
  const btn = page.getByRole("button", { name: /Edit Sheet:/ });
  if (await btn.isVisible()) {
    const text = await btn.textContent();
    if (text.includes("Off")) await btn.click();
  }
}

test.describe("Exhaustive Button, Creation Point-Spending, & Live Table Session Walkthrough", () => {
  test("Complete lifecycle: Edit Sheet -> Create & Spend Points -> Join Lobby -> Play Rounds -> Handler Audit -> Reload", async ({ page, context }) => {
    // 1. Navigate to Operator sheet
    await page.goto("/operator/");
    await page.getByRole("button", { name: "Sheet", exact: true }).click();

    // 2. Enable Edit Sheet & Apply Core Start
    await ensureEditSheetOn(page);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Apply Core Start" }).click();
    await expect(page.locator("#storage-status")).toContainText("Core start applied");

    // 3. Select Background & Presentation Ontology
    await page.locator('[name="background"]').selectOption("Tech");
    await expect(page.locator("#background-grant-preview")).toHaveText("Grants: Hacking +1, Engineering +1");

    await page.locator('[name="ontologyPresentation"]').selectOption("Echo-Altered Presentation");
    await expect(page.locator("#ontology-grant-preview")).toContainText("Load: Echo Load");

    // 4. Verify Creation Mode is active after Core Start and spend points
    await expect(page.locator("#creation-mode-toggle")).toHaveText("Creation Mode: On");

    // Add trained skills to spend free creation budget
    const skillsToTrain = ["Athletics", "Deception", "Stealth", "Awareness"];
    for (const skill of skillsToTrain) {
      await page.locator("#skill-picker").selectOption(skill);
      await page.locator("#skill-rank").fill("2");
      await page.getByRole("button", { name: "Add Skill" }).click();
    }

    // Spend Bonus Breach points using inline [+] buttons
    await page.getByRole("button", { name: "Increase Athletics rank" }).click();
    await page.getByRole("button", { name: "Increase Deception rank" }).click();
    await page.getByRole("button", { name: "Increase Stealth rank" }).click();

    // Verify budget readout
    await expect(page.getByText("Creation: skills 8/8 // attribute spread 0/6 // Bonus Breach 0/3")).toBeVisible();

    // 5. Finalize Creation Mode
    await page.getByRole("button", { name: "Creation Mode: On" }).click();
    await expect(page.getByRole("button", { name: "Edit Sheet: Off" })).toBeVisible();

    // 6. Join Live Table Lobby via Quick Button
    const lobbyBtn = page.locator("#lobby-quick-btn");
    await expect(lobbyBtn).toBeVisible();
    await lobbyBtn.click();

    await expect(page.locator("#live-session-bar")).toBeVisible();
    await page.locator("#live-join-code-input").fill("EXACT1");
    await page.locator("#live-session-join-form button[type='submit']").click();

    await expect(lobbyBtn).toHaveText("🟢 LOBBY: EXACT1");

    // 7. Perform Action Rolls (Standard, Advantage, Disadvantage, Modifiers)
    await page.locator("#roll-skill").selectOption("Hacking");
    await page.locator("#roll-action").click();

    await expect(page.locator("#roll-output")).toContainText("Hacking");
    await expect(page.locator("#roll-sync-status")).toBeVisible();

    // Roll with Advantage
    await page.locator('[name="rollAdvantage"]').check();
    await page.locator("#roll-action").click();
    await expect(page.locator("#roll-output")).toContainText("ADVANTAGE");

    // Roll with Disadvantage & Manual Modifier
    await page.locator('[name="rollDisadvantage"]').check();
    await page.locator('[name="rollModifier"]').fill("2");
    await page.locator("#roll-action").click();
    await expect(page.locator("#roll-output")).toContainText("DISADVANTAGE");
    await expect(page.locator("#roll-output")).toContainText("MOD 2");

    // 8. Adjust Harm, Stability, and Presentation Load Steps
    // Modify Harm
    const harmBox2 = page.locator("#tracker-board button[data-track='harm'][data-box='2']");
    if (await harmBox2.isVisible()) {
      await harmBox2.click();
    }

    // Adjust Blood Load meter step
    const bloodStep2 = page.locator("button[data-presentation-step='2']").first();
    if (await bloodStep2.isVisible()) {
      await bloodStep2.click();
    }

    // 9. Reconcile with Handler Live Dashboard
    const handlerPage = await context.newPage();
    await handlerPage.goto("/handler/live/");

    // Verify incoming operator rolls appear in Handler Keep Honest Roll Feed
    await expect(handlerPage.locator("#roll-feed-list")).toBeVisible();
    await expect(handlerPage.locator("#roll-feed-list")).toContainText("EXHAUSTIVE-OP-42");
    await expect(handlerPage.locator("#roll-feed-list")).toContainText("Hacking");

    // 10. Verify Persistence & Clean Disconnection on Operator Sheet
    await page.bringToFront();
    await page.reload();
    await page.getByRole("button", { name: "Sheet", exact: true }).click();

    // Verify all points, skills, background, and session code persist
    await expect(page.locator("#skill-summary-list")).toContainText("Hacking");
    await expect(page.locator("#skill-summary-list")).toContainText("Athletics");
    await expect(lobbyBtn).toHaveText("🟢 LOBBY: EXACT1");

    // Disconnect and switch back to Local mode
    await page.locator("#live-session-disconnect").click();
    await page.locator('[data-mode="local"]').click();

    await expect(lobbyBtn).toHaveText("⚡ JOIN LOBBY");
  });
});
