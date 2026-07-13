#!/usr/bin/env node

/**
 * Build web and press derivatives for the Cradlepoint Studio raster identity.
 *
 * Round marks use an exterior-only flood fill: dark pixels are removed only
 * when they connect to the canvas edge. Enclosed black bands, shadows, and
 * interior negative space remain opaque.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const brandDir = path.join(root, "studio/assets/brand");

const roundMarks = [
  {
    source: "cradlepoint-studio-emblem.png",
    output: "cradlepoint-studio-emblem-transparent.png",
    protectedRadiusRatio: 0.415,
  },
  {
    source: "cradlepoint-studio-seal-city-duality.png",
    output: "cradlepoint-studio-seal-city-duality-transparent.png",
    protectedRadiusRatio: 0.455,
  },
];

const flatWebpSources = [
  "cradlepoint-studio-wordmark-color.png",
  "cradlepoint-studio-wordmark-monochrome.png",
];

function isExteriorBackground(data, offset, channels) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const lightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  const sourceAlpha = channels === 4 ? data[offset + 3] : 255;

  return sourceAlpha === 0 || (lightest <= 52 && lightest - darkest <= 45);
}

async function removeExteriorBackground(sourcePath, outputPath, protectedRadiusRatio) {
  const { data, info } = await sharp(sourcePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixelCount = width * height;
  const exterior = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const protectedRadius = Math.min(width, height) * protectedRadiusRatio;

  function enqueue(index) {
    if (exterior[index]) return;
    const x = index % width;
    const y = Math.floor(index / width);
    if (Math.hypot(x - centerX, y - centerY) <= protectedRadius) return;
    const offset = index * channels;
    if (!isExteriorBackground(data, offset, channels)) return;
    exterior[index] = 1;
    queue[queueEnd++] = index;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  const rgba = Buffer.alloc(pixelCount * 4);
  let preservedDarkPixels = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const sourceOffset = index * channels;
    const outputOffset = index * 4;
    const red = data[sourceOffset];
    const green = data[sourceOffset + 1];
    const blue = data[sourceOffset + 2];
    rgba[outputOffset] = red;
    rgba[outputOffset + 1] = green;
    rgba[outputOffset + 2] = blue;
    rgba[outputOffset + 3] = exterior[index] ? 0 : 255;

    if (!exterior[index] && Math.max(red, green, blue) <= 52) {
      preservedDarkPixels += 1;
    }
  }

  if (queueEnd === 0 || preservedDarkPixels === 0) {
    throw new Error(`Mask validation failed for ${path.basename(sourcePath)}`);
  }

  await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(outputPath);
  return { width, height, removedPixels: queueEnd, preservedDarkPixels };
}

async function writeWebp(sourcePath, outputPath, width = 1920) {
  await sharp(sourcePath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 100, effort: 5 })
    .toFile(outputPath);
}

function buildIco(pngBuffers, sizes) {
  const headerSize = 6 + sizes.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = headerSize;

  pngBuffers.forEach((png, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index] === 256 ? 0 : sizes[index];
    header[entry + 1] = sizes[index] === 256 ? 0 : sizes[index];
    header[entry + 2] = 0;
    header[entry + 3] = 0;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...pngBuffers]);
}

for (const mark of roundMarks) {
  const sourcePath = path.join(brandDir, mark.source);
  const outputPath = path.join(brandDir, mark.output);
  const report = await removeExteriorBackground(
    sourcePath,
    outputPath,
    mark.protectedRadiusRatio,
  );
  await writeWebp(outputPath, outputPath.replace(/\.png$/i, ".webp"));
  console.log("masked", mark.source, report);
}

for (const source of flatWebpSources) {
  const sourcePath = path.join(brandDir, source);
  await writeWebp(sourcePath, sourcePath.replace(/\.png$/i, ".webp"));
}

const emblem = path.join(brandDir, "cradlepoint-studio-emblem-transparent.png");
for (const size of [128, 256, 512]) {
  await writeWebp(emblem, path.join(brandDir, `cradlepoint-studio-emblem-${size}.webp`), size);
}

const faviconSizes = [16, 32, 48];
const faviconBuffers = [];
for (const size of faviconSizes) {
  const buffer = await sharp(emblem).resize(size, size, { fit: "contain" }).png().toBuffer();
  faviconBuffers.push(buffer);
  await fs.writeFile(path.join(brandDir, `favicon-${size}x${size}.png`), buffer);
}
await fs.writeFile(path.join(brandDir, "favicon.ico"), buildIco(faviconBuffers, faviconSizes));
await sharp(emblem)
  .resize(180, 180, { fit: "contain" })
  .png()
  .toFile(path.join(brandDir, "apple-touch-icon.png"));

console.log("built transparent Studio marks and browser icons");
