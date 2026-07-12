#!/usr/bin/env node
/**
 * Ensure raster images used for web display have WebP siblings.
 * Usage:
 *   node scripts/ensure-webp.mjs path/to/image.png [path/to/dir ...]
 *   node scripts/ensure-webp.mjs --check   # fail if HTML/CSS references .png/.jpg for display
 *
 * Rule: if it paints on the web, serve WebP. PNG/JPEG may remain as masters/downloads.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const inputs = args.filter((a) => a !== "--check");

async function convertFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) return null;
  const out = file.replace(/\.(png|jpg|jpeg)$/i, ".webp");
  await sharp(file)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(out);
  return out;
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(png|jpe?g)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

function checkDisplayRefs() {
  const bad = [];
  const roots = ["studio", "index.html", "styles.css", "operator", "handler", "debrief", "stream"];
  const files = [];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    if (fs.statSync(r).isDirectory()) {
      const stack = [r];
      while (stack.length) {
        const d = stack.pop();
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, ent.name);
          if (ent.isDirectory() && ent.name !== "node_modules") stack.push(p);
          else if (/\.(html|css)$/i.test(ent.name)) files.push(p);
        }
      }
    } else files.push(r);
  }
  const re = /(?:src|href)=["']([^"']+\.(?:png|jpe?g))["']|url\(\s*["']?([^"'\)\\s]+\.(?:png|jpe?g))["']?\s*\)/gi;
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    let m;
    while ((m = re.exec(text))) {
      const ref = m[1] || m[2];
      const start = Math.max(0, m.index - 120);
      const ctx = text.slice(start, m.index + (ref?.length || 0) + 40);
      // allow press/download masters and favicons
      if (/download/i.test(ctx) || /favicon/i.test(ref) || /rel=["'](?:apple-touch-)?icon["']/i.test(ctx) || /\.ico$/i.test(ref)) continue;
      if (/Press Kit|download originals|PNG for print/i.test(ctx)) continue;
      bad.push(`${f}: ${ref}`);
    }
  }
  return bad;
}

if (checkOnly) {
  const bad = checkDisplayRefs();
  if (bad.length) {
    console.error("Web display still references PNG/JPEG (convert to WebP):");
    for (const b of bad) console.error(" -", b);
    process.exit(1);
  }
  console.log("OK: no display PNG/JPEG refs found in scanned HTML/CSS (download links ignored).");
  process.exit(0);
}

if (!inputs.length) {
  console.error("Usage: node scripts/ensure-webp.mjs <files-or-dirs...> | --check");
  process.exit(2);
}

const files = [];
for (const input of inputs) {
  if (!fs.existsSync(input)) {
    console.error("missing", input);
    continue;
  }
  if (fs.statSync(input).isDirectory()) files.push(...walk(input));
  else files.push(input);
}

for (const f of files) {
  try {
    const out = await convertFile(f);
    if (out) console.log("wrote", out);
  } catch (e) {
    console.error("fail", f, e.message);
    process.exitCode = 1;
  }
}
