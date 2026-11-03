const { test, expect } = require("@playwright/test");

function seedRecord(page, overrides = {}) {
  return page.addInitScript((extra) => {
    window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
      designation: "TEST-OPERATOR",
      primaryFrequency: "Silence",
      attentionStatus: "NOTED",
      observerClassification: "POTENTIAL OPERATOR",
      discordRoute: "operator-silence",
      ...extra,
    }));
  }, overrides);
}
async function mockDiscord(page, context, seen, fail = false) {
  await page.route("**/functions/v1/discord-route?key=*", async (route) => {
    const key = new URL(route.request().url()).searchParams.get("key");
    seen.push(key);
    await route.fulfill({
      status: fail ? 404 : 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4173" },
      body: fail ? JSON.stringify({ ok: false, error: "Route unavailable." }) :
        JSON.stringify({ url: "https://discord.gg/test-" + key }),
    });
  });
  await context.route("https://discord.gg/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "Mock Discord invite" }));
}
test("frequency keys remain classified as operator or triage", async ({ page }) => {
  await page.goto("/");
  const keys = await page.evaluate(() => [
    getDiscordRoute("Dream"), getDiscordRoute("Dream", true),
    getDiscordRoute("Becoming"), getDiscordRoute("Becoming", true),
    threadbreakerRoute,
  ]);
  expect(keys).toEqual([
    "operator-dream", "triage-dream",
    "operator-becoming", "triage-becoming",
    "threadbreaker",
  ]);
});
test("returning PASS operator opens the server-resolved frequency invite", async ({ page, context }) => {
  const seen = [];
  await seedRecord(page);
  await mockDiscord(page, context, seen);
  await page.goto("/");
  await page.locator("#start-intake").click();
  const btn = page.locator("#task-discord-route");
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText("Open Silence Channel");
  await expect(btn).toHaveAttribute("href", "#");
  const [popup] = await Promise.all([context.waitForEvent("page"), btn.click()]);
  await popup.waitForURL("https://discord.gg/test-operator-silence");
  expect(seen).toEqual(["operator-silence"]);
  await popup.close();
});
test("CLAIMED operators retain triage route and existing label", async ({ page, context }) => {
  const seen = [];
  await seedRecord(page, { observerClassification: "CLAIMED", discordRoute: "https://discord.gg/retired-legacy-value" });
  await mockDiscord(page, context, seen);
  await page.goto("/");
  await page.locator("#start-intake").click();
  const btn = page.locator("#task-discord-route");
  await expect(btn).toHaveText("Open Triage Channel");
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("veildaemon.operatorRecord.v2")));
  expect(stored.discordRoute).toBe("triage-silence");
  const [popup] = await Promise.all([context.waitForEvent("page"), btn.click()]);
  await popup.waitForURL("https://discord.gg/test-triage-silence");
  expect(seen).toEqual(["triage-silence"]);
  await popup.close();
});
test("Threadbreaker resolves separately from classified operator route", async ({ page, context }) => {
  const seen = [];
  await mockDiscord(page, context, seen);
  await page.goto("/");
  await page.locator("#start-intake").click();
  await page.evaluate(() => executeCommand("threadbreaker"));
  const btn = page.getByRole("link", { name: "Open Threadbreaker Route" });
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute("href", "#");
  const [popup] = await Promise.all([context.waitForEvent("page"), btn.click()]);
  await popup.waitForURL("https://discord.gg/test-threadbreaker");
  expect(seen).toEqual(["threadbreaker"]);
  await popup.close();
});
test("missing route shows an error without a fallback invite", async ({ page, context }) => {
  const seen = [];
  await seedRecord(page);
  await mockDiscord(page, context, seen, true);
  await page.goto("/");
  await page.locator("#start-intake").click();
  const btn = page.locator("#task-discord-route");
  await btn.click();
  await expect(page.locator(".discord-route-unavailable")).toContainText("Route currently unavailable");
  expect(seen).toEqual(["operator-silence"]);
  expect(await btn.getAttribute("href")).toBe("#");
});
