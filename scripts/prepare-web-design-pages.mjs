#!/usr/bin/env node
// Isolate the paid Web Design brochure from the free GitHub Pages game site.
// Cloudflare Pages project root: deploy/web-design-pages; build command:
// node ../../scripts/prepare-web-design-pages.mjs; output: public
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "deploy/web-design-pages/public");
// Source lives outside .html paths: GitHub Pages (.nojekyll) publishes every
// repo file, and a sales page there is what this split removes.
const original = readFileSync(resolve(root, "deploy/web-design-pages/brochure.src"), "utf8");
const css = readFileSync(resolve(root, "studio/studio.css"), "utf8");

function assetPaths(content, baseUrl) {
  const links = [
    ...[...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...content.matchAll(/url\(\s*['"]?([^)'"]+)/g)].map((m) => m[1]),
  ];
  return links
    .filter((url) => !url.startsWith("#") && !/^(?:https?:|data:|mailto:|sms:)/i.test(url))
    .map((url) => new URL(url, baseUrl).pathname)
    .filter((path) => path.startsWith("/studio/assets/") || path.startsWith("/assets/") || path === "/studio/studio.css");
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const assetSet = new Set([
  ...assetPaths(original, "https://design.veildaemon.app/"),
  ...assetPaths(css, "https://design.veildaemon.app/studio/studio.css"),
]);
assetSet.add("/studio/studio.css");

for (const pathname of assetSet) {
  const rel = pathname.slice(1);
  const source = resolve(root, rel);
  if (!existsSync(source)) throw new Error(`Missing Web Design asset: ${rel}`);
  const target = resolve(out, rel);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

let html = original
  // Keep unrelated site navigation on the original public game/wiki site.
  .replaceAll('href="/studio/web-design/"', 'href="./"')
  .replaceAll('href="/"', 'href="https://veildaemon.app/"')
  .replace(/href="\/(studio\/|operator\/|handler\/|$)/g, 'href="https://veildaemon.app/$1')
  .replaceAll('https://veildaemon.app/studio/web-design/', 'https://design.veildaemon.app/')
  .replaceAll('<meta property="og:url" content="https://veildaemon.app/studio/web-design/" />', '<meta property="og:url" content="https://design.veildaemon.app/" />');

writeFileSync(resolve(out, "index.html"), html);
writeFileSync(resolve(out, "robots.txt"), "User-agent: *\nAllow: /\n");
console.log(`Prepared Web Design commercial brochure with ${assetSet.size} assets.`);
