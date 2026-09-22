/**
 * Unit tests for the VeilLink deployment-target guard and guarded deploy path.
 * Run: node --test tests/unit/test_veillink_deploy_guard.mjs
 *
 * No live Vercel CLI, no network access, and no real deploy is exercised
 * anywhere in this file -- `exec`/`fetch` are always injected fakes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  EXPECTED_VEILLINK_PROJECT,
  VEILLINK_PRODUCTION_ALIASES,
  verifyVeillinkProjectLink,
} from "../../scripts/lib/veillinkDeployTarget.mjs";
import {
  readProjectJson,
  parseProductionUrl,
  runVeillinkDeploy,
  verifyDeployment,
} from "../../scripts/deploy-veillink.mjs";

function fakeExec(script) {
  const calls = [];
  const exec = (command, args, options) => {
    calls.push({ command, args, options });
    return script(command, args, options) || { status: 0, stdout: "", stderr: "" };
  };
  return { exec, calls };
}

describe("verifyVeillinkProjectLink", () => {
  it("accepts a project.json that exactly matches the expected VeilLink project", () => {
    const result = verifyVeillinkProjectLink({ ...EXPECTED_VEILLINK_PROJECT });
    assert.equal(result.ok, true);
  });

  it("fails closed when project.json is missing (null)", () => {
    const result = verifyVeillinkProjectLink(null);
    assert.equal(result.ok, false);
    assert.match(result.reason, /missing or unreadable/);
  });

  it("fails closed on a project id mismatch and names the known root API project", () => {
    const result = verifyVeillinkProjectLink({
      projectId: "prj_7bgZ4yTaZOd5QsR6WOpXElo2pbpv",
      projectName: "veildaemon",
      orgId: "team_9qQRYFciKKzHNl7aUMqR9r03",
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /repo-root "veildaemon" API project/);
    assert.match(result.reason, /projectId: expected/);
  });

  it("fails closed on a project name mismatch even if the id happens to match", () => {
    const result = verifyVeillinkProjectLink({
      projectId: EXPECTED_VEILLINK_PROJECT.projectId,
      projectName: "some-other-project",
      orgId: EXPECTED_VEILLINK_PROJECT.orgId,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /projectName: expected/);
  });

  it("fails closed on an org/team (scope) mismatch", () => {
    const result = verifyVeillinkProjectLink({
      projectId: EXPECTED_VEILLINK_PROJECT.projectId,
      projectName: EXPECTED_VEILLINK_PROJECT.projectName,
      orgId: "team_someoneElsesScope",
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /orgId \(team\/scope\)/);
  });

  it("never suggests or performs relinking", () => {
    const result = verifyVeillinkProjectLink(null);
    assert.doesNotMatch(result.reason, /automatically relink|will relink|relinking for you/i);
  });
});

describe("readProjectJson", () => {
  it("returns null when the file does not exist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veillink-guard-"));
    assert.equal(readProjectJson(dir), null);
  });

  it("parses a real project.json fixture from disk", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veillink-guard-"));
    fs.mkdirSync(path.join(dir, ".vercel"));
    fs.writeFileSync(path.join(dir, ".vercel", "project.json"), JSON.stringify(EXPECTED_VEILLINK_PROJECT));
    assert.deepEqual(readProjectJson(dir), EXPECTED_VEILLINK_PROJECT);
  });

  it("returns null for unparseable JSON instead of throwing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veillink-guard-"));
    fs.mkdirSync(path.join(dir, ".vercel"));
    fs.writeFileSync(path.join(dir, ".vercel", "project.json"), "{ not valid json");
    assert.equal(readProjectJson(dir), null);
  });
});

describe("parseProductionUrl", () => {
  it("extracts the Production URL line from Vercel CLI output", () => {
    const stdout = "Uploading...\n  Production      https://veillink-abc123-knoxmortis-projects.vercel.app\nBuilding…\n";
    assert.equal(parseProductionUrl(stdout), "https://veillink-abc123-knoxmortis-projects.vercel.app");
  });

  it("returns null when no Production line is present", () => {
    assert.equal(parseProductionUrl("some unrelated output"), null);
  });
});

describe("runVeillinkDeploy (fail-closed, no live calls)", () => {
  it("aborts before calling exec when the project link is wrong, and does not deploy", async () => {
    const { exec, calls } = fakeExec(() => ({ status: 0, stdout: "", stderr: "" }));
    const result = await runVeillinkDeploy({
      exec,
      readProjectJsonFn: () => ({ projectId: "prj_wrong", projectName: "wrong", orgId: "team_wrong" }),
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, "guard");
    assert.equal(calls.length, 0, "exec must never be called when the project link is wrong");
  });

  it("aborts before calling exec when project.json is missing entirely", async () => {
    const { exec, calls } = fakeExec();
    const result = await runVeillinkDeploy({
      exec,
      readProjectJsonFn: () => null,
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, "guard");
    assert.equal(calls.length, 0);
  });

  it("in --dry-run mode, verifies the link but never invokes the vercel CLI", async () => {
    const { exec, calls } = fakeExec();
    const result = await runVeillinkDeploy({
      exec,
      readProjectJsonFn: () => ({ ...EXPECTED_VEILLINK_PROJECT }),
      gitShaFn: () => "deadbeefcafefeed",
      dryRun: true,
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, true);
    assert.equal(result.stage, "dry-run");
    assert.equal(calls.length, 0, "dry-run must not invoke exec at all");
    assert.ok(result.args.includes("--prod"));
    assert.ok(result.args.includes("gitSha=deadbeefcafefeed"));
  });

  it("tags the deployment with the current git sha via --meta", async () => {
    const { exec, calls } = fakeExec((command, args) => {
      if (command === "vercel" && args[0] === "--prod") {
        return { status: 0, stdout: "Production      https://veillink-x-knoxmortis-projects.vercel.app\n", stderr: "" };
      }
      if (command === "vercel" && args[0] === "inspect") {
        return {
          status: 0,
          stdout: JSON.stringify({
            name: EXPECTED_VEILLINK_PROJECT.projectName,
            target: "production",
            alias: VEILLINK_PRODUCTION_ALIASES,
          }),
          stderr: "",
        };
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    const fetchFn = async () => ({ ok: true, status: 200 });
    const result = await runVeillinkDeploy({
      exec,
      fetchFn,
      readProjectJsonFn: () => ({ ...EXPECTED_VEILLINK_PROJECT }),
      gitShaFn: () => "cafed00d",
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, true);
    const deployCall = calls.find((c) => c.command === "vercel" && c.args[0] === "--prod");
    assert.ok(deployCall, "expected a vercel --prod call");
    assert.ok(deployCall.args.includes("--meta"));
    assert.ok(deployCall.args.includes("gitSha=cafed00d"));
  });

  it("fails when the real deploy command exits non-zero, without attempting verification", async () => {
    const { exec, calls } = fakeExec((command, args) => {
      if (command === "vercel" && args[0] === "--prod") {
        return { status: 1, stdout: "", stderr: "boom" };
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    const result = await runVeillinkDeploy({
      exec,
      readProjectJsonFn: () => ({ ...EXPECTED_VEILLINK_PROJECT }),
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, "deploy");
    assert.equal(calls.filter((c) => c.command === "vercel" && c.args[0] === "inspect").length, 0);
  });
});

describe("verifyDeployment", () => {
  it("passes when project, target, aliases, and live route all match", async () => {
    const { exec } = fakeExec((command, args) => {
      if (command === "vercel" && args[0] === "inspect") {
        return {
          status: 0,
          stdout: JSON.stringify({
            name: EXPECTED_VEILLINK_PROJECT.projectName,
            target: "production",
            alias: VEILLINK_PRODUCTION_ALIASES,
          }),
        };
      }
      return { status: 0, stdout: "" };
    });
    const fetchFn = async () => ({ ok: true, status: 200 });
    const result = await verifyDeployment({
      stdout: "Production      https://veillink-x-knoxmortis-projects.vercel.app\n",
      exec,
      fetchFn,
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, true);
  });

  it("fails when the deployed project name does not match VeilLink", async () => {
    const { exec } = fakeExec((command, args) => {
      if (command === "vercel" && args[0] === "inspect") {
        return { status: 0, stdout: JSON.stringify({ name: "veildaemon", target: "production", alias: VEILLINK_PRODUCTION_ALIASES }) };
      }
      return { status: 0, stdout: "" };
    });
    const fetchFn = async () => ({ ok: true, status: 200 });
    const result = await verifyDeployment({
      stdout: "Production      https://veillink-x-knoxmortis-projects.vercel.app\n",
      exec,
      fetchFn,
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes("project name")));
  });

  it("fails when an expected alias is missing", async () => {
    const { exec } = fakeExec((command, args) => {
      if (command === "vercel" && args[0] === "inspect") {
        return { status: 0, stdout: JSON.stringify({ name: EXPECTED_VEILLINK_PROJECT.projectName, target: "production", alias: ["go.veildaemon.app"] }) };
      }
      return { status: 0, stdout: "" };
    });
    const fetchFn = async () => ({ ok: true, status: 200 });
    const result = await verifyDeployment({
      stdout: "Production      https://veillink-x-knoxmortis-projects.vercel.app\n",
      exec,
      fetchFn,
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes("app.veildaemon.app")));
  });

  it("fails when the live route check does not respond ok", async () => {
    const { exec } = fakeExec((command, args) => {
      if (command === "vercel" && args[0] === "inspect") {
        return { status: 0, stdout: JSON.stringify({ name: EXPECTED_VEILLINK_PROJECT.projectName, target: "production", alias: VEILLINK_PRODUCTION_ALIASES }) };
      }
      return { status: 0, stdout: "" };
    });
    const fetchFn = async () => ({ ok: false, status: 500 });
    const result = await verifyDeployment({
      stdout: "Production      https://veillink-x-knoxmortis-projects.vercel.app\n",
      exec,
      fetchFn,
      log: () => {},
      errorLog: () => {},
    });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes("live route")));
  });
});

describe("unified-push.mjs uses the guarded VeilLink deploy path", () => {
  const unifiedPushSource = fs.readFileSync(new URL("../../scripts/unified-push.mjs", import.meta.url), "utf8");

  it("invokes scripts/deploy-veillink.mjs for the VeilLink deploy step", () => {
    assert.match(unifiedPushSource, /deploy-veillink\.mjs/);
  });

  it("no longer runs a raw `vercel --prod --yes` for the VeilLink directory", () => {
    // The Relay and Root API steps still legitimately call `vercel ... --prod --yes` directly
    // (they are out of scope for this guard); only the VeilLink step must be routed through
    // the guarded script, so we check the specific old call shape is gone, not the phrase
    // "--prod", "--yes" entirely.
    assert.doesNotMatch(unifiedPushSource, /run\("vercel",\s*\["--prod",\s*"--yes"\],\s*\{\s*cwd:\s*veillinkDir/);
  });
});

describe("docs/config do not misidentify the root veildaemon Vercel project as VeilLink", () => {
  it("the expected VeilLink project id differs from the known root API project id", () => {
    assert.notEqual(EXPECTED_VEILLINK_PROJECT.projectId, "prj_7bgZ4yTaZOd5QsR6WOpXElo2pbpv");
  });

  it("CLAUDE.md and AGENTS.md do not attach the VeilLink production aliases to the root veildaemon project", () => {
    const claudeMd = fs.readFileSync(new URL("../../CLAUDE.md", import.meta.url), "utf8");
    const agentsMd = fs.readFileSync(new URL("../../AGENTS.md", import.meta.url), "utf8");
    for (const doc of [claudeMd, agentsMd]) {
      // Every line that mentions app.veildaemon.app or go.veildaemon.app must not also
      // describe the root `veildaemon` API project (api.veildaemon.app) on that same line.
      for (const line of doc.split("\n")) {
        const mentionsVeillinkAlias = /app\.veildaemon\.app|go\.veildaemon\.app/.test(line);
        const mentionsRootApiProject = /veildaemon.{0,40}api\.veildaemon\.app|api\.veildaemon\.app.{0,40}veildaemon.{0,20}project/i.test(line);
        assert.ok(
          !(mentionsVeillinkAlias && mentionsRootApiProject),
          `Line conflates VeilLink aliases with the root API project: ${line}`
        );
      }
    }
  });
});
