import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wasmPath = path.join(repoRoot, "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");

function usage() {
  console.error("Usage: npm run qr:verify -- <image-path> [expected-text] [--crop left,top,width,height] [--scale factor]");
}

const args = process.argv.slice(2);
const imageArg = args.shift();
let expectedText = "";
let crop = null;
let scale = 1;

while (args.length > 0) {
  const arg = args.shift();

  if (arg === "--crop") {
    const value = args.shift();

    if (!value) {
      usage();
      process.exit(2);
    }

    const [left, top, width, height] = value.split(",").map((part) => Number.parseInt(part, 10));

    if ([left, top, width, height].some((part) => !Number.isFinite(part) || part < 0) || width === 0 || height === 0) {
      console.error(`Invalid crop rectangle: ${value}`);
      process.exit(2);
    }

    crop = { left, top, width, height };
    continue;
  }

  if (arg === "--scale") {
    const value = args.shift();
    scale = Number.parseInt(value, 10);

    if (!Number.isFinite(scale) || scale < 1) {
      console.error(`Invalid scale factor: ${value}`);
      process.exit(2);
    }

    continue;
  }

  if (!expectedText) {
    expectedText = arg;
    continue;
  }

  usage();
  process.exit(2);
}

if (!imageArg) {
  usage();
  process.exit(2);
}

const imagePath = path.resolve(imageArg);
const wasmBinary = await fs.readFile(wasmPath);
await prepareZXingModule({
  overrides: { wasmBinary },
  fireImmediately: true,
});

let image = sharp(imagePath);

if (crop) {
  image = image.extract(crop);
}

if (scale > 1) {
  const metadata = crop || await image.metadata();
  image = image.resize({
    width: metadata.width * scale,
    height: metadata.height * scale,
    kernel: "nearest",
  });
}

const input = await image.png().toBuffer();
const results = await readBarcodes(input, {
  formats: ["QRCode"],
  tryHarder: true,
  tryInvert: true,
});

const validResults = results.filter((result) => result.isValid && result.text);

if (validResults.length === 0) {
  console.error(`QR verification failed: no readable QR code found in ${imagePath}`);
  process.exit(1);
}

for (const result of validResults) {
  console.log(`${result.format}: ${result.text}`);
}

if (expectedText && !validResults.some((result) => result.text === expectedText)) {
  console.error(`QR verification failed: expected ${expectedText}`);
  process.exit(1);
}

console.log(`QR verification passed for ${imagePath}`);
