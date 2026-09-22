#!/usr/bin/env node
/**
 * Canonical, guarded VeilLink production deploy path.
 *
 * Usage:
 *   node scripts/deploy-veillink.mjs [--dry-run]
 *   npm run veillink:deploy
 *   npm run veillink:deploy:dry-run
 *
 * Replaces the previously-undocumented `cd veillink && vercel --prod --yes`
 * that agents and humans had to remember by hand. Always deploys the
 * VeilLink production target -- there is no other target for this script.
 * There is deliberately no way to skip post-deploy verification: this
 * command exists specifically to make a VeilLink production deploy
 * self-verifying, and no caller in this repo has a concrete need to bypass
 * that. If one ever does, add the bypass then, scoped to that need.
 *
 * Before deploying, verifies TWO independent things (scripts/lib/veillinkDeployTarget.mjs)
 * because a correct one is not sufficient on its own:
 *   1. veillink/.vercel/project.json is linked to the expected VeilLink project.
 *   2. The environment does not override that link. Vercel CLI's documented
 *      project-selection precedence is `--project` flag > `VERCEL_PROJECT_ID`/
 *      `VERCEL_ORG_ID` env vars > `.vercel/project.json` -- so a correct link
 *      file can still be silently overridden by an inherited env var. If
 *      either check fails, this script aborts with a clear error and makes NO
 *      deployment and NO relink/env-mutation attempt -- fail closed, always.
 * The actual deploy command also pins `--project <expected id>` explicitly,
 * since that flag is documented as the CLI's highest-precedence signal --
 * belt and suspenders on top of the environment check above.
 *
 * After a real (non-dry-run) deploy, performs bounded verification:
 *   1. Parses the production deployment URL from the deploy command's
 *      output. The current Vercel CLI's documented contract is that stdout
 *      is *just* the deployment URL (see `vercel deploy --help`'s own
 *      `URL=$(vercel deploy --prod)` idiom) with progress/status on stderr;
 *      parseProductionUrl() treats a bare single-URL stdout as authoritative
 *      and falls back to scanning stdout+stderr for an older/human-formatted
 *      "Production      https://..." line for resilience across CLI
 *      versions. It refuses to guess if stdout is neither shape or if
 *      multiple distinct candidate URLs turn up.
 *   2. Runs `vercel inspect <url> --format=json` (a documented, stable CLI
 *      flag -- confirmed via `vercel inspect --help` before use) to confirm
 *      the deployment's project name, production target, and that the
 *      expected aliases are attached.
 *   3. Fetches a known public VeilLink route and checks it responds.
 *
 * If the deploy command itself succeeds but verification then fails, that is
 * reported distinctly (stage "verify", with deployAttempted: true) -- it is
 * never silently treated as a successful, trusted release. The deploy may
 * well have gone through; what failed is confirming that.
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
  verifyVeillinkEnvironmentAuthority,
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

/**
 * Extract the deployment URL from a `vercel deploy --prod` invocation.
 *
 * Prefers the current, documented CLI contract: stdout is *just* the
 * deployment URL, trimmed to a single line (this is what makes
 * `URL=$(vercel deploy --prod)` work as Vercel's own canonical example).
 * Falls back to scanning stdout+stderr for an older/human-formatted
 * "Production      https://..." line, for resilience across CLI versions
 * that print progress differently. Returns null rather than guessing when
 * stdout doesn't match either shape, or when more than one distinct
 * candidate URL turns up.
 */
export function parseProductionUrl({ stdout = "", stderr = "" } = {}) {
  const stdoutLines = String(stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (stdoutLines.length === 1 && /^https:\/\/\S+$/.test(stdoutLines[0])) {
    return stdoutLines[0];
  }

  const combined = `${stdout || ""}\n${stderr || ""}`;
  const matches = [...combined.matchAll(/Production\s+(https?:\/\/\S+)/g)];
  const uniqueUrls = [...new Set(matches.map((m) => m[1]))];
  if (uniqueUrls.length === 1) {
    return uniqueUrls[0];
  }

  return null;
}

/**
 * Post-deploy verification, dependency-injected for testing. `exec` matches
 * child_process.spawnSync's signature: (command, args, options) => { status, stdout, stderr }.
 */
export async function verifyDeployment({ stdout, stderr, exec, fetchFn, log = () => {}, errorLog = () => {} }) {
  const productionUrl = parseProductionUrl({ stdout, stderr });
  if (!productionUrl) {
    errorLog(
      "Could not determine a single production deployment URL from Vercel CLI output " +
        "(expected either a bare URL on stdout, or exactly one \"Production ... https://...\" line); " +
        "skipping structured verification rather than guessing."
    );
    return { ok: false, stage: "verify", reason: "no-production-url", deployAttempted: true };
  }

  // `vercel inspect <url>` addresses one globally-unique deployment by URL and has
  // no documented --project flag of its own (checked via `vercel inspect --help`
  // before writing this) -- there's nothing to pin here beyond what the caller's
  // upstream env-authority check (verifyVeillinkEnvironmentAuthority) already
  // guarantees before any vercel command in this script runs.
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
    errorLog(
      `Post-deploy verification found problems:\n${problems.map((p) => `  - ${p}`).join("\n")}\n` +
        "The deploy command itself succeeded, but this could NOT be confirmed as a correct VeilLink " +
        "production release. Treat app.veildaemon.app's state as UNCONFIRMED, not as verified -- " +
        "investigate with `vercel inspect` before trusting it."
    );
    return { ok: false, stage: "verify", problems, deployment, liveOk, deployAttempted: true };
  }

  log("Post-deploy verification passed: project, production target, aliases, and live route all confirmed.");
  return { ok: true, stage: "verify", deployment, liveOk, deployAttempted: true };
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
  env = process.env,
  dryRun = false,
  log = console.log,
  errorLog = console.error,
} = {}) {
  const projectJson = readProjectJsonFn(cwd);
  const linkCheck = verifyVeillinkProjectLink(projectJson);
  if (!linkCheck.ok) {
    errorLog(`VeilLink deploy guard failed:\n${linkCheck.reason}`);
    return { ok: false, stage: "guard", reason: linkCheck.reason };
  }

  // A correct project.json is not sufficient on its own -- an inherited
  // VERCEL_PROJECT_ID/VERCEL_ORG_ID env var takes precedence over it in the
  // Vercel CLI's own documented resolution order. Check that separately.
  const envCheck = verifyVeillinkEnvironmentAuthority(env);
  if (!envCheck.ok) {
    errorLog(`VeilLink deploy guard failed:\n${envCheck.reason}`);
    return { ok: false, stage: "guard", reason: envCheck.reason };
  }
  log(`VeilLink Vercel link verified: ${EXPECTED_VEILLINK_PROJECT.projectName} (${EXPECTED_VEILLINK_PROJECT.projectId})`);

  const gitSha = gitShaFn(exec);
  // --project pins the actual target explicitly. It's the CLI's documented
  // highest-precedence project selector, so this holds even if some other
  // ambient signal we haven't thought of exists -- belt and suspenders on
  // top of the environment check above, not a replacement for it.
  const deployArgs = [
    "--prod",
    "--yes",
    "--project",
    EXPECTED_VEILLINK_PROJECT.projectId,
    "--meta",
    `gitSha=${gitSha}`,
  ];

  if (dryRun) {
    log(`[DRY RUN] Would run: vercel ${deployArgs.join(" ")} (cwd: ${cwd})`);
    return { ok: true, stage: "dry-run", args: deployArgs };
  }

  log(`Running: vercel ${deployArgs.join(" ")} (in ${cwd})`);
  const deployResult = exec("vercel", deployArgs, { cwd, encoding: "utf8" });
  if (deployResult.status !== 0) {
    errorLog(`VeilLink deploy failed (exit ${deployResult.status}).`);
    if (deployResult.stderr) errorLog(deployResult.stderr);
    return { ok: false, stage: "deploy", status: deployResult.status, deployAttempted: true };
  }
  if (deployResult.stdout) log(deployResult.stdout);

  return verifyDeployment({
    stdout: deployResult.stdout || "",
    stderr: deployResult.stderr || "",
    exec,
    fetchFn,
    log,
    errorLog,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const result = await runVeillinkDeploy({ dryRun });
  if (!result.ok) process.exit(1);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}
