#!/usr/bin/env node

/**
 * Verify the vendored brand icon sets, routed by SURFACE IDENTITY:
 *
 *   SigilForge  -> /studio/**, /registry/, /rights/**, VeilLink (studio surfaces)
 *   VeilCorp    -> root / ARG / player-facing surfaces (Intake, Operator, Handler, stream, admin)
 *   Cradlepoint -> explicitly Cradlepoint product / universe surfaces only (/play/)
 *
 * The sets are byte copies of the canonical favicon sets in the Cradlepoint
 * repository (Marketing/SigilForge Art/Favicon/, Marketing/VeilCorp Art/
 * VeilCorp Avatar favicon/, Marketing/Cradlepoint Art/Brand/Web/). Nothing is
 * generated here: if a set is incomplete this fails closed. Never substitute
 * another brand's icons for a missing set.
 *
 * (This script previously derived the retired "Cradlepoint Studio" raster
 * identity; the studio is SigilForge Studios.)
 */

import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const SETS = {
  sigilforge: {
    dir: "studio/assets/brand",
    files: ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "favicon-48x48.png",
      "apple-touch-icon.png", "sigilforge-mark-192.png", "sigilforge-mark-512.png"],
  },
  "sigilforge-veillink": {
    dir: "veillink/public/brand",
    files: ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png"],
  },
  veilcorp: {
    dir: "assets/icons/veilcorp",
    files: ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png",
      "android-chrome-192x192.png", "android-chrome-512x512.png"],
  },
  "veilcorp-root-fallback": { dir: ".", files: ["favicon.ico"] },
  cradlepoint: {
    dir: "assets/icons/cradlepoint",
    files: ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "favicon-48x48.png", "apple-touch-icon.png"],
  },
};

const missing = [];
for (const [surface, { dir, files }] of Object.entries(SETS)) {
  for (const file of files) {
    try {
      const stat = await fs.stat(path.join(root, dir, file));
      if (!stat.isFile() || stat.size === 0) missing.push(`${surface}: ${dir}/${file}`);
    } catch {
      missing.push(`${surface}: ${dir}/${file}`);
    }
  }
}

if (missing.length) {
  console.error("Brand icon sets incomplete (fail closed; do not substitute another brand):");
  for (const item of missing) console.error(`  - ${item}`);
  process.exit(1);
}
// Served copies must stay byte-identical to their canonical set. Vercel hosts serve these files
// directly (VeilLink public/, the root API project's public/), so a stale copy silently shows an
// old brand there even when the canonical sets are right.
const MIRRORS = [
  ["veillink/public/brand/favicon.ico", "studio/assets/brand/favicon.ico"],
  ["veillink/public/brand/favicon-16x16.png", "studio/assets/brand/favicon-16x16.png"],
  ["veillink/public/brand/favicon-32x32.png", "studio/assets/brand/favicon-32x32.png"],
  ["veillink/public/brand/apple-touch-icon.png", "studio/assets/brand/apple-touch-icon.png"],
  ["veillink/public/favicon.ico", "studio/assets/brand/favicon.ico"], // app./go.veildaemon.app/favicon.ico
  ["veillink/public/icon-512.png", "studio/assets/brand/sigilforge-mark-512.png"],
  ["public/favicon.ico", "studio/assets/brand/favicon.ico"], // api.veildaemon.app/favicon.ico (Book One claim pages)
  ["favicon.ico", "assets/icons/veilcorp/favicon.ico"], // veildaemon.app root (VeilCorp)
];
const drifted = [];
for (const [copy, canonical] of MIRRORS) {
  const [a, b] = await Promise.all([fs.readFile(path.join(root, copy)).catch(() => null), fs.readFile(path.join(root, canonical))]);
  if (!a || !a.equals(b)) drifted.push(`${copy} != ${canonical}`);
}
if (drifted.length) {
  console.error("Served brand icons drifted from their canonical sets (fail closed):");
  for (const item of drifted) console.error(`  - ${item}`);
  process.exit(1);
}

console.log(`brand icon sets verified: ${Object.keys(SETS).join(", ")}; ${MIRRORS.length} served copies byte-identical`);
