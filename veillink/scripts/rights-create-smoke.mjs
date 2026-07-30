const baseUrl = process.env.RIGHTS_SMOKE_BASE_URL || "http://localhost:3000";
const email = process.env.RIGHTS_SMOKE_EMAIL || "";
const password = process.env.RIGHTS_SMOKE_PASSWORD || "";
const screenshot = process.env.RIGHTS_SMOKE_SCREENSHOT || "/tmp/rights-create-smoke.png";

process.env.TMPDIR ||= "/tmp";
process.env.TEMP ||= "/tmp";
process.env.TMP ||= "/tmp";

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 1100 } });
  const logs = [];
  page.on("console", (message) => logs.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));

  try {
    const target = new URL("/rights/create", baseUrl).toString();
    await page.goto(target, { waitUntil: "networkidle", timeout: 45000 });
    if (page.url().includes("/login")) {
      if (!email || !password) {
        throw new Error("Route requires login. Set RIGHTS_SMOKE_EMAIL and RIGHTS_SMOKE_PASSWORD.");
      }
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForFunction(() => location.pathname === "/rights/create", null, { timeout: 45000 });
      await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
    }

    await page.screenshot({ path: screenshot, fullPage: true });
    const body = await page.locator("body").innerText();
    const required = [
      "Register product",
      "Import from artifact or GitHub",
      "Upload work file",
      "Import repository",
      "Choose how your work may be reused",
    ];
    const missing = required.filter((text) => !body.includes(text));
    if (missing.length) throw new Error(`Missing expected text: ${missing.join(", ")}`);

    console.log(JSON.stringify({
      ok: true,
      url: page.url(),
      screenshot,
      console: logs,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
