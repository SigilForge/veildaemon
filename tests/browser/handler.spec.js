const { test, expect } = require("@playwright/test");

test("handler dashboard exposes live table controls", async ({ page }) => {
  await page.goto("/handler/");

  await expect(page.getByRole("heading", { name: "HANDLER DASHBOARD" })).toBeVisible();
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Stable/ })).toHaveClass(/is-active/);
  await expect(page.getByLabel("Primary clock segments")).toBeVisible();
  await expect(page.locator(".status-strip").getByText("3d6 + Attribute + Skill", { exact: true })).toBeVisible();
  await expect(page.getByText("Need -> Lure -> Pressure -> Gift -> Violence -> Exit")).toBeVisible();
  await expect(page.getByText("PRIVATE HANDLER NOTES")).toBeVisible();

  await page.getByLabel("Template").selectOption("veilcorp-intake");
  await page.getByRole("button", { name: "Apply Template" }).click();
  await expect(page.locator('[name="session.caseTitle"]')).toHaveValue("VeilCorp Intake");
  await expect(page.getByLabel("Current Attention")).toHaveValue("Observed");
  await expect(page.getByLabel("Scene State").getByRole("button", { name: /Echoed/ })).toHaveClass(/is-active/);

  await page.locator('[name="roll.attribute"]').fill("3");
  await page.locator('[name="roll.skill"]').fill("2");
  await page.getByRole("button", { name: "Roll 3d6" }).click();
  await expect(page.locator("#roll-output")).toContainText("3d6");
  await expect(page.locator("#roll-output")).toContainText("Attribute 3 + Skill 2");

  await page.getByLabel("Player View").check();
  await expect(page.getByLabel("Player-facing display")).toBeVisible();
  await expect(page.getByLabel("Player-facing display")).toContainText("Intake pressure rising");
  await expect(page.getByLabel("Player-facing display")).not.toContainText("PRIVATE HANDLER NOTES");
});
