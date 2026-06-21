const { test, expect } = require("@playwright/test");

test("operator sheet exposes at-table controls", async ({ page }) => {
  await page.goto("/operator/");

  await expect(page.getByRole("button", { name: "Sheet" })).toHaveClass(/is-active/);
  await expect(page.getByText("Live Condition Trackers")).toBeVisible();
  await expect(page.locator(".pip-tracker").filter({ hasText: "Harm" })).toBeVisible();
  await expect(page.locator(".pip-tracker").filter({ hasText: "Stability" })).toBeVisible();
  await expect(page.locator(".pip-tracker").filter({ hasText: "Misfire" })).toHaveCount(0);
  await expect(page.locator(".pip-tracker").filter({ hasText: "Lotus" })).toHaveCount(0);
  await expect(page.locator(".pip-tracker").filter({ hasText: "Void" })).toHaveCount(0);
  await expect(page.locator(".pip-tracker").filter({ hasText: "Breach" })).toHaveCount(0);
  await expect(page.locator(".pip-tracker").filter({ hasText: "Harm" }).getByText("0/5")).toBeVisible();
  await expect(page.locator(".pip-tracker").filter({ hasText: "Harm" }).getByText("Condition: Clear")).toBeVisible();
  await expect(page.locator(".pip-tracker").filter({ hasText: "Stability" }).getByText("10/10")).toBeVisible();
  await expect(page.locator("#status-band")).toHaveText("CALM");

  await page.locator('input[name="voidMarks"]').fill("12");
  await page.locator('input[name="breachPoints"]').fill("3");
  await page.getByRole("button", { name: "Major" }).click();
  await expect(page.getByRole("button", { name: "Major" })).toHaveClass(/is-active/);

  await page.getByRole("button", { name: "Marked" }).click();
  await expect(page.getByRole("button", { name: "Marked" })).toHaveClass(/is-active/);

  await page.getByLabel("Attribute").fill("2");
  await page.getByLabel("Skill").fill("1");
  await page.getByRole("button", { name: "Roll 3D6" }).click();
  await expect(page.getByText(/3D6 .* = /)).toBeVisible();
});

test("secondary material is separated into tabs", async ({ page }) => {
  await page.goto("/operator/");

  await page.getByRole("button", { name: "Frequency" }).click();
  await expect(page.getByText("Abilities, tells, grounding, and misfire language.")).toBeVisible();
  await expect(page.locator(".lotus-petal")).toHaveCount(6);
  await page.getByLabel("Dream pip 3").click();
  await expect(page.locator("#lotus-frequency")).toHaveText("Dream");
  await expect(page.locator("#lotus-tier")).toHaveText("Empowered");
  await expect(page.getByText("Anchor memory")).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Case files, residue records, and slower notes.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Case File", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Residue", exact: true })).toBeVisible();
});
