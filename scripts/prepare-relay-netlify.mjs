#!/usr/bin/env node
// Build the isolated, static RelayDaemon site for Netlify without publishing
// internal repo files or relying on the generated Vercel deployment snapshot.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "deploy/relay-netlify/public");
const source = (path) => resolve(root, path);
const target = (path) => resolve(out, path);

function copy(from, to = from) {
  mkdirSync(dirname(target(to)), { recursive: true });
  cpSync(source(from), target(to), { recursive: true });
}

// The persona browser files are generated from canonical YAML sources.
const sync = spawnSync(process.execPath, [source("scripts/sync-relay-personas.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (sync.status !== 0) throw new Error("Relay persona synchronization failed.");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const html = readFileSync(source("studio/relay/index.html"), "utf8")
  .replaceAll('<script defer src="/_vercel/insights/script.js"></script>', "")
  .replaceAll('<script defer src="/_vercel/speed-insights/script.js"></script>', "");
writeFileSync(target("index.html"), html);
mkdirSync(target("studio/relay"), { recursive: true });
writeFileSync(target("studio/relay/index.html"), html);

for (const file of ["relay.js", "relay.css"]) {
  copy(`studio/relay/${file}`);
}
copy("studio/relay/vendor");
copy("studio/relay/personas");
copy("studio/studio.css");
copy("assets/background.webp");
for (const file of ["favicon.ico", "sigilforge-emblem-256.webp", "cradlepoint-studio-emblem-256.webp"]) {
  copy(`studio/assets/brand/${file}`);
}
writeFileSync(target("_redirects"), "/studio/relay /studio/relay/index.html 200\n/studio/relay/ /studio/relay/index.html 200\n");
console.log("Prepared Netlify RelayDaemon static assets:", out);
