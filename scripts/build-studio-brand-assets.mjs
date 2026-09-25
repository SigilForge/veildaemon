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
console.log(`brand icon sets verified: ${Object.keys(SETS).join(", ")}`);
