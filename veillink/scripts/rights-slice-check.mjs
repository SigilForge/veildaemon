import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repoRoot = resolve(root, "..");

function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, TMPDIR: "/tmp", TEMP: "/tmp", TMP: "/tmp" },
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function output(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${[command, ...args].join(" ")} failed:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function changedTextFiles() {
  const names = new Set([
    ...output("git", ["diff", "--name-only"]).split("\n"),
    ...output("git", ["diff", "--cached", "--name-only"]).split("\n"),
    ...output("git", ["ls-files", "--others", "--exclude-standard", "veillink"]).split("\n"),
  ].map((name) => name.trim()).filter(Boolean));
  return [...names].filter((name) => name.startsWith("veillink/") && /\.(css|html|js|jsx|json|md|mjs|ts|tsx|txt|yml|yaml)$/.test(name));
}

function scanTouchedFiles() {
  const offenders = [];
  for (const name of changedTextFiles()) {
    const path = resolve(repoRoot, name);
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^(<<<<<<<|=======|>>>>>>>)\b/.test(line)) offenders.push(`${name}:${index + 1}: conflict marker`);
      if (/[ \t]$/.test(line)) offenders.push(`${name}:${index + 1}: trailing whitespace`);
    });
  }
  if (offenders.length) {
    throw new Error(`Touched-file scan failed:\n${offenders.join("\n")}`);
  }
  console.log("\n==> touched-file scan");
  console.log(`OK (${changedTextFiles().map((name) => relative(repoRoot, resolve(repoRoot, name))).length} files)`);
}

try {
  run("npm", ["run", "test"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "lint"]);
  run("npm", ["run", "build"]);
  run("git", ["diff", "--check"], { cwd: repoRoot });
  run("git", ["diff", "--cached", "--check"], { cwd: repoRoot });
  scanTouchedFiles();
  console.log("\nCreator Rights slice check passed.");
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
