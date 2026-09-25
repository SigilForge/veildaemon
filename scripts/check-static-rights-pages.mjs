#!/usr/bin/env node
/**
 * rights:render:check — fail closed on Creator Rights renderer/page drift.
 *
 * Renders every Creator Rights record into a temporary directory
 * (render-static-rights-pages.mjs --out=<tmp>) and compares the result byte-for-byte
 * against the committed generated outputs in rights/<slug>/:
 *   index.html, license/index.html, record-qr.webp
 *
 * Fails (exit 1) on:
 *   - DIFFERS: a committed page/asset differs from what the renderer produces (hand edit or
 *     stale template/record);
 *   - MISSING: the renderer produces a file that is not committed;
 *   - ORPHAN:  a committed file under rights/<slug>/ that the renderer no longer produces;
 *   - the renderer failing, or the working tree under rights/ changing during the check.
 *
 * Never modifies the working tree. rights/index.html is a hand-written redirect stub, not a
 * generated output, and is out of scope.
 *
 * To fix a failure: change rights/*.json or the renderer, then run `npm run rights:render`.
 * Never hand-edit rights/<slug>/ pages.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rightsDir = path.join(root, "rights");
const renderer = path.join(root, "scripts", "render-static-rights-pages.mjs");

async function walk(dir, base = dir, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

/** Committed generated outputs: every file inside a rights/<slug>/ directory. */
async function committedGenerated() {
  const files = [];
  for (const entry of await fs.readdir(rightsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of await walk(path.join(rightsDir, entry.name))) files.push(`${entry.name}/${file}`);
  }
  return files.sort();
}

async function snapshot() {
  const hashes = new Map();
  for (const file of await walk(rightsDir)) {
    hashes.set(file, crypto.createHash("sha256").update(await fs.readFile(path.join(rightsDir, file))).digest("hex"));
  }
  return hashes;
}

const before = await snapshot();
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "rights-render-check-"));
const problems = [];
let generatedCount = 0;
try {
  const result = spawnSync(process.execPath, [renderer, `--out=${tmp}`], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    problems.push(`renderer failed (exit ${result.status}):\n${result.stderr || result.stdout}`);
  } else {
    const generated = (await walk(tmp)).sort();
    generatedCount = generated.length;
    const committed = new Set(await committedGenerated());
    for (const file of generated) {
      if (!committed.has(file)) {
        problems.push(`MISSING  rights/${file} (renderer produces it; not committed)`);
        continue;
      }
      committed.delete(file);
      const [a, b] = await Promise.all([fs.readFile(path.join(tmp, file)), fs.readFile(path.join(rightsDir, file))]);
      if (!a.equals(b)) problems.push(`DIFFERS  rights/${file}`);
    }
    for (const file of [...committed].sort()) problems.push(`ORPHAN   rights/${file} (committed; renderer no longer produces it)`);
  }
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

const after = await snapshot();
const touched = [...new Set([...before.keys(), ...after.keys()])].filter((f) => before.get(f) !== after.get(f));
if (touched.length) problems.push(`working tree changed under rights/ during the check: ${touched.join(", ")}`);

if (problems.length) {
  console.error(`Creator Rights render check FAILED (${problems.length} problem(s)); generated pages have drifted from the renderer:`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("Fix: change rights/*.json or scripts/render-static-rights-pages.mjs, then run `npm run rights:render`. Never hand-edit rights/<slug>/ pages.");
  process.exit(1);
}
console.log(`Creator Rights render check passed: ${generatedCount} generated file(s) match the committed outputs byte-for-byte.`);
