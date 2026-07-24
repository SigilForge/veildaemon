import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import QRCode from "qrcode";
import sharp from "sharp";

const presets = {
  purple: {
    bgInner: "#260F4D",
    bgMid: "#120624",
    bgOuter: "#090312",
    panel: "#1A0B33",
    module: "#F0EBF8",
    moduleDim: "#D8CDED",
    primary: "#9A3CFF",
    secondary: "#00F0FF",
    accent: "#D845FF",
    text: "#F0EBF8",
    muted: "#B8A8D0",
  },
  crimson: {
    bgInner: "#4D0F18",
    bgMid: "#24060C",
    bgOuter: "#0A0205",
    panel: "#380A14",
    module: "#FDEDF0",
    moduleDim: "#EACCD2",
    primary: "#FF3B3B",
    secondary: "#E8A87C",
    accent: "#FF758F",
    text: "#FDEDF0",
    muted: "#D0A8B0",
  },
  cyan: {
    bgInner: "#0F3D4D",
    bgMid: "#061D24",
    bgOuter: "#030F12",
    panel: "#0A2B38",
    module: "#EDFBFD",
    moduleDim: "#C5EBF2",
    primary: "#00F0FF",
    secondary: "#89FFDA",
    accent: "#3B9EFF",
    text: "#EDFBFD",
    muted: "#A0D8E5",
  },
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
    node: "INTAKE NODE",
    clearance: "PUBLIC",
    footer: "PRACTICAL STRUCTURE. DISTINCTIVE PRESENCE.",
    outDir: "public/assets/qr",
    errorCorrectionLevel: "H",
    presetName: "purple",
    accentRate: 0.04,
    logoSvg: null,
    logoPath: null,
    borderless: false,
    fancy: false,
    square: false,
    pngPreview: false,
    scale: 2,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (key === "png-preview") {
      args.pngPreview = true;
      continue;
    }
    if (key === "borderless") {
      args.borderless = true;
      continue;
    }
    if (key === "square" || key === "bizcard") {
      args.square = true;
      args.borderless = true;
      args.fancy = true;
      continue;
    }
    if (key === "fancy") {
      args.fancy = true;
      args.borderless = true;
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
      case "preset":
      case "color":
        args.presetName = value.toLowerCase();
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
    "  npm run qr -- --url https://play.veildaemon.app/ --preset crimson --square --out play-veildaemon",
    "  npm run qr -- --url https://veildaemon.app/ --preset cyan --square --out veildaemon-app",
    "  npm run qr -- --url https://veildaemon.app/studio/web-design/ --preset purple --square --out studio-web-design",
    "",
    "Options:",
    "  --url            Required direct http(s) URL.",
    "  --square         Generate a 1:1 1000x1000 square QR badge tailored for business cards.",
    "  --preset         Color preset: purple, crimson, cyan.",
    "  --fancy          Generate fancy borderless QR with center emblem.",
    "  --logo           Path to custom PNG/WebP center logo.",
    "  --out            Output basename.",
    "  --out-dir        Output directory. Defaults to public/assets/qr.",
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

function moduleColor(palette, seed, x, y, size) {
  if (isFinderModule(x, y, size)) {
    const part = getFinderPart(x, y, size);
    if (part === "outer") return palette.primary;
    if (part === "eye") return (x + y) % 2 === 0 ? palette.secondary : palette.accent;
    return palette.panel;
  }

  if (safeAccent(seed, x, y, 0.04)) {
    return (x + y) % 2 === 0 ? palette.secondary : palette.accent;
  }

  return (x + y) % 3 === 0 ? palette.moduleDim : palette.module;
}

function buildQrModules(qr, args, palette, hasLogo, canvasWidth, canvasHeight) {
  const quietZone = 3;
  const qrSize = qr.modules.size;
  const totalModules = qrSize + quietZone * 2;
  const targetWidth = args.square ? 760 : (args.borderless ? 800 : 900);
  const moduleSize = Math.max(4, Math.floor(targetWidth / totalModules));
  const qrPixels = totalModules * moduleSize;
  const qrX = canvasWidth / 2 - qrPixels / 2;
  const qrY = args.square ? (canvasHeight / 2 - qrPixels / 2) : (args.borderless ? 280 : 270);
  const seed = hashString(args.url);
  const rects = [];

  for (let y = 0; y < qrSize; y += 1) {
    for (let x = 0; x < qrSize; x += 1) {
      if (!qr.modules.data[y * qrSize + x] || isLogoZone(x, y, qrSize, hasLogo)) {
        continue;
      }
      const drawX = qrX + (x + quietZone) * moduleSize;
      const drawY = qrY + (y + quietZone) * moduleSize;
      const fill = moduleColor(palette, seed, x, y, qrSize);
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

function buildLogoInjection(qr, palette, logoDataUri, logoSvg, canvasWidth, canvasHeight) {
  if (!logoDataUri && !logoSvg) return "";

  const size = Math.round(qr.qrPixels * 0.24);
  const centerX = qr.qrX + qr.qrPixels / 2;
  const centerY = qr.qrY + qr.qrPixels / 2;
  const x = centerX - size / 2;
  const y = centerY - size / 2;

  if (logoDataUri) {
    return `
    <g id="center-logo">
      <circle cx="${centerX}" cy="${centerY}" r="${size / 2 + 10}" fill="${palette.bgMid}" stroke="${palette.primary}" stroke-width="5"/>
      <circle cx="${centerX}" cy="${centerY}" r="${size / 2 + 3}" fill="${palette.panel}" stroke="${palette.secondary}" stroke-width="2" opacity=".8"/>
      <image href="${logoDataUri}" x="${x}" y="${y}" width="${size}" height="${size}"/>
    </g>`;
  }

  const normalizedLogo = logoSvg
    .replace(/\s(width|height)="[^"]*"/gi, "")
    .replace(/<svg\b/i, '<svg width="100" height="100"')
    .replace(/<script\b[\s\S]*?<\/script>/gi, "");

  return `
    <g id="center-logo" transform="translate(${x} ${y})">
      <rect x="0" y="0" width="${size}" height="${size}" rx="12" fill="${palette.bgMid}" stroke="${palette.primary}" stroke-width="5"/>
      <g transform="translate(${size * 0.14} ${size * 0.14}) scale(${(size * 0.72) / 100})">
        ${normalizedLogo}
      </g>
    </g>`;
}

function buildSvg(qr, args, palette, logoDataUri, logoSvg) {
  const title = escapeXml(args.title.toUpperCase());
  const subtitle = escapeXml(args.subtitle.toUpperCase());
  const destination = escapeXml(args.url);
  const logo = buildLogoInjection(qr, palette, logoDataUri, logoSvg, args.square ? 1000 : 1200, args.square ? 1000 : 1400);

  if (args.square) {
    const size = 1000;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="title desc">
  <title id="title">${title} Square QR Badge</title>
  <desc id="desc">Square QR badge for business card use: ${destination}. Error correction ${args.errorCorrectionLevel}.</desc>
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="${palette.bgInner}"/>
      <stop offset="65%" stop-color="${palette.bgMid}"/>
      <stop offset="100%" stop-color="${palette.bgOuter}"/>
    </radialGradient>
  </defs>

  <rect width="${size}" height="${size}" rx="40" fill="url(#bgGlow)"/>

  <!-- Square QR Badge Container -->
  <g id="qr-field">
    <rect x="${qr.qrX - 22}" y="${qr.qrY - 22}" width="${qr.qrPixels + 44}" height="${qr.qrPixels + 44}" rx="28" fill="${palette.panel}" stroke="${palette.primary}" stroke-width="4"/>
    <rect x="${qr.qrX - 9}" y="${qr.qrY - 9}" width="${qr.qrPixels + 18}" height="${qr.qrPixels + 18}" rx="18" fill="none" stroke="${palette.secondary}" stroke-width="2" opacity=".7"/>
    <g id="qr-modules" shape-rendering="crispEdges">
      ${qr.svg}
    </g>${logo}
  </g>
</svg>
`;
  }

  if (args.borderless) {
    const viewWidth = 1200;
    const viewHeight = 1400;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${title} QR</title>
  <desc id="desc">Fancy borderless QR code for ${destination}. Error correction ${args.errorCorrectionLevel}.</desc>
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="${palette.bgInner}"/>
      <stop offset="60%" stop-color="${palette.bgMid}"/>
      <stop offset="100%" stop-color="${palette.bgOuter}"/>
    </radialGradient>
  </defs>

  <rect width="${viewWidth}" height="${viewHeight}" rx="32" fill="url(#bgGlow)"/>

  <g id="header">
    <text x="600" y="140" fill="${palette.text}" font-family="Inter, system-ui, sans-serif" font-size="52" font-weight="800" text-anchor="middle" letter-spacing="4">${title}</text>
    <text x="600" y="195" fill="${palette.secondary}" font-family="Consolas, monospace" font-size="24" font-weight="600" text-anchor="middle" letter-spacing="5">${subtitle}</text>
    <path d="M350 225h500" stroke="${palette.primary}" stroke-width="3" stroke-dasharray="24 12"/>
  </g>

  <g id="qr-field">
    <rect x="${qr.qrX - 24}" y="${qr.qrY - 24}" width="${qr.qrPixels + 48}" height="${qr.qrPixels + 48}" rx="28" fill="${palette.panel}" stroke="${palette.primary}" stroke-width="3"/>
    <rect x="${qr.qrX - 10}" y="${qr.qrY - 10}" width="${qr.qrPixels + 20}" height="${qr.qrPixels + 20}" rx="18" fill="none" stroke="${palette.secondary}" stroke-width="2" opacity=".6"/>
    <g id="qr-modules" shape-rendering="crispEdges">
      ${qr.svg}
    </g>${logo}
  </g>
</svg>
`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600" role="img" aria-labelledby="title desc">
  <title id="title">${title} QR</title>
  <desc id="desc">Static QR code for ${destination}. Error correction ${args.errorCorrectionLevel}.</desc>
  <rect width="1200" height="1600" fill="${palette.bgMid}"/>
  <g id="qr-field">
    <rect x="${qr.qrX - 14}" y="${qr.qrY - 14}" width="${qr.qrPixels + 28}" height="${qr.qrPixels + 28}" fill="${palette.panel}" stroke="${palette.primary}" stroke-width="4"/>
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

    const activePalette = presets[args.presetName] || presets.purple;
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

    const canvasWidth = args.square ? 1000 : 1200;
    const canvasHeight = args.square ? 1000 : (args.borderless ? 1400 : 1600);

    const qrModules = buildQrModules(qr, args, activePalette, hasLogo, canvasWidth, canvasHeight);
    const svg = buildSvg(qrModules, args, activePalette, logoDataUri, logoSvg);

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(svgPath, svg, "utf8");

    console.log(`Generated ${path.relative(process.cwd(), svgPath)}`);

    const pngPath = path.join(outDir, `${outputBase}.png`);
    await sharp(Buffer.from(svg)).resize({
      width: Math.round(canvasWidth * args.scale),
      height: Math.round(canvasHeight * args.scale),
    }).png().toFile(pngPath);
    console.log(`Generated ${path.relative(process.cwd(), pngPath)} PNG asset`);

    const webpPath = path.join(outDir, `${outputBase}.webp`);
    await sharp(Buffer.from(svg)).resize({
      width: Math.round(canvasWidth * args.scale),
      height: Math.round(canvasHeight * args.scale),
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
