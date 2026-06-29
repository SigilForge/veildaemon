const { test, expect } = require("@playwright/test");

async function enableHandlerFieldEdit(page) {
  await page.getByRole("button", { name: "Edit Fields: Off" }).click();
  await expect(page.getByRole("button", { name: "Edit Fields: On" })).toBeVisible();
}

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

  await enableHandlerFieldEdit(page);
  await page.getByLabel("Template").selectOption("veilcorp-intake");
  await page.getByRole("button", { name: "Apply Template" }).click();
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
  await expect(page.getByLabel("What makes it worse")).toBeHidden();
  await expect(page.getByLabel("What makes it better")).toBeHidden();
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
  await expect(page.getByLabel("Template")).toHaveValue("custom-campaign");
  await page.getByLabel("Template").selectOption("veilcorp-intake");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await expect(page.locator('[name="session.caseTitle"]')).toHaveValue("VeilCorp Intake");
  await expect(page.locator('[name="entityLoop.Need"]')).toHaveValue("A complete self to copy, correct, or preserve.");
  await expect(page.locator('[name="entityLoop.Exit"]')).toHaveValue("Refuse the false self, speak one specific truth while witnessed, and leave together before the chamber chooses.");
  await expect(page.getByLabel("Current Attention")).toHaveValue("Noticed");
  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Echoed/ })).toHaveClass(/is-active/);
  await page.getByRole("button", { name: "PREP" }).click();
  await page.getByLabel("Template").selectOption("viridian-house");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await expect(page.locator('[name="session.caseTitle"]')).toHaveValue("Viridian House");
  await expect(page.locator('[name="entityLoop.Need"]')).toHaveValue("The moment before confession, when someone edits themselves to survive being seen.");
  await expect(page.locator('[name="primaryClock.name"]')).toHaveValue("Audience Before Clock");
  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await expect(page.locator('[name="attention.residue"]')).toHaveValue("Screens hesitate before showing the Operator's reflection.");
  await page.getByLabel("Current Attention").selectOption("Unseen");
  await expect(page.locator('[name="attention.residue"]')).toHaveValue("A comment arrives before anyone types it.");
  await expect(page.locator('[name="sceneState.sceneConsequence"]')).toHaveValue("The lobby still pretends to be ordinary. Cameras watch, but have not answered yet.");
  await expect(page.locator('[name="attention.aftermathConsequence"]')).toHaveValue("Minor tell only. No penalty; warning only.");
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

  await page.getByRole("button", { name: "ARCHIVE" }).click();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toBeVisible();
  await expect(page.getByLabel("Dashboard controls")).toBeVisible();
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
  await expect(preview).toContainText("Responsibility");
  await expect(preview).toContainText("Primary + Attention");
  await expect(preview).toContainText("0/6 -> 2/6");
  await expect(preview).toContainText("Unseen -> Noticed");
});

test("handler live collapse staging respects global field lock", async ({ page }) => {
  await page.goto("/handler/live/");
  await enableHandlerFieldEdit(page);
  await page.getByRole("button", { name: "PREP" }).click();
  await page.getByLabel("Template").selectOption("viridian-house");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await page.getByRole("button", { name: "LIVE MODE" }).click();
  await page.locator('[name="primaryClock.current"]').fill("6");
  await page.locator('[name="primaryClock.current"]').dispatchEvent("change");

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
  await page.getByLabel("Template").selectOption("viridian-house");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await page.locator('[name="primaryClock.current"]').fill("6");
  await page.locator('[name="primaryClock.current"]').dispatchEvent("change");

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
  await page.getByLabel("Template").selectOption("veilcorp-intake");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await page.locator('[name="primaryClock.current"]').fill("6");
  await page.locator('[name="primaryClock.current"]').dispatchEvent("change");

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
  await page.getByLabel("Template").selectOption("custom-campaign");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await expect(page.getByRole("group", { name: "Table triggers" }).getByRole("button", { name: /Operators deny visible pressure/ })).toBeVisible();

  await page.locator('[name="primaryClock.current"]').fill("6");
  await page.locator('[name="primaryClock.current"]').dispatchEvent("change");

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
  await page.getByLabel("Template").selectOption("viridian-house");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  await page.locator('[name="primaryClock.current"]').fill("6");
  await page.locator('[name="primaryClock.current"]').dispatchEvent("change");

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

  await rail.getByRole("button", { name: /Recover Clean Clue/ }).click();
  await expect(preview).toContainText("Case Clock");
  await expect(preview).toContainText("Case Record");
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
  await page.getByLabel("Template").selectOption("viridian-house");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await page.getByRole("button", { name: "LIVE MODE" }).click();

  const sceneConsequence = page.locator('[name="sceneState.sceneConsequence"]');
  const attentionAftermath = page.locator('[name="attention.aftermathConsequence"]');

  await expect(sceneConsequence).toHaveValue("The lobby still pretends to be ordinary. Cameras watch, but have not answered yet.");
  await expect(attentionAftermath).not.toHaveValue("");

  const attentionBeforeSceneChange = await attentionAftermath.inputValue();

  await page.getByLabel("Scene State").getByRole("button", { name: /Echoed/ }).click();
  await expect(sceneConsequence).toHaveValue("The building repeats avoided truth through cameras, comments, reflections, and elevator timing.");
  await expect(attentionAftermath).toHaveValue(attentionBeforeSceneChange);

  const sceneBeforeAttentionChange = await sceneConsequence.inputValue();
  await page.getByLabel("Current Attention").selectOption("Focused");
  await expect(attentionAftermath).not.toHaveValue("");
  await expect(attentionAftermath).not.toHaveValue(attentionBeforeSceneChange);
  await expect(sceneConsequence).toHaveValue(sceneBeforeAttentionChange);

  await page.getByRole("button", { name: "PREP" }).click();
  await page.getByLabel("Template").selectOption("custom-campaign");
  await page.getByRole("button", { name: "Apply Template" }).click();
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
