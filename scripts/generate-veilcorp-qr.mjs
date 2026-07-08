import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import QRCode from "qrcode";

const palette = {
  background: "#0A0A0D",
  panel: "#0F0F15",
  module: "#C9B8D0",
  moduleDim: "#B8A2BE",
  purple: "#9A3CFF",
  red: "#FF3B3B",
  white: "#EAEAF2",
  line: "#6B6C72",
  text: "#EAEAF2",
  muted: "#A9AAB2",
};

const accentColors = {
  purple: palette.purple,
  red: palette.red,
  white: palette.white,
};

const shortenerHosts = new Set([
  "bit.ly",
  "buff.ly",
  "cutt.ly",
  "goo.gl",
  "is.gd",
  "lnkd.in",
  "ow.ly",
  "rebrand.ly",
  "s.id",
  "shorturl.at",
  "t.co",
  "tiny.cc",
  "tinyurl.com",
  "trib.al",
  "url.kr",
]);

function parseArgs(argv) {
  const args = {
    title: "VEILCORP ARCHIVES",
    subtitle: "ACCESS NODE // VERIFIED",
    node: "PUBLIC INTAKE",
    clearance: "OBSERVER",
    footer: "HUMAN AUTHORIZATION PARTIAL. SURVIVAL AUTHORIZATION ACTIVE.",
    outDir: "public/assets/qr",
    errorCorrectionLevel: "H",
    accent: "purple",
    accentRate: 0.025,
    logoSvg: null,
    pngPreview: false,
    scale: 2,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (key === "no-accent") {
      args.accent = "none";
      continue;
    }
    if (key === "png-preview") {
      args.pngPreview = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;

    switch (key) {
      case "url":
        args.url = value;
        break;
      case "title":
        args.title = value;
        break;
      case "subtitle":
        args.subtitle = value;
        break;
      case "node":
        args.node = value;
        break;
      case "clearance":
        args.clearance = value;
        break;
      case "footer":
        args.footer = value;
        break;
      case "out":
        args.out = value;
        break;
      case "out-dir":
        args.outDir = value;
        break;
      case "ecc":
        args.errorCorrectionLevel = value.toUpperCase();
        break;
      case "accent":
        args.accent = value.toLowerCase();
        break;
      case "accent-rate":
        args.accentRate = Number.parseFloat(value);
        break;
      case "logo-svg":
        args.logoSvg = value;
        break;
      case "scale":
        args.scale = Number.parseFloat(value);
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  npm run qr -- --url https://veildaemon.app --title \"VEILCORP ARCHIVES\" --subtitle \"ACCESS NODE // VERIFIED\" --node \"OPERATOR INTAKE\" --clearance \"THREADBREAKER\" --out operator-intake",
    "",
    "Options:",
    "  --url            Required direct http(s) URL.",
    "  --out            Output basename. Defaults to a slug from --title.",
    "  --out-dir        Output directory. Defaults to public/assets/qr.",
    "  --ecc            QR error correction level. Defaults to H.",
    "  --accent         Accent module color: purple, red, white, or none. Defaults to purple.",
    "  --no-accent      Disable deterministic accent modules.",
    "  --accent-rate    Accent ratio for safe modules. Defaults to 0.025.",
    "  --footer         Footer text. Defaults to the VeilCorp authorization line.",
    "  --logo-svg       Optional center SVG logo path. Disabled by default.",
    "  --png-preview    Also write a PNG preview. SVG remains the publishing asset.",
    "  --scale          PNG preview scale multiplier. Defaults to 2.",
  ].join("\n");
}

function validateOptions(args) {
  if (!args.url) {
    throw new Error("Missing required --url.");
  }

  const parsed = new URL(args.url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("QR URL must be a direct http(s) URL.");
  }
  if (shortenerHosts.has(parsed.hostname.toLowerCase().replace(/^www\./, ""))) {
    throw new Error(`Refusing short URL host: ${parsed.hostname}`);
  }
  if (!["L", "M", "Q", "H"].includes(args.errorCorrectionLevel)) {
    throw new Error("--ecc must be one of L, M, Q, or H.");
  }
  if (![...Object.keys(accentColors), "none"].includes(args.accent)) {
    throw new Error("--accent must be one of purple, red, white, or none.");
  }
  if (!Number.isFinite(args.accentRate) || args.accentRate < 0 || args.accentRate > 0.12) {
    throw new Error("--accent-rate must be a number from 0 to 0.12.");
  }
  if (!Number.isFinite(args.scale) || args.scale < 1 || args.scale > 4) {
    throw new Error("--scale must be a number from 1 to 4.");
  }

  return parsed;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "veilcorp-qr";
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function safeAccent(seed, x, y, rate) {
  const mixed = Math.imul(seed ^ (x * 374761393) ^ (y * 668265263), 2246822519) >>> 0;
  return mixed / 0xffffffff < rate;
}

function isFinderModule(x, y, size) {
  const inTopLeft = x < 9 && y < 9;
  const inTopRight = x >= size - 8 && y < 9;
  const inBottomLeft = x < 9 && y >= size - 8;
  return inTopLeft || inTopRight || inBottomLeft;
}

function isLogoZone(x, y, size, logo) {
  if (!logo) {
    return false;
  }
  const center = (size - 1) / 2;
  const radius = Math.max(4, Math.floor(size * 0.105));
  return Math.abs(x - center) <= radius && Math.abs(y - center) <= radius;
}

function moduleColor(args, seed, x, y, size) {
  if (args.accent === "none" || isFinderModule(x, y, size) || isLogoZone(x, y, size, args.logoSvg)) {
    return (x + y) % 3 === 0 ? palette.moduleDim : palette.module;
  }

  if (!safeAccent(seed, x, y, args.accentRate)) {
    return (x + y) % 3 === 0 ? palette.moduleDim : palette.module;
  }

  return accentColors[args.accent];
}

function buildQrModules(qr, args) {
  const quietZone = 4;
  const qrSize = qr.modules.size;
  const totalModules = qrSize + quietZone * 2;
  const moduleSize = Math.max(4, Math.floor(966 / totalModules));
  const qrPixels = totalModules * moduleSize;
  const qrX = 600 - qrPixels / 2;
  const qrY = 270;
  const seed = hashString(args.url);
  const rects = [];

  for (let y = 0; y < qrSize; y += 1) {
    for (let x = 0; x < qrSize; x += 1) {
      if (!qr.modules.data[y * qrSize + x]) {
        continue;
      }
      const drawX = qrX + (x + quietZone) * moduleSize;
      const drawY = qrY + (y + quietZone) * moduleSize;
      const fill = moduleColor(args, seed, x, y, qrSize);
      rects.push(`<rect x="${drawX}" y="${drawY}" width="${moduleSize}" height="${moduleSize}" fill="${fill}"/>`);
    }
  }

  return {
    moduleSize,
    qrPixels,
    qrX,
    qrY,
    qrSize,
    quietZone,
    svg: rects.join("\n      "),
  };
}

function buildFrameMarks() {
  return [
    '<path d="M88 92h118v14H102v104H88V92Z" fill="#6B6C72"/>',
    '<path d="M1112 92h-118v14h104v104h14V92Z" fill="#6B6C72"/>',
    '<path d="M88 1508h118v-14H102v-104H88v118Z" fill="#6B6C72"/>',
    '<path d="M1112 1508h-118v-14h104v-104h14v118Z" fill="#6B6C72"/>',
    '<path d="M126 138h948M126 1462h948" stroke="#6B6C72" stroke-width="2" stroke-dasharray="18 16" opacity=".75"/>',
    '<path d="M138 180v1240M1062 180v1240" stroke="#6B6C72" stroke-width="2" stroke-dasharray="18 16" opacity=".5"/>',
  ].join("\n  ");
}

async function readLogoSvg(logoSvgPath) {
  if (!logoSvgPath) {
    return "";
  }

  const source = await fs.readFile(path.resolve(logoSvgPath), "utf8");
  if (!/<svg[\s>]/i.test(source)) {
    throw new Error("--logo-svg must point to an SVG file.");
  }

  return source
    .replace(/<\?xml[^>]*>\s*/i, "")
    .replace(/<!DOCTYPE[^>]*>\s*/i, "")
    .trim();
}

function buildLogoInjection(qr, logoSvg) {
  if (!logoSvg) {
    return "";
  }

  const size = Math.round(qr.qrPixels * 0.16);
  const x = 600 - size / 2;
  const y = qr.qrY + qr.qrPixels / 2 - size / 2;
  const normalizedLogo = logoSvg
    .replace(/\s(width|height)="[^"]*"/gi, "")
    .replace(/<svg\b/i, '<svg width="100" height="100"')
    .replace(/<script\b[\s\S]*?<\/script>/gi, "");

  return `
    <g id="center-logo" transform="translate(${x} ${y})">
      <rect x="0" y="0" width="${size}" height="${size}" fill="#0A0A0D" stroke="#9A3CFF" stroke-width="6"/>
      <g transform="translate(${size * 0.14} ${size * 0.14}) scale(${(size * 0.72) / 100})">
        ${normalizedLogo}
      </g>
    </g>`;
}

function buildSvg(qr, args, logoSvg) {
  const title = escapeXml(args.title.toUpperCase());
  const subtitle = escapeXml(args.subtitle.toUpperCase());
  const node = escapeXml(args.node.toUpperCase());
  const clearance = escapeXml(args.clearance.toUpperCase());
  const footer = escapeXml(args.footer.toUpperCase());
  const destination = escapeXml(args.url);
  const generated = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const logo = buildLogoInjection(qr, logoSvg);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600" role="img" aria-labelledby="title desc">
  <title id="title">${title} QR</title>
  <desc id="desc">Static QR code for ${destination}. Error correction ${args.errorCorrectionLevel}. Scan test required before publishing.</desc>
  <rect width="1200" height="1600" fill="${palette.background}"/>
  <rect x="70" y="74" width="1060" height="1452" fill="none" stroke="${palette.line}" stroke-width="4"/>
  <rect x="92" y="96" width="1016" height="1408" fill="none" stroke="${palette.line}" stroke-width="1" opacity=".52"/>
  <rect x="114" y="118" width="972" height="1364" fill="none" stroke="${palette.purple}" stroke-width="1" opacity=".42"/>
  ${buildFrameMarks()}

  <g id="header">
    <text x="600" y="178" fill="${palette.text}" font-family="Inter, Consolas, monospace" font-size="54" font-weight="700" text-anchor="middle" letter-spacing="3">${title}</text>
    <text x="600" y="226" fill="${palette.muted}" font-family="Consolas, monospace" font-size="24" text-anchor="middle" letter-spacing="4">${subtitle}</text>
    <path d="M282 260h636" stroke="${palette.purple}" stroke-width="3" stroke-dasharray="32 14"/>
  </g>

  <g id="qr-field">
    <rect x="${qr.qrX - 14}" y="${qr.qrY - 14}" width="${qr.qrPixels + 28}" height="${qr.qrPixels + 28}" fill="${palette.panel}" stroke="${palette.line}" stroke-width="4"/>
    <rect x="${qr.qrX - 2}" y="${qr.qrY - 2}" width="${qr.qrPixels + 4}" height="${qr.qrPixels + 4}" fill="none" stroke="${palette.red}" stroke-width="2" opacity=".48"/>
    <rect x="${qr.qrX}" y="${qr.qrY}" width="${qr.qrPixels}" height="${qr.qrPixels}" fill="${palette.background}"/>
    <g id="qr-modules" shape-rendering="crispEdges">
      ${qr.svg}
    </g>${logo}
  </g>

  <g id="metadata">
    <rect x="126" y="1254" width="442" height="116" fill="none" stroke="${palette.line}" stroke-width="2"/>
    <rect x="632" y="1254" width="442" height="116" fill="none" stroke="${palette.line}" stroke-width="2"/>
    <path d="M126 1240h948M126 1388h948" stroke="${palette.purple}" stroke-width="2" stroke-dasharray="12 12" opacity=".55"/>
    <text x="154" y="1296" fill="${palette.muted}" font-family="Consolas, monospace" font-size="20" letter-spacing="3">NODE</text>
    <text x="154" y="1338" fill="${palette.text}" font-family="Consolas, monospace" font-size="28" font-weight="700">${node}</text>
    <text x="660" y="1296" fill="${palette.muted}" font-family="Consolas, monospace" font-size="20" letter-spacing="3">CLEARANCE</text>
    <text x="660" y="1338" fill="${palette.text}" font-family="Consolas, monospace" font-size="28" font-weight="700">${clearance}</text>
    <rect x="126" y="1412" width="948" height="58" fill="none" stroke="${palette.line}" stroke-width="2"/>
    <text x="154" y="1450" fill="${palette.muted}" font-family="Consolas, monospace" font-size="18">STATIC DIRECT URL // ECC-${args.errorCorrectionLevel} // GENERATED ${generated}</text>
  </g>

  <g id="footer">
    <text x="600" y="1514" fill="${palette.text}" font-family="Consolas, monospace" font-size="20" text-anchor="middle" letter-spacing="3">${footer}</text>
  </g>
</svg>
`;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    validateOptions(args);
    const qr = QRCode.create(args.url, {
      errorCorrectionLevel: args.errorCorrectionLevel,
      margin: 4,
      type: "terminal",
    });
    const outputBase = slugify(args.out || args.title);
    const outDir = path.resolve(args.outDir);
    const svgPath = path.join(outDir, `${outputBase}.svg`);
    const qrModules = buildQrModules(qr, args);
    const logoSvg = await readLogoSvg(args.logoSvg);
    const svg = buildSvg(qrModules, args, logoSvg);

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(svgPath, svg, "utf8");

    console.log(`Generated ${path.relative(process.cwd(), svgPath)}`);
    if (args.pngPreview) {
      const pngPath = path.join(outDir, `${outputBase}.png`);
      const { default: sharp } = await import("sharp");
      await sharp(Buffer.from(svg)).resize({
        width: Math.round(1200 * args.scale),
        height: Math.round(1600 * args.scale),
        kernel: "nearest",
      }).png().toFile(pngPath);
      console.log(`Generated ${path.relative(process.cwd(), pngPath)} preview`);
    }
    console.warn("Scan test required before publishing.");
  } catch (error) {
    console.error(error.message);
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  }
}

await main();
