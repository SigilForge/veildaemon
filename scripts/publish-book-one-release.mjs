#!/usr/bin/env node
/**
 * Book One release publishing: stage files in private storage, verify a real claim, switch delivery.
 *
 * The manifest (studio/shelf/book-one/manifest.json) is the authority for which objects are current.
 * Paid bytes only ever go to the private `paid-downloads` bucket; nothing here touches public paths.
 *
 *   node scripts/publish-book-one-release.mjs stage --source <dir>
 *       Upload the manifest's PDF/EPUB/MOBI/wallpaper ZIP from <dir> (matched by manifest `*_source` names) next to
 *       whatever is already in the bucket. Never overwrites: an existing object with the same path
 *       must hash-match or the run fails. Every object is then read back through a signed URL and
 *       hash-checked against the manifest.
 *
 *   node scripts/publish-book-one-release.mjs wait-for-purchase [--since <ISO>] [--timeout-min 60]
 *       Poll Stripe until a paid Checkout Session containing the Book One price appears; print its id.
 *
 *   node scripts/publish-book-one-release.mjs verify-claim --session <cs_...|latest> [--base-url <url>]
 *       Run the real claim for a real paid session and hash-check every delivered file against the
 *       manifest. Without --base-url it invokes api/book-one/claim.js locally with the manifest's
 *       object paths (the pre-switch check: same code, same Stripe, same bucket, same ledger). With
 *       --base-url (e.g. https://api.veildaemon.app) it checks the live endpoint (the post-switch
 *       check). Note: a claim is recorded against that purchase each run, as it would be for a buyer.
 *
 *   node scripts/publish-book-one-release.mjs cleanup-test-purchases --stripe-mode test [--session cs_test_...]
 *       Delete ledger rows left by test-mode claims (cs_test_ session + recorded test price only).
 *       The test gate runs this for its own session after every verification, pass or fail.
 *
 *   node scripts/publish-book-one-release.mjs switch [--dry-run]
 *       Point production delivery at the manifest: set the Vercel BOOK_ONE_SUPABASE_PATH override
 *       (Production + Preview) to the manifest PDF path and rename the Stripe product to the manifest
 *       title, and mirror the rights record's newest version into Supabase (new version row + live row
 *       title/edition/fingerprint). Code/page changes ship through the normal `npm run push`.
 *
 * Credentials come from the environment, falling back to veillink/.env: STRIPE_SECRET_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL). The Vercel CLI must be
 * logged in for `switch`.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const manifestPath = path.join(root, "studio/shelf/book-one/manifest.json");
const BUCKET = "paid-downloads";
const LIVE_PRICE_ID = "price_1TwE0oFht6uPr4mz4thEHLpN";
const TEST_IDS_FILE = path.join(root, "scripts/book-one-stripe-test.json");
const TEST_KEY_FILE = path.join(root, ".env.stripe-test.local"); // gitignored (.env.*)

const [command, ...rest] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith("--")) continue;
  const key = rest[i].slice(2);
  flags[key] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
}

// Stripe mode. live (default): STRIPE_SECRET_KEY from veillink/.env, must be sk_live_, live price,
// cs_live_ sessions. test (--stripe-mode test): STRIPE_TEST_SECRET_KEY from .env.stripe-test.local,
// must be sk_test_, the test price from scripts/book-one-stripe-test.json, cs_test_ sessions only.
// A test-mode run never reads the live key, never talks to a deployed claim endpoint, never switches.
const MODE = flags["stripe-mode"] === "test" ? "test" : "live";
let PRICE_ID = LIVE_PRICE_ID;

function applyStripeMode() {
  if (MODE === "live") {
    if (!String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_")) fail("live mode requires an sk_live_ STRIPE_SECRET_KEY");
    return;
  }
  const line = existsSync(TEST_KEY_FILE) && readFileSync(TEST_KEY_FILE, "utf8").match(/^STRIPE_TEST_SECRET_KEY=(\S+)$/m);
  const key = line && line[1].replace(/^["']|["']$/g, "");
  if (!key || !key.startsWith("sk_test_")) fail(`test mode needs STRIPE_TEST_SECRET_KEY=sk_test_... in ${path.basename(TEST_KEY_FILE)}`);
  process.env.STRIPE_SECRET_KEY = key; // replaces the live key for this process only
  const ids = existsSync(TEST_IDS_FILE) ? JSON.parse(readFileSync(TEST_IDS_FILE, "utf8")) : {};
  PRICE_ID = ids.testPriceId || "";
  process.env.BOOK_ONE_STRIPE_PRICE_ID = PRICE_ID;
}

function checkSessionMode(sessionId) {
  const want = MODE === "test" ? "cs_test_" : "cs_live_";
  if (!sessionId.startsWith(want)) fail(`${MODE} mode only verifies ${want} sessions (got ${sessionId.slice(0, 8)}…)`);
}

function loadEnv() {
  const file = path.join(root, "veillink/.env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  process.env.SUPABASE_URL ||= process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function need(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (environment or veillink/.env)`);
  return value;
}

function fail(message) {
  console.error(`\x1b[31m✗ ${message}\x1b[0m`);
  process.exit(1);
}

const ok = (message) => console.log(`\x1b[32m✓ ${message}\x1b[0m`);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function manifest() {
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  const files = ["pdf", "epub", "mobi", "wallpaper"].map((kind) => ({
    kind,
    objectPath: m[`${kind}_path`],
    source: m[`${kind}_source`],
    sha256: m[`${kind}_sha256`],
    // MIME types as reported by `file --mime-type` on the release artifacts; the bucket allows exactly these.
    contentType: {
      pdf: "application/pdf",
      epub: "application/epub+zip",
      mobi: "application/x-mobipocket-ebook",
      wallpaper: "application/zip",
    }[kind],
  }));
  for (const f of files) {
    if (!f.objectPath || !f.sha256) fail(`manifest is missing ${f.kind}_path or ${f.kind}_sha256`);
  }
  return { ...m, files };
}

function storageHeaders(extra = {}) {
  const key = need("SUPABASE_SERVICE_ROLE_KEY");
  return { Authorization: `Bearer ${key}`, apikey: key, ...extra };
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

async function signedDownload(objectPath) {
  const base = need("SUPABASE_URL").replace(/\/+$/, "");
  const res = await fetch(`${base}/storage/v1/object/sign/${BUCKET}/${encodePath(objectPath)}`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: 120 }),
  });
  if (res.status === 400 || res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`sign ${objectPath}: ${res.status} ${body.message || body.error || ""}`);
  const signed = body.signedURL || body.signedUrl;
  const url = signed.startsWith("http") ? signed : `${base}/storage/v1${signed}`;
  const file = await fetch(url);
  if (!file.ok) throw new Error(`download ${objectPath}: ${file.status}`);
  return Buffer.from(await file.arrayBuffer());
}

async function stage() {
  const m = manifest();
  const source = flags.source && path.resolve(String(flags.source));
  if (!source || !existsSync(source)) fail("stage needs --source <dir> containing the release files");
  const base = need("SUPABASE_URL").replace(/\/+$/, "");
  for (const f of m.files) {
    const local = path.join(source, f.source || path.basename(f.objectPath));
    if (!existsSync(local)) fail(`missing ${local}`);
    const bytes = readFileSync(local);
    if (sha256(bytes) !== f.sha256) fail(`${local} does not match manifest ${f.kind}_sha256`);
    const existing = await signedDownload(f.objectPath);
    if (existing) {
      if (sha256(existing) !== f.sha256) fail(`${f.objectPath} already exists with different bytes; refusing to overwrite`);
      ok(`${f.objectPath} already staged (hash matches)`);
      continue;
    }
    const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodePath(f.objectPath)}`, {
      method: "POST",
      headers: storageHeaders({ "Content-Type": f.contentType, "x-upsert": "false", "cache-control": "no-store" }),
      body: bytes,
    });
    if (!res.ok) fail(`upload ${f.objectPath}: ${res.status} ${await res.text()}`);
    ok(`uploaded ${f.objectPath} (${bytes.length} bytes)`);
  }
  for (const f of m.files) {
    const back = await signedDownload(f.objectPath);
    if (!back || sha256(back) !== f.sha256) fail(`read-back hash mismatch for ${f.objectPath}`);
    ok(`verified ${f.objectPath} via signed URL`);
  }
}

async function stripe(pathname, init = {}) {
  const res = await fetch(`https://api.stripe.com/v1${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${need("STRIPE_SECRET_KEY")}`, ...(init.headers || {}) },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe ${pathname}: ${body.error?.message || res.status}`);
  return body;
}

async function paidSessions(sinceSeconds = 0) {
  const found = [];
  let after = "";
  for (let page = 0; page < 20; page++) {
    const q = `limit=100&status=complete&created[gte]=${sinceSeconds}&expand[]=data.line_items${after ? `&starting_after=${after}` : ""}`;
    const list = await stripe(`/checkout/sessions?${q}`);
    for (const s of list.data) {
      if (s.payment_status === "paid" && s.line_items?.data?.some((li) => li.price?.id === PRICE_ID)) found.push(s);
    }
    if (!list.has_more) break;
    after = list.data[list.data.length - 1].id;
  }
  return found.sort((a, b) => b.created - a.created);
}

async function waitForPurchase() {
  const since = flags.since ? Math.floor(Date.parse(String(flags.since)) / 1000) : Math.floor(Date.now() / 1000) - 300;
  const deadline = Date.now() + Number(flags["timeout-min"] || 60) * 60_000;
  console.log(`Waiting for a paid Book One checkout since ${new Date(since * 1000).toISOString()}…`);
  while (Date.now() < deadline) {
    const [latest] = await paidSessions(since);
    if (latest) {
      ok(`paid session ${latest.id} at ${new Date(latest.created * 1000).toISOString()}`);
      console.log(latest.id);
      return latest.id;
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  fail("timed out waiting for a paid Book One checkout");
}

function linksFrom(html) {
  const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  return [...html.matchAll(/href="([^"]+\/storage\/v1\/object\/sign\/[^"]+)"/g)].map((m) => unescape(m[1]));
}

async function claimHtmlLocal(sessionId, m) {
  process.env.BOOK_ONE_SUPABASE_BUCKET = BUCKET;
  process.env.BOOK_ONE_SUPABASE_PATH = m.pdf_path;
  process.env.BOOK_ONE_EPUB_PATH = m.epub_path;
  process.env.BOOK_ONE_MOBI_PATH = m.mobi_path;
  process.env.BOOK_ONE_WALLPAPER_PATH = m.wallpaper_path;
  const handler = require(path.join(root, "api/book-one/claim.js"));
  let status = 200;
  let body = "";
  const res = {
    statusCode: 200,
    setHeader() {},
    end(chunk) { body += chunk || ""; status = this.statusCode; },
    send(chunk) { this.end(chunk); },
    status(code) { this.statusCode = code; return this; },
  };
  await handler({ method: "GET", query: { session_id: sessionId }, url: `/api/book-one/claim?session_id=${sessionId}` }, res);
  return { status, html: body };
}

async function verifyClaim() {
  const m = manifest();
  let sessionId = String(flags.session || "");
  if (!PRICE_ID) fail("no test price recorded; run test-setup --stripe-mode test first");
  if (!sessionId || sessionId === "latest") {
    const [latest] = await paidSessions(0);
    if (!latest) fail("no paid Book One checkout exists yet; run wait-for-purchase after buying once");
    sessionId = latest.id;
  }
  checkSessionMode(sessionId);
  if (MODE === "test" && flags["base-url"]) fail("test-mode sessions are only verified against the local handler, never a deployed endpoint");
  let status;
  let html;
  if (flags["base-url"]) {
    const res = await fetch(`${String(flags["base-url"]).replace(/\/+$/, "")}/api/book-one/claim?session_id=${encodeURIComponent(sessionId)}`);
    status = res.status;
    html = await res.text();
  } else {
    ({ status, html } = await claimHtmlLocal(sessionId, m));
  }
  if (status !== 200) fail(`claim returned ${status}`);
  const links = linksFrom(html);
  for (const f of m.files) {
    const link = links.find((l) => decodeURIComponent(l).includes(f.objectPath));
    if (!link) fail(`claim did not deliver ${f.objectPath}`);
    const res = await fetch(link);
    if (!res.ok) fail(`delivered ${f.kind} link returned ${res.status}`);
    const got = sha256(Buffer.from(await res.arrayBuffer()));
    if (got !== f.sha256) fail(`delivered ${f.kind} hash ${got} does not match manifest`);
    ok(`claim delivered ${f.objectPath} (sha256 matches)`);
  }
  ok(`${MODE}-mode claim verified end to end for ${sessionId.slice(0, 16)}… ${flags["base-url"] ? `via ${flags["base-url"]}` : "(local handler)"}`);
}

// Mirror the static record's newest versionHistory entry into Supabase: insert that version's snapshot
// (never touching earlier versions) and update the live row's title/edition/fingerprint to match.
// Idempotent: an existing version with the same number is left as is.
async function recordRightsVersion(dry) {
  const record = JSON.parse(readFileSync(path.join(root, "rights/the-anchor-and-the-glitch.json"), "utf8"));
  const latest = [...(record.versionHistory || [])].sort((a, b) => b.version - a.version)[0];
  if (!latest) fail("rights record has no versionHistory");
  const base = need("SUPABASE_URL").replace(/\/+$/, "");
  const headers = storageHeaders({ "Content-Type": "application/json" });
  const [row] = await (await fetch(`${base}/rest/v1/creator_rights_records?select=id&slug=eq.the-anchor-and-the-glitch`, { headers })).json();
  if (!row) fail("live Creator Rights record not found");
  const existing = await (await fetch(`${base}/rest/v1/creator_rights_record_versions?select=version_number&record_id=eq.${row.id}&version_number=eq.${latest.version}`, { headers })).json();
  console.log(`${dry ? "[dry-run] " : ""}Creator Rights version ${latest.version} (${latest.title}) ${existing.length ? "already recorded" : "to record"}`);
  if (dry) return;
  if (!existing.length) {
    const ins = await fetch(`${base}/rest/v1/creator_rights_record_versions`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ record_id: row.id, version_number: latest.version, snapshot_json: record, change_summary: latest.summary }),
    });
    if (!ins.ok) fail(`insert rights version: ${ins.status} ${await ins.text()}`);
  }
  const fp = record.fileFingerprint;
  const upd = await fetch(`${base}/rest/v1/creator_rights_records?id=eq.${row.id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      title: record.title,
      edition: record.workVersion,
      filename: fp.filename,
      file_size: fp.fileSize,
      mime_type: fp.mimeType,
      sha256_hash: fp.value,
      hash_created_at: fp.createdAt,
    }),
  });
  if (!upd.ok) fail(`update rights record: ${upd.status} ${await upd.text()}`);
  ok(`Creator Rights version ${latest.version} recorded; live record now "${record.title}"`);
}

async function switchDelivery() {
  if (MODE !== "live") fail("switch only runs in live mode");
  const m = manifest();
  const dry = Boolean(flags["dry-run"]);
  for (const env of ["production", "preview"]) {
    console.log(`${dry ? "[dry-run] " : ""}vercel env BOOK_ONE_SUPABASE_PATH (${env}) -> ${m.pdf_path}`);
    if (dry) continue;
    spawnSync("vercel", ["env", "rm", "BOOK_ONE_SUPABASE_PATH", env, "--yes"], { cwd: root, stdio: "ignore" });
    const add = spawnSync("vercel", ["env", "add", "BOOK_ONE_SUPABASE_PATH", env], { cwd: root, input: m.pdf_path, encoding: "utf8" });
    if (add.status !== 0) fail(`vercel env add (${env}) failed: ${add.stderr}`);
    ok(`BOOK_ONE_SUPABASE_PATH (${env}) set`);
  }
  await recordRightsVersion(dry);
  const price = await stripe(`/prices/${PRICE_ID}`);
  const name = m.stripe_product_name || m.title;
  console.log(`${dry ? "[dry-run] " : ""}Stripe product ${price.product} name -> ${name}`);
  if (!dry) {
    await stripe(`/products/${price.product}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name, ...(m.stripe_product_description ? { description: m.stripe_product_description } : {}) }),
    });
    ok("Stripe product renamed");
  }
}

async function testSetup() {
  if (MODE !== "test") fail("test-setup requires --stripe-mode test");
  const m = manifest();
  const liveProductId = "prod_Uw6DGVcPF1s1Kt";
  const found = await stripe(`/products/search?query=${encodeURIComponent(`metadata['mirror_of']:'${liveProductId}'`)}`);
  let product = found.data[0];
  if (!product) {
    product = await stripe("/products", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: m.stripe_product_name || m.title, "metadata[mirror_of]": liveProductId }),
    });
    ok(`created test product ${product.id}`);
  }
  const prices = await stripe(`/prices?product=${product.id}&active=true&limit=10`);
  let price = prices.data.find((p) => p.unit_amount === 999 && p.currency === "usd" && !p.recurring);
  if (!price) {
    price = await stripe("/prices", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ product: product.id, unit_amount: "999", currency: "usd", "metadata[mirror_of]": LIVE_PRICE_ID }),
    });
    ok(`created test price ${price.id}`);
  }
  if (!price.id || price.livemode) fail("refusing a price that is not test mode");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(TEST_IDS_FILE, `${JSON.stringify({ note: "Stripe TEST-mode mirror of the live Book One product/price. Test IDs only; no keys.", testProductId: product.id, testPriceId: price.id, mirrorOfLiveProduct: liveProductId, mirrorOfLivePrice: LIVE_PRICE_ID }, null, 2)}\n`);
  ok(`test product ${product.id} / price ${price.id} recorded in ${path.relative(root, TEST_IDS_FILE)}`);
}

// Remove ledger rows created by test-mode claims. The claim endpoint records every verified claim in
// book_one_purchases (the production ledger), so each test-gate run would otherwise leave a ghost
// purchase and a test-backed library entitlement behind. Only rows matching all of: a cs_test_
// session id, the recorded test price, and test mode are eligible; --session narrows to one session.
async function cleanupTestPurchases() {
  if (MODE !== "test") fail("cleanup-test-purchases only runs with --stripe-mode test");
  if (!PRICE_ID.startsWith("price_")) fail("no test price recorded");
  const session = flags.session ? String(flags.session) : "";
  if (session && !session.startsWith("cs_test_")) fail("cleanup only accepts cs_test_ sessions");
  const base = need("SUPABASE_URL").replace(/\/+$/, "");
  const filter = `stripe_checkout_session_id=${session ? `eq.${encodeURIComponent(session)}` : "like.cs_test_*"}&price_id=eq.${encodeURIComponent(PRICE_ID)}`;
  const res = await fetch(`${base}/rest/v1/book_one_purchases?${filter}&select=id,stripe_checkout_session_id`, {
    method: "DELETE",
    headers: storageHeaders({ Prefer: "return=representation" }),
  });
  if (!res.ok) fail(`cleanup failed: ${res.status} ${await res.text()}`);
  const removed = await res.json();
  for (const row of removed) ok(`removed test ledger row ${row.id.slice(0, 8)}… (${row.stripe_checkout_session_id.slice(0, 16)}…)`);
  if (!removed.length) ok("no test ledger rows to remove");
}

loadEnv();
applyStripeMode();
const commands = {
  "test-setup": testSetup,
  "cleanup-test-purchases": cleanupTestPurchases, stage, "wait-for-purchase": waitForPurchase, "verify-claim": verifyClaim, switch: switchDelivery };
if (!commands[command]) fail(`usage: publish-book-one-release.mjs <${Object.keys(commands).join("|")}> [flags]`);
commands[command]().catch((error) => fail(error.message));
