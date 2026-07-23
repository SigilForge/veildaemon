import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { publicPathUrl, publicSubdomainUrl } from "@/lib/config";
import { getOwnedRedirect, requireUser } from "@/lib/store";
import { generateArtisticQrSvg } from "@/lib/qr-generator";
import type { QrArtOption, QrFrameStyleOption } from "@/lib/types";

function filename(slug: string, extension: string) {
  return `veillink-${slug}.${extension}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser();
  const { id } = await context.params;
  const redirect = await getOwnedRedirect(user.id, id);
  const searchParams = request.nextUrl.searchParams;

  const format = searchParams.get("format") === "png" ? "png" : "svg";
  const art = (searchParams.get("art") || redirect.qr_art || "emblem") as QrArtOption;
  const frameStyle = (searchParams.get("frame") || redirect.qr_frame_style || "badge") as QrFrameStyleOption;

  const foreground = searchParams.get("fg") || redirect.qr_foreground;
  const background = searchParams.get("bg") || redirect.qr_background;
  const accent = searchParams.get("accent") || redirect.qr_accent || "";
  const eyeColor = searchParams.get("eye") || redirect.qr_eye_color || "";
  const customArtUrl = searchParams.get("customArt") || redirect.qr_custom_art_url || "";

  const frameTitle = searchParams.get("title") || redirect.qr_frame_title || redirect.name || "VEILCORP ARCHIVES";
  const frameSubtitle = searchParams.get("subtitle") || redirect.qr_frame_subtitle || "ACCESS NODE // VERIFIED";
  const node = searchParams.get("node") || redirect.qr_node || "PUBLIC INTAKE";
  const clearance = searchParams.get("clearance") || redirect.qr_clearance || "OBSERVER";
  const footer = searchParams.get("footer") || redirect.qr_footer || "HUMAN AUTHORIZATION PARTIAL. SURVIVAL AUTHORIZATION ACTIVE.";

  const stableUrl = redirect.routing_mode === "subdomain" ? publicSubdomainUrl(redirect.slug) : publicPathUrl(redirect.slug);

  const finalSvg = await generateArtisticQrSvg({
    url: stableUrl,
    foreground,
    background,
    accent,
    eyeColor,
    art,
    customArtUrl,
    frameStyle,
    frameTitle,
    frameSubtitle,
    node,
    clearance,
    footer,
    ecc: redirect.qr_ecc,
  });

  if (format === "png") {
    const pngBuffer = await sharp(Buffer.from(finalSvg))
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
