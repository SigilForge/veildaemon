#!/usr/bin/env node
/**
 * Canonical, guarded VeilLink production deploy path.
 *
 * Usage:
 *   node scripts/deploy-veillink.mjs [--dry-run] [--skip-verify]
 *   npm run veillink:deploy
 *   npm run veillink:deploy:dry-run
 *
 * Replaces the previously-undocumented `cd veillink && vercel --prod --yes`
 * that agents and humans had to remember by hand. Always deploys the
 * VeilLink production target -- there is no other target for this script.
 *
 * Before deploying, verifies that veillink/.vercel/project.json is linked to
 * the expected VeilLink Vercel project (scripts/lib/veillinkDeployTarget.mjs).
 * If it does not match, this script aborts with a clear error and makes NO
 * deployment and NO relink attempt -- fail closed, always.
 *
 * After a real (non-dry-run) deploy, performs bounded verification unless
 * --skip-verify is passed:
 *   1. Parses the production deployment URL the Vercel CLI prints to stdout.
 *   2. Runs `vercel inspect <url> --format=json` (a documented, stable CLI
 *      flag -- confirmed via `vercel inspect --help` before use) to confirm
 *      the deployment's project name, production target, and that the
 *      expected aliases are attached.
 *   3. Fetches a known public VeilLink route and checks it responds.
 *
 * Documented limitation: this script deploys via the local Vercel CLI, not a
 * Git-triggered build, so there is no automatic, Vercel-verified link between
 * a deployment and the git commit that produced it. It tags the deployment
 * with `--meta gitSha=<HEAD sha>` (a real, documented `vercel deploy` flag)
 * for a best-effort audit trail, but whether `vercel inspect --format=json`
 * round-trips custom `--meta` values back has NOT been verified here -- this
 * PR does not run a real deploy (see IMPORTANT SECURITY / AUTHORITY RULE in
 * its description). Treat the project/target/alias/live-route evidence above
 * as the reliable proof of a correct deploy; treat the gitSha meta tag as
 * supplementary, not proof.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_VEILLINK_PROJECT,
  VEILLINK_PRODUCTION_ALIASES,
  verifyVeillinkProjectLink,
} from "./lib/veillinkDeployTarget.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultVeillinkDir = resolve(repoRoot, "veillink");

export function readProjectJson(dir) {
  const path = resolve(dir, ".vercel", "project.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function currentGitSha(exec = spawnSync) {
  const result = exec("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  return (result.stdout || "").trim() || "unknown";
}

export function parseProductionUrl(stdout) {
  const match = String(stdout || "").match(/Production\s+(https?:\/\/\S+)/);
  return match ? match[1] : null;
}

/**
 * Post-deploy verification, dependency-injected for testing. `exec` matches
 * child_process.spawnSync's signature: (command, args, options) => { status, stdout, stderr }.
 */
export async function verifyDeployment({ stdout, exec, fetchFn, log = () => {}, errorLog = () => {} }) {
  const productionUrl = parseProductionUrl(stdout);
  if (!productionUrl) {
    errorLog("Could not find a Production deployment URL in Vercel CLI output; skipping structured verification.");
    return { ok: false, stage: "verify", reason: "no-production-url" };
  }

  const inspectResult = exec("vercel", ["inspect", productionUrl, "--format=json"], { encoding: "utf8" });
  let deployment = null;
  if (inspectResult.status === 0) {
    try {
      deployment = JSON.parse(inspectResult.stdout);
    } catch {
      errorLog("`vercel inspect --format=json` did not return parseable JSON; continuing with live-route check only.");
    }
  } else {
    errorLog("`vercel inspect` failed; continuing with live-route check only.");
  }

  const problems = [];
  if (deployment) {
    if (deployment.name !== EXPECTED_VEILLINK_PROJECT.projectName) {
      problems.push(`deployment project name "${deployment.name}" != expected "${EXPECTED_VEILLINK_PROJECT.projectName}"`);
    }
    if (deployment.target !== "production") {
      problems.push(`deployment target "${deployment.target}" != "production"`);
    }
    const aliases = deployment.alias || deployment.aliases || [];
    for (const expectedAlias of VEILLINK_PRODUCTION_ALIASES) {
      if (!aliases.some((a) => String(a).includes(expectedAlias))) {
        problems.push(`expected alias "${expectedAlias}" not found in deployment aliases`);
      }
    }
  } else {
    problems.push("no structured deployment metadata available (vercel inspect unavailable/unparseable)");
  }

  let liveOk = false;
  try {
    const response = await fetchFn(`https://${VEILLINK_PRODUCTION_ALIASES[0]}/`);
    liveOk = Boolean(response && response.ok);
    if (!liveOk) problems.push(`live route https://${VEILLINK_PRODUCTION_ALIASES[0]}/ responded ${response && response.status}`);
  } catch (err) {
    problems.push(`live route check failed: ${err && err.message ? err.message : err}`);
  }

  if (problems.length > 0) {
    errorLog(`Post-deploy verification found problems:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    return { ok: false, stage: "verify", problems, deployment, liveOk };
  }

  log("Post-deploy verification passed: project, production target, aliases, and live route all confirmed.");
  return { ok: true, stage: "verify", deployment, liveOk };
}

/**
 * Core logic, dependency-injected for testing so nothing here needs a real
 * Vercel CLI, a real network, or a real deploy to exercise.
 */
export async function runVeillinkDeploy({
  cwd = defaultVeillinkDir,
  exec = spawnSync,
  fetchFn = typeof fetch === "function" ? fetch : undefined,
  readProjectJsonFn = readProjectJson,
  gitShaFn = currentGitSha,
  dryRun = false,
  skipVerify = false,
  log = console.log,
  errorLog = console.error,
} = {}) {
  const projectJson = readProjectJsonFn(cwd);
  const linkCheck = verifyVeillinkProjectLink(projectJson);
  if (!linkCheck.ok) {
    errorLog(`VeilLink deploy guard failed:\n${linkCheck.reason}`);
    return { ok: false, stage: "guard", reason: linkCheck.reason };
  }
  log(`VeilLink Vercel link verified: ${EXPECTED_VEILLINK_PROJECT.projectName} (${EXPECTED_VEILLINK_PROJECT.projectId})`);

  const gitSha = gitShaFn(exec);
  const deployArgs = ["--prod", "--yes", "--meta", `gitSha=${gitSha}`];

  if (dryRun) {
    log(`[DRY RUN] Would run: vercel ${deployArgs.join(" ")} (cwd: ${cwd})`);
    return { ok: true, stage: "dry-run", args: deployArgs };
  }

  log(`Running: vercel ${deployArgs.join(" ")} (in ${cwd})`);
  const deployResult = exec("vercel", deployArgs, { cwd, encoding: "utf8" });
  if (deployResult.status !== 0) {
    errorLog(`VeilLink deploy failed (exit ${deployResult.status}).`);
    if (deployResult.stderr) errorLog(deployResult.stderr);
    return { ok: false, stage: "deploy", status: deployResult.status };
  }
  if (deployResult.stdout) log(deployResult.stdout);

  if (skipVerify) {
    log("Skipping post-deploy verification (--skip-verify).");
    return { ok: true, stage: "deployed", verified: false };
  }

  return verifyDeployment({ stdout: deployResult.stdout || "", exec, fetchFn, log, errorLog });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipVerify = args.includes("--skip-verify");
  const result = await runVeillinkDeploy({ dryRun, skipVerify });
  if (!result.ok) process.exit(1);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}
