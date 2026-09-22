/**
 * Shared VeilLink Vercel deployment-target contract.
 *
 * VeilLink (app.veildaemon.app / go.veildaemon.app) deploys as its OWN Vercel
 * project, separate from the repo-root `veildaemon` Vercel project that
 * serves api.veildaemon.app. A green "Vercel" check on a GitHub PR/commit for
 * this repo belongs to whichever project GitHub's integration happens to be
 * wired to (historically the root `veildaemon` project) -- it is NOT evidence
 * that VeilLink itself has been deployed. See README_DEPLOY.md and
 * AGENTS.md "Deploy Surfaces" for the full explanation, and
 * scripts/deploy-veillink.mjs for the guarded deploy path that enforces this.
 */

export const EXPECTED_VEILLINK_PROJECT = {
  projectId: "prj_yIporTovuVLyKTbvfPtxGi6uwuiQ",
  projectName: "veillink",
  orgId: "team_9qQRYFciKKzHNl7aUMqR9r03",
};

export const VEILLINK_PRODUCTION_ALIASES = ["app.veildaemon.app", "go.veildaemon.app"];

// The repo-root Vercel project (api.veildaemon.app). Deploying VeilLink
// source into this project, or mistaking its green CI check for a VeilLink
// deploy, is exactly the incident this guard exists to prevent -- named here
// only so the error message can call it out by name when it's the culprit.
const KNOWN_ROOT_API_PROJECT_ID = "prj_7bgZ4yTaZOd5QsR6WOpXElo2pbpv";

/**
 * Pure check: does a parsed `.vercel/project.json` match the expected
 * VeilLink project? Takes the already-parsed object (or null/undefined if
 * the file is missing/unreadable) so it is trivially unit-testable without
 * touching the filesystem.
 *
 * Never attempts to fix a mismatch -- callers must fail closed and let a
 * human re-link by hand.
 */
export function verifyVeillinkProjectLink(projectJson, expected = EXPECTED_VEILLINK_PROJECT) {
  if (!projectJson || typeof projectJson !== "object") {
    return {
      ok: false,
      reason:
        "veillink/.vercel/project.json is missing or unreadable. Run `cd veillink && vercel link` " +
        `and confirm it links to project "${expected.projectName}" (${expected.projectId}) ` +
        `in scope/team "${expected.orgId}". Do not let automation relink for you -- verify by hand.`,
    };
  }

  const { projectId, projectName, orgId } = projectJson;
  const mismatches = [];
  if (projectId !== expected.projectId) {
    mismatches.push(`projectId: expected "${expected.projectId}", got "${projectId}"`);
  }
  if (projectName !== expected.projectName) {
    mismatches.push(`projectName: expected "${expected.projectName}", got "${projectName}"`);
  }
  if (expected.orgId) {
    if (orgId === undefined || orgId === null || orgId === "") {
      // Fail closed: an omitted orgId is not "no opinion", it's missing
      // evidence of which team/scope this project link actually belongs to.
      mismatches.push(`orgId (team/scope): expected "${expected.orgId}", got none (missing from project.json)`);
    } else if (orgId !== expected.orgId) {
      mismatches.push(`orgId (team/scope): expected "${expected.orgId}", got "${orgId}"`);
    }
  }

  if (mismatches.length === 0) {
    return { ok: true };
  }

  const hint =
    projectId === KNOWN_ROOT_API_PROJECT_ID
      ? ` This is the repo-root "veildaemon" API project (serves api.veildaemon.app), not VeilLink.`
      : "";

  return {
    ok: false,
    reason:
      `veillink/.vercel/project.json does not point at the expected VeilLink Vercel project.${hint}\n` +
      mismatches.map((m) => `  - ${m}`).join("\n") +
      `\nRefusing to deploy. Do not relink automatically -- fix the link by hand ` +
      `(\`cd veillink && vercel link\`) and re-run.`,
  };
}

/**
 * Pure check: does the process environment conflict with the expected
 * VeilLink project? A correct `.vercel/project.json` is NOT sufficient on
 * its own -- Vercel CLI's documented project-selection precedence is
 * `--project` flag > `VERCEL_PROJECT_ID`/`VERCEL_ORG_ID` env vars >
 * `.vercel/project.json`, so an inherited env var can silently redirect a
 * deploy even when the link file is correct. Takes the environment object
 * explicitly (defaults to none) so it never reaches into `process.env`
 * itself -- callers inject `process.env` (or a test fixture).
 *
 * Absent env vars are fine (nothing to conflict with); only a *present and
 * different* value fails closed. Never attempts to unset or correct the
 * environment -- callers must fail closed and let a human fix it.
 */
export function verifyVeillinkEnvironmentAuthority(env = {}, expected = EXPECTED_VEILLINK_PROJECT) {
  const envProjectId = env.VERCEL_PROJECT_ID;
  const envOrgId = env.VERCEL_ORG_ID;
  const mismatches = [];

  if (envProjectId && envProjectId !== expected.projectId) {
    mismatches.push(
      `VERCEL_PROJECT_ID env var is set to "${envProjectId}", not the expected VeilLink project "${expected.projectId}"`
    );
  }
  if (envOrgId && expected.orgId && envOrgId !== expected.orgId) {
    mismatches.push(
      `VERCEL_ORG_ID env var is set to "${envOrgId}", not the expected VeilLink org/team "${expected.orgId}"`
    );
  }

  if (mismatches.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      `The environment overrides Vercel's project selection away from VeilLink. Vercel CLI's documented ` +
      `precedence is --project > VERCEL_PROJECT_ID/VERCEL_ORG_ID > .vercel/project.json, so a correct ` +
      `project.json is not enough on its own when one of these is set.\n` +
      mismatches.map((m) => `  - ${m}`).join("\n") +
      `\nRefusing to deploy. Unset the conflicting environment variable(s) yourself and re-run -- ` +
      `this will not unset or override them for you.`,
  };
}
