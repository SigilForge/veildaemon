import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brbRoot = path.join(repoRoot, "stream", "brb");
const masterPath = path.join(brbRoot, "assets", "brb-screen.webp");
const webmPath = path.join(brbRoot, "assets", "brb-screen.webm");
const cssPath = path.join(brbRoot, "overlay.css");

function fail(message) {
  console.error(`BRB overlay check failed: ${message}`);
  process.exit(1);
}

function readPosition(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`))?.[1];
  if (!block) fail(`missing CSS block ${selector}`);

  const left = Number.parseFloat(block.match(/left:\s*calc\(([\d.]+)%\s*-\s*6px\)/)?.[1]);
  const top = Number.parseFloat(block.match(/top:\s*calc\(([\d.]+)%\s*-\s*6px\)/)?.[1]);
  if (!Number.isFinite(left) || !Number.isFinite(top)) fail(`invalid center coordinates in ${selector}`);
  return { left, top };
}

function coloredCentroid(data, width, region) {
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  let matches = 0;
  const threshold = 420;

  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1) {
      const offset = (y * width + x) * 3;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const total = red + green + blue;
      const colorMatch = region.color === "cyan"
        ? green > red * 1.15 && blue > red * 1.1
        : red > green * 1.12 && blue > green * 1.08;

      if (total < threshold || !colorMatch) continue;
      const weight = total - threshold + 1;
      weightedX += x * weight;
      weightedY += y * weight;
      totalWeight += weight;
      matches += 1;
    }
  }

  if (matches < 12 || totalWeight === 0) fail(`could not locate ${region.name} painted dot`);
  return { x: weightedX / totalWeight, y: weightedY / totalWeight };
}

const metadata = await sharp(masterPath).metadata();
if (metadata.width !== 1938 || metadata.height !== 811) {
  fail(`WebP master is ${metadata.width}x${metadata.height}; expected 1938x811`);
}

const probe = spawnSync("ffprobe", [
  "-v", "error",
  "-select_streams", "v:0",
  "-show_entries", "stream=codec_name,width,height,pix_fmt,avg_frame_rate:format=duration",
  "-of", "json",
  webmPath,
], { encoding: "utf8" });

if (probe.error?.code === "ENOENT") fail("ffprobe is not installed or not on PATH");
if (probe.status !== 0) fail(`ffprobe exited ${probe.status}: ${probe.stderr.trim()}`);

const probed = JSON.parse(probe.stdout);
const stream = probed.streams?.[0];
if (stream?.codec_name !== "vp9") fail(`background codec is ${stream?.codec_name}; expected vp9`);
if (stream?.width !== 1938 || stream?.height !== 811) fail(`WebM is ${stream?.width}x${stream?.height}; expected 1938x811`);
if (stream?.pix_fmt !== "yuv420p") fail(`WebM pixel format is ${stream?.pix_fmt}; expected yuv420p`);
if (stream?.avg_frame_rate !== "1/1") fail(`WebM rate is ${stream?.avg_frame_rate}; expected 1/1`);
if (Number.parseFloat(probed.format?.duration) !== 10) fail(`WebM duration is ${probed.format?.duration}; expected 10 seconds`);

const [indexHtml, backgroundHtml, previewHtml, css] = await Promise.all([
  fs.readFile(path.join(brbRoot, "index.html"), "utf8"),
  fs.readFile(path.join(brbRoot, "background", "index.html"), "utf8"),
  fs.readFile(path.join(brbRoot, "preview.html"), "utf8"),
  fs.readFile(cssPath, "utf8"),
]);

if (/brb-screen\.(webp|webm)|stage-backdrop/.test(indexHtml)) fail("transparent overlay route includes a background asset");
if (!/brb-screen\.webm/.test(backgroundHtml) || !/\bautoplay\b/.test(backgroundHtml) || !/\bmuted\b/.test(backgroundHtml) || !/\bloop\b/.test(backgroundHtml)) {
  fail("background route must autoplay, mute, and loop the BRB WebM");
}
if (!/background\/index\.html/.test(previewHtml) || !/index\.html\?v=/.test(previewHtml)) {
  fail("preview must compose the background and transparent overlay routes");
}

const pulseBlock = css.match(/\.status-pulse\s*\{([\s\S]*?)\}/)?.[1] || "";
if (!/width:\s*12px/.test(pulseBlock) || !/height:\s*12px/.test(pulseBlock) || !/border-radius:\s*50%/.test(pulseBlock)) {
  fail("status pulses must be 12px circles");
}

const { data, info } = await sharp(masterPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const targets = [
  { name: "node", selector: ".brb-mode .node-standby", left: 1040, top: 50, right: 1075, bottom: 82, color: "violet" },
  { name: "archive", selector: ".brb-mode .pulse-one", left: 1252, top: 730, right: 1290, bottom: 762, color: "violet" },
  { name: "signal", selector: ".brb-mode .pulse-two", left: 1408, top: 730, right: 1447, bottom: 762, color: "cyan" },
];

for (const target of targets) {
  const painted = coloredCentroid(data, info.width, target);
  const position = readPosition(css, target.selector);
  const cssCenter = {
    x: position.left * info.width / 100,
    y: position.top * info.height / 100,
  };
  const delta = Math.hypot(cssCenter.x - painted.x, cssCenter.y - painted.y);
  if (delta > 0.5) fail(`${target.name} pulse is ${delta.toFixed(2)}px from its painted center`);
  console.log(`${target.name}: center delta ${delta.toFixed(2)}px`);
}

console.log("BRB overlay check passed: media, routes, circles, and dot registration are valid.");
