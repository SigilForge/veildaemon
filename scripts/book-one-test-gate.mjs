#!/usr/bin/env node
/**
 * Stripe TEST-mode purchase gate for a Book One release (pre-switch verification).
 *
 * Runs the production code paths locally with test credentials and nothing live:
 *   1. api/book-one/claim.js served on 127.0.0.1 with the sk_test_ key and the test price, and the
 *      manifest's (staged, not yet live) object paths.
 *   2. VeilLink `next dev` with STRIPE_SECRET_KEY / BOOK_ONE_STRIPE_PRICE_ID overridden to the test
 *      key and test price and BOOK_ONE_CLAIM_URL pointed at the local claim server. The checkout route
 *      itself is unchanged, so client_reference_id and metadata.user_id come from the signed-in user.
 *   3. Signs in as the owner's normal VeilLink account with a server-generated magic-link token
 *      (no email is sent) and stores the session in the @supabase/ssr cookie format.
 *   4. Completes Stripe-hosted test Checkout with the 4242 test card, lands on the local claim,
 *      then runs `publish-book-one-release.mjs verify-claim --stripe-mode test` for that cs_test_
 *      session, which hash-checks every delivered file against the manifest, then deletes that
 *      session's row from the purchase ledger (pass or fail) so validation leaves no ghost purchase.
 *
 * Nothing here touches a deployed endpoint, the live Stripe account, or production env vars.
 * Prerequisites: .env.stripe-test.local with STRIPE_TEST_SECRET_KEY=sk_test_..., then
 *   node scripts/publish-book-one-release.mjs test-setup --stripe-mode test
 *
 * Usage: node scripts/book-one-test-gate.mjs --email <veillink account email> [--headed]
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? undefined : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};
const CLAIM_PORT = 4181;
const APP_PORT = 3100;
const APP = `http://127.0.0.1:${APP_PORT}`;

const fail = (m) => { console.error(`\x1b[31m✗ ${m}\x1b[0m`); process.exit(1); };
const ok = (m) => console.log(`\x1b[32m✓ ${m}\x1b[0m`);

function readEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const email = flag("email");
if (!email || email === true) fail("--email <veillink account email> is required");
const testKey = readEnvFile(path.join(root, ".env.stripe-test.local")).STRIPE_TEST_SECRET_KEY || "";
if (!testKey.startsWith("sk_test_")) fail("STRIPE_TEST_SECRET_KEY=sk_test_... missing from .env.stripe-test.local");
const ids = JSON.parse(readFileSync(path.join(root, "scripts/book-one-stripe-test.json"), "utf8"));
if (!String(ids.testPriceId || "").startsWith("price_")) fail("run test-setup --stripe-mode test first");
const veillinkEnv = readEnvFile(path.join(root, "veillink/.env"));
const supabaseUrl = veillinkEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = veillinkEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = veillinkEnv.SUPABASE_SERVICE_ROLE_KEY;
const manifest = JSON.parse(readFileSync(path.join(root, "studio/shelf/book-one/manifest.json"), "utf8"));

// 1. Local claim server: test key + test price only; staged v48 object paths.
Object.assign(process.env, {
  STRIPE_SECRET_KEY: testKey,
  BOOK_ONE_STRIPE_PRICE_ID: ids.testPriceId,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  BOOK_ONE_SUPABASE_BUCKET: "paid-downloads",
  BOOK_ONE_SUPABASE_PATH: manifest.pdf_path,
  BOOK_ONE_EPUB_PATH: manifest.epub_path,
  BOOK_ONE_MOBI_PATH: manifest.mobi_path,
  BOOK_ONE_WALLPAPER_PATH: manifest.wallpaper_path,
});
const claim = require(path.join(root, "api/book-one/claim.js"));
const claimServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${CLAIM_PORT}`);
  if (url.pathname !== "/api/book-one/claim") { res.statusCode = 404; return res.end(); }
  req.query = Object.fromEntries(url.searchParams);
  claim(req, res);
});
await new Promise((r) => claimServer.listen(CLAIM_PORT, "127.0.0.1", r));
ok(`local claim server on 127.0.0.1:${CLAIM_PORT} (test mode)`);

// 2. VeilLink dev server with test Stripe values overriding veillink/.env.
const devEnv = {
  ...process.env,
  STRIPE_SECRET_KEY: testKey,
  BOOK_ONE_STRIPE_PRICE_ID: ids.testPriceId,
  BOOK_ONE_CLAIM_URL: `http://127.0.0.1:${CLAIM_PORT}/api/book-one/claim`,
  BOOK_ONE_CANCEL_URL: `${APP}/book-one`,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
  NEXT_TELEMETRY_DISABLED: "1",
  TMPDIR: "/tmp", TEMP: "/tmp", TMP: "/tmp",
};
const dev = spawn("npx", ["next", "dev", "-p", String(APP_PORT), "-H", "127.0.0.1"], { cwd: path.join(root, "veillink"), env: devEnv, stdio: ["ignore", "pipe", "pipe"], detached: true });
let devLog = "";
dev.stdout.on("data", (d) => { devLog += d; });
dev.stderr.on("data", (d) => { devLog += d; });
const cleanup = () => {
  try { process.kill(-dev.pid, "SIGTERM"); } catch {}
  claimServer.close();
};
process.on("exit", cleanup);
for (let i = 0; i < 120; i++) {
  try { if ((await fetch(`${APP}/book-one`)).status < 500) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
  if (i === 119) { console.error(devLog.slice(-2000)); fail("VeilLink dev server did not start"); }
}
ok(`VeilLink dev on ${APP} (test Stripe values)`);

// 3. Sign in as the owner's account: server-side magic-link token -> session -> @supabase/ssr cookies.
const gen = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email }),
});
const link = await gen.json();
const tokenHash = link.hashed_token || link.properties?.hashed_token;
if (!gen.ok || !tokenHash) fail(`could not generate a sign-in token: ${gen.status}`);
const { createServerClient } = require(path.join(root, "veillink/node_modules/@supabase/ssr"));
let jar = [];
const sb = createServerClient(supabaseUrl, anonKey, { cookies: { getAll: () => jar, setAll: (c) => { jar = c.map(({ name, value }) => ({ name, value })); } } });
let { data: verified, error: verifyError } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
if (verifyError) ({ data: verified, error: verifyError } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "email" }));
if (verifyError || !verified.user) fail(`sign-in failed: ${verifyError?.message}`);
if (!jar.length) fail("no session cookies were produced");
ok(`signed in as ${email} (user ${verified.user.id.slice(0, 8)}…)`);

// 4. Real VeilLink checkout -> Stripe test Checkout -> local claim.
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ headless: !flag("headed") });
const page = await (await browser.newContext()).newPage();
await page.context().addCookies(jar.map((c) => ({ ...c, url: APP })));
await page.goto(`${APP}/book-one`);
await Promise.all([page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 }), page.locator('form[action="/api/book-one/checkout"] button, form[action="/api/book-one/checkout"] [type=submit]').first().click()]);
ok("VeilLink checkout route issued a Stripe test Checkout session");
const fillIf = async (sel, val) => { const el = page.locator(sel).first(); if (await el.count() && await el.isEditable().catch(() => false)) await el.fill(val); };
await page.waitForLoadState("networkidle").catch(() => {});
if (process.env.GATE_DEBUG) {
  await page.screenshot({ path: "/tmp/book-one-test-gate-debug.png", fullPage: true });
  const inputs = await page.$$eval("input, button", (els) => els.map((e) => `${e.tagName}#${e.id}[name=${e.getAttribute("name")}] visible=${!!e.offsetParent} ${e.getAttribute("aria-label") || e.textContent?.trim().slice(0, 30) || ""}`));
  console.log(inputs.join("\n"));
  console.log("frames:", page.frames().map((f) => f.url().slice(0, 80)).join(" | "));
  process.exit(3);
}
// Checkout shows a payment-method accordion; select Card, then wait for the card fields.
const cardRadio = page.locator("#payment-method-accordion-item-title-card");
if (await cardRadio.count()) await cardRadio.check({ force: true });
await page.locator("#cardNumber").waitFor({ timeout: 60_000 });
// Do not opt into Link (it adds a required phone field).
const linkOptIn = page.locator("#enableStripePass");
if (await linkOptIn.count() && await linkOptIn.isChecked().catch(() => false)) await linkOptIn.uncheck({ force: true });
await fillIf("#email", email);
await fillIf("#cardNumber", "4242 4242 4242 4242");
await fillIf("#cardExpiry", "12 / 34");
await fillIf("#cardCvc", "123");
await fillIf("#billingName", "VeilSight Gate Test");
await fillIf("#billingPostalCode", "10001");
await Promise.all([
  page.waitForURL(new RegExp(`127\\.0\\.0\\.1:${CLAIM_PORT}/api/book-one/claim`), { timeout: 120_000 }),
  page.locator('button[type="submit"], .SubmitButton').first().click(),
]).catch(async (e) => {
  await page.screenshot({ path: path.join("/tmp", "book-one-test-gate-checkout.png"), fullPage: true });
  fail(`Checkout did not complete (screenshot /tmp/book-one-test-gate-checkout.png): ${e.message}`);
});
const sessionId = new URL(page.url()).searchParams.get("session_id") || "";
if (!sessionId.startsWith("cs_test_")) fail(`expected a cs_test_ session, got ${sessionId.slice(0, 8)}…`);
ok(`paid test Checkout ${sessionId.slice(0, 16)}… redirected to the local claim`);
await browser.close();
cleanup();

// 5. Verify the claim for that session: all four files, hash-checked against the manifest.
const publish = path.join(root, "scripts/publish-book-one-release.mjs");
const verify = spawnSync("node", [publish, "verify-claim", "--stripe-mode", "test", "--session", sessionId], { cwd: root, stdio: "inherit" });
// 6. Always remove this run's ledger row (the claim records test purchases in the production ledger).
const cleaned = spawnSync("node", [publish, "cleanup-test-purchases", "--stripe-mode", "test", "--session", sessionId], { cwd: root, stdio: "inherit" });
if (cleaned.status !== 0) console.error(`cleanup failed; run: node scripts/publish-book-one-release.mjs cleanup-test-purchases --stripe-mode test --session ${sessionId}`);
process.exit(verify.status || cleaned.status || 0);
