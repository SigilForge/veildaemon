const { test, expect } = require("@playwright/test");

const appOrigin = process.env.VEILLINK_TEST_URL;

test.describe("VeilLink portal routing", () => {
  test.skip(!appOrigin, "Set VEILLINK_TEST_URL to a running VeilLink origin");

  test("portal includes all five doors, embedded login, and generic navigation", async ({ page }) => {
    const response = await page.goto(`${appOrigin}/`);
    expect(response.status()).toBe(200);
    for (const name of ["Connected Play", "Book One / Library", "Creator Rights", "QR & Links", "Account & Billing"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue("/home");
    await expect(page.locator("header a.brand")).toHaveAttribute("href", "/");
    await expect(page.locator("header").getByRole("link", { name: "Log in", exact: true })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Create a free account", exact: true })).toHaveAttribute("href", "/signup");
    await page.getByRole("link", { name: "Manage QR & Links", exact: true }).click();
    await expect(page).toHaveURL(`${appOrigin}/links`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Editable QR codes");
    await page.getByRole("link", { name: "Create a free link", exact: true }).click();
    await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
    await page.getByRole("link", { name: "Already have an account?" }).click();
    await expect(page).toHaveURL(`${appOrigin}/login?next=%2Fdashboard`);
    await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
  });

  test("signed-out hub returns to the portal and generic signup returns there too", async ({ page }) => {
    await page.goto(`${appOrigin}/home`);
    await expect(page).toHaveURL(`${appOrigin}/`);
    await page.goto(`${appOrigin}/signup`);
    await page.getByRole("link", { name: "Already have an account?" }).click();
    await expect(page).toHaveURL(`${appOrigin}/`);
  });

  test("portal displays login errors without removing its product context", async ({ page }) => {
    await page.goto(`${appOrigin}/?error=Invalid%20credentials&next=%2Fhome`);
    await expect(page.locator(".auth-embed").getByRole("alert")).toHaveText("Invalid credentials");
    await expect(page.getByRole("heading", { name: "Connected Play", exact: true })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  });

  test("real generic login reaches home and changes the brand destination", async ({ page }) => {
    const email = process.env.RIGHTS_SMOKE_EMAIL;
    const password = process.env.RIGHTS_SMOKE_PASSWORD;
    test.skip(!email || !password, "Existing test account required via RIGHTS_SMOKE_EMAIL and RIGHTS_SMOKE_PASSWORD");
    await page.goto(`${appOrigin}/`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(`${appOrigin}/home`);
    await expect(page.locator("header a.brand")).toHaveAttribute("href", "/home");
    await expect(page.locator("header").getByRole("link", { name: "QR & Links", exact: true })).toHaveAttribute("href", "/dashboard");
    await expect(page.locator("header").getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
  });

  for (const next of ["https://veildaemon.app/operator/", "https://veildaemon.app/handler/live/?case=viridian"]) {
    test(`explicit play auth preserves ${next}`, async ({ page }) => {
      const response = await page.goto(`${appOrigin}/login?next=${encodeURIComponent(next)}`);
      expect(response.status()).toBe(200);
      await expect(page.locator('input[name="next"]')).toHaveValue(next);
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    });
  }

  for (const next of ["/book-one", "/rights/create", "/account/rights", "/dashboard"]) {
    test(`product entry retains ${next} login intent`, async ({ page }) => {
      await page.goto(`${appOrigin}${next}`);
      await expect(page).toHaveURL(new RegExp("/login\\?next="));
      expect(new URL(page.url()).searchParams.get("next")).toBe(next);
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      await expect(page.locator('input[name="next"]')).toHaveValue(next);
    });
  }
});
