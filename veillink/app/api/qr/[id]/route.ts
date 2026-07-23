import sharp from "sharp";
import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { publicPathUrl, publicSubdomainUrl } from "@/lib/config";
import { getOwnedRedirect, requireUser } from "@/lib/store";
import { contrastRatio } from "@/lib/validation";

function filename(slug: string, extension: string) {
  return `veillink-${slug}.${extension}`;
}

const EMBLEM_SVG = `<path d="M50 14 L82 50 L50 86 L18 50 Z" fill="none" stroke="CURRENT_FG" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="50" r="10" fill="CURRENT_FG"/><path d="M50 28 V72 M28 50 H72" stroke="CURRENT_BG" stroke-width="4"/>`;

const SEAL_SVG = `<circle cx="50" cy="50" r="44" fill="none" stroke="CURRENT_FG" stroke-width="5"/><circle cx="50" cy="50" r="35" fill="none" stroke="CURRENT_FG" stroke-width="2.5" stroke-dasharray="5 3"/><polygon points="50,20 57,36 74,36 60,47 65,64 50,53 35,64 40,47 26,36 43,36" fill="CURRENT_FG"/>`;

const MARK_SVG = `<path d="M20 25 L50 82 L80 25 H64 L50 56 L36 25 Z" fill="CURRENT_FG"/>`;

function embedCenterArt(svgString: string, artType: string, foreground: string, background: string) {
  if (!artType || artType === "none") return svgString;

  const viewBoxMatch = svgString.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/i);
  const width = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 100;

  const badgeSize = Math.round(width * 0.22);
  const x = (width - badgeSize) / 2;
  const y = (width - badgeSize) / 2;
  const rx = Math.round(badgeSize * 0.22);
  const strokeWidth = Math.max(1.5, Math.round(width / 120));

  let artPath = "";
  if (artType === "emblem") {
    artPath = EMBLEM_SVG.replaceAll("CURRENT_FG", foreground).replaceAll("CURRENT_BG", background);
  } else if (artType === "seal") {
    artPath = SEAL_SVG.replaceAll("CURRENT_FG", foreground).replaceAll("CURRENT_BG", background);
  } else if (artType === "mark") {
    artPath = MARK_SVG.replaceAll("CURRENT_FG", foreground).replaceAll("CURRENT_BG", background);
  } else {
    return svgString;
  }

  const artGroup = `
  <g id="qr-center-art">
    <rect x="${x}" y="${y}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" fill="${background}" stroke="${foreground}" stroke-width="${strokeWidth}"/>
    <g transform="translate(${x} ${y}) scale(${badgeSize / 100})">
      ${artPath}
    </g>
  </g>
</svg>`;

  return svgString.replace("</svg>", artGroup);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser();
  const { id } = await context.params;
  const redirect = await getOwnedRedirect(user.id, id);
  const searchParams = request.nextUrl.searchParams;

  const format = searchParams.get("format") === "png" ? "png" : "svg";
  const art = (searchParams.get("art") || "none").toLowerCase();

  const customFg = searchParams.get("fg");
  const customBg = searchParams.get("bg");

  const foreground = customFg && /^#[0-9a-f]{6}$/i.test(customFg) ? customFg : redirect.qr_foreground;
  const background = customBg && /^#[0-9a-f]{6}$/i.test(customBg) ? customBg : redirect.qr_background;

  const safeForeground = contrastRatio(foreground, background) >= 4.5 ? foreground : "#111827";
  const safeBackground = contrastRatio(foreground, background) >= 4.5 ? background : "#ffffff";
  const ecc = art !== "none" ? "H" : redirect.qr_ecc;

  const stableUrl = redirect.routing_mode === "subdomain" ? publicSubdomainUrl(redirect.slug) : publicPathUrl(redirect.slug);

  const rawSvg = await QRCode.toString(stableUrl, {
    type: "svg",
    errorCorrectionLevel: ecc,
    margin: 4,
    color: { dark: safeForeground, light: safeBackground },
  });

  const finalSvg = embedCenterArt(rawSvg, art, safeForeground, safeBackground);

  if (format === "png") {
    const pngBuffer = await sharp(Buffer.from(finalSvg))
      .resize(1200, 1200, { kernel: "nearest" })
      .png()
      .toBuffer();

    return new NextResponse(pngBuffer, {
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="${filename(redirect.slug, "png")}"`,
        "cache-control": "private, no-store",
      },
    });
  }

  return new NextResponse(finalSvg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "content-disposition": `attachment; filename="${filename(redirect.slug, "svg")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
