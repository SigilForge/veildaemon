const { test, expect } = require("@playwright/test");

test("operator sheet exposes at-table controls", async ({ page }) => {
  await page.goto("/operator/");

  await expect(page.getByRole("button", { name: "Anomaly Log" })).toHaveClass(/is-active/);
  await expect(page.getByText("Record the impossible. Patterns emerge.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log + Volunteer Copy" })).toBeVisible();

  await page.getByRole("button", { name: "Sheet" }).click();
  await expect(page.getByRole("button", { name: "Sheet" })).toHaveClass(/is-active/);
  await expect(page.locator(".line-tracker").filter({ hasText: "Harm" })).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Stability" })).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Harm" }).getByText("0/5")).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Harm" }).getByText("Condition: Clear")).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Stability" }).getByText("10/10")).toBeVisible();
  await expect(page.locator(".line-tracker").filter({ hasText: "Stability" }).getByText("Band: Calm")).toBeVisible();
  await expect(page.getByLabel("Operator Name")).toBeVisible();
  await expect(page.locator('input[name="voidMarks"]')).toBeVisible();
  await expect(page.locator('input[name="breachPoints"]')).toBeVisible();
  await expect(page.locator('input[name="voidMarks"]')).toHaveAttribute("max", "99");
  await expect(page.locator('input[name="breachPoints"]')).toHaveAttribute("max", "99");

  await page.locator('input[name="voidMarks"]').fill("12");
  await page.locator('input[name="breachPoints"]').fill("3");
  await page.getByRole("button", { name: "Major" }).click();
  await expect(page.getByRole("button", { name: "Major" })).toHaveClass(/is-active/);

  await page.getByRole("button", { name: "Marked" }).click();
  await expect(page.getByRole("button", { name: "Marked" })).toHaveClass(/is-active/);

  await page.getByRole("button", { name: "Apply Core Start" }).click();
  await expect(page.getByRole("button", { name: "Creation Mode: On" })).toBeVisible();
  await expect(page.locator('input[name="voidMarks"]')).toHaveValue("1");
  await expect(page.locator('input[name="breachPoints"]')).toHaveValue("3");
  await expect(page.getByLabel("Body 1")).toBeVisible();
  await page.getByLabel("Body 3").click();
  await page.locator("#skill-picker").selectOption("Investigation");
  await page.locator("#skill-rank").fill("2");
  await expect(page.locator("#skill-rank-preview")).toContainText("connect evidence");
  await page.getByRole("button", { name: "Add Skill" }).click();
  await expect(page.getByText("Creation: skills 2/8 // attribute spread 2/6 // Bonus Breach 3/3")).toBeVisible();
  await expect(page.locator("#skill-list").getByText(/Investigation 2 .* connect evidence/)).toBeVisible();
  await page.locator("#roll-attribute").selectOption("Body");
  await page.locator("#roll-skill").selectOption("Investigation");
  await page.getByRole("button", { name: "Roll 3D6" }).click();
  await expect(page.getByText(/3D6 .* Body \+3 .* Investigation \+2 .* = /)).toBeVisible();

  await page.getByRole("button", { name: "Creation Mode: On" }).click();
  await page.locator('input[name="breachPoints"]').fill("3");
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
  await page.getByRole("button", { name: "Frequency" }).click();
  await expect(page.getByText("Abilities, tells, grounding, and misfire language.")).toBeVisible();
  await expect(page.locator(".lotus-petal")).toHaveCount(6);
  await expect(page.locator("#lotus-tier")).toHaveText("Basic");
  await page.getByLabel("Dream pip 3").click();
  await expect(page.locator("#lotus-frequency")).toHaveText("Dream");
  await expect(page.locator("#lotus-tier")).toHaveText("Empowered");
  await page.getByLabel("Silence pip 5").click();
  await page.getByLabel("Becoming pip 3").click();
  await expect(page.locator("#lotus-unlocks")).toContainText("Silence 5: Distortion");
  await expect(page.locator("#lotus-unlocks")).toContainText("Becoming 3: Integration");
  await page.locator(".lotus-petal").filter({ hasText: "Hunger" }).getByRole("button", { name: "Mark Blind" }).click();
  await expect(page.getByLabel("Hunger pip 1")).toBeDisabled();
  await expect(page.locator("#lotus-unlocks")).toContainText("Blind petal: Hunger");
  await expect(page.getByText("Anchor memory")).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Case files, residue records, and slower notes.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Case File", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Residue", exact: true })).toBeVisible();
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
