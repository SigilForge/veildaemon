import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const event = process.argv[2] || "";
const inputText = await new Promise((resolve) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { value += chunk; });
  process.stdin.on("end", () => resolve(value));
});
let input = {};
try { input = JSON.parse(inputText || "{}"); } catch {}

const ledgerPath = ".codex/state/relay-incident.json";
const examplePath = ".codex/state/relay-incident.example.json";
const relayPrefixes = ["studio/relay/", "scripts/relay-local-bridge.mjs", "scripts/run-relay-acceptance.mjs", "api/character.js", "deploy/relay-vercel/", "tests/fixtures/relay/", "references/relay-architecture.md"];
const alwaysAllowed = [".codex/state/", ".codex/hooks/", ".codex/rules/", ".agents/skills/relay-reliability/"];

async function ledger() {
  if (!existsSync(ledgerPath)) return null;
  try { return JSON.parse(await readFile(ledgerPath, "utf8")); } catch { return { active: true, malformed: true }; }
}

function changedRelayFiles() {
  const changed = spawnSync("git", ["status", "--short", "--untracked-files=all"], { encoding: "utf8" }).stdout
    .split("\n").map((line) => line.slice(3).trim()).filter(Boolean);
  return changed.filter((file) => relayPrefixes.some((prefix) => file === prefix || file.startsWith(prefix)));
}

function emit(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }

if (event === "SessionStart") {
  const state = await ledger();
  const branch = spawnSync("git", ["branch", "--show-current"], { encoding: "utf8" }).stdout.trim() || "detached";
  const context = state?.active
    ? `Relay incident is active on branch ${branch}. Deployment target is knoxmortis-projects/veildaemon-relay -> relay.veildaemon.app. Re-read studio/relay/AGENTS.md. Current ledger: ${JSON.stringify(state)}`
    : `Current branch: ${branch}. Relay deployment target: knoxmortis-projects/veildaemon-relay -> relay.veildaemon.app. For Relay work, read studio/relay/AGENTS.md, invoke $relay-reliability, and copy ${examplePath} to ${ledgerPath} before editing.`;
  emit({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } });
} else if (event === "PreCompact") {
  const state = await ledger();
  if (state?.active) {
    const required = ["reproduction", "expected", "responsibleLayer", "hypothesis", "falsifier", "allowedPaths", "lastEvidence", "editTestCycles"];
    const missing = required.filter((key) => state[key] === undefined || state[key] === "");
    if (missing.length) emit({ continue: false, stopReason: `Relay ledger is incomplete before compaction: ${missing.join(", ")}` });
    else {
      await writeFile(".codex/state/relay-precompact.json", `${JSON.stringify({ timestamp: new Date().toISOString(), ledger: state }, null, 2)}\n`);
      emit({ hookSpecificOutput: { hookEventName: "PreCompact", additionalContext: `Relay ledger snapshot saved. Resume from this falsifiable hypothesis only: ${state.hypothesis}` } });
    }
  }
} else if (event === "PostCompact") {
  const state = await ledger();
  emit({ hookSpecificOutput: { hookEventName: "PostCompact", additionalContext: state?.active ? `Compaction ended. Re-read studio/relay/AGENTS.md and resume from this incident ledger, not memory: ${JSON.stringify(state)}` : "Compaction ended. Re-read the applicable AGENTS.md files before editing." } });
} else if (event === "Stop") {
  const changed = changedRelayFiles();
  if (changed.length) {
    const check = spawnSync(process.execPath, ["scripts/run-relay-acceptance.mjs", "--verify-artifact"], { encoding: "utf8", timeout: 30_000 });
    if (check.status !== 0 && !input.stop_hook_active) emit({ decision: "block", reason: `Relay-relevant files changed without a fresh passing acceptance artifact: ${changed.join(", ")}. Run npm run relay:acceptance before claiming completion.` });
    else if (check.status !== 0) console.error("Relay acceptance is still absent or stale. Do not claim fixed, working, live, shipped, or done.");
  }
} else if (event === "PreToolUse") {
  const state = await ledger();
  if (state?.active && /apply_patch/i.test(input.tool_name || input.toolName || "")) {
    const patch = String(input.tool_input?.patch || input.tool_input?.input || input.toolInput?.patch || "");
    const paths = [...patch.matchAll(/^\*{3} (?:Add|Update|Delete) File: (.+)$/gm)].map((match) => match[1].replace(/^\/home\/nox\/projects\/veildaemon\//, ""));
    const allowed = [...(Array.isArray(state.allowedPaths) ? state.allowedPaths : []), ...alwaysAllowed];
    const outside = paths.filter((path) => !allowed.some((prefix) => path === prefix || path.startsWith(prefix)));
    if (outside.length) emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `Relay incident scope excludes: ${outside.join(", ")}. Update the ledger with evidence before crossing layers.` } });
  }
}
