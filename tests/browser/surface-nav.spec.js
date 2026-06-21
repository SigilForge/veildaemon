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

test("secondary surface tabs route through the main console", async ({ page }) => {
  for (const path of ["/operator/", "/debrief/", "/recovered-operator-reports/", "/updates/"]) {
    await page.goto(path);

    const links = await page.locator(".surface-tabs .surface-tab").evaluateAll((tabs) =>
      tabs.map((tab) => ({
        label: tab.querySelector("span")?.textContent?.trim(),
        detail: tab.querySelector("strong")?.textContent?.trim(),
        href: tab.getAttribute("href")
      }))
    );

    expect(links.find((link) => link.label === "CASE FILE")?.href).toBe("/");
    expect(links.some((link) => link.href?.includes("itch.io"))).toBe(false);
  }

  await page.goto("/operator/");
  await expect(page.locator(".surface-tabs .active-case-tab")).toHaveAttribute("href", "/");
  await expect(page.locator(".surface-tabs .active-case-tab strong")).toHaveText("RETURN HOME");

  await page.goto("/recovered-operator-reports/");
  await expect(page.locator(".surface-tabs .recovered-reports-tab")).toHaveAttribute("href", "/");
  await expect(page.locator(".surface-tabs .recovered-reports-tab strong")).toHaveText("RETURN HOME");
});

test("preview panels normalize to the surface tab rack", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Surface files" });
  await nav.getByText("CASE FILE").click();

  const homeHeights = await page.evaluate(() => {
    const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect().height || 0;
    const panel = document.querySelector(".casefile-panel")?.getBoundingClientRect().height || 0;
    return { tabs, panel };
  });
  expect(homeHeights.panel).toBeGreaterThanOrEqual(homeHeights.tabs - 2);

  await page.goto("/updates/#operator-preview");
  const noticeHeights = await page.evaluate(() => {
    const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect().height || 0;
    const panel = document.querySelector(".operator-preview-panel")?.getBoundingClientRect().height || 0;
    return { tabs, panel };
  });
  expect(noticeHeights.panel).toBeGreaterThanOrEqual(noticeHeights.tabs - 2);
});
