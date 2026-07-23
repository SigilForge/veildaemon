import QRCode from "qrcode";
import type { QrArtOption, QrFrameStyleOption } from "./types";
import { contrastRatio } from "./validation";

export type QrGeneratorOptions = {
  url: string;
  foreground?: string;
  background?: string;
  accent?: string;
  accentRate?: number;
  eyeColor?: string;
  art?: QrArtOption;
  customArtUrl?: string;
  frameStyle?: QrFrameStyleOption;
  frameTitle?: string;
  frameSubtitle?: string;
  node?: string;
  clearance?: string;
  footer?: string;
  ecc?: "L" | "M" | "Q" | "H";
};

const EMBLEM_SVG = `<path d="M50 14 L82 50 L50 86 L18 50 Z" fill="none" stroke="CURRENT_FG" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="50" r="10" fill="CURRENT_FG"/><path d="M50 28 V72 M28 50 H72" stroke="CURRENT_BG" stroke-width="4"/>`;

const SEAL_SVG = `<circle cx="50" cy="50" r="44" fill="none" stroke="CURRENT_FG" stroke-width="5"/><circle cx="50" cy="50" r="35" fill="none" stroke="CURRENT_FG" stroke-width="2.5" stroke-dasharray="5 3"/><polygon points="50,20 57,36 74,36 60,47 65,64 50,53 35,64 40,47 26,36 43,36" fill="CURRENT_FG"/>`;

const MARK_SVG = `<path d="M20 25 L50 82 L80 25 H64 L50 56 L36 25 Z" fill="CURRENT_FG"/>`;

function escapeXml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isFinderModule(x: number, y: number, size: number) {
  const inTopLeft = x < 8 && y < 8;
  const inTopRight = x >= size - 8 && y < 8;
  const inBottomLeft = x < 8 && y >= size - 8;
  return inTopLeft || inTopRight || inBottomLeft;
}

function isCenterZone(x: number, y: number, size: number, hasArt: boolean) {
  if (!hasArt) return false;
  const center = (size - 1) / 2;
  const radius = Math.max(3, Math.floor(size * 0.11));
  return Math.abs(x - center) <= radius && Math.abs(y - center) <= radius;
}

function getArtImageSrc(art: QrArtOption, customArtUrl?: string) {
  if (art === "custom" && customArtUrl?.trim()) {
    return customArtUrl.trim();
  }
  if (art === "book-one") {
    return "/brand/book-one-cover.webp";
  }
  if (art === "studio-seal") {
    return "/brand/cradlepoint-studio-seal-city-duality.webp";
  }
  return "";
}

export async function generateArtisticQrSvg(opts: QrGeneratorOptions): Promise<string> {
  const {
    url,
    foreground = "#c9b8d0",
    background = "#0f0f15",
    accent = "#9a3cff",
    accentRate = 0.025,
    eyeColor = "",
    art = "emblem",
    customArtUrl = "",
    frameStyle = "badge",
    frameTitle = "VEILCORP ARCHIVES",
    frameSubtitle = "ACCESS NODE // VERIFIED",
    node = "PUBLIC INTAKE",
    clearance = "OBSERVER",
    footer = "HUMAN AUTHORIZATION PARTIAL. SURVIVAL AUTHORIZATION ACTIVE.",
    ecc: userEcc,
  } = opts;

  const safeFg = contrastRatio(foreground, background) >= 4.0 ? foreground : "#ffffff";
  const safeBg = contrastRatio(foreground, background) >= 4.0 ? background : "#0d1117";
  const safeAccent = accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : "";
  const safeEye = eyeColor && /^#[0-9a-f]{6}$/i.test(eyeColor) ? eyeColor : safeFg;
  const ecc = art !== "none" ? "H" : userEcc || "H";

  const qr = QRCode.create(url, { errorCorrectionLevel: ecc });
  const qrSize = qr.modules.size;
  const quietZone = 3;
  const totalModules = qrSize + quietZone * 2;

  const seed = hashString(url);
  const imageSrc = getArtImageSrc(art, customArtUrl);
  const hasArt = art !== "none";

  // Build module rects
  const rects: string[] = [];
  for (let y = 0; y < qrSize; y++) {
    for (let x = 0; x < qrSize; x++) {
      if (!qr.modules.data[y * qrSize + x]) continue;
      if (isCenterZone(x, y, qrSize, hasArt && (imageSrc !== "" || ["emblem", "seal", "mark"].includes(art)))) {
        continue; // Clear center for art badge
      }

      let fill = safeFg;
      if (isFinderModule(x, y, qrSize)) {
        fill = safeEye;
      } else if (safeAccent && accentRate > 0) {
        const mixed = Math.imul(seed ^ (x * 374761393) ^ (y * 668265263), 2246822519) >>> 0;
        if (mixed / 0xffffffff < accentRate) {
          fill = safeAccent;
        }
      }

      rects.push({ x: x + quietZone, y: y + quietZone, fill } as any);
    }
  }

  // Dimensioning depending on frame style
  if (frameStyle === "poster") {
    const canvasWidth = 1200;
    const canvasHeight = 1600;
    const moduleSize = Math.floor(700 / totalModules);
    const qrPixels = totalModules * moduleSize;
    const qrX = (canvasWidth - qrPixels) / 2;
    const qrY = 320;

    const moduleSvg = (rects as any[]).map((r) =>
      `<rect x="${qrX + r.x * moduleSize}" y="${qrY + r.y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${r.fill}"/>`
    ).join("");

    let centerArtGroup = "";
    if (hasArt) {
      const badgeSize = Math.round(qrPixels * 0.24);
      const bx = qrX + (qrPixels - badgeSize) / 2;
      const by = qrY + (qrPixels - badgeSize) / 2;
      const rx = Math.round(badgeSize * 0.2);

      if (imageSrc) {
        centerArtGroup = `
        <g id="center-art">
          <rect x="${bx}" y="${by}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="4"/>
          <image href="${escapeXml(imageSrc)}" x="${bx + badgeSize * 0.1}" y="${by + badgeSize * 0.1}" width="${badgeSize * 0.8}" height="${badgeSize * 0.8}" preserveAspectRatio="xMidYMid slice"/>
        </g>`;
      } else if (art === "emblem" || art === "seal" || art === "mark") {
        let artPath = "";
        if (art === "emblem") artPath = EMBLEM_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);
        if (art === "seal") artPath = SEAL_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);
        if (art === "mark") artPath = MARK_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);

        centerArtGroup = `
        <g id="center-art">
          <rect x="${bx}" y="${by}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="4"/>
          <g transform="translate(${bx} ${by}) scale(${badgeSize / 100})">${artPath}</g>
        </g>`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img">
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="${safeBg}"/>
  <rect x="50" y="50" width="1100" height="1500" fill="none" stroke="${safeAccent || safeFg}" stroke-width="4" opacity="0.8"/>
  <rect x="70" y="70" width="1060" height="1460" fill="none" stroke="${safeFg}" stroke-width="1" opacity="0.3"/>

  <!-- Frame Marks -->
  <path d="M60 60h80v8H68v72H60V60Z" fill="${safeAccent || safeFg}"/>
  <path d="M1140 60h-80v8h72v72h8V60Z" fill="${safeAccent || safeFg}"/>
  <path d="M60 1540h80v-8H68v-72H60v80Z" fill="${safeAccent || safeFg}"/>
  <path d="M1140 1540h-80v-8h72v-72h8v80Z" fill="${safeAccent || safeFg}"/>

  <g id="poster-header">
    <text x="600" y="160" fill="${safeFg}" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="800" text-anchor="middle" letter-spacing="4">${escapeXml(frameTitle.toUpperCase())}</text>
    <text x="600" y="210" fill="${safeAccent || safeFg}" font-family="Consolas, monospace" font-size="22" text-anchor="middle" letter-spacing="3" opacity="0.9">${escapeXml(frameSubtitle.toUpperCase())}</text>
    <path d="M250 250h700" stroke="${safeAccent || safeFg}" stroke-width="2" stroke-dasharray="16 10"/>
  </g>

  <g id="qr-field">
    <rect x="${qrX - 16}" y="${qrY - 16}" width="${qrPixels + 32}" height="${qrPixels + 32}" fill="${safeBg}" stroke="${safeFg}" stroke-width="3" opacity="0.5"/>
    <rect x="${qrX - 6}" y="${qrY - 6}" width="${qrPixels + 12}" height="${qrPixels + 12}" fill="${safeBg}"/>
    <g id="qr-modules" shape-rendering="crispEdges">${moduleSvg}</g>
    ${centerArtGroup}
  </g>

  <g id="poster-meta">
    <rect x="120" y="1150" width="440" height="120" fill="none" stroke="${safeFg}" stroke-width="2" opacity="0.6"/>
    <text x="150" y="1190" fill="${safeAccent || safeFg}" font-family="Consolas, monospace" font-size="18" letter-spacing="2">NODE</text>
    <text x="150" y="1235" fill="${safeFg}" font-family="Consolas, monospace" font-size="26" font-weight="700">${escapeXml(node.toUpperCase())}</text>

    <rect x="640" y="1150" width="440" height="120" fill="none" stroke="${safeFg}" stroke-width="2" opacity="0.6"/>
    <text x="670" y="1190" fill="${safeAccent || safeFg}" font-family="Consolas, monospace" font-size="18" letter-spacing="2">CLEARANCE LEVEL</text>
    <text x="670" y="1235" fill="${safeFg}" font-family="Consolas, monospace" font-size="26" font-weight="700">${escapeXml(clearance.toUpperCase())}</text>

    <rect x="120" y="1310" width="960" height="60" fill="none" stroke="${safeAccent || safeFg}" stroke-width="1.5" stroke-dasharray="8 6"/>
    <text x="150" y="1348" fill="${safeFg}" font-family="Consolas, monospace" font-size="18" opacity="0.85">STABLE PRINT TARGET // SCAN VERIFICATION ACTIVE</text>
  </g>

  <g id="poster-footer">
    <text x="600" y="1480" fill="${safeFg}" font-family="Consolas, monospace" font-size="20" text-anchor="middle" letter-spacing="2">${escapeXml(footer.toUpperCase())}</text>
  </g>
</svg>`;
  }

  if (frameStyle === "tech-card") {
    const canvasWidth = 900;
    const canvasHeight = 1100;
    const moduleSize = Math.floor(540 / totalModules);
    const qrPixels = totalModules * moduleSize;
    const qrX = (canvasWidth - qrPixels) / 2;
    const qrY = 220;

    const moduleSvg = (rects as any[]).map((r) =>
      `<rect x="${qrX + r.x * moduleSize}" y="${qrY + r.y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${r.fill}"/>`
    ).join("");

    let centerArtGroup = "";
    if (hasArt) {
      const badgeSize = Math.round(qrPixels * 0.24);
      const bx = qrX + (qrPixels - badgeSize) / 2;
      const by = qrY + (qrPixels - badgeSize) / 2;
      const rx = Math.round(badgeSize * 0.18);

      if (imageSrc) {
        centerArtGroup = `
        <g id="center-art">
          <rect x="${bx}" y="${by}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="3"/>
          <image href="${escapeXml(imageSrc)}" x="${bx + badgeSize * 0.1}" y="${by + badgeSize * 0.1}" width="${badgeSize * 0.8}" height="${badgeSize * 0.8}" preserveAspectRatio="xMidYMid slice"/>
        </g>`;
      } else if (art === "emblem" || art === "seal" || art === "mark") {
        let artPath = "";
        if (art === "emblem") artPath = EMBLEM_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);
        if (art === "seal") artPath = SEAL_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);
        if (art === "mark") artPath = MARK_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);

        centerArtGroup = `
        <g id="center-art">
          <rect x="${bx}" y="${by}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="3"/>
          <g transform="translate(${bx} ${by}) scale(${badgeSize / 100})">${artPath}</g>
        </g>`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img">
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="${safeBg}"/>
  <rect x="30" y="30" width="840" height="1040" fill="none" stroke="${safeFg}" stroke-width="2" rx="16"/>
  <rect x="44" y="44" width="812" height="1012" fill="none" stroke="${safeAccent || safeFg}" stroke-width="1" stroke-dasharray="10 8" rx="10" opacity="0.6"/>

  <g id="card-header">
    <text x="70" y="110" fill="${safeFg}" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="700">${escapeXml((frameTitle || "CRADLEPOINT SCANNER").toUpperCase())}</text>
    <text x="70" y="145" fill="${safeAccent || safeFg}" font-family="Consolas, monospace" font-size="18">${escapeXml((frameSubtitle || "DYNAMIC UTILITY NODE").toUpperCase())}</text>
  </g>

  <g id="qr-field">
    <rect x="${qrX - 10}" y="${qrY - 10}" width="${qrPixels + 20}" height="${qrPixels + 20}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="2" rx="8"/>
    <g id="qr-modules" shape-rendering="crispEdges">${moduleSvg}</g>
    ${centerArtGroup}
  </g>

  <g id="card-footer">
    <text x="450" y="850" fill="${safeFg}" font-family="Consolas, monospace" font-size="20" text-anchor="middle" font-weight="600">NODE: ${escapeXml((node || "VEILLINK-01").toUpperCase())}</text>
    <text x="450" y="890" fill="${safeAccent || safeFg}" font-family="Consolas, monospace" font-size="16" text-anchor="middle">CLEARANCE: ${escapeXml((clearance || "UNRESTRICTED").toUpperCase())}</text>
    <rect x="150" y="930" width="600" height="50" fill="none" stroke="${safeFg}" stroke-width="1" rx="6"/>
    <text x="450" y="962" fill="${safeFg}" font-family="Consolas, monospace" font-size="15" text-anchor="middle" opacity="0.8">${escapeXml((footer || "SCAN WITH CAMERA OR HANDHELD SENSOR").toUpperCase())}</text>
  </g>
</svg>`;
  }

  if (frameStyle === "neon") {
    const canvasWidth = 800;
    const canvasHeight = 960;
    const moduleSize = Math.floor(500 / totalModules);
    const qrPixels = totalModules * moduleSize;
    const qrX = (canvasWidth - qrPixels) / 2;
    const qrY = 180;

    const moduleSvg = (rects as any[]).map((r) =>
      `<rect x="${qrX + r.x * moduleSize}" y="${qrY + r.y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${r.fill}"/>`
    ).join("");

    let centerArtGroup = "";
    if (hasArt) {
      const badgeSize = Math.round(qrPixels * 0.24);
      const bx = qrX + (qrPixels - badgeSize) / 2;
      const by = qrY + (qrPixels - badgeSize) / 2;
      const rx = Math.round(badgeSize * 0.22);

      if (imageSrc) {
        centerArtGroup = `
        <g id="center-art">
          <rect x="${bx}" y="${by}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="3"/>
          <image href="${escapeXml(imageSrc)}" x="${bx + badgeSize * 0.1}" y="${by + badgeSize * 0.1}" width="${badgeSize * 0.8}" height="${badgeSize * 0.8}" preserveAspectRatio="xMidYMid slice"/>
        </g>`;
      } else if (art === "emblem" || art === "seal" || art === "mark") {
        let artPath = "";
        if (art === "emblem") artPath = EMBLEM_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);
        if (art === "seal") artPath = SEAL_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);
        if (art === "mark") artPath = MARK_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);

        centerArtGroup = `
        <g id="center-art">
          <rect x="${bx}" y="${by}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="3"/>
          <g transform="translate(${bx} ${by}) scale(${badgeSize / 100})">${artPath}</g>
        </g>`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img">
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="${safeBg}"/>
  <rect x="24" y="24" width="752" height="912" fill="none" stroke="${safeAccent || safeFg}" stroke-width="3" rx="20"/>

  <g id="neon-corners">
    <path d="M44 44h50 M44 44v50" stroke="${safeFg}" stroke-width="4" stroke-linecap="round"/>
    <path d="M756 44h-50 M756 44v50" stroke="${safeFg}" stroke-width="4" stroke-linecap="round"/>
    <path d="M44 916h50 M44 916v-50" stroke="${safeFg}" stroke-width="4" stroke-linecap="round"/>
    <path d="M756 916h-50 M756 916v-50" stroke="${safeFg}" stroke-width="4" stroke-linecap="round"/>
  </g>

  <text x="400" y="110" fill="${safeFg}" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="800" text-anchor="middle" letter-spacing="3">${escapeXml((frameTitle || "VEILDEMOM LINK").toUpperCase())}</text>

  <g id="qr-field">
    <rect x="${qrX - 12}" y="${qrY - 12}" width="${qrPixels + 24}" height="${qrPixels + 24}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="2" rx="12"/>
    <g id="qr-modules" shape-rendering="crispEdges">${moduleSvg}</g>
    ${centerArtGroup}
  </g>

  <text x="400" y="760" fill="${safeAccent || safeFg}" font-family="Consolas, monospace" font-size="18" text-anchor="middle" letter-spacing="2">${escapeXml((frameSubtitle || "SCAN TO ACCESS").toUpperCase())}</text>
  <text x="400" y="810" fill="${safeFg}" font-family="Consolas, monospace" font-size="15" text-anchor="middle" opacity="0.8">${escapeXml((footer || "AUTHENTICATED STABLE TARGET").toUpperCase())}</text>
</svg>`;
  }

  // Default "badge" (Clean QR code canvas)
  const moduleSize = 12;
  const qrPixels = totalModules * moduleSize;
  const moduleSvg = (rects as any[]).map((r) =>
    `<rect x="${r.x * moduleSize}" y="${r.y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${r.fill}"/>`
  ).join("");

  let centerArtGroup = "";
  if (hasArt) {
    const badgeSize = Math.round(qrPixels * 0.24);
    const bx = (qrPixels - badgeSize) / 2;
    const by = (qrPixels - badgeSize) / 2;
    const rx = Math.round(badgeSize * 0.22);

    if (imageSrc) {
      centerArtGroup = `
      <g id="center-art">
        <rect x="${bx}" y="${by}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="3"/>
        <image href="${escapeXml(imageSrc)}" x="${bx + badgeSize * 0.1}" y="${by + badgeSize * 0.1}" width="${badgeSize * 0.8}" height="${badgeSize * 0.8}" preserveAspectRatio="xMidYMid slice"/>
      </g>`;
    } else if (art === "emblem" || art === "seal" || art === "mark") {
      let artPath = "";
      if (art === "emblem") artPath = EMBLEM_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);
      if (art === "seal") artPath = SEAL_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);
      if (art === "mark") artPath = MARK_SVG.replaceAll("CURRENT_FG", safeFg).replaceAll("CURRENT_BG", safeBg);

      centerArtGroup = `
      <g id="center-art">
        <rect x="${bx}" y="${by}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${safeBg}" stroke="${safeAccent || safeFg}" stroke-width="3"/>
        <g transform="translate(${bx} ${by}) scale(${badgeSize / 100})">${artPath}</g>
      </g>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${qrPixels}" height="${qrPixels}" viewBox="0 0 ${qrPixels} ${qrPixels}" role="img">
  <rect width="${qrPixels}" height="${qrPixels}" fill="${safeBg}"/>
  <g id="qr-modules" shape-rendering="crispEdges">${moduleSvg}</g>
  ${centerArtGroup}
</svg>`;
}
