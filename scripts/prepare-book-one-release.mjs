#!/usr/bin/env node
/**
 * Book One release preparation: turn a Cradlepoint Book One build into site release data.
 *
 * The parent repository builds the book (tools/build_book_one_release.py) and records it in
 * Fiction/Book 1 - Complete Editing/BOOK_ONE_RELEASE.json plus <stem>.sha256. This script reads
 * that record and those artifacts and updates every site surface that names the current edition,
 * so a release never needs hand edits here:
 *
 *   studio/shelf/book-one/manifest.json      version, object paths, filenames, sources, SHA-256,
 *                                            superseded paths moved to retired_paths
 *   rights/the-anchor-and-the-glitch.json    new versionHistory entry + current edition/fingerprint
 *                                            (earlier versions are never touched)
 *   veillink/lib/rights/records.ts           example record edition lines
 *   scripts/backfill-creator-rights-hashes.mjs   current Book One artifact path
 *   then scripts/sync-book-one-shelf.mjs (claim defaults, shelf page, VeilLink page, README,
 *   .env.example) and the Creator Rights render / index / static projection scripts.
 *
 * Idempotent. --check makes no changes and exits 1 if the site is not in step with the build.
 *
 *   node scripts/prepare-book-one-release.mjs [--book-dir <dir>] [--check]
 *
 * After this: commit, then scripts/publish-book-one-release.mjs stage / verify-claim / switch
 * (the parent repo's tools/publish_book_one.sh runs the whole line in order).
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const bookDirFlag = args.indexOf("--book-dir");
const bookDir = bookDirFlag >= 0 ? path.resolve(args[bookDirFlag + 1])
  : path.resolve(root, "..", "Fiction", "Book 1 - Complete Editing");

const fail = (msg) => { console.error(`\x1b[31m✗ ${msg}\x1b[0m`); process.exit(1); };
const ok = (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const recordPath = path.join(bookDir, "BOOK_ONE_RELEASE.json");
if (!existsSync(recordPath)) fail(`no release record at ${recordPath}`);
const rel = readJson(recordPath);
for (const key of ["version", "stem", "released", "edition_label", "rights_summary"]) {
  if (!rel[key]) fail(`release record is missing "${key}"`);
}
const sumsPath = path.join(bookDir, `${rel.stem}.sha256`);
if (!existsSync(sumsPath)) fail(`no ${rel.stem}.sha256; build the book first`);
const sums = Object.fromEntries(readFileSync(sumsPath, "utf8").trim().split("\n").map((l) => l.split(/  /).reverse()));
const artifact = (ext) => {
  const name = `${rel.stem}.${ext}`;
  const file = path.join(bookDir, name);
  if (!existsSync(file)) fail(`missing artifact ${name}`);
  const digest = sha256(file);
  if (sums[name] !== digest) fail(`${name} does not match ${rel.stem}.sha256 (rebuild, do not hand-edit artifacts)`);
  return { name, digest, size: readFileSync(file).length };
};
const files = { pdf: artifact("pdf"), epub: artifact("epub"), mobi: artifact("mobi") };

const slug = rel.version.replace(/\./g, "-"); // v48.1 -> v48-1, v49 -> v49
const changes = [];
function put(rel_path, next) {
  const file = path.join(root, rel_path);
  const prev = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (prev === next) return;
  changes.push(rel_path);
  if (!check) writeFileSync(file, next, "utf8");
}
function replaceOnce(text, pattern, replacement, where) {
  const hits = text.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"));
  if (!hits || hits.length !== 1) fail(`${where}: expected one match for ${pattern}, found ${hits ? hits.length : 0}`);
  return text.replace(pattern, replacement);
}

// 1. Shelf manifest.
const manifestRel = "studio/shelf/book-one/manifest.json";
const m = readJson(path.join(root, manifestRel));
const next = { ...m, version: rel.version };
const names = {
  pdf: `cradlepoint-veilsight-${slug}-print-edition.pdf`,
  epub: `cradlepoint-veilsight-${slug}.epub`,
  mobi: `cradlepoint-veilsight-${slug}.mobi`,
};
const retired = [...(m.retired_paths || [])];
for (const kind of ["pdf", "epub", "mobi"]) {
  const objectPath = `book-one/${names[kind]}`;
  if (m[`${kind}_path`] && m[`${kind}_path`] !== objectPath && !retired.includes(m[`${kind}_path`])) {
    retired.push(m[`${kind}_path`]);
  }
  next[`${kind}_path`] = objectPath;
  next[`${kind}_filename`] = names[kind];
  next[`${kind}_source`] = files[kind].name;
  next[`${kind}_sha256`] = files[kind].digest;
}
next.retired_paths = retired;
next.retired_paths_note = "Superseded objects stay in the bucket through the grace period; do not delete until it ends. (The v47-2c paths were never staged.)";
put(manifestRel, `${JSON.stringify(next, null, 2)}\n`);

// 2. Creator Rights record: append a version only when the EPUB fingerprint changed.
const rightsRel = "rights/the-anchor-and-the-glitch.json";
const rights = readJson(path.join(root, rightsRel));
const history = rights.versionHistory || [];
const latest = [...history].sort((a, b) => b.version - a.version)[0];
const fingerprint = {
  algorithm: "SHA-256",
  value: files.epub.digest,
  filename: files.epub.name,
  fileSize: files.epub.size,
  mimeType: "application/epub+zip",
};
if (!latest || latest.fileFingerprint?.value !== files.epub.digest) {
  history.push({
    version: (latest?.version || 0) + 1,
    recordedAt: rel.released.slice(0, 10),
    title: next.title,
    workVersion: rel.edition_label,
    summary: rel.rights_summary,
    fileFingerprint: fingerprint,
  });
}
rights.versionHistory = history;
rights.workVersion = rel.edition_label;
rights.fileFingerprint = { ...fingerprint, createdAt: rel.released.replace("Z", ".000Z") };
put(rightsRel, `${JSON.stringify(rights, null, 2)}\n`);

// 3. VeilLink example record.
const recordsRel = "veillink/lib/rights/records.ts";
let records = readFileSync(path.join(root, recordsRel), "utf8");
records = replaceOnce(records, /edition: "Book One, [^"]*",/, `edition: "${rel.edition_label}",`, recordsRel);
records = replaceOnce(records, /external_identifier: "SigilForge internal edition [^"]*",/,
  `external_identifier: "SigilForge internal edition ${rel.version} (previously v47.2C, The Anchor and the Glitch)",`, recordsRel);
put(recordsRel, records);

// 4. Hash backfill source path.
const backfillRel = "scripts/backfill-creator-rights-hashes.mjs";
let backfill = readFileSync(path.join(root, backfillRel), "utf8");
backfill = replaceOnce(backfill, /"the-anchor-and-the-glitch": "Fiction\/Book 1 - Complete Editing\/[^"]+",/,
  `"the-anchor-and-the-glitch": "Fiction/Book 1 - Complete Editing/${files.epub.name}",`, backfillRel);
put(backfillRel, backfill);

if (check) {
  if (changes.length) fail(`site is behind the Book One build (${rel.version}): ${changes.join(", ")}`);
  ok(`site data matches Book One ${rel.version}`);
  process.exit(0);
}
for (const c of changes) ok(`updated ${c}`);

// 5. Derived surfaces.
const run = (cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) fail(`${cmd} ${cmdArgs.join(" ")} failed`);
};
run("node", ["scripts/sync-book-one-shelf.mjs"]);
run("node", ["scripts/render-static-rights-pages.mjs"]);
run("node", ["scripts/build-creator-rights-registry-index.mjs"]);
run("node", ["scripts/export-creator-rights-verification-projection.mjs", "--source=static"]);
ok(`site release data prepared for Book One ${rel.version}`);
