const { test, expect } = require("@playwright/test");

const reviewDir = "/tmp/studio-review";

test("studio portal routes visitors and captures desktop review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/");

  await expect(page).toHaveTitle(/Cradlepoint Studio/);
  await expect(page.getByRole("heading", { name: /One universe/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open the Guided Pitch/ })).toHaveAttribute("href", "/studio/funding/");
  await expect(page.getByRole("link", { name: /Explore Publishing/ })).toHaveAttribute("href", "/studio/publishing/");
  await expect(page.getByRole("link", { name: /Explore the Platform/ })).toHaveAttribute("href", "/studio/technology/");
  await expect(page.locator('a[href^="mailto:J.Donavon.Love@gmail.com"]')).toHaveCount(2);
  await expect(page.locator('script[src="/_vercel/insights/script.js"]')).toHaveCount(1);

  for (const route of ["about", "projects", "publishing", "technology", "funding", "traction", "press", "data-room"]) {
    const response = await page.request.get("/studio/" + route + "/");
    expect(response.ok(), route + " route").toBeTruthy();
  }

  await page.goto("/studio/funding/");
  await expect(page.getByRole("heading", { name: /investment case/i })).toBeVisible();
  await expect(page.locator("#problem")).toContainText(/persistent system/i);
  await expect(page.locator("#customer")).toContainText(/Horror and narrative-focused TTRPG/i);
  await expect(page.locator("#revenue")).toContainText(/Near-term/i);
  await expect(page.locator("#capital")).toContainText(/twelve-month outcomes/i);
  await expect(page.locator("#founder")).toContainText(/several disciplines/i);

  await page.screenshot({ path: reviewDir + "/cradlepoint-studio-desktop.png", fullPage: true });
});

test("studio portal is intentional on mobile and captures review", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio/");

  await expect(page.getByRole("heading", { name: /One universe/ })).toBeVisible();
  await expect(page.locator(".pathway")).toHaveCount(6);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: reviewDir + "/cradlepoint-studio-mobile.png", fullPage: true });
});
