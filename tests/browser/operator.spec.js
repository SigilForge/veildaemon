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

async function importAuthorizationPacket(page, flags, operatorName = "TEST-OP") {
  await page.getByLabel("Console modules").getByRole("button", { name: "Authorized Unlocks" }).click();
  await page.locator("#import-authorization").setInputFiles({
    name: "authorization.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      exportType: "cradlepoint.authorization",
      version: 1,
      exportedAt: "2026-06-24T21:00:00.000Z",
      operatorName,
      flags,
      note: ""
    }))
  });
}

test("operator sheet exposes at-table controls", async ({ page }) => {
  await page.goto("/operator/");

  await expect(page.getByRole("button", { name: "Anomaly Log" })).toHaveClass(/is-active/);
  await expect(page.getByText("Record the impossible. Patterns emerge.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log + Volunteer Copy" })).toBeVisible();

  await page.getByRole("button", { name: "Sheet" }).click();
  await expect(page.getByRole("button", { name: "Sheet" })).toHaveClass(/is-active/);
  await expect(page.locator(".operator-roll-dock")).toBeVisible();
  const initialLayout = await page.evaluate(() => {
    const sheetTop = document.querySelector("#module-sheet")?.getBoundingClientRect().top || 0;
    const rollTop = document.querySelector(".operator-roll-dock")?.getBoundingClientRect().top || 0;
    const managerTop = document.querySelector(".skill-manager")?.getBoundingClientRect().top || 0;
    return { rollOffset: rollTop - sheetTop, managerAfterRoll: managerTop > rollTop };
  });
  expect(initialLayout.rollOffset).toBeLessThan(420);
  expect(initialLayout.managerAfterRoll).toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const stickyNav = await page.locator(".console-nav").boundingBox();
  expect(stickyNav.y).toBeGreaterThanOrEqual(0);
  expect(stickyNav.y).toBeLessThan(90);
  await page.getByRole("button", { name: "Sheet" }).click();
  await expect(page.locator(".line-tracker").filter({ hasText: "Harm" })).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Stability" })).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Harm" }).getByText("0/5")).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Harm" }).getByText("Condition: Fine")).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Stability" }).getByText("10/10")).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Stability" }).getByText("Band: Calm")).toBeVisible();
  await expect(page.getByLabel("Operator Name")).toBeVisible();
  await expect(page.locator("#void-bank-readout")).toHaveText("0");
  await expect(page.locator("#breach-bank-readout")).toHaveText("0");
  await expect(page.locator('input[name="voidMarks"]')).toHaveAttribute("type", "hidden");
  await expect(page.locator('input[name="breachPoints"]')).toHaveAttribute("type", "hidden");
  await expect(page.locator('input[name="voidMarks"]')).toHaveAttribute("readonly", "");
  await expect(page.locator('input[name="breachPoints"]')).toHaveAttribute("readonly", "");
  await page.getByLabel("Current consequence").fill("The wrong door remembers the Operator.");
  await expect(page.getByLabel("Current consequence")).toHaveValue("The wrong door remembers the Operator.");
  await page.getByRole("button", { name: "Clear Active Misfire" }).click();
  await expect(page.getByLabel("Current consequence")).toHaveValue("");

  await expect(page.locator("#sheet-attention-status")).toContainText("Unnoticed");
  await expect(page.getByRole("button", { name: "Marked" })).toHaveCount(0);

  await page.getByRole("button", { name: "Apply Core Start" }).click();
  await expect(page.getByRole("button", { name: "Creation Mode: On" })).toBeVisible();
  await expect(page.locator('input[name="voidMarks"]')).toHaveValue("0");
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("3");
  await expect(page.locator("#void-bank-readout")).toHaveText("0");
  await expect(page.locator("#breach-bank-readout")).toHaveText("3");
  await page.getByRole("button", { name: "Frequency" }).click();
  await expect(page.getByLabel("Dream Void")).toHaveValue("1");
  await expect(page.getByLabel("Dream pip 1")).toBeEnabled();
  await expect(page.getByLabel("Dream pip 3")).toBeDisabled();
  await page.getByRole("button", { name: "Sheet" }).click();
  await expect(page.getByLabel("Body 1")).toBeVisible();
  await page.getByLabel("Body 3").click();
  await page.locator("#skill-picker").selectOption("Investigation");
  await page.locator("#skill-rank").fill("2");
  await expect(page.locator("#skill-rank-preview")).toContainText("connect evidence");
  await page.getByRole("button", { name: "Add Skill" }).click();
  await expect(page.getByText("Creation: skills 2/8 // attribute spread 2/6 // Bonus Breach 3/3")).toBeVisible();
  await expect(page.locator("#skill-list")).toContainText("Investigation");
  await expect(page.locator("#skill-list")).toContainText("Investigation 2");
  await expect(page.locator("#skill-summary-list")).toContainText("Investigation");
  await expect(page.locator("#skill-summary-list")).toContainText("+2");
  await page.locator("#roll-attribute").selectOption("Body");
  await page.locator("#roll-skill").selectOption("Investigation");
  await page.getByRole("button", { name: "Roll 3D6" }).click();
  await expect(page.getByText(/3D6 .* Body \+3 .* Investigation \+2 .* = /)).toBeVisible();
  await page.getByRole("checkbox", { name: "Advantage", exact: true }).check();
  await expect(page.getByRole("checkbox", { name: "Disadvantage" })).not.toBeChecked();
  await page.getByRole("button", { name: "Roll 3D6" }).click();
  await expect(page.getByText(/4D6 .* ADVANTAGE KEEP BEST 3 .* DROP .* Body \+3 .* Investigation \+2 .* = /)).toBeVisible();
  await page.getByRole("checkbox", { name: "Disadvantage" }).check();
  await expect(page.getByRole("checkbox", { name: "Advantage", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Roll 3D6" }).click();
  await expect(page.getByText(/4D6 .* DISADVANTAGE KEEP WORST 3 .* DROP .* Body \+3 .* Investigation \+2 .* = /)).toBeVisible();

  await page.getByRole("button", { name: "Creation Mode: On" }).click();
  await page.locator("#skill-picker").selectOption("Investigation");
  await page.locator("#skill-rank").fill("3");
  await expect(page.getByText("Cost: 3 Breach")).toBeVisible();
  await page.getByRole("button", { name: "Add Skill" }).click();
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("0");
});

test("secondary material is separated into tabs", async ({ page }) => {
  await page.goto("/operator/");

  await page.getByRole("button", { name: "Sheet" }).click();
  await page.getByRole("button", { name: "Apply Core Start" }).click();
  await importAuthorizationPacket(page, ["VOID_REWARD:7", "BREACH_REWARD:27"]);
  await page.getByRole("button", { name: "Sheet" }).click();
  await page.getByRole("button", { name: "Creation Mode: On" }).click();
  await page.getByRole("button", { name: "Frequency" }).click();
  await expect(page.getByText("Abilities, tells, grounding, and misfire language.")).toBeVisible();
  await expect(page.locator(".lotus-petal")).toHaveCount(6);
  await expect(page.locator("#lotus-tier")).toHaveText("Basic");
  await page.getByLabel("Dream Void").fill("2");
  await page.getByLabel("Dream Void").blur();
  await expect(page.locator('input[name="voidMarks"]')).toHaveValue("6");
  await page.getByLabel("Dream pip 3").click();
  await expect(page.locator("#lotus-frequency")).toHaveText("Dream");
  await expect(page.locator("#lotus-tier")).toHaveText("Empowered");
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("27");
  await page.getByLabel("Dream pip 3").click();
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("27");
  await expect(page.locator("#storage-status")).toContainText("Frequency Edit Mode required to remove pips.");
  await expect(page.locator("#lotus-tier")).toHaveText("Empowered");
  await page.getByRole("button", { name: "Frequency Edit Mode: Off" }).click();
  await expect(page.getByRole("button", { name: "Frequency Edit Mode: On" })).toBeVisible();
  await expect(page.locator("#frequency-edit-status")).toContainText("Pip removal unlocked.");
  await page.getByLabel("Dream pip 3").click();
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("29");
  await page.getByLabel("Dream pip 3").click();
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("27");
  await expect(page.getByLabel("Silence pip 6")).toBeDisabled();
  await page.getByLabel("Silence Void").fill("4");
  await page.getByLabel("Silence Void").blur();
  await expect(page.locator('input[name="voidMarks"]')).toHaveValue("2");
  await page.getByLabel("Silence pip 6").click();
  await page.getByLabel("Becoming Void").fill("2");
  await page.getByLabel("Becoming Void").blur();
  await expect(page.locator('input[name="voidMarks"]')).toHaveValue("0");
  await page.getByLabel("Becoming pip 4").click();
  await expect(page.locator("#lotus-unlocks")).not.toContainText("Silence 5: CONCEPT EROSION");
  await expect(page.locator("#lotus-unlocks")).toContainText("3: PATTERN MIMIC");
  await expect(page.locator("#lotus-unlocks")).toContainText("Fusion: IDENTITY ERASURE");
  await expect(page.locator("#lotus-unlocks")).toContainText("Silence 6 + Becoming 4");
  await expect(page.locator("#lotus-unlocks")).not.toContainText("Fusion: NULL ILLUSION");
  await expect(page.locator("#active-resonance-profile")).toContainText("Silence");
  await expect(page.locator("#active-resonance-profile")).toContainText("5. CONCEPT EROSION");
  await expect(page.locator("#active-resonance-profile")).toContainText("Becoming");
  await expect(page.locator("#active-resonance-profile")).toContainText("3. PATTERN MIMIC");
  await expect(page.locator("#frequency-build-summary")).toContainText("Total cultivated pips");
  await expect(page.locator("#frequency-build-summary")).toContainText("13 / 20");
  await expect(page.locator("#frequency-build-summary")).toContainText("Total Void committed");
  await expect(page.locator("#frequency-build-summary")).toContainText("8 / 13");
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("9");
  await page.getByLabel("Silence Void").fill("1");
  await page.getByLabel("Silence Void").blur();
  await expect(page.locator("#lotus-frequency")).toHaveText("Silence");
  await expect(page.locator("#lotus-tier")).toHaveText("Basic");
  await expect(page.locator("#lotus-pips-readout")).toHaveText("2 / 6");
  await expect(page.locator('input[name="voidMarks"]')).toHaveValue("3");
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("19");
  await expect(page.locator("#active-resonance-profile")).not.toContainText("5. CONCEPT EROSION");
  await expect(page.locator("#frequency-build-summary")).toContainText("9 / 20");
  await page.getByLabel("Silence Void").fill("4");
  await page.getByLabel("Silence Void").blur();
  await expect(page.locator('input[name="voidMarks"]')).toHaveValue("0");
  await page.locator(".lotus-petal").filter({ hasText: "Hunger" }).getByRole("button", { name: "Mark Blind" }).click();
  await expect(page.getByLabel("Hunger pip 1")).toBeDisabled();
  await expect(page.locator("#lotus-unlocks")).toContainText("HUNGER // BLIND");
  await expect(page.locator("#active-resonance-profile")).toContainText("HUNGER // BLIND");
  await expect(page.getByRole("button", { name: "Mark Blind" })).toHaveCount(0);
  await page.getByRole("button", { name: "Sheet" }).click();
  await page.getByRole("button", { name: "Creation Mode: Off" }).click();
  await page.getByRole("button", { name: "Frequency" }).click();
  await expect(page.getByRole("button", { name: "Mark Blind" })).toHaveCount(5);
  await expect(page.getByText("Anchor memory")).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Case files, residue records, and slower notes.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Case File", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Residue", exact: true })).toBeVisible();
});

test("frequency dossier stays selected while resonance profile summarizes the build", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorConsole.v1", JSON.stringify({
      operatorStatus: {
        selectedLotusPetal: "Silence",
        blindPetal: "Empyrean",
        breachPoints: "10",
        voidMarks: "4",
        lotus: {
          Dream: "0",
          Hunger: "0",
          Silence: "2",
          Stillness: "0",
          Empyrean: "0",
          Becoming: "0"
        },
        voidByFrequency: {
          Dream: "0",
          Hunger: "0",
          Silence: "1",
          Stillness: "0",
          Empyrean: "0",
          Becoming: "0"
        }
      }
    }));
  });

  await page.goto("/operator/");
  await page.getByRole("button", { name: "Frequency" }).click();
  await expect(page.locator("#lotus-frequency")).toHaveText("Silence");
  await expect(page.locator("#lotus-tier")).toHaveText("Basic");
  await expect(page.locator("#lotus-gate")).toHaveText("Gate 1 // 1 Void");
  await expect(page.locator("#lotus-pips-readout")).toHaveText("2 / 6");
  await expect(page.locator("#lotus-next")).toHaveText("2 Void // 2 Breach");
  await expect(page.locator("#lotus-unlocks")).toContainText("1: SOFT FOOTPRINT");
  await expect(page.locator("#lotus-unlocks")).toContainText("2: DAMPENING");
  await expect(page.locator("#lotus-unlocks")).not.toContainText("All active expressions");
  await expect(page.locator("#lotus-unlocks")).not.toContainText("Dream 1:");
  await page.locator("#lotus-unlocks").getByText("2: DAMPENING").click();
  await expect(page.getByText("Mute or soften one immediate detail")).toBeVisible();
  await expect(page.locator("#active-resonance-profile")).toContainText("Silence");
  await expect(page.locator("#active-resonance-profile")).toContainText("1. SOFT FOOTPRINT");
  await expect(page.locator("#active-resonance-profile")).toContainText("2. DAMPENING");
  await expect(page.locator("#active-resonance-profile")).toContainText("Dream");
  await expect(page.locator("#active-resonance-profile")).toContainText("No cultivated pips.");
  await expect(page.locator("#active-resonance-profile")).toContainText("EMPYREAN // BLIND");

  await page.getByRole("button", { name: "Dream", exact: true }).click();
  await expect(page.locator("#lotus-frequency")).toHaveText("Dream");
  await expect(page.locator("#lotus-unlocks")).toContainText("No pips selected for this Frequency.");
  await expect(page.locator("#lotus-unlocks")).not.toContainText("SOFT FOOTPRINT");
  await expect(page.locator("#active-resonance-profile")).toContainText("2. DAMPENING");
});

test("operator equipment supports default kit and selectable carry", async ({ page }) => {
  await page.goto("/operator/");

  await page.getByRole("button", { name: "Equipment" }).click();
  await expect(page.getByText("Ordinary tools, plausible carry")).toBeVisible();
  await expect(page.locator("#equipment-list")).toContainText("Phone");
  await expect(page.locator("#equipment-list")).toContainText("One personal Anchor item");
  await expect(page.getByText("Field Law:")).toBeVisible();

  await page.getByLabel("Category").selectOption("Optional Carry");
  await page.getByLabel("Equipment item").selectOption("Chalk or marker");
  await expect(page.getByLabel("Slot")).toHaveValue("No slot");
  await page.getByLabel("Why you have it").fill("Marks doors that keep lying.");
  await page.getByRole("button", { name: "Add Equipment" }).click();
  await expect(page.locator("#equipment-list")).toContainText("Chalk or marker");
  await expect(page.locator("#equipment-list")).toContainText("Marks doors that keep lying.");

  await page.getByLabel("Category").selectOption("Background Tool");
  await page.getByLabel("Equipment item").selectOption("Technician: toolkit, cables, diagnostic meter");
  await expect(page.getByLabel("Slot")).toHaveValue("Major");
  await page.getByRole("button", { name: "Add Equipment" }).click();
  await expect(page.locator("#equipment-list")).toContainText("Technician: toolkit, cables, diagnostic meter");
  await expect(page.locator("#equipment-cap-status")).toContainText("Major 1/3");

  await page.getByLabel("Category").selectOption("Optional Carry");
  await page.getByLabel("Equipment item").selectOption("Basic flak jacket");
  await expect(page.getByLabel("Slot")).toHaveValue("Major");
  await page.getByRole("button", { name: "Add Equipment" }).click();
  await expect(page.locator("#equipment-list")).toContainText("Basic flak jacket");
  await expect(page.locator("#equipment-cap-status")).toContainText("Major 2/3");

  const minorItems = ["Pocket knife or multitool", "Pepper spray", "Handgun with one spare magazine", "Duct tape", "Cheap audio recorder", "Camera"];
  for (const item of minorItems) {
    await page.getByLabel("Equipment item").selectOption(item);
    await expect(page.getByLabel("Slot")).toHaveValue("Minor");
    await page.getByRole("button", { name: "Add Equipment" }).click();
  }
  await expect(page.locator("#equipment-cap-status")).toContainText("Minor 6/6");
  await page.getByLabel("Equipment item").selectOption("Basic lockpick set");
  await page.getByRole("button", { name: "Add Equipment" }).click();
  await expect(page.locator("#storage-status")).toContainText("Minor item cap exceeded");
  await expect(page.locator("#equipment-list")).not.toContainText("Basic lockpick set");
});

test("operator imports Handler authorization unlock packets", async ({ page }) => {
  await page.goto("/operator/");

  await expect(page.getByLabel("Console modules").getByRole("button", { name: "Authorized Unlocks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Background" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ontology" })).toHaveCount(0);

  await importAuthorizationPacket(page, ["ONTOLOGY_UNLOCK:SANGUINE"], "OTHER-OP");
  await expect(page.locator("#storage-status")).toContainText("Authorization refused. Packet targets OTHER-OP.");

  const packet = {
    exportType: "cradlepoint.authorization",
    version: 1,
    exportedAt: "2026-06-24T21:00:00.000Z",
    operatorName: "TEST-OP",
    flags: [
      "ONTOLOGY_UNLOCK:SANGUINE",
      "ONTOLOGY_UNLOCK:MYTHIC_ECHO",
      "ONTOLOGY_UNLOCK:TECHNOMANCER_DAEMON_ALIGNED",
      "ONTOLOGY_UNLOCK:RED_LEDGER_ADJACENT",
      "BACKGROUND_UNLOCK:FIELD_MEDIC",
      "BACKGROUND_UNLOCK:LOCAL_WITNESS",
      "BACKGROUND_UNLOCK:SANGUINE_ADJACENT",
      "BACKGROUND_UNLOCK:SAFEHOUSE_BRAT",
      "VOID_REWARD:2",
      "BREACH_REWARD:5",
      "CASE_UNLOCK:NEEDLEPOINT_SURVIVOR"
    ],
    note: ""
  };

  await page.locator("#import-authorization").setInputFiles({
    name: "authorization.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(packet))
  });

  await expect(page.locator("#storage-status")).toContainText("NEW ONTOLOGY SIGNAL DETECTED");
  await expect(page.getByRole("button", { name: "Background" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ontology" })).toBeVisible();
  await expect(page.locator("#authorized-background-list")).toContainText("Field Medic");
  await expect(page.locator("#authorized-background-list")).toContainText("Local Witness");
  await expect(page.locator("#authorized-background-list")).toContainText("Sanguine Adjacent");
  await expect(page.locator("#authorized-background-list")).toContainText("Safehouse Brat");
  await expect(page.locator("#authorized-background-list")).toContainText("Applied");
  await expect(page.locator("#authorized-ontology-list")).toContainText("Sanguine Presentation");
  await expect(page.locator("#authorized-ontology-list")).toContainText("Mythic Echo");
  await expect(page.locator("#authorized-ontology-list")).toContainText("Technomancer / Daemon-Aligned");
  await expect(page.locator("#authorized-ontology-list")).toContainText("Red Ledger Adjacent");
  await expect(page.locator("#authorized-reward-list")).toContainText("2 Void");
  await expect(page.locator("#authorized-reward-list")).toContainText("5 Breach");
  await page.getByRole("button", { name: "Sheet" }).click();
  await expect(page.locator("#skill-list")).toContainText("Medicine 1");
  await expect(page.locator('[name="background"]')).toHaveValue("Safehouse Brat");
  await expect(page.locator('[name="ontologyPresentation"]')).toHaveValue("Red Ledger Adjacent");
  await expect(page.locator('[name="background"]')).toContainText("Field Medic");
  await expect(page.locator('[name="background"]')).toContainText("Safehouse Brat");
  await expect(page.locator('[name="ontologyPresentation"]')).toContainText("Sanguine Presentation");
  await expect(page.locator('[name="ontologyPresentation"]')).toContainText("Red Ledger Adjacent");
  await expect(page.locator('input[name="voidMarks"]')).toHaveValue("2");
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("5");
});

test("frequency advancement enforces released Lotus caps", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("veildaemon.operatorConsole.v1", JSON.stringify({
      operatorStatus: {
        breachPoints: "99",
        voidMarks: "0",
        selectedLotusPetal: "Empyrean",
        lotus: {
          Dream: "6",
          Hunger: "6",
          Silence: "4",
          Stillness: "4",
          Empyrean: "0",
          Becoming: "0"
        },
        voidByFrequency: {
          Dream: "4",
          Hunger: "4",
          Silence: "2",
          Stillness: "2",
          Empyrean: "1",
          Becoming: "0"
        }
      }
    }));
  });

  await page.goto("/operator/");
  await page.getByRole("button", { name: "Frequency" }).click();
  await expect(page.locator("#lotus-unlocks")).toContainText("Empyrean unlocked // Void 1");
  await page.getByLabel("Empyrean pip 1").click();
  await expect(page.locator("#storage-status")).toContainText("Frequency pip cap exceeded: 21/20.");
  await expect(page.locator("#lotus-tier")).toHaveText("None");
});

test("creation bonus breach refunds when attributes are lowered", async ({ page }) => {
  await page.goto("/operator/");

  await page.getByRole("button", { name: "Sheet" }).click();
  await page.getByRole("button", { name: "Apply Core Start" }).click();
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("3");

  await page.getByLabel("Body 4").click();
  await page.getByLabel("Agility 4").click();
  await expect(page.getByText("Creation: skills 0/8 // attribute spread 6/6 // Bonus Breach 3/3")).toBeVisible();

  await page.getByLabel("Mind 2").click();
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("2");
  await expect(page.getByText("Creation: skills 0/8 // attribute spread 6/6 // Bonus Breach 2/3")).toBeVisible();

  await page.getByLabel("Body 3").click();
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("3");
  await expect(page.getByText("Creation: skills 0/8 // attribute spread 6/6 // Bonus Breach 3/3")).toBeVisible();
});
