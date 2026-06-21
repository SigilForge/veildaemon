const { test, expect } = require("@playwright/test");

const publicSurfaces = [
  "/",
  "/operator/",
  "/debrief/",
  "/recovered-operator-reports/",
  "/updates/"
];

for (const path of publicSurfaces) {
  test(`surface navigation is visible on ${path}`, async ({ page }) => {
    await page.goto(path);

    const nav = page.getByRole("navigation", { name: "Surface files" });
    await expect(nav).toBeVisible();
    await expect(nav.getByText("CASE FILE")).toBeVisible();
    await expect(nav.getByText("OPERATOR FILE")).toBeVisible();
    await expect(nav.getByText("REPORTS")).toBeVisible();
  });
}

test("operator file opens local anomaly preview before routing", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();

  const preview = page.locator("#operator-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByText("LOCAL OBSERVATION BUFFER")).toBeVisible();
  await expect(preview.getByText("ANOMALY RECOVERY CHANNEL", { exact: true })).toBeVisible();
  await expect(preview.getByRole("link", { name: "Edit Personal File" })).toHaveAttribute("href", "/operator/");
});

test("surface drawers allow only one open preview", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("OPERATOR FILE").click();
  await expect(page.locator("#operator-preview")).toBeVisible();

  await nav.getByText("REPORTS").click();
  await expect(page.locator("#operator-preview")).not.toBeVisible();
  await expect(page.locator("#recovered-reports-drawer")).toBeVisible();
});
