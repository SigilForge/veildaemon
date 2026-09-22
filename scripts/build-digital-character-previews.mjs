import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Run from the repo root; optionally pass the canonical Marketing/Characters folder.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(process.argv[2] || path.join(root, "../cradlepoint-ttrpg/Marketing/Characters"));
const outputRoot = path.join(root, "studio/assets/shelf/digital");
const sources = [
  ["alex-shade-dossier", "Alex Shade/Shade Dossier1.png"],
  ["agnes-dossier", "Agnes/Dossier1.png"],
  ["cathy-ortho", "Cathy/Ortho Final Final v3 for the memes.png"],
  ["diana-ortho", "Diana/Diana Ortho - Library Export.png"],
  ["father-samiel-dossier", "Father Samiel/Dossier.png"],
  ["kaelyn-ortho", "Kaelyn/Character Ortho.jpg"],
  ["kira-ortho", "Kira/Ortho1.png"],
  ["maslow-dossier", "Maslow/Dossier.png"],
  ["mira-ortho", "Mira/Mira Ortho1.png"],
  ["wednesday-ortho", "Wednesday/Wednesday Dossier - Library Export.png"],
  ["vesper-rook-ortho", "Vesper Rook/Vesper Rook Tattoo Reference - Library Export.png"],
];

// Prepare every preview before writing so a missing source fails before any export.
const previews = await Promise.all(sources.map(async ([name, source]) => {
  const input = await readFile(path.join(sourceRoot, source));
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { name, data, info };
}));

for (const { name, data, info } of previews) {
  await writeFile(path.join(outputRoot, `${name}.webp`), data);
  console.log(`${name}.webp: ${info.width}x${info.height}, ${data.length} bytes`);
}
