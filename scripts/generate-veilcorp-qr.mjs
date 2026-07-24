import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import QRCode from "qrcode";
import sharp from "sharp";

const palette = {
  background: "#0F071D",
  panel: "#1A0B33",
  module: "#F0EBF8",
  moduleDim: "#D8CDED",
  purple: "#9A3CFF",
  magenta: "#D845FF",
  cyan: "#00F0FF",
  red: "#FF3B3B",
  white: "#FFFFFF",
  line: "#4D2C77",
  text: "#F0EBF8",
  muted: "#B8A8D0",
};

const accentColors = {
  purple: palette.purple,
  magenta: palette.magenta,
  cyan: palette.cyan,
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
    title: "CRADLEPOINT STUDIO",
    subtitle: "CLIENT SERVICES // VERIFIED",
    node: "WEB DESIGN INTAKE",
    clearance: "PUBLIC",
    footer: "PRACTICAL STRUCTURE. DISTINCTIVE PRESENCE. MOBILE-FIRST.",
    outDir: "public/assets/qr",
    errorCorrectionLevel: "H",
    accent: "purple",
    accentRate: 0.04,
    logoSvg: null,
    logoPath: null,
    borderless: false,
    fancy: false,
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
    if (key === "borderless") {
      args.borderless = true;
      continue;
    }
    if (key === "fancy") {
      args.fancy = true;
      args.borderless = true;
      args.accent = "purple";
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
      case "logo":
      case "logo-img":
        args.logoPath = value;
        break;
      case "scale":
        args.scale = Number.parseFloat(value);
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  if (args.fancy && !args.logoPath && !args.logoSvg) {
    args.logoPath = "studio/assets/brand/cradlepoint-studio-emblem-transparent.png";
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  npm run qr -- --url https://veildaemon.app/studio/web-design/ --fancy --out studio-web-design --png-preview",
    "",
    "Options:",
    "  --url            Required direct http(s) URL.",
    "  --fancy          Generate fancy borderless QR with VeilCorp purple styling and center Cradlepoint emblem.",
    "  --borderless     Remove outer poster frame and render clean QR badge.",
    "  --logo           Path to logo image (PNG/WebP) for center embedding.",
    "  --out            Output basename. Defaults to a slug from --title.",
    "  --out-dir        Output directory. Defaults to public/assets/qr.",
    "  --ecc            QR error correction level. Defaults to H.",
    "  --accent         Accent module color: purple, magenta, cyan, red, white, or none.",
    "  --accent-rate    Accent ratio for safe modules. Defaults to 0.04.",
    "  --png-preview    Also write a PNG preview.",
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
    throw new Error("--accent must be one of purple, magenta, cyan, red, white, or none.");
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
  const inTopLeft = x < 7 && y < 7;
  const inTopRight = x >= size - 7 && y < 7;
  const inBottomLeft = x < 7 && y >= size - 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

function getFinderPart(x, y, size) {
  let relX = x;
  let relY = y;
  if (x >= size - 7 && y < 7) {
    relX = x - (size - 7);
  } else if (x < 7 && y >= size - 7) {
    relY = y - (size - 7);
  }

  const isOuter = relX === 0 || relX === 6 || relY === 0 || relY === 6;
  const isInnerEye = relX >= 2 && relX <= 4 && relY >= 2 && relY <= 4;

  if (isOuter) return "outer";
  if (isInnerEye) return "eye";
  return "space";
}

function isLogoZone(x, y, size, hasLogo) {
  if (!hasLogo) {
    return false;
  }
  const center = (size - 1) / 2;
  const radius = Math.max(3.5, Math.floor(size * 0.125));
  return Math.abs(x - center) <= radius && Math.abs(y - center) <= radius;
}

function moduleColor(args, seed, x, y, size) {
  if (isFinderModule(x, y, size)) {
    const part = getFinderPart(x, y, size);
    if (part === "outer") return palette.purple;
    if (part === "eye") return (x + y) % 2 === 0 ? palette.cyan : palette.magenta;
    return palette.panel;
  }

  if (args.accent === "none") {
    return (x + y) % 3 === 0 ? palette.moduleDim : palette.module;
  }

  if (safeAccent(seed, x, y, args.accentRate)) {
    return (x + y) % 2 === 0 ? palette.cyan : palette.magenta;
  }

  return (x + y) % 3 === 0 ? palette.moduleDim : palette.module;
}

function buildQrModules(qr, args, hasLogo) {
  const quietZone = 3;
  const qrSize = qr.modules.size;
  const totalModules = qrSize + quietZone * 2;
  const targetWidth = args.borderless ? 800 : 900;
  const moduleSize = Math.max(4, Math.floor(targetWidth / totalModules));
  const qrPixels = totalModules * moduleSize;
  const qrX = 600 - qrPixels / 2;
  const qrY = args.borderless ? 280 : 270;
  const seed = hashString(args.url);
  const rects = [];

  for (let y = 0; y < qrSize; y += 1) {
    for (let x = 0; x < qrSize; x += 1) {
      if (!qr.modules.data[y * qrSize + x] || isLogoZone(x, y, qrSize, hasLogo)) {
        continue;
      }
      const drawX = qrX + (x + quietZone) * moduleSize;
      const drawY = qrY + (y + quietZone) * moduleSize;
      const fill = moduleColor(args, seed, x, y, qrSize);
      rects.push(`<rect x="${drawX}" y="${drawY}" width="${moduleSize}" height="${moduleSize}" fill="${fill}" rx="1"/>`);
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

async function readLogoBase64(logoPath) {
  if (!logoPath) return null;
  const resolved = path.resolve(logoPath);
  const buf = await sharp(resolved).resize(256, 256, { fit: "contain" }).png().toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function readLogoSvg(logoSvgPath) {
  if (!logoSvgPath) return "";
  const source = await fs.readFile(path.resolve(logoSvgPath), "utf8");
  return source.replace(/<\?xml[^>]*>\s*/i, "").replace(/<!DOCTYPE[^>]*>\s*/i, "").trim();
}

function buildLogoInjection(qr, logoDataUri, logoSvg) {
  if (!logoDataUri && !logoSvg) return "";

  const size = Math.round(qr.qrPixels * 0.24);
  const x = 600 - size / 2;
  const y = qr.qrY + qr.qrPixels / 2 - size / 2;

  if (logoDataUri) {
    return `
    <g id="center-logo">
      <circle cx="600" cy="${qr.qrY + qr.qrPixels / 2}" r="${size / 2 + 10}" fill="#0F071D" stroke="#9A3CFF" stroke-width="5"/>
      <circle cx="600" cy="${qr.qrY + qr.qrPixels / 2}" r="${size / 2 + 3}" fill="#1A0B33" stroke="#00F0FF" stroke-width="2" opacity=".7"/>
      <image href="${logoDataUri}" x="${x}" y="${y}" width="${size}" height="${size}"/>
    </g>`;
  }

  const normalizedLogo = logoSvg
    .replace(/\s(width|height)="[^"]*"/gi, "")
    .replace(/<svg\b/i, '<svg width="100" height="100"')
    .replace(/<script\b[\s\S]*?<\/script>/gi, "");

  return `
    <g id="center-logo" transform="translate(${x} ${y})">
      <rect x="0" y="0" width="${size}" height="${size}" rx="12" fill="#0F071D" stroke="#9A3CFF" stroke-width="5"/>
      <g transform="translate(${size * 0.14} ${size * 0.14}) scale(${(size * 0.72) / 100})">
        ${normalizedLogo}
      </g>
    </g>`;
}

function buildSvg(qr, args, logoDataUri, logoSvg) {
  const title = escapeXml(args.title.toUpperCase());
  const subtitle = escapeXml(args.subtitle.toUpperCase());
  const node = escapeXml(args.node.toUpperCase());
  const clearance = escapeXml(args.clearance.toUpperCase());
  const footer = escapeXml(args.footer.toUpperCase());
  const destination = escapeXml(args.url);
  const logo = buildLogoInjection(qr, logoDataUri, logoSvg);

  if (args.borderless) {
    const viewWidth = 1200;
    const viewHeight = 1400;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${title} QR</title>
  <desc id="desc">Fancy borderless QR code for ${destination}. Error correction ${args.errorCorrectionLevel}. Scan test required before publishing.</desc>
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#260F4D"/>
      <stop offset="60%" stop-color="#120624"/>
      <stop offset="100%" stop-color="#090312"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="${viewWidth}" height="${viewHeight}" rx="32" fill="url(#bgGlow)"/>

  <g id="header">
    <text x="600" y="140" fill="${palette.text}" font-family="Inter, system-ui, sans-serif" font-size="52" font-weight="800" text-anchor="middle" letter-spacing="4">${title}</text>
    <text x="600" y="195" fill="${palette.cyan}" font-family="Consolas, monospace" font-size="24" font-weight="600" text-anchor="middle" letter-spacing="5">${subtitle}</text>
    <path d="M350 225h500" stroke="${palette.purple}" stroke-width="3" stroke-dasharray="24 12"/>
  </g>

  <g id="qr-field">
    <rect x="${qr.qrX - 24}" y="${qr.qrY - 24}" width="${qr.qrPixels + 48}" height="${qr.qrPixels + 48}" rx="28" fill="${palette.panel}" stroke="${palette.purple}" stroke-width="3"/>
    <rect x="${qr.qrX - 10}" y="${qr.qrY - 10}" width="${qr.qrPixels + 20}" height="${qr.qrPixels + 20}" rx="18" fill="none" stroke="${palette.cyan}" stroke-width="2" opacity=".6"/>
    <g id="qr-modules" shape-rendering="crispEdges">
      ${qr.svg}
    </g>${logo}
  </g>

  <g id="metadata">
    <rect x="200" y="${qr.qrY + qr.qrPixels + 50}" width="800" height="76" rx="16" fill="rgba(26, 11, 51, 0.85)" stroke="${palette.line}" stroke-width="2"/>
    <text x="320" y="${qr.qrY + qr.qrPixels + 98}" fill="${palette.muted}" font-family="Consolas, monospace" font-size="20" letter-spacing="3" text-anchor="middle">NODE: <tspan fill="${palette.text}" font-weight="700">${node}</tspan></text>
    <text x="880" y="${qr.qrY + qr.qrPixels + 98}" fill="${palette.muted}" font-family="Consolas, monospace" font-size="20" letter-spacing="3" text-anchor="end">CLEARANCE: <tspan fill="${palette.cyan}" font-weight="700">${clearance}</tspan></text>
  </g>

  <g id="footer">
    <text x="600" y="${viewHeight - 50}" fill="${palette.muted}" font-family="Consolas, monospace" font-size="19" text-anchor="middle" letter-spacing="3">${footer}</text>
  </g>
</svg>
`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600" role="img" aria-labelledby="title desc">
  <title id="title">${title} QR</title>
  <desc id="desc">Static QR code for ${destination}. Error correction ${args.errorCorrectionLevel}. Scan test required before publishing.</desc>
  <rect width="1200" height="1600" fill="${palette.background}"/>
  <g id="qr-field">
    <rect x="${qr.qrX - 14}" y="${qr.qrY - 14}" width="${qr.qrPixels + 28}" height="${qr.qrPixels + 28}" fill="${palette.panel}" stroke="${palette.line}" stroke-width="4"/>
    <g id="qr-modules" shape-rendering="crispEdges">
      ${qr.svg}
    </g>${logo}
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
      margin: 3,
      type: "terminal",
    });
    const outputBase = slugify(args.out || args.title);
    const outDir = path.resolve(args.outDir);
    const svgPath = path.join(outDir, `${outputBase}.svg`);
    const logoDataUri = await readLogoBase64(args.logoPath);
    const logoSvg = await readLogoSvg(args.logoSvg);
    const hasLogo = Boolean(logoDataUri || logoSvg);
    const qrModules = buildQrModules(qr, args, hasLogo);
    const svg = buildSvg(qrModules, args, logoDataUri, logoSvg);

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(svgPath, svg, "utf8");

    console.log(`Generated ${path.relative(process.cwd(), svgPath)}`);

    if (args.pngPreview || args.fancy) {
      const pngPath = path.join(outDir, `${outputBase}.png`);
      const targetHeight = args.borderless ? 1400 : 1600;
      await sharp(Buffer.from(svg)).resize({
        width: Math.round(1200 * args.scale),
        height: Math.round(targetHeight * args.scale),
        kernel: "nearest",
      }).png().toFile(pngPath);
      console.log(`Generated ${path.relative(process.cwd(), pngPath)} preview`);
    }

    const webpPath = path.join(outDir, `${outputBase}.webp`);
    const targetHeight = args.borderless ? 1400 : 1600;
    await sharp(Buffer.from(svg)).resize({
      width: Math.round(1200 * args.scale),
      height: Math.round(targetHeight * args.scale),
    }).webp({ quality: 95 }).toFile(webpPath);
    console.log(`Generated ${path.relative(process.cwd(), webpPath)} WebP asset`);

    console.warn("Scan test required before publishing.");
  } catch (error) {
    console.error(error.message);
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  }
}

await main();
