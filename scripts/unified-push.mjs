/**
 * Unified deployment script for VeilDaemon, VeilLink, RelayDaemon, and Supabase.
 *
 * Performs pre-flight checks, Git push, Vercel deployments, and Supabase verification sync
 * in one canonical command.
 *
 * Usage:
 *   node scripts/unified-push.mjs [options]
 *   npm run ship
 *   npm run push
 *
 * Options:
 *   --skip-checks    Skip unit tests and static syntax checks
 *   --skip-git       Skip git push origin main
 *   --skip-vercel    Skip Vercel deployments
 *   --all-vercel     Force deployment of all Vercel surfaces (veillink, relay, root api)
 *   --relay          Include Relay Vercel deployment
 *   --root-api       Include Root Vercel API deployment
 *   --dry-run        Print actions without executing them
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const args = process.argv.slice(2);
const skipChecks = args.includes("--skip-checks");
const skipGit = args.includes("--skip-git");
const skipVercel = args.includes("--skip-vercel");
const allVercel = args.includes("--all-vercel");
const includeRelay = args.includes("--relay") || allVercel;
const includeRootApi = args.includes("--root-api") || allVercel;
const dryRun = args.includes("--dry-run");

function logStep(msg) {
  console.log(`\n\x1b[36m==> ${msg}\x1b[0m`);
}

function logOk(msg) {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
}

function logWarn(msg) {
  console.log(`\x1b[33m! ${msg}\x1b[0m`);
}

function run(command, commandArgs, options = {}) {
  const label = [command, ...commandArgs].join(" ");
  const cwd = options.cwd || root;
  console.log(`  └─ Running: ${label} (in ${cwd === root ? "." : cwd})`);

  if (dryRun) {
    logOk(`[DRY RUN] Would execute: ${label}`);
    return { status: 0, stdout: "", stderr: "" };
  }

  const env = {
    ...process.env,
    TMPDIR: "/tmp",
    TEMP: "/tmp",
    TMP: "/tmp",
    ...options.env,
  };

  const result = spawnSync(command, commandArgs, {
    cwd,
    env,
    encoding: "utf8",
    stdio: options.silent ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    const errorMsg = `${label} failed with exit code ${result.status}`;
    if (options.allowFailure) {
      logWarn(errorMsg);
      return result;
    }
    throw new Error(errorMsg);
  }

  return result;
}

function gitChangedFiles() {
  try {
    const stdout = run("git", ["diff", "HEAD~1", "--name-only"], { silent: true, allowFailure: true }).stdout || "";
    return stdout.split("\n").map((f) => f.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function main() {
  console.log(`\x1b[1m\x1b[35m=== VeilDaemon Unified Push & Deploy ===\x1b[0m`);
  if (dryRun) console.log(`\x1b[33m(DRY RUN MODE ACTIVE)\x1b[0m`);

  const changed = gitChangedFiles();

  // 1. Pre-flight Checks
  if (skipChecks) {
    logWarn("Skipping pre-flight checks (--skip-checks)");
  } else {
    logStep("Phase 1: Pre-flight Checks & Validation");
    run("npm", ["run", "check"]);
    run("npm", ["run", "rights:validate"]);
    run("npm", ["run", "rights:verification:check"]);
    run("npm", ["run", "test"], { cwd: resolve(root, "veillink") });
    run("npm", ["run", "typecheck"], { cwd: resolve(root, "veillink") });
    logOk("All pre-flight checks passed cleanly");
  }

  // 2. Supabase Verification Sync (if configured)
  logStep("Phase 2: Supabase Verification Sync");
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (hasSupabaseEnv) {
    run("npm", ["run", "rights:verification:export"]);
    logOk("Supabase verification projection synced");
  } else {
    logWarn("Supabase credentials not set in env; skipping live export (local verification projection used)");
  }

  // 3. Git Push
  if (skipGit) {
    logWarn("Skipping Git push (--skip-git)");
  } else {
    logStep("Phase 3: Push to GitHub (origin main)");
    run("git", ["push", "origin", "main"]);
    logOk("Pushed latest commits to origin main");
  }

  // 4. Vercel Deployments
  if (skipVercel) {
    logWarn("Skipping Vercel deployments (--skip-vercel)");
  } else {
    logStep("Phase 4: Vercel Deployments");

    // 4a. VeilLink App (app.veildaemon.app)
    logStep("4a. Deploying VeilLink (app.veildaemon.app)...");
    const veillinkDir = resolve(root, "veillink");
    if (existsSync(veillinkDir)) {
      run("vercel", ["--prod", "--yes"], { cwd: veillinkDir });
      logOk("VeilLink production build deployed to app.veildaemon.app");
    }

    // 4b. RelayDaemon (relay.veildaemon.app) - run if Relay files changed or requested
    const relayFilesChanged = changed.some(
      (f) => f.startsWith("studio/relay/") || f.startsWith("scripts/relay") || f.startsWith("api/character.js")
    );
    if (includeRelay || relayFilesChanged) {
      logStep("4b. Deploying RelayDaemon (relay.veildaemon.app)...");
      run("npm", ["run", "relay:vercel:prepare"]);
      const relayVercelDir = resolve(root, "_relay-vercel");
      if (existsSync(relayVercelDir)) {
        run("vercel", ["link", "--yes", "--project", "veildaemon-relay", "--scope", "knoxmortis-projects"], {
          cwd: relayVercelDir,
        });
        run("vercel", ["deploy", "--prod", "--yes"], { cwd: relayVercelDir });
        logOk("RelayDaemon deployed to relay.veildaemon.app");
      }
    } else {
      console.log("  └─ Skipping RelayDaemon deploy (no relay file changes detected; use --relay or --all-vercel to force)");
    }

    // 4c. Main Vercel API (api.veildaemon.app) - run if api/ or vercel.json changed or requested
    const apiFilesChanged = changed.some((f) => f.startsWith("api/") || f === "vercel.json");
    if (includeRootApi || apiFilesChanged) {
      logStep("4c. Deploying Root Vercel API (api.veildaemon.app)...");
      run("vercel", ["--prod", "--yes"], { cwd: root });
      logOk("Root Vercel API deployed to api.veildaemon.app");
    } else {
      console.log("  └─ Skipping Root API deploy (no root api changes detected; use --root-api or --all-vercel to force)");
    }
  }

  // 5. Final Summary
  logStep("Phase 5: Unified Deployment Summary");
  console.log(`
  \x1b[32m✔ Unified Push & Deployment Complete!\x1b[0m

  \x1b[1mDeployed Surfaces:\x1b[0m
  • GitHub Pages:  https://veildaemon.app/
  • VeilLink App:  https://app.veildaemon.app/
  • Vercel API:    https://api.veildaemon.app/
  • RelayDaemon:   https://relay.veildaemon.app/
  `);
}

main().catch((err) => {
  console.error(`\n\x1b[31m✖ Unified push failed:\x1b[0m`, err.message || err);
  process.exit(1);
});
