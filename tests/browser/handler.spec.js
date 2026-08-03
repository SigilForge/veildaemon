const { test, expect } = require("@playwright/test");

async function enableHandlerFieldEdit(page) {
  const onButton = page.getByRole("button", { name: "Edit Fields: On" });
  if (await onButton.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: "Edit Fields: Off" }).click();
  await expect(onButton).toBeVisible();
}

// Live screen focus mode (RUN / PRESSURE / REFERENCE, see handler.js and
// Docs/DESIGN_CONSTRAINTS.md). Only meaningful on /handler/live/ while dashboard
// mode is "live" -- the switch itself is hidden in PREP/ARCHIVE, where every
// panel's visibility is still decided by data-mode-panel alone.
async function switchLiveView(page, view) {
  const button = page.locator(`.live-view-switch [data-live-toggle="${view}"]`);
  // No-op off the Live screen (or outside LIVE MODE, where the switch is itself hidden) --
  // callers that are shared across live and non-live pages, like selectClueChip below,
  // rely on this being safe to call unconditionally.
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function setPrimaryClockForCollapseStaging(page, value = 6) {
  await page.evaluate((clockValue) => {
    const api = window.HandlerState;
    let next = api.readState();
    next.primaryClock.current = clockValue;
    next = api.syncCollapseRewriteStaging(api.normalizeState(next));
    api.writeState(next);
    if (window.HandlerCollapse) window.HandlerCollapse.render(api.readState());
  }, value);
}

async function applyHandlerTemplate(page, templateId) {
  const returnTo = page.url();
  const onOverview = /\/handler\/?$/.test(new URL(returnTo).pathname);
  if (!onOverview) {
    await page.goto("/handler/");
  }
  await enableHandlerFieldEdit(page);

  page.once("dialog", (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("unloads");
    dialog.accept();
  });
  if (templateId) {
    await page.getByLabel("Template").selectOption(templateId);
  }
  await page.getByRole("button", { name: "Apply Template" }).click();
  await page.waitForFunction(() => {
    const api = window.HandlerState;
    if (!api) return false;
    const state = api.readState();
    if (!state?.activeNeedlepoint?.id) return false;
    if (!state.activeNeedlepoint.scaffold) return true;
    return Boolean(state.clueIntegrity?.clues?.length);
  }, null, { timeout: 10000 });

  if (!onOverview) {
    await page.goto(returnTo);
    if (returnTo.includes("/handler/live/")) {
      await enableHandlerFieldEdit(page);
    }
    await page.waitForFunction(() => {
      const api = window.HandlerState;
      if (!api) return false;
      const state = api.readState();
      if (!state?.activeNeedlepoint?.scaffold) return true;
      return Boolean(state.clueIntegrity?.clues?.length);
    }, null, { timeout: 10000 });
  }
}

test("handler apply template confirm cancels without replacing case", async ({ page }) => {
  await page.goto("/handler/");
  await applyHandlerTemplate(page, "veilcorp-intake");
  await expect(page.locator("#overview-case")).toContainText("VeilCorp Intake");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Template").selectOption("viridian-house");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await expect(page.locator("#overview-case")).toContainText("VeilCorp Intake");
});

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
  await expect(overview.getByRole("link", { name: "Open Clue Tracker" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open Residue Log" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "View Operator Summaries" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open Player View" })).toBeVisible();

  await enableHandlerFieldEdit(page);
  await applyHandlerTemplate(page, "veilcorp-intake");
  await expect(page.locator("#overview-case")).toContainText("VeilCorp Intake");
  await expect(page.locator("#overview-scene-state")).toContainText("Echoed");
});

test("handler live dashboard exposes at-table controls", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);

  await expect(page.getByRole("heading", { name: "LIVE DASHBOARD" })).toBeVisible();
  await expect(page.getByText("JSON")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "LIVE MODE" })).toHaveClass(/is-active/);
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Stable/ })).toHaveClass(/is-active/);
  await expect(page.getByLabel("Primary clock segments")).toBeVisible();
  await expect(page.locator(".status-strip").getByText("Handler", { exact: true })).toBeVisible();
  await expect(page.getByText("Handler Exterior")).toHaveCount(0);

  // Entity/Zone Loop and The Room Answers live in the REFERENCE live-view tab.
  await switchLiveView(page, "reference");
  await expect(page.getByText("Need -> Lure -> Pressure -> Gift -> Violence -> Exit")).toBeVisible();
  await expect(page.getByText("THE ROOM ANSWERS", { exact: true })).toBeVisible();

  // Quick Roll (misfire guide, roll dock) and the rest of RUN.
  await switchLiveView(page, "run");
  await expect(page.getByText("Misfire / target guide")).toBeVisible();
  await expect(page.locator("#operator-risk-strip")).toBeVisible();
  await expect(page.getByText("NPC / ROSTER")).toBeVisible();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toBeHidden();
  await expect(page.getByLabel("Template")).toBeHidden();

  await switchLiveView(page, "reference");
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

  await switchLiveView(page, "run");
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
  expect(rollMetrics.button.top).toBeGreaterThan(rollMetrics.attribute.top);
  expect(rollMetrics.mode.top).toBeGreaterThan(rollMetrics.button.top);

  await page.getByRole("button", { name: "PREP" }).click();
  await expect(page.getByRole("button", { name: "PREP" })).toHaveClass(/is-active/);
  await expect(page.getByLabel("Enemy Opportunities")).toBeHidden();
  await expect(page.getByLabel("Operator Counterplay")).toBeHidden();
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
  await expect(page.getByLabel("Template")).toBeHidden();
  await applyHandlerTemplate(page, "veilcorp-intake");
  await expect(page.locator('[name="session.caseTitle"]')).toHaveValue("VeilCorp Intake");
  await expect(page.locator('[name="entityLoop.Need"]')).toHaveValue("A complete self to copy, correct, or preserve.");
  await expect(page.locator('[name="entityLoop.Exit"]')).toHaveValue("Refuse the false self, speak one specific truth while witnessed, and leave together before the chamber chooses.");
  await expect(page.getByLabel("Current Attention")).toHaveValue("Noticed");
  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Echoed/ })).toHaveClass(/is-active/);
  await page.getByRole("button", { name: "PREP" }).click();
  await applyHandlerTemplate(page, "viridian-house");
  await expect(page.locator('[name="session.caseTitle"]')).toHaveValue("Viridian House");
  await expect(page.locator('[name="entityLoop.Need"]')).toHaveValue("The moment before confession, when someone edits themselves to survive being seen.");
  await expect(page.locator('[name="primaryClock.name"]')).toHaveValue("Audience Before Clock");
  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await expect(page.locator('[name="attention.residue"]')).toHaveValue("Screens hesitate before showing the Operator's reflection.");
  await switchLiveView(page, "pressure"); // Current Attention lives in PRESSURE (Attention/Aftermath).
  await page.getByLabel("Current Attention").selectOption("Unseen");
  await expect(page.locator('[name="attention.residue"]')).toHaveValue("A comment arrives before anyone types it.");
  await expect(page.locator('[name="sceneState.sceneConsequence"]')).toHaveValue("The lobby still pretends to be ordinary. Cameras watch, but have not answered yet.");
  await expect(page.locator('[name="attention.aftermathConsequence"]')).toHaveValue("Minor tell only. No penalty; warning only.");
  await switchLiveView(page, "run"); // Quick Roll lives in RUN.
  await page.locator('[name="roll.attribute"]').fill("3");
  await page.locator('[name="roll.skill"]').fill("2");
  await page.getByRole("button", { name: "Roll 3d6" }).click();
  await expect(page.locator("#roll-output")).toContainText("3d6");
  await expect(page.locator("#roll-output")).toContainText("Attribute 3 + Skill 2");

  await page.getByLabel("Player View").check();
  await expect(page.getByLabel("Player-facing display")).toBeVisible();
  await expect(page.getByLabel("Player-facing display")).toContainText("Mara Venn missing; observation indexing withheld speech");
  await expect(page.getByLabel("Player-facing display")).toContainText("Stay real. Stay alive.");
  await expect(page.getByLabel("Player-facing display")).not.toContainText("Audience Before Clock");
  await expect(page.getByLabel("Player-facing display")).not.toContainText("TN 15");
  await expect(page.getByLabel("Player-facing display")).not.toContainText("PRIVATE HANDLER NOTES");

  await page.locator('.mode-switch [data-dashboard-mode="archive"]').click();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toBeVisible();
  const privateNoteHeights = await page.locator(".notes-panel .field-grid.three textarea").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(privateNoteHeights).toHaveLength(3);
  expect(Math.max(...privateNoteHeights) - Math.min(...privateNoteHeights)).toBeLessThan(1);
  await expect(page.getByLabel("Dashboard controls")).toBeVisible();
  await expect(page.getByLabel("Enemy Opportunities")).toBeHidden();
  await expect(page.getByLabel("Operator Counterplay")).toBeHidden();
  await expect(page.getByLabel("Attention and aftermath")).toBeVisible();
});

test("handler queues operator track prompts without silent sheet mutation", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await switchLiveView(page, "pressure"); // Track Prompts lives in PRESSURE.

  await expect(page.getByText("OPERATOR TRACK PROMPTS")).toBeVisible();
  await expect(page.locator(".track-prompt-empty")).toBeVisible();
  await expect(page.locator("#operator-risk-strip")).toContainText("Band Calm");

  const rail = page.getByRole("group", { name: "Table triggers" });
  await rail.getByRole("button", { name: /Both Severe misfire \/ natural 3/ }).click();
  await expect(page.locator("#trigger-stability-announce")).toContainText(
    "When this happens, characters in the area take 3 Stability damage."
  );
  await expect(page.locator("#trigger-stability-breakdown")).toContainText("Severe Misfire: 2 Stability damage.");
  await expect(page.locator("#trigger-stability-breakdown")).toContainText("Breached Scene: +1 Stability damage.");
  await expect(page.locator("#trigger-stability-breakdown")).toContainText("Total: 3 Stability damage.");
  await expect(page.locator(".trigger-operator-helper")).toContainText("Selected = in area. Tap to exclude.");
  await expect(page.getByRole("group", { name: "Who takes Stability damage" }).getByRole("button", { name: "Operator 1" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.locator("#handler-pending-banner")).toBeVisible();
  await expect(page.locator("#handler-pending-status")).toContainText("1 PENDING");
  await expect(page.locator("#handler-pending-banner-copy")).toContainText("needs announcement at the table");
  await expect(page.locator(".track-prompt-pending-alert")).toContainText("still need announcement");
  await expect(page.locator("#trigger-table-copy")).toContainText("Tell Operator 1: reduce Stability by 3.");
  await expect(page.locator(".track-prompt-card")).toHaveCount(1);
  await expect(page.locator(".track-prompt-copy")).toContainText("characters in the area take 3 Stability damage");
  await expect(page.locator(".track-prompt-copy")).toContainText("reduce Stability by 3");
  await expect(page.locator(".track-prompt-copy")).toContainText("7 / 10");
  await expect(page.locator("#operator-risk-strip")).toContainText("Band Calm");

  await page.getByRole("button", { name: "Undo Last Trigger" }).click();
  await expect(page.locator(".track-prompt-empty")).toBeVisible();
  await expect(page.locator("#trigger-undo-banner")).toBeHidden();

  await rail.getByRole("button", { name: /Both Severe misfire \/ natural 3/ }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await page.locator(".track-prompt-card").getByRole("button", { name: "Resolve" }).click();
  await expect(page.locator("#operator-risk-strip")).toContainText("Band Strained");
});

test("presentation load writes -- manual resolve (both directions) and auto-apply-on-sync -- all route through the centralized mint/clear helper", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);

  // Manual "Resolve" on a queued _load Track Prompt card is one of the three real Presentation
  // Load write sites (handler-state.js's applyPromptToPlayerSummary) -- this must mint
  // driftEligibleCollapseId via writeHandlerPresentationLoad, not a separate hand-wired path.
  // Resolving a second, decreasing prompt through that SAME site (6 -> 5) must clear it --
  // proving the site is wired for both directions. (undoTrackPrompt's own _load branch was
  // rewritten identically in handler-state.js, but Track Prompt Queue's live re-projection
  // recomputes a resolved prompt's currentValue from the player's current Load on every
  // normalize pass -- a pre-existing property of every track kind, not introduced here -- so
  // undo's revert-to-currentValue is not a reliable way to construct a controlled reverse
  // transition in an integration test; the reverse-transition clear logic itself is already
  // covered directly in presentation-pressure.spec.js.)
  const result = await page.evaluate(() => {
    const api = window.HandlerState;
    let state = api.readState();
    state.players[0].ontologyPresentationKey = "SANGUINE";
    state.players[0].operatorStatus = { presentationPressures: { "sanguine.blood_load": 5 } };
    state = api.createTrackPrompt(state, {
      operatorIndex: 0, track: "blood_load", delta: 1, source: "Manual", reason: "test seed"
    });
    api.writeState(state);
    const promptId = state.trackPromptQueue[0].id;
    state = api.resolveTrackPrompt(api.readState(), promptId, { applySummary: true });
    api.writeState(state);
    const afterResolve = state.players[0].operatorStatus.presentationDrift.byPresentation.sanguine.driftEligibleCollapseId;

    state = api.createTrackPrompt(api.readState(), {
      operatorIndex: 0, track: "blood_load", delta: -1, source: "Manual", reason: "resolved back down"
    });
    api.writeState(state);
    const secondPromptId = state.trackPromptQueue[0].id;
    state = api.resolveTrackPrompt(api.readState(), secondPromptId, { applySummary: true });
    api.writeState(state);
    const afterDecreaseResolve = state.players[0].operatorStatus.presentationDrift.byPresentation.sanguine.driftEligibleCollapseId;

    return { afterResolve, afterDecreaseResolve };
  });
  expect(result.afterResolve).toBeTruthy();
  expect(result.afterDecreaseResolve).toBe("");

  // Auto-apply-during-sync (End Pressure Round / Sync Cell reconciliation for a seat that
  // didn't send its own update) is the third real write site -- handler-cell-sync.js's
  // applyTrackDeltaToPlayer, a private module closure not exposed on window -- so this is
  // exercised through the real Sync Cell button, matching how it actually fires in play.
  await page.evaluate(() => {
    const api = window.HandlerState;
    let state = api.readState();
    state.players[0].operatorStatus = { presentationPressures: { "sanguine.blood_load": 5 } };
    state = api.createTrackPrompt(state, {
      operatorIndex: 0, track: "blood_load", delta: 1, source: "Manual", reason: "auto-apply seed"
    });
    api.writeState(state);
  });
  await page.reload();
  await page.getByRole("button", { name: "Sync Cell" }).click();
  const afterSync = await page.evaluate(() => {
    const bucket = window.HandlerState.readState().players[0].operatorStatus?.presentationDrift?.byPresentation?.sanguine;
    return bucket ? bucket.driftEligibleCollapseId : "";
  });
  expect(afterSync).toBeTruthy();
});

test("operator acknowledgment shows on the Track Prompt card independent of auto-resolve status", async ({ page }) => {
  await page.goto("/handler/live/");
  const onButton = page.getByRole("button", { name: "Edit Fields: On" });
  if (!(await onButton.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Edit Fields: Off" }).click();
  }
  const promptId = await page.evaluate(() => {
    const api = window.HandlerState;
    let state = api.readState();
    state.players[0].sourceId = "TEST-OP";
    state = api.createTrackPrompt(state, {
      operatorIndex: 0, track: "stability", delta: -1, source: "Manual", reason: "test seed"
    });
    api.writeState(state);
    return state.trackPromptQueue[0].id;
  });

  // First sync auto-resolves the prompt -- status moves to Resolved immediately, before the
  // Operator has necessarily seen anything. Confirm the card does NOT falsely claim confirmed.
  await page.getByRole("button", { name: "Sync Cell" }).click();
  await page.waitForTimeout(200);
  const cardBeforeAck = page.locator(`[data-prompt-id="${promptId}"]`);
  await expect(cardBeforeAck.locator(".track-prompt-status")).toHaveText("Resolved");
  await expect(cardBeforeAck.locator(".track-prompt-acknowledged")).toHaveText("Operator has not confirmed yet");

  // Operator sends an acknowledgment (same-origin Cell bus -- this page also loads cell-sync.js).
  await page.evaluate((id) => {
    window.VeilDaemonCellSync.publishOperatorSend({
      operatorKey: "TEST-OP", sourceId: "TEST-OP", name: "Operator 1",
      harmBoxes: 0, stability: 9, acknowledgedPromptIds: [id]
    });
  }, promptId);
  await page.getByRole("button", { name: "Sync Cell" }).click();
  await page.waitForTimeout(200);

  await expect(cardBeforeAck.locator(".track-prompt-acknowledged")).toHaveText("✓ Operator confirmed");
  const stillResolved = await page.evaluate(() => window.HandlerState.readState().trackPromptQueue[0].status);
  expect(stillResolved).toBe("Resolved");
});

test("End Pressure Round shows a by-name accept/pending summary before advancing, and Handler can still advance anyway", async ({ page }) => {
  await page.goto("/handler/live/");
  const onButton = page.getByRole("button", { name: "Edit Fields: On" });
  if (!(await onButton.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Edit Fields: Off" }).click();
  }
  await page.evaluate(() => {
    const api = window.HandlerState;
    let state = api.readState();
    state.players[0].name = "Knoxmortis";
    state.players[0].sourceId = "TEST-OP";
    state = api.createTrackPrompt(state, {
      operatorIndex: 0, track: "stability", delta: -1, source: "Manual", reason: "test seed"
    });
    api.writeState(state);
  });

  let dialogMessage = "";
  page.once("dialog", (dialog) => {
    dialogMessage = dialog.message();
    dialog.dismiss();
  });
  await page.getByRole("button", { name: "End Pressure Round" }).click();
  await page.waitForTimeout(200);
  expect(dialogMessage).toContain("Knoxmortis: Pending");
  expect(dialogMessage).toContain("Advance anyway?");
  const roundAfterCancel = await page.evaluate(() => window.HandlerState.readState().session?.pressureRound || 0);
  expect(roundAfterCancel).toBe(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "End Pressure Round" }).click();
  await page.waitForTimeout(200);
  const roundAfterAccept = await page.evaluate(() => window.HandlerState.readState().session?.pressureRound || 0);
  expect(roundAfterAccept).toBe(1);
});

test("Operator's Next Round is disabled permanently once a Handler round transition lands, and resolves Recovery/action-economy as part of that transition", async ({ page, browser }) => {
  const operatorPage = await page.context().newPage();
  await operatorPage.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "TEST-OP", primaryFrequency: "Dream", observerClassification: "Operator",
      attentionStatus: "Local", accessLevel: "LOCAL"
    }));
  });
  await operatorPage.goto("/operator/");
  await operatorPage.getByRole("button", { name: "Sheet", exact: true }).click();
  await operatorPage.getByRole("button", { name: "Edit Sheet: Off" }).click();
  operatorPage.once("dialog", (dialog) => dialog.accept());
  await operatorPage.getByRole("button", { name: "Apply Core Start" }).click();
  await operatorPage.waitForTimeout(300);

  // Solo play: Next Round is enabled and works normally before any Handler has ever synced.
  await expect(operatorPage.getByRole("button", { name: "Next Round" })).toBeEnabled();
  const soloRound = await operatorPage.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem("veildaemon.operatorConsole.v1") || "{}");
    return raw.operatorStatus?.sceneTimer?.round || 1;
  });
  expect(soloRound).toBe(1);
  await operatorPage.getByRole("button", { name: "Next Round" }).click();
  await operatorPage.waitForTimeout(200);
  const afterSoloClick = await operatorPage.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem("veildaemon.operatorConsole.v1") || "{}");
    return raw.operatorStatus?.sceneTimer?.round;
  });
  expect(afterSoloClick).toBe(2);

  // Operator declares Recovery (Ground) and marks Main Action used, then a Handler round
  // transition lands -- both should resolve as part of that transition, not require a
  // separate local click.
  await operatorPage.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem("veildaemon.operatorConsole.v1") || "{}");
    raw.operatorStatus.recoveryGround = true;
    raw.operatorStatus.stability = "6";
    window.localStorage.setItem("veildaemon.operatorConsole.v1", JSON.stringify(raw));
  });
  await operatorPage.reload();
  await operatorPage.getByRole("button", { name: "Sheet", exact: true }).click();

  await page.goto("/handler/live/");
  const onButton = page.getByRole("button", { name: "Edit Fields: On" });
  if (!(await onButton.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Edit Fields: Off" }).click();
  }
  await page.evaluate(() => {
    const api = window.HandlerState;
    let state = api.readState();
    state.players[0].sourceId = "TEST-OP";
    // Match the Operator's already-declared Stability (6) so the pre-existing Harm/Stability
    // sync block (unrelated to this fix) is a no-op here -- otherwise the Handler's stale
    // default (10, never having received a real Operator send in this test) would clobber it
    // before the round transition's Recovery resolution ever runs, which isn't what this test
    // is checking.
    state.players[0].stabilityPoints = 6;
    api.writeState(state);
  });
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "End Pressure Round" }).click();
  await page.waitForTimeout(200);

  await operatorPage.getByRole("button", { name: "Pull Handler" }).click();
  await operatorPage.waitForTimeout(300);

  const nextRoundBtn = operatorPage.getByRole("button", { name: "Next Round" });
  await expect(nextRoundBtn).toBeDisabled();
  const afterHandlerRound = await operatorPage.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem("veildaemon.operatorConsole.v1") || "{}");
    return {
      round: raw.operatorStatus?.sceneTimer?.round,
      stability: raw.operatorStatus?.stability,
      recoveryGround: raw.operatorStatus?.recoveryGround,
      lastHandlerRound: raw.cellSync?.lastHandlerRound
    };
  });
  // Stability's exact number depends on the Handler's own mirrored copy of the Operator's
  // stats being in sync first (a separate, pre-existing Harm/Stability sync concern, already
  // covered by its own tests) -- what THIS test verifies is that the round transition itself
  // landed and resolved the declared Recovery as one of its effects, exactly like the
  // dedicated data-layer test for targetRound already proves in isolation.
  expect(afterHandlerRound.round).toBe(1);
  expect(afterHandlerRound.recoveryGround).toBe(false);
  expect(afterHandlerRound.lastHandlerRound).toBe(1);

  await operatorPage.close();
});

test("Next Round disables the instant a Cell connection exists, even before any Handler round has landed", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "TEST-OP", primaryFrequency: "Dream", observerClassification: "Operator",
      attentionStatus: "Local", accessLevel: "LOCAL"
    }));
    // Intercept cell-sync-remote.js's real module assignment so every other method (join,
    // pull, leave) stays genuine, but isConnected() reports true the instant it's assigned --
    // simulating a live Cell connection that exists before any Handler projection has ever
    // been pushed. That's the exact gap this fix closes: lastHandlerRound alone stays null
    // until the Handler's first sync, but the Operator should already be locked out of
    // independent round advancement the moment a real connection exists.
    let real;
    Object.defineProperty(window, "VeilDaemonCellRemote", {
      configurable: true,
      get() { return real ? { ...real, isConnected: () => true } : undefined; },
      set(value) { real = value; }
    });
  });
  await page.goto("/operator/");
  await page.getByRole("button", { name: "Sheet", exact: true }).click();
  await page.getByRole("button", { name: "Edit Sheet: Off" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Apply Core Start" }).click();
  await page.waitForTimeout(300);

  await expect(page.getByRole("button", { name: "Next Round" })).toBeDisabled();
});

test("joining a Cell persists the connection so it survives a page reload", async ({ page }) => {
  // joinCell/createSession used to assign the module-level `connection` variable directly,
  // never calling setConnection()/persistConnectionMeta() -- meaning isConnected() was true
  // for the rest of that page load, but a reload (which restoreConnection() is explicitly
  // meant to recover from) always found nothing persisted and silently came back
  // disconnected, re-opening every gap the connection-based lock was supposed to close.
  await page.route("**/api/cell/join", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, session: { id: "test-session-1" }, seat: { id: "test-seat-1" } })
  }));
  await page.goto("/operator/");
  const result = await page.evaluate(async () => {
    await window.VeilDaemonCellRemote.joinCell(async () => "fake-token", {
      joinCode: "ABCDEF", displayName: "Test Operator", designation: "TEST-OP"
    });
    return {
      connectedRightAfterJoin: window.VeilDaemonCellRemote.isConnected(),
      persisted: window.localStorage.getItem("veildaemon.cellConnection.operator.v1")
    };
  });
  expect(result.connectedRightAfterJoin).toBe(true);
  expect(JSON.parse(result.persisted || "null")).toEqual({
    sessionId: "test-session-1", role: "operator", seatId: "test-seat-1"
  });
});

test("Operator and Handler connections persist under separate keys and don't clobber each other on the same browser/account", async ({ page }) => {
  // A single shared storage key meant one person running both an Operator tab and a Handler
  // tab (same browser, same account -- solo testing, or a legitimate one-person dual role)
  // would have whichever role connected/reloaded most recently silently overwrite the other's
  // persisted connection, so e.g. reloading the Operator tab could restore it as "handler".
  // Two real tabs sharing one browser context (and therefore one localStorage) reproduces
  // that faithfully, using an actual reload to reset each page's in-memory connection state
  // rather than any test-only shortcut.
  await page.route("**/api/cell/join", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, session: { id: "op-session" }, seat: { id: "op-seat" } })
  }));
  const handlerPage = await page.context().newPage();
  await handlerPage.route("**/api/cell/create-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, session: { id: "handler-session", join_code: "ABC123" } })
  }));

  await page.goto("/operator/");
  await page.evaluate(async () => {
    await window.VeilDaemonCellRemote.joinCell(async () => "fake-token", {
      joinCode: "ABCDEF", displayName: "Op", designation: "OP"
    });
  });

  await handlerPage.goto("/operator/"); // any page that loads cell-sync-remote.js
  await handlerPage.evaluate(async () => {
    await window.VeilDaemonCellRemote.createSession(async () => "fake-token", {});
  });

  await page.reload();
  const restoredAsOperator = await page.evaluate(() =>
    window.VeilDaemonCellRemote.restoreConnection(async () => "fake-token", "operator")
  );
  await handlerPage.reload();
  const restoredAsHandler = await handlerPage.evaluate(() =>
    window.VeilDaemonCellRemote.restoreConnection(async () => "fake-token", "handler")
  );

  expect(restoredAsOperator).toMatchObject({ role: "operator", sessionId: "op-session" });
  expect(restoredAsHandler).toMatchObject({ role: "handler", sessionId: "handler-session" });

  await handlerPage.close();
});

test("publishSessionRoll inserts into session_rolls via the Supabase client, scoped to the current connection's session and user", async ({ page }) => {
  // The lobby roll feed bypasses api.veildaemon.app entirely -- it talks straight to
  // Supabase (insert + Realtime subscribe) via the client window.VeilAuth already loads for
  // auth, since Realtime needs a direct client connection the Bearer-token REST transport
  // the rest of cell-sync-remote.js uses doesn't provide.
  await page.goto("/operator/");
  const captured = await page.evaluate(async () => {
    let capturedTable = null;
    let capturedRow = null;
    window.VeilAuth.getClient = () => ({
      from: (table) => {
        capturedTable = table;
        return {
          insert: (row) => {
            capturedRow = row;
            return { select: () => ({ single: async () => ({ data: { ...row, id: "roll-row-1" }, error: null }) }) };
          }
        };
      }
    });
    window.VeilAuth.getUser = () => ({ id: "user-1" });
    window.VeilDaemonCellRemote.setConnection({ sessionId: "sess-1", role: "operator", getToken: async () => "fake-token" });
    const result = await window.VeilDaemonCellRemote.publishSessionRoll({ operatorKey: "OP-1", name: "Op One", total: 12, summary: "mine" });
    return { capturedTable, capturedRow, result };
  });
  expect(captured.capturedTable).toBe("session_rolls");
  expect(captured.capturedRow).toMatchObject({
    session_id: "sess-1", owner_user_id: "user-1", operator_key: "OP-1", operator_name: "Op One"
  });
  expect(captured.capturedRow.roll).toMatchObject({ operatorKey: "OP-1", total: 12 });
  expect(captured.result).toMatchObject({ id: "roll-row-1" });
});

test("subscribeToSessionRolls filters by the current session and forwards each new row to the callback", async ({ page }) => {
  await page.goto("/operator/");
  const result = await page.evaluate(async () => {
    let capturedChannelName = null;
    let capturedFilterConfig = null;
    let registeredCallback = null;
    const fakeChannel = {
      on: (event, config, cb) => {
        capturedFilterConfig = config;
        registeredCallback = cb;
        return fakeChannel;
      },
      subscribe: () => fakeChannel
    };
    window.VeilAuth.getClient = () => ({
      channel: (name) => {
        capturedChannelName = name;
        return fakeChannel;
      },
      removeChannel: () => {}
    });
    window.VeilDaemonCellRemote.setConnection({ sessionId: "sess-1", role: "handler", getToken: async () => "fake-token" });
    const received = [];
    const unsubscribe = window.VeilDaemonCellRemote.subscribeToSessionRolls((roll) => received.push(roll));
    // Simulate Supabase Realtime delivering an INSERT event.
    registeredCallback({ new: { id: "row-1", roll: { total: 7 } } });
    unsubscribe();
    return { capturedChannelName, capturedFilterConfig, received };
  });
  expect(result.capturedChannelName).toBe("session-rolls-sess-1");
  expect(result.capturedFilterConfig).toMatchObject({
    event: "INSERT", schema: "public", table: "session_rolls", filter: "session_id=eq.sess-1"
  });
  expect(result.received).toHaveLength(1);
  expect(result.received[0]).toMatchObject({ id: "row-1" });
});

test("pullState's Handler branch reports a seatRoster distinguishing identity-stub-only seats from ones with a real send", async ({ page }) => {
  // handleJoin now seeds live_state.operatorSend with an identity stub (sourceId/name/
  // operatorKey, deliberately no sentAt) so the Handler's own seat-matching never depends
  // on the Operator having sent anything first. seatRoster is the first-contact visibility
  // this enables: every seat, whether or not it's ever had a real send.
  await page.route("**/api/cell/state**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      session: { id: "sess-1" },
      seats: [
        {
          id: "seat-pending",
          operator_profiles: { display_name: "Pending Op", designation: "PENDING-OP" },
          live_state: { operatorSend: { sourceId: "PENDING-OP", name: "Pending Op", operatorKey: "PENDING-OP" } }
        },
        {
          id: "seat-synced",
          operator_profiles: { display_name: "Synced Op", designation: "SYNCED-OP" },
          live_state: { operatorSend: { sourceId: "SYNCED-OP", name: "Synced Op", operatorKey: "SYNCED-OP", sentAt: "2026-08-02T00:00:00.000Z", harmBoxes: 0, stability: 10 } }
        }
      ]
    })
  }));
  await page.goto("/operator/");
  const seatRoster = await page.evaluate(async () => {
    const remote = window.VeilDaemonCellRemote;
    remote.setConnection({ sessionId: "sess-1", role: "handler", getToken: async () => "fake-token" });
    const result = await remote.pullState();
    return result.seatRoster;
  });
  expect(seatRoster).toHaveLength(2);
  expect(seatRoster.find((s) => s.seatId === "seat-pending")).toMatchObject({ name: "Pending Op", hasRealSend: false });
  expect(seatRoster.find((s) => s.seatId === "seat-synced")).toMatchObject({ name: "Synced Op", hasRealSend: true });
});

test("Handler live shows the seat roster with pending/synced status after opening a Cell", async ({ page }) => {
  await page.route("**/api/cell/create-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, session: { id: "sess-1", join_code: "ABC123" } })
  }));
  await page.route("**/api/cell/state**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      session: { id: "sess-1" },
      seats: [{
        id: "seat-pending",
        operator_profiles: { display_name: "Knoxmortis", designation: "KNOX" },
        live_state: { operatorSend: { sourceId: "KNOX", name: "Knoxmortis", operatorKey: "KNOX" } }
      }]
    })
  }));
  await page.goto("/handler/live/");
  await page.evaluate(() => {
    window.VeilAuth = window.VeilAuth || {};
    window.VeilAuth.getSession = () => ({ access_token: "fake-token" });
    window.VeilAuth.getUser = () => ({ id: "handler-user-1" });
    window.VeilAuth.init = async () => {};
  });
  await page.getByRole("button", { name: "Open Cell" }).click();
  await page.waitForTimeout(500);
  const roster = page.locator("#seat-roster-list");
  await expect(roster).toBeVisible();
  await expect(roster).toContainText("Knoxmortis");
  await expect(roster).toContainText("Joined — no Operator state received yet");
});

test("Reset Local drops an active Cell connection so a stale round can't silently resend", async ({ page }) => {
  // Reset Local only wiped HandlerState's own storage -- session.pressureRound went back to
  // 0, but a still-active remote connection pointed at the SAME session row an Operator may
  // already have lastHandlerRound recorded against. The next End Pressure Round would
  // recompute round 1 and push it again, which the Operator's strict must-be-greater guard
  // then silently drops as a repeat. Reset must also drop the connection.
  await page.route("**/api/cell/create-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, session: { id: "sess-1", join_code: "ABC123" } })
  }));
  await page.route("**/api/cell/state**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, session: { id: "sess-1" }, seats: [] })
  }));
  await page.goto("/handler/live/");
  await page.evaluate(() => {
    window.VeilAuth = window.VeilAuth || {};
    window.VeilAuth.getSession = () => ({ access_token: "fake-token" });
    window.VeilAuth.getUser = () => ({ id: "handler-user-1" });
    window.VeilAuth.init = async () => {};
  });
  await page.getByRole("button", { name: "Open Cell" }).click();
  await page.waitForFunction(() => /CONNECTED/.test(document.getElementById("cell-connect-status")?.textContent || ""), null, { timeout: 15000 });

  await page.getByRole("button", { name: "PREP" }).click(); // Reset Local lives in the prep/archive mode panel
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset Local" }).click();
  await page.waitForTimeout(300);

  const stillConnected = await page.evaluate(() => window.VeilDaemonCellRemote.isConnected());
  expect(stillConnected).toBe(false);
  await expect(page.locator("#cell-connect-status")).toHaveText("LOCAL — same-device sync only.");
  await expect(page.locator("#seat-roster-list")).toBeHidden();
});

async function waitForClueChips(page) {
  await page.waitForFunction(() => document.querySelectorAll("#clue-status-tracker .clue-status-chip").length > 0, null, { timeout: 15000 });
}

async function selectClueChip(page, namePattern) {
  await switchLiveView(page, "pressure"); // Clue Integrity lives in PRESSURE; no-op off /handler/live/.
  await waitForClueChips(page);
  const tracker = page.getByRole("group", { name: "Clue status tracker" });
  const chip = tracker.getByRole("button", { name: namePattern });
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
}

async function applyClueAction(page, actionLabel) {
  await page.getByRole("button", { name: actionLabel }).click();
  const preview = page.locator("#clue-preview-panel");
  await expect(preview).toBeVisible();
  await preview.locator("#clue-apply").click();
}

test("handler clues module exposes clue tracker", async ({ page }) => {
  await page.goto("/handler/clues/");
  await enableHandlerFieldEdit(page);
  await applyHandlerTemplate(page, "viridian-house");

  await expect(page.getByRole("heading", { name: "CORE CLUE TRACKER" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Clue status tracker" })).toBeVisible();
  await expect(page.locator("#clue-integrity-active")).toBeHidden();
  await expect(page.locator("#module-clue-progress")).not.toContainText("No core clues loaded");
});

test("handler live clue integrity tracks core clue state flow", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await applyHandlerTemplate(page, "viridian-house");
  await switchLiveView(page, "pressure");

  await expect(page.getByLabel("Clue Integrity")).toBeVisible();
  await expect(page.getByRole("group", { name: "Clue status tracker" })).toBeVisible();
  await selectClueChip(page, /Floor 13 appears after a lie under observation/);
  await expect(page.locator("#clue-integrity-active")).toBeVisible();
  await applyClueAction(page, "Discover Clue");
  await expect(page.locator("#clue-integrity-status")).toContainText("Discover Clue");
  const discoveredState = await page.evaluate(() => {
    const state = window.HandlerState.readState();
    const clue = state.clueIntegrity.clues.find((item) => /Floor 13 appears/.test(item.clue));
    return {
      state: clue?.state,
      nextClue: state.caseFile.nextClue,
      sceneState: state.sceneState.current,
      attention: state.attention.current
    };
  });
  expect(discoveredState.state).toBe("discovered");
  expect(discoveredState.nextClue).toContain("Floor 13 appears after a lie under observation");
  expect(discoveredState.sceneState).toBe("Echoed");

  await applyClueAction(page, "Secure Clue");
  await expect(page.locator("#clue-integrity-status")).toContainText("Secure Clue");

  await applyClueAction(page, "Archive Clue");
  await expect(page.locator("#clue-integrity-status")).toContainText("Archive Clue");
  await expect(page.getByRole("group", { name: "Clue status tracker" }).getByText("Archived")).toBeVisible();
  const archivedState = await page.evaluate(() => window.HandlerState.readState());
  expect(archivedState.clueIntegrity.clues.some((item) => /Floor 13 appears/.test(item.clue))).toBe(true);
  expect(archivedState.handlerNotes.clueList).toContain("ARCHIVED TRUTH");
});

test("handler live clue integrity preview can cancel before apply", async ({ page }) => {
  await page.goto("/handler/live/");
  await applyHandlerTemplate(page, "viridian-house");
  await selectClueChip(page, /Mara entered the elevator at 2:13 a\.m\./);
  await page.getByRole("button", { name: "Discover Clue" }).click();
  await expect(page.locator("#clue-preview-panel")).toBeVisible();
  await page.locator("#clue-cancel").click();
  const clueState = await page.evaluate(() => {
    const clue = window.HandlerState.readState().clueIntegrity.clues.find((item) => /Mara entered the elevator/.test(item.clue));
    return clue?.state;
  });
  expect(clueState).toBe("unknown");
});

test("handler live clue contaminate advances pressure", async ({ page }) => {
  await page.goto("/handler/live/");
  await applyHandlerTemplate(page, "viridian-house");
  await page.evaluate(() => {
    const state = window.HandlerState.readState();
    state.attention.current = "Unseen";
    state.sceneState.current = "Stable";
    state.primaryClock.current = 2;
    window.HandlerState.writeState(state);
  });

  await selectClueChip(page, /Floor 13 appears after a lie under observation/);
  await applyClueAction(page, "Discover Clue");
  await applyClueAction(page, "Contaminate Clue");

  const pressure = await page.evaluate(() => {
    const state = window.HandlerState.readState();
    const clue = state.clueIntegrity.clues.find((item) => /Floor 13 appears/.test(item.clue));
    return {
      state: clue?.state,
      clock: state.primaryClock.current,
      attention: state.attention.current,
      sceneState: state.sceneState.current
    };
  });
  expect(pressure.state).toBe("contaminated");
  expect(pressure.clock).toBeGreaterThan(2);
  expect(pressure.attention).not.toBe("Unseen");
  expect(pressure.sceneState).toBe("Recursive");
});

test("handler live clue reroute changes next clue and route cost", async ({ page }) => {
  await page.goto("/handler/live/");
  await applyHandlerTemplate(page, "viridian-house");
  await page.evaluate(() => {
    const state = window.HandlerState.readState();
    state.caseFile.nextPressureBeat = "Lobby camera watches.";
    window.HandlerState.writeState(state);
  });

  await selectClueChip(page, /Floor 13 appears after a lie under observation/);
  await applyClueAction(page, "Discover Clue");
  await applyClueAction(page, "Reroute Clue");

  const rerouted = await page.evaluate(() => {
    const state = window.HandlerState.readState();
    const clue = state.clueIntegrity.clues.find((item) => /Floor 13 appears/.test(item.clue));
    return {
      state: clue?.state,
      routeUsed: clue?.routeUsed,
      nextClue: state.caseFile.nextClue,
      nextPressure: state.caseFile.nextPressureBeat
    };
  });
  expect(rerouted.state).toBe("rerouted");
  expect(rerouted.routeUsed).toBe("alternate");
  expect(rerouted.nextClue).toContain("Alternate route");
  expect(rerouted.nextPressure).toContain("alternate route");
});

test("handler live pressure panel titles wrap cleanly in side columns", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/handler/live/");
  await applyHandlerTemplate(page, "veilcorp-intake");

  const metrics = await page.evaluate(() => {
    const inspect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const text = node.textContent || "";
      return {
        width: rect.width,
        height: rect.height,
        text,
        brokenWord: /\w-\s+\w/.test(text)
      };
    };
    return {
      counterplayTitle: inspect(".live-pressure-better .kicker"),
      enemyTitle: inspect(".live-pressure-worse .kicker"),
      counterplayHeading: inspect(".live-pressure-better h2")
    };
  });

  expect(metrics.counterplayTitle?.text).toMatch(/operator counterplay/i);
  expect(metrics.enemyTitle?.text).toMatch(/enemy opportunities/i);
  expect(metrics.counterplayTitle?.width || 0).toBeGreaterThan(120);
  expect(metrics.counterplayTitle?.height || 0).toBeGreaterThan(12);
  expect(metrics.counterplayTitle?.brokenWord).toBe(false);
  expect(metrics.counterplayHeading?.brokenWord).toBe(false);
});

test("handler live primary clock stays usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await applyHandlerTemplate(page, "veilcorp-intake");

  const clockMetrics = await page.evaluate(() => {
    const shell = document.querySelector(".handler-shell")?.getBoundingClientRect();
    const panel = document.querySelector(".clock-panel");
    const panelRect = panel?.getBoundingClientRect();
    const fields = Array.from(document.querySelectorAll(".clock-panel .clock-field-grid label")).map((label) => {
      const rect = label.getBoundingClientRect();
      return { top: rect.top, width: rect.width, left: rect.left };
    });
    const segments = Array.from(document.querySelectorAll("#primary-clock-track .clock-segment")).map((button) => button.getBoundingClientRect().height);
    const ticksWhen = document.querySelector('[name="primaryClock.ticksWhen"]')?.getBoundingClientRect();
    const stabilizer = document.querySelector('[name="primaryClock.stabilizer"]')?.getBoundingClientRect();
    return {
      shellWidth: shell?.width || 0,
      panelWidth: panelRect?.width || 0,
      fields,
      segments,
      ticksWhenWidth: ticksWhen?.width || 0,
      stabilizerTop: stabilizer?.top || 0,
      ticksWhenTop: ticksWhen?.top || 0
    };
  });

  expect(clockMetrics.shellWidth).toBeGreaterThan(300);
  expect(clockMetrics.panelWidth).toBeGreaterThan(clockMetrics.shellWidth - 48);
  expect(clockMetrics.fields[0].width).toBeGreaterThan(clockMetrics.panelWidth * 0.88);
  expect(clockMetrics.ticksWhenWidth).toBeGreaterThan(clockMetrics.panelWidth * 0.88);
  expect(clockMetrics.fields[3].width).toBeGreaterThan(clockMetrics.panelWidth * 0.88);
  expect(clockMetrics.stabilizerTop).toBeGreaterThan(clockMetrics.ticksWhenTop);
  expect(Math.min(...clockMetrics.segments)).toBeGreaterThan(30);
  expect(clockMetrics.segments).toHaveLength(6);
});

test("handler clocks module fields stack on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/handler/clocks/");

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector(".clock-panel");
    const panelRect = panel?.getBoundingClientRect();
    const labels = Array.from(document.querySelectorAll(".clock-panel .field-grid.five label")).map((label) => label.getBoundingClientRect().width);
    const segments = Array.from(document.querySelectorAll("#primary-clock-track .clock-segment")).map((button) => button.getBoundingClientRect().height);
    return {
      panelWidth: panelRect?.width || 0,
      labels,
      segments
    };
  });

  expect(metrics.panelWidth).toBeGreaterThan(300);
  expect(metrics.labels.length).toBeGreaterThanOrEqual(5);
  metrics.labels.forEach((width) => {
    expect(width).toBeGreaterThan(metrics.panelWidth * 0.88);
  });
  expect(metrics.segments.length).toBeGreaterThan(0);
  expect(Math.min(...metrics.segments)).toBeGreaterThan(30);
});

test("handler cases module fields stack on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/handler/cases/");

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector(".case-panel");
    const panelRect = panel?.getBoundingClientRect();
    const labels = Array.from(document.querySelectorAll(".case-panel .field-grid.three label")).map((label) => label.getBoundingClientRect().width);
    return {
      panelWidth: panelRect?.width || 0,
      labels
    };
  });

  expect(metrics.panelWidth).toBeGreaterThan(300);
  metrics.labels.forEach((width) => {
    expect(width).toBeGreaterThan(metrics.panelWidth * 0.88);
  });
});

test("handler operators authorization stacks on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/handler/operators/");

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector(".handler-shell")?.getBoundingClientRect();
    const sections = Array.from(document.querySelectorAll(".authorization-section")).map((section) => section.getBoundingClientRect().width);
    return {
      shellWidth: shell?.width || 0,
      sections
    };
  });

  expect(metrics.shellWidth).toBeGreaterThan(300);
  metrics.sections.forEach((width) => {
    expect(width).toBeGreaterThan(metrics.shellWidth * 0.72);
  });
});

test("handler live prep and archive panels stay full width on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/handler/live/");

  for (const mode of ["prep", "archive"]) {
    await page.getByRole("button", { name: mode === "prep" ? "PREP" : "ARCHIVE" }).click();

    const metrics = await page.evaluate(() => {
      const shell = document.querySelector(".handler-shell")?.getBoundingClientRect();
      const panels = Array.from(document.querySelectorAll(".dashboard-form .panel:not([hidden])")).map((panel) => {
        const rect = panel.getBoundingClientRect();
        return { width: rect.width };
      });
      return {
        shellWidth: shell?.width || 0,
        panels
      };
    });

    expect(metrics.shellWidth).toBeGreaterThan(300);
    metrics.panels.forEach((panel) => {
      expect(panel.width).toBeGreaterThan(metrics.shellWidth * 0.88);
    });
  }
});

test("handler overview cards stack on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/handler/");

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector(".handler-shell")?.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll(".overview-card")).map((card) => card.getBoundingClientRect().width);
    return {
      shellWidth: shell?.width || 0,
      cards
    };
  });

  expect(metrics.shellWidth).toBeGreaterThan(300);
  metrics.cards.forEach((width) => {
    expect(width).toBeGreaterThan(metrics.shellWidth * 0.88);
  });
});

test("handler module pages share case state", async ({ page }) => {
  await page.goto("/handler/cases/");
  await enableHandlerFieldEdit(page);
  await page.locator('[name="session.caseTitle"]').fill("Silence Gap");
  await page.locator('[name="caseFile.nextClue"]').fill("The exit sign points inward.");

  await page.goto("/handler/");
  await expect(page.locator("#overview-case")).toContainText("Silence Gap");
  await expect(page.locator("#overview-next-clue")).toContainText("The exit sign points inward.");

  await page.goto("/handler/player-view/");
  await expect(page.getByRole("heading", { name: "PLAYER VIEW" })).toBeVisible();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toHaveCount(0);
});

test("handler live shows secondary clock under primary when enabled", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);

  await expect(page.locator("#secondary-clock-panel")).toBeHidden();

  await page.getByRole("button", { name: "PREP" }).click();
  await page.getByLabel("Show Secondary Clock").check();
  await page.locator('[name="secondaryClock.name"]').fill("Case Clock");

  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await expect(page.locator("#secondary-clock-panel")).toBeVisible();
  await expect(page.locator(".secondary-clock-live-only")).toContainText("SECONDARY CLOCK");
  await expect(page.locator("#secondary-clock-track")).toBeVisible();
  await expect(page.locator('[name="secondaryClock.name"]')).toHaveValue("Case Clock");

  const order = await page.evaluate(() => {
    const primary = document.querySelector(".live-center-column .clock-panel:not(.secondary-panel)");
    const secondary = document.getElementById("secondary-clock-panel");
    const clue = document.querySelector(".clue-integrity-panel");
    return {
      secondaryAfterPrimary: Boolean(primary && secondary && primary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING),
      secondaryBeforeClue: Boolean(secondary && clue && secondary.compareDocumentPosition(clue) & Node.DOCUMENT_POSITION_FOLLOWING)
    };
  });
  expect(order.secondaryAfterPrimary).toBe(true);
  expect(order.secondaryBeforeClue).toBe(true);
});

test("handler clocks module routes numeric clock input through pressure preview", async ({ page }) => {
  await page.goto("/handler/clocks/");
  await enableHandlerFieldEdit(page);

  const before = await page.locator('[name="primaryClock.current"]').inputValue();
  await page.locator('[name="primaryClock.current"]').fill("3");
  await page.locator('[name="primaryClock.current"]').dispatchEvent("change");

  const preview = page.locator("#trigger-preview-panel");
  await expect(preview).toBeVisible();
  await expect(page.locator('[name="primaryClock.current"]')).toHaveValue(before);

  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator('[name="primaryClock.current"]')).toHaveValue("3");
});

test("manual primary clock tick opens the same pressure preview flow", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);

  await page.getByLabel("Primary clock segments").getByRole("button", { name: "primary-clock-track segment 1" }).click();
  const preview = page.locator("#trigger-preview-panel");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Apply:");
  await expect(page.locator("#trigger-stability-announce")).toContainText(
    "When this happens, characters in the area take 1 Stability damage."
  );
  await expect(page.locator(".trigger-operator-helper")).toContainText("Selected = in area. Tap to exclude.");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("#handler-pending-banner")).toBeVisible();
  await expect(page.locator("#handler-pending-status")).toContainText("1 PENDING");
  await expect(page.locator("#trigger-table-copy")).toContainText("Tell Operator 1: reduce Stability by 1.");
  await expect(page.locator('[name="primaryClock.current"]')).toHaveValue("1");
});

test("handler live triggers route common table events to clock responsibility", async ({ page }) => {
  await page.goto("/handler/live/");

  const rail = page.getByRole("group", { name: "Table triggers" });
  await expect(rail.getByRole("button", { name: /Primary Misfire disturbs site/ })).toBeVisible();
  await expect(rail.getByRole("button", { name: /Attention Misfire exposes Operator/ })).toBeVisible();
  await expect(rail.getByRole("button", { name: /Case Evidence decay/ })).toBeVisible();
  await expect(rail.getByRole("button", { name: /Both Severe misfire \/ natural 3/ })).toBeVisible();

  await rail.getByRole("button", { name: /Both Severe misfire \/ natural 3/ }).click();
  const preview = page.locator("#trigger-preview-panel");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("When this happens, characters in the area take 3 Stability damage.");
  await expect(preview.locator("#trigger-stability-breakdown")).toContainText("Total: 3 Stability damage.");
  await expect(preview).toContainText("Responsibility");
  await expect(preview).toContainText("Primary + Attention");
  await expect(preview).toContainText("0/6 -> 2/6");
  await expect(preview).toContainText("Unseen -> Noticed");
});

test("handler live collapse staging keeps themed target buttons on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await applyHandlerTemplate(page, "viridian-house");
  await setPrimaryClockForCollapseStaging(page);

  const staging = page.getByLabel("Collapse and Rewrite staging");
  await expect(staging).toContainText("COLLAPSE READY");

  const collapseButton = staging.locator('button[data-break-type="Body"]');
  await collapseButton.evaluate((button) => button.click());

  const collapseStyles = await collapseButton.evaluate((button) => {
    const styles = getComputedStyle(button);
    return {
      border: styles.borderColor,
      background: styles.backgroundColor,
      color: styles.color
    };
  });
  expect(collapseStyles.border).not.toBe("rgb(128, 128, 128)");
  expect(collapseStyles.background).not.toBe("rgb(239, 239, 239)");

  await staging.locator("button.button.primary", { hasText: "Activate Collapse" }).evaluate((button) => button.click());
  await page.evaluate(() => {
    const api = window.HandlerState;
    let next = api.readState();
    next.rewrite.ready = true;
    next.rewrite.readyLatch = true;
    next.rewrite.trigger = "Accepted false / curated self";
    next = api.syncCollapseRewriteStaging(next);
    window.dispatchEvent(new CustomEvent("veildaemon:handler-collapse-updated", {
      detail: { state: next, statusText: "REWRITE READY" }
    }));
  });

  const rewriteButton = staging.locator('button[data-overwrite-type="Role"]');
  await rewriteButton.evaluate((button) => button.click());

  const rewriteStyles = await rewriteButton.evaluate((button) => {
    const styles = getComputedStyle(button);
    return {
      border: styles.borderColor,
      background: styles.backgroundColor
    };
  });
  expect(rewriteStyles.border).not.toBe(collapseStyles.border);
});

test("handler live collapse staging respects global field lock", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await page.getByRole("button", { name: "PREP" }).click();
  await applyHandlerTemplate(page, "viridian-house");
  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await setPrimaryClockForCollapseStaging(page);

  await page.getByRole("button", { name: "Edit Fields: On" }).click();
  await expect(page.getByRole("button", { name: "Edit Fields: Off" })).toBeVisible();

  const staging = page.getByLabel("Collapse and Rewrite staging");
  await staging.locator('button[data-break-type="Signal"]').evaluate((button) => button.click());
  await expect(staging.locator('[name="collapse.brokenLaw"]')).toHaveJSProperty("readOnly", true);

  await staging.locator("button.button.primary", { hasText: "Activate Collapse" }).evaluate((button) => button.click());
  await expect(staging).toContainText("COLLAPSE MODE");
  await expect(staging.locator('button[data-break-type="Name"]')).toBeEnabled();

  await page.getByRole("button", { name: "Edit Fields: Off" }).click();
  await expect(page.getByRole("button", { name: "Edit Fields: On" })).toBeVisible();
  await expect(staging.locator('[name="collapse.brokenLaw"]')).toHaveJSProperty("readOnly", false);
});

test("handler live collapse staging surfaces from full clock without exposing player view", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await page.getByRole("button", { name: "PREP" }).click();
  await applyHandlerTemplate(page, "viridian-house");
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await setPrimaryClockForCollapseStaging(page);

  const staging = page.getByLabel("Collapse and Rewrite staging");
  await expect(staging).toBeVisible();
  await expect(staging).toContainText("STAGING ONLY — HANDLER RESOLVES");
  await expect(staging).toContainText("COLLAPSE READY");
  await expect(staging).toContainText("SELECT TARGET");
  await expect(staging).not.toContainText("REWRITE READY");

  await staging.locator('button[data-break-type="Body"]').evaluate((button) => button.click());
  await expect(staging.locator('[name="collapse.brokenLaw"]')).toHaveValue("The performed body becomes easier to maintain than the living one.");
  await expect(staging.locator('[name="collapse.operatorChoice"]')).toHaveValue("Refuse the curated self, ground Mara as a person, protect Saffi's true memory, or flee Floor 13 together.");
  await expect(staging.locator('[name="collapse.exitCondition"]')).toHaveValue("Honest speech under observation, protected by the group, directed toward Mara or the room instead of the audience.");

  await staging.locator('button[data-break-type="Name"]').evaluate((button) => button.click());
  await expect(staging.locator('[name="collapse.brokenLaw"]')).toHaveValue("The audience's name for someone becomes easier to answer to than their own.");
  await expect(staging.locator('[name="collapse.operatorChoice"]')).toHaveValue("Speak the real name, reject the captioned name, or let the label stabilize.");
  await expect(staging.locator('[name="collapse.exitCondition"]')).toHaveValue("Someone who knows the person speaks the real name while another Operator shields them from attention.");

  await page.getByLabel("Player View").check();
  await expect(page.getByLabel("Player-facing display")).toBeVisible();
  await expect(page.getByLabel("Player-facing display")).not.toContainText("COLLAPSE READY");
  await expect(page.getByLabel("Player-facing display")).not.toContainText("Broken Law");
});

test("handler live collapse staging uses VeilCorp Intake pressure grammar", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await page.getByRole("button", { name: "PREP" }).click();
  await applyHandlerTemplate(page, "veilcorp-intake");
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await setPrimaryClockForCollapseStaging(page);

  const staging = page.getByLabel("Collapse and Rewrite staging");
  await expect(staging).toContainText("COLLAPSE READY");

  await staging.locator('button[data-break-type="Room"]').evaluate((button) => button.click());
  await expect(staging.locator('[name="collapse.brokenLaw"]')).toHaveValue("The church answers observation before anyone admits what they saw.");
  await expect(staging.locator('[name="collapse.operatorChoice"]')).toHaveValue("Cover the reflection, step outside, name the ordinary detail, or keep looking and accept Attention.");
  await expect(staging.locator('[name="collapse.exitCondition"]')).toHaveValue("The group breaks line of sight, names what changed, and leaves together with one Anchor intact.");

  await staging.locator('button[data-break-type="Identity"]').evaluate((button) => button.click());
  await expect(staging.locator('[name="collapse.brokenLaw"]')).toHaveValue("The system classification becomes easier to believe than the Operator's own self-description.");
  await expect(staging.locator('[name="collapse.operatorChoice"]')).toHaveValue("Accept the intake label, dispute it, or define yourself before the room does.");
  await expect(staging.locator('[name="collapse.exitCondition"]')).toHaveValue("The Operator states who they are through an Anchor, and another Operator confirms it.");

  await page.evaluate(() => {
    const api = window.HandlerState;
    let next = api.activateCollapseMode(api.readState());
    next = api.activateRewriteMode(next);
    next = api.populateRewriteOverlay(next, "Record");
    window.dispatchEvent(new CustomEvent("veildaemon:handler-collapse-updated", {
      detail: { state: next, statusText: "REWRITE STAGED" }
    }));
  });

  await expect(staging.locator('[name="rewrite.rewriteLaw"]')).toHaveValue("The impossible message becomes the official version.");
  await expect(staging.locator('[name="rewrite.lockInRisk"]')).toHaveValue("Screens, logs, timestamps, and contact records begin agreeing with the intake file.");
  await expect(staging.locator('[name="rewrite.counteractionWindow"]')).toHaveValue("Duplicate the record, compare devices, and preserve one contradiction.");
});

test("handler live custom template carries ideal runtime scaffold", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await page.getByRole("button", { name: "PREP" }).click();
  await applyHandlerTemplate(page, "custom-campaign");
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await expect(page.getByRole("group", { name: "Table triggers" }).getByRole("button", { name: /Operators deny visible pressure/ })).toBeVisible();

  await setPrimaryClockForCollapseStaging(page);

  const staging = page.getByLabel("Collapse and Rewrite staging");
  await staging.locator('button[data-break-type="Room"]').evaluate((button) => button.click());
  await expect(staging.locator('[name="collapse.brokenLaw"]')).toHaveValue("The site accepts pressure as architecture.");

  await page.evaluate(() => {
    const api = window.HandlerState;
    let next = api.activateCollapseMode(api.readState());
    next = api.activateRewriteMode(next);
    next = api.populateRewriteOverlay(next, "Name");
    window.dispatchEvent(new CustomEvent("veildaemon:handler-collapse-updated", {
      detail: { state: next, statusText: "REWRITE STAGED" }
    }));
  });

  await expect(staging.locator('[name="rewrite.rewriteLaw"]')).toHaveValue("The accepted name becomes easier to remember than the original.");
});

test("handler live rewrite staging waits for active collapse", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await page.getByRole("button", { name: "PREP" }).click();
  await applyHandlerTemplate(page, "viridian-house");
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await setPrimaryClockForCollapseStaging(page);

  const staging = page.getByLabel("Collapse and Rewrite staging");
  await staging.locator("button.button.primary", { hasText: "Activate Collapse" }).evaluate((button) => button.click());
  await expect(staging).toContainText("COLLAPSE MODE");

  const rail = page.getByRole("group", { name: "Table triggers" });
  await rail.locator('[data-trigger-id="accept-curated-self"]').evaluate((button) => button.click());
  await page.locator("#trigger-apply").evaluate((button) => button.click());

  await expect(staging).toContainText("REWRITE READY");
  await expect(staging).toContainText("SELECT TARGET");
  await staging.locator('button[data-overwrite-type="Role"]').evaluate((button) => button.click());
  await expect(staging.locator('[name="rewrite.rewriteLaw"]')).toHaveValue("The useful role becomes the stable identity.");
  await expect(staging.locator('[name="rewrite.lockInRisk"]')).toHaveValue("The character gains advantage while performing it, but loses access to unsupported selfhood.");
  await expect(staging.locator('[name="rewrite.counteractionWindow"]')).toHaveValue("Someone asks for the person, not the performance.");
});

test("handler live wind down mirrors the trigger preview flow", async ({ page }) => {
  await page.goto("/handler/live/");

  const rail = page.getByRole("group", { name: "Wind down moves" });
  await expect(rail.getByRole("button", { name: /Speak Truth While Protected/ })).toBeVisible();
  await rail.getByRole("button", { name: /Speak Truth While Protected/ }).click();

  const preview = page.locator("#wind-down-preview-panel");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Responsibility");
  await expect(preview).toContainText("Primary + Attention");
  await expect(preview).toContainText("Use When");
  await expect(preview).toContainText("Clock");
  await expect(preview).toContainText("Attention");
  await expect(preview).toContainText("Scene State");
  await expect(preview).toContainText("Next Pressure");

  await rail.getByRole("button", { name: /Soften Case Pressure/ }).click();
  await expect(preview).toContainText("Case Clock");
  await expect(preview).toContainText("Case Record");
  await expect(preview).toContainText("Attention");
  await expect(preview).toContainText("Truth preserved");

  await preview.locator("#wind-down-apply").click();
  const softened = await page.evaluate(() => {
    const state = window.HandlerState.readState();
    return {
      attention: state.attention.current,
      nextPressure: state.caseFile.nextPressureBeat,
      residue: state.residueLog[0]?.residue || ""
    };
  });
  expect(softened.nextPressure).toContain("Truth preserved");
  expect(softened.residue).toContain("Truth preserved");
});

test("handler live anchor npc state applies pressure modifiers", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await applyHandlerTemplate(page, "viridian-house");

  await page.evaluate(() => {
    const state = window.HandlerState.readState();
    state.attention.current = "Unseen";
    state.primaryClock.current = 1;
    window.HandlerState.writeState(state);
  });

  const saffiIndex = await page.evaluate(() => {
    return window.HandlerState.readState().npcs.findIndex((npc) => /Saffi/.test(npc.name));
  });
  expect(saffiIndex).toBeGreaterThanOrEqual(0);

  const anchorBlock = page.locator("#npc-summary-grid .npc-anchor-block").first();
  await expect(anchorBlock).toBeVisible();
  await anchorBlock.getByRole("button", { name: "Separated" }).click();
  const preview = anchorBlock.locator(".npc-anchor-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Attention");
  await preview.getByRole("button", { name: "Apply" }).click();
  await expect(anchorBlock.locator(".npc-anchor-preview")).toBeHidden();

  const after = await page.evaluate((index) => {
    const state = window.HandlerState.readState();
    const saffi = state.npcs[index];
    return {
      anchorState: saffi?.anchor?.state,
      attention: state.attention.current,
      nextPressure: state.caseFile.nextPressureBeat
    };
  }, saffiIndex);
  expect(after.anchorState).toBe("separated");
  expect(after.attention).not.toBe("Unseen");
  expect(after.nextPressure).toContain("gap between Saffi");
});

test("handler live viridian anchor with operators uses needlepoint override", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await applyHandlerTemplate(page, "viridian-house");

  const overrides = await page.evaluate(() => {
    const state = window.HandlerState.readState();
    const effects = window.HandlerState.resolveAnchorNpcEffects(state, "with-operators");
    return {
      attentionDelta: effects.attention_delta,
      beat: effects.next_pressure_beat
    };
  });
  expect(overrides.attentionDelta).toBe(-1);
  expect(overrides.beat).toContain("denies the Audience");

  await page.evaluate(() => {
    const state = window.HandlerState.readState();
    state.attention.current = "Noticed";
    window.HandlerState.writeState(state);
  });

  const saffiIndex = await page.evaluate(() => {
    return window.HandlerState.readState().npcs.findIndex((npc) => /Saffi/.test(npc.name));
  });
  expect(saffiIndex).toBeGreaterThanOrEqual(0);

  const anchorBlock = page.locator("#npc-summary-grid .npc-anchor-block").first();
  await anchorBlock.getByRole("button", { name: "With Operators" }).click();
  const preview = anchorBlock.locator(".npc-anchor-preview");
  await expect(preview).toContainText("Noticed -> Unseen");
  await expect(preview).toContainText("denies the Audience");
  await preview.getByRole("button", { name: "Apply" }).click();

  const after = await page.evaluate((index) => {
    const state = window.HandlerState.readState();
    return {
      anchorState: state.npcs[index]?.anchor?.state,
      attention: state.attention.current,
      nextPressure: state.caseFile.nextPressureBeat
    };
  }, saffiIndex);
  expect(after.anchorState).toBe("with-operators");
  expect(after.attention).toBe("Unseen");
  expect(after.nextPressure).toContain("denies the Audience");
});

test("handler imports Operator Record summaries", async ({ page }) => {
  await page.goto("/handler/operators/");
  await enableHandlerFieldEdit(page);

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
  await expect(page.locator("#operator-grid")).toContainText("8/10");
  await expect(page.locator("#operator-grid")).toContainText("Band: Calm");
  await expect(page.locator("#operator-grid")).toContainText("1/5");
  await expect(page.locator("#operator-grid")).toContainText("Condition: Injured");
  await expect(page.locator('[data-operator="0"][data-field="voidBreach"]')).toHaveValue("Void 2 // Breach 5");
  await expect(page.locator('[data-operator="0"][data-field="frequencyPips"]')).toHaveValue("Dream 2 // Silence 1");
  await expect(page.locator('[data-operator="0"][data-field="equipment"]')).toHaveValue("Chalk or marker // Technician: toolkit, cables, diagnostic meter");
  await expect(page.locator("#operator-grid")).toContainText("Last Imported");

  await page.goto("/handler/");
  await expect(page.locator("#overview-operators")).toContainText("June Rook");
  await expect(page.locator("#overview-operators")).toContainText("Dream");
});

test("handler live scene and attention consequences stay independent", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await page.getByRole("button", { name: "PREP" }).click();
  await applyHandlerTemplate(page, "viridian-house");
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  const sceneConsequence = page.locator('[name="sceneState.sceneConsequence"]');
  const attentionAftermath = page.locator('[name="attention.aftermathConsequence"]');

  await expect(sceneConsequence).toHaveValue("The lobby still pretends to be ordinary. Cameras watch, but have not answered yet.");
  await expect(attentionAftermath).not.toHaveValue("");

  const attentionBeforeSceneChange = await attentionAftermath.inputValue();

  await page.getByLabel("Scene State").getByRole("button", { name: /Echoed/ }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(sceneConsequence).toHaveValue("The building repeats avoided truth through cameras, comments, reflections, and elevator timing.");
  await expect(attentionAftermath).toHaveValue(attentionBeforeSceneChange);

  const sceneBeforeAttentionChange = await sceneConsequence.inputValue();
  await switchLiveView(page, "pressure"); // Current Attention lives in PRESSURE.
  await page.getByLabel("Current Attention").selectOption("Focused");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(attentionAftermath).not.toHaveValue("");
  await expect(attentionAftermath).not.toHaveValue(attentionBeforeSceneChange);
  await expect(sceneConsequence).toHaveValue(sceneBeforeAttentionChange);

  await page.getByRole("button", { name: "PREP" }).click();
  await applyHandlerTemplate(page, "custom-campaign");
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await expect(sceneConsequence).toHaveValue("The site is mostly ordinary. One impossible detail is visible, but the room has not committed.");
  await expect(attentionAftermath).toHaveValue("Minor tell only. No penalty; warning only.");
});

test("handler exports Operator authorization packets", async ({ page }) => {
  await page.goto("/handler/operators/");
  await enableHandlerFieldEdit(page);

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
  await expect(page.locator("#authorization-brief")).toContainText("Giving 7 authorization flags to June Rook");
  await expect(page.locator("#authorization-brief")).toContainText("Sanguine Presentation");
  await expect(page.locator("#authorization-brief")).toContainText("Void-Shard");
  await expect(page.locator("#authorization-brief")).toContainText("Field Medic");
  await expect(page.locator("#authorization-brief")).toContainText("Local Witness");
  await expect(page.locator("#authorization-brief")).toContainText("Needlepoint Survivor");
  await expect(page.locator("#authorization-brief")).toContainText("2 Void");
  await expect(page.locator("#authorization-brief")).toContainText("5 Breach");
  await expect(page.locator("#authorization-brief")).toContainText("Sanguine Presentation, Void-Shard available for review");
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

test("session-end rewards: mark, recovered clue, and trust/distrust gate Archive Session and deliver via Cell-sync projection", async ({ page }) => {
  await page.route("**/api/cell/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false }) }));
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);

  const setup = await page.evaluate(() => {
    const api = window.HandlerState;
    let state = api.readState();
    state.activeNeedlepoint = {
      id: "NP-001",
      core_clues: [{ clue: "VeilCorp is emergency scaffolding, not a stable agency." }]
    };
    state.players = [{ ...state.players[0], id: "operator-1", name: "Rowan", sourceId: "ROWAN" }];
    api.writeState(state);
    state = api.readState();
    return { clueId: state.clueIntegrity.clues[0]?.id };
  });
  expect(setup.clueId).toBeTruthy();

  await page.reload();
  await enableHandlerFieldEdit(page);

  // Everything is still pending -- Archive Session must refuse, not silently proceed.
  await page.getByRole("button", { name: "Archive Session" }).click();
  await expect(page.locator("#storage-status")).toContainText("Resolve session-end rewards");
  const archivedAfterBlock = await page.evaluate(() => Boolean(window.HandlerState.readState().session?.cellArchiveToken));
  expect(archivedAfterBlock).toBe(false);

  const afterResolve = await page.evaluate((clueId) => {
    const api = window.HandlerState;
    let state = api.readState();
    const playerId = state.players[0].id;
    state = api.awardSessionRewardMark(state, playerId, {
      label: "Absent From Notice", benefit: "Once per scene, go unremarked.", cost: "Familiar faces hesitate before recognizing you.",
      ontologyGrant: { presentationKey: "HOLLOW", startingDrift: 1, justification: "Survived the mirror chamber by refusing to be seen." }
    });
    // recoverSessionRewardClue has real failure modes (bad clueId, blocked clue-state
    // transition) so it returns {state, ok, message} rather than a plain state, unlike the
    // other reward functions -- the real UI's commit() unwraps both shapes; this must too.
    const clueResult = api.recoverSessionRewardClue(state, playerId, clueId);
    if (!clueResult.ok) throw new Error(`recoverSessionRewardClue failed: ${clueResult.message}`);
    state = clueResult.state;
    state = api.recordSessionRewardTrust(state, playerId, {
      target: "VeilCorp", stance: "distrust", note: "Shade recorded emotional tells without consent.", source: "Session aftermath"
    });
    api.writeState(state);
    return { resolved: api.sessionRewardsResolved(api.readState()) };
  }, setup.clueId);
  expect(afterResolve.resolved).toBe(true);

  // The real clue-integrity state machine actually advanced, not a parallel flag.
  const clueState = await page.evaluate((clueId) => {
    return window.HandlerState.readState().clueIntegrity.clues.find((c) => c.id === clueId)?.state;
  }, setup.clueId);
  expect(clueState).toBe("secured");

  // Now Archive Session should proceed (mock the remote publish/close calls so this stays local-only).
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive Session" }).click();
  await page.waitForTimeout(500);
  const archiveToken = await page.evaluate(() => window.HandlerState.readState().session?.cellArchiveToken);
  expect(archiveToken).toBeTruthy();

  // Simulate what the remote projection would have carried, exercising the Operator-side
  // consumption path directly (same shape projectionFromPlayer would produce on kind="archive").
  await page.goto("/operator/");
  await page.evaluate((clueId) => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "ROWAN", primaryFrequency: "Dream", observerClassification: "Operator",
      attentionStatus: "Local", accessLevel: "LOCAL"
    }));
  }, setup.clueId);
  await page.reload();
  await page.getByRole("button", { name: "Sheet", exact: true }).click();
  await page.getByRole("button", { name: "Edit Sheet: Off" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Apply Core Start" }).click();
  await page.waitForTimeout(300);

  const applied = await page.evaluate((clueId) => {
    const bus = window.VeilDaemonCellSync.read();
    // Directly invoke the same page-internal projection-application path a real Pull Handler
    // would, since applyHandlerCellProjection is a closure not exported for direct testing --
    // matching the established pattern for this file (see the round-authority guard test).
    window.VeilDaemonCellSync.publishHandlerPush("archive", {
      projections: [{
        operatorKey: "ROWAN", sourceId: "ROWAN", name: "Rowan", harmBoxes: 0, stability: 10,
        sessionMarkAward: {
          id: "mark-1", label: "Absent From Notice", benefit: "Once per scene, go unremarked.",
          cost: "Familiar faces hesitate before recognizing you.", needlepointId: "NP-001", needlepointTitle: "VeilCorp Intake",
          awardedAt: new Date().toISOString(),
          ontologyGrant: { presentationKey: "HOLLOW", startingDrift: 1, justification: "Survived by refusing to be seen.", status: "proposed" }
        },
        recoveredClue: { id: "clue-1", clueId, clue: "VeilCorp is emergency scaffolding, not a stable agency.", needlepointId: "NP-001", needlepointTitle: "VeilCorp Intake", awardedAt: new Date().toISOString() },
        trustRecord: { id: "trust-1", target: "VeilCorp", stance: "distrust", note: "Shade recorded emotional tells without consent.", source: "Session aftermath", sessionReference: "VeilCorp Intake", awardedAt: new Date().toISOString() }
      }],
      round: 1
    });
    return true;
  }, setup.clueId);
  expect(applied).toBe(true);

  await page.getByRole("button", { name: "Pull Handler" }).click();
  await page.waitForTimeout(500);

  const rewards = await page.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem("veildaemon.operatorConsole.v1") || "{}");
    return raw.sessionRewards;
  });
  expect(rewards.marks).toHaveLength(1);
  expect(rewards.marks[0]).toMatchObject({ label: "Absent From Notice" });
  expect(rewards.marks[0].ontologyGrant).toMatchObject({ presentationKey: "HOLLOW", status: "proposed" });
  expect(rewards.recoveredClues).toHaveLength(1);
  expect(rewards.recoveredClues[0].clue).toContain("emergency scaffolding");
  expect(rewards.trustRecords).toHaveLength(1);
  expect(rewards.trustRecords[0]).toMatchObject({ target: "VeilCorp", stance: "distrust" });

  // Ontology grant is a PROPOSAL until the Operator explicitly accepts it -- ontologyPresentation
  // must not be touched yet.
  const beforeAccept = await page.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem("veildaemon.operatorConsole.v1") || "{}");
    return raw.operatorStatus.ontologyPresentation;
  });
  expect(beforeAccept).toBe("");

  await page.getByRole("button", { name: "Relationships", exact: true }).click(); // session rewards render in this tab
  await page.getByRole("button", { name: "Accept Ontology" }).click();
  await page.waitForTimeout(300);
  const afterAccept = await page.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem("veildaemon.operatorConsole.v1") || "{}");
    return {
      ontologyPresentation: raw.operatorStatus.ontologyPresentation,
      driftValue: raw.operatorStatus.presentationDrift?.byPresentation?.hollow_silence_altered?.value,
      orphanCatalogBucket: raw.operatorStatus.presentationDrift?.byPresentation?.HOLLOW,
      grantStatus: raw.sessionRewards.marks[0].ontologyGrant.status
    };
  });
  expect(afterAccept.ontologyPresentation).toBeTruthy();
  expect(afterAccept.orphanCatalogBucket).toBeUndefined();
  expect(afterAccept.driftValue).toBe(1);
  expect(afterAccept.grantStatus).toBe("accepted");
});

async function seedHandlerState(page, patch) {
  await page.evaluate((p) => {
    const api = window.HandlerState;
    const state = api.readState();
    if (p.session) Object.assign(state.session, p.session);
    if (p.sceneState) Object.assign(state.sceneState, p.sceneState);
    if (p.primaryClock) Object.assign(state.primaryClock, p.primaryClock);
    api.writeState(state);
  }, patch);
  await page.reload();
}

test("player view shows real scene state and a spoiler-safe clock label, not blank fields", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await seedHandlerState(page, {
    sceneState: { current: "Breached" },
    primaryClock: { name: "The Ritual Countdown", current: 4 }
  });

  const playerToggle = page.locator("#player-view-toggle");
  await playerToggle.check();

  const stateRow = page.locator("#player-view-state").locator("xpath=ancestor::div[1]");
  const clockRow = page.locator("#player-view-clock").locator("xpath=ancestor::div[1]");
  await expect(stateRow).toBeVisible();
  await expect(clockRow).toBeVisible();
  await expect(page.locator("#player-view-state")).toHaveText("Breached");
  await expect(page.locator("#player-view-clock")).toHaveText("Pressure Clock 4/6");
  // Never leak the Handler-authored clock name to the player-facing surface.
  await expect(page.locator("#player-view-clock")).not.toContainText("The Ritual Countdown");
});

test("standalone player-view page shows safe fields and does not leak the real clock name", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await seedHandlerState(page, {
    sceneState: { current: "Echoed" },
    primaryClock: { name: "Neighbor Suspicion", current: 2 }
  });

  await page.goto("/handler/player-view/");
  await expect(page.locator("#safe-state")).toHaveText("Echoed");
  await expect(page.locator("#safe-clock")).toContainText("Pressure Clock 2/6");
  await expect(page.locator("#module-clock")).toContainText("Pressure Clock 2/6");
  await expect(page.locator("#safe-clock")).not.toContainText("Neighbor Suspicion");
  await expect(page.locator("#module-clock")).not.toContainText("Neighbor Suspicion");
});

test("a Handler-only module page still shows the real clock name (not the player-safe label)", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await seedHandlerState(page, { primaryClock: { name: "Neighbor Suspicion", current: 2 } });

  await page.goto("/handler/npcs/");
  await expect(page.locator("#module-clock")).toContainText("Neighbor Suspicion 2/6");
});

test("print button populates a Handler-only Session Brief with real data", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await seedHandlerState(page, {
    session: { caseTitle: "Cold Address Intake", location: "4402 Marrow St, Unit 3" },
    sceneState: { current: "Breached" },
    primaryClock: { name: "The Ritual Countdown", current: 4 }
  });

  const brief = page.locator("#session-brief");
  await expect(brief).toBeHidden(); // display:none outside @media print

  await page.getByRole("button", { name: "Print" }).click();

  await expect(brief.locator(".sb-field", { hasText: "Case" }).locator("strong")).toHaveText("Cold Address Intake");
  await expect(brief.locator(".sb-field", { hasText: "Location" }).locator("strong")).toHaveText("4402 Marrow St, Unit 3");
  await expect(brief.locator(".sb-field", { hasText: "Scene State" }).locator("strong")).toHaveText("Breached");
  // Handler-only surface — real clock name is expected here, unlike player view.
  await expect(brief.locator(".sb-clock-line")).toContainText("The Ritual Countdown 4/6");
});
