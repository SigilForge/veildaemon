#!/usr/bin/env node
/**
 * Canonical VeilLink production deploy: Cloudflare (Workers + Pages Free).
 *
 * Usage:
 *   node scripts/deploy-veillink-cloudflare.mjs [--dry-run]
 *   npm run veillink:deploy
 *   npm run veillink:deploy:dry-run
 *
 * VeilLink left Vercel Hobby (commercial use is not permitted there). It now
 * runs as three Cloudflare pieces, deployed in dependency order:
 *   1. veillink-raster  (veillink/workers/raster)   SVG -> PNG via resvg wasm,
 *      reachable only through the app's RASTER service binding.
 *   2. veillink-app     (veillink, OpenNext build)  the Next.js app Worker.
 *   3. veillink-app-front (deploy/veillink-app-pages) Pages project that owns
 *      app.veildaemon.app (Porkbun CNAME) and forwards to veillink-app over
 *      the APP binding; it also serves the paid Book One claim from the
 *      canonical api/book-one/claim.js.
 * Runtime secrets live on the Worker / Pages project (wrangler secret), never
 * in this repo. NEXT_PUBLIC_* values are inlined at build time from
 * veillink/.env, which Next.js loads automatically.
 *
 * Preconditions (fail closed, nothing deployed): wrangler is authenticated
 * for the SigilForge account, and veillink/.env provides the public build
 * values. After a real deploy it verifies the production hosts; a failed
 * verification is reported as such, never as a trusted release.
 *
 * Rollback: redeploy an earlier version from Cloudflare deployment history
 * (`npx wrangler rollback` for the Workers, Pages deployment history for the
 * front). The old Vercel veillink project was deleted on 2026-11-03.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const veillinkDir = resolve(root, "veillink");
const frontDir = resolve(root, "deploy/veillink-app-pages");
const ACCOUNT_ID = "907f5498d002a7a9c94ddfc5fb9a7f92";
const APP_HOST = "https://app.veildaemon.app";
const REQUIRED_PUBLIC_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_VEILLINK_APP_URL",
  "NEXT_PUBLIC_VEILLINK_PATH_HOST",
  "NEXT_PUBLIC_VEILLINK_BASE_DOMAIN",
];

const dryRun = process.argv.includes("--dry-run");
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || ACCOUNT_ID };

function fail(stage, message) {
  console.error(`\x1b[31m✗ [${stage}] ${message}\x1b[0m`);
  process.exit(1);
}

function ok(message) {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`);
}

function run(stage, command, args, cwd) {
  console.log(`\n$ ${[command, ...args].join(" ")}  (${cwd.replace(root, ".") || "."})`);
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) fail(stage, `${command} ${args[0] || ""} exited ${result.status}`);
}

function gitSha() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

// Preconditions.
const whoami = spawnSync("npx", ["wrangler", "whoami"], { cwd: veillinkDir, env, encoding: "utf8" });
if (whoami.status !== 0 || !whoami.stdout.includes(ACCOUNT_ID)) {
  fail("preflight", "wrangler is not authenticated for the SigilForge Cloudflare account (run `npx wrangler login`).");
}
const envFile = resolve(veillinkDir, ".env");
const publicEnv = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const missing = REQUIRED_PUBLIC_ENV.filter(
  (key) => !process.env[key] && !new RegExp(`^${key}=.+`, "m").test(publicEnv)
);
if (missing.length) fail("preflight", `missing public build values: ${missing.join(", ")}`);
ok("preflight: wrangler authenticated, public build values present");

// Build and deploy in dependency order.
run("build", "npm", ["run", "build:cf"], veillinkDir);
if (dryRun) {
  run("dry-run", "npx", ["wrangler", "deploy", "--dry-run", "-c", "workers/raster/wrangler.jsonc"], veillinkDir);
  run("dry-run", "npx", ["wrangler", "deploy", "--dry-run"], veillinkDir);
  ok("dry run complete: built and bundled, nothing deployed");
  process.exit(0);
}
run("deploy", "npx", ["wrangler", "deploy", "-c", "workers/raster/wrangler.jsonc"], veillinkDir);
run("deploy", "npx", ["wrangler", "deploy"], veillinkDir);
const sha = gitSha();
run(
  "deploy",
  "npx",
  ["wrangler", "pages", "deploy", "--branch", "main", ...(sha ? ["--commit-hash", sha] : []), "--commit-dirty=true"],
  frontDir
);
ok("deployed veillink-raster, veillink-app and veillink-app-front");

// Bounded verification against the production host.
const checks = [
  ["/login", (status) => status === 200],
  ["/api/auth/config", (status) => status === 200],
  ["/api/resolve/zz-deploy-verify-unknown", (status) => status === 404],
  ["/api/book-one/claim", (status) => status === 400],
];
let failed = 0;
for (const [path, expect] of checks) {
  let status = 0;
  try {
    status = (await fetch(`${APP_HOST}${path}`, { redirect: "manual" })).status;
  } catch {
    status = 0;
  }
  if (expect(status)) ok(`verify ${path} -> ${status}`);
  else {
    failed += 1;
    console.error(`\x1b[31m✗ verify ${path} -> ${status}\x1b[0m`);
  }
}
if (failed) fail("verify", `${failed} production check(s) failed after deploy (the deploy itself went through)`);
ok(`VeilLink live on ${APP_HOST}`);
