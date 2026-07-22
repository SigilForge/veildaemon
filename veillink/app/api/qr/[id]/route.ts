import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { publicPathUrl, publicSubdomainUrl } from "@/lib/config";
import { getOwnedRedirect, requireUser } from "@/lib/store";
import { contrastRatio } from "@/lib/validation";

function filename(slug: string, extension: string) {
  return `veillink-${slug}.${extension}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser();
  const { id } = await context.params;
  const redirect = await getOwnedRedirect(user.id, id);
  const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const stableUrl = redirect.routing_mode === "subdomain" ? publicSubdomainUrl(redirect.slug) : publicPathUrl(redirect.slug);
  const foreground = redirect.qr_foreground;
  const background = redirect.qr_background;
  const safeForeground = contrastRatio(foreground, background) >= 4.5 ? foreground : "#111827";
  const safeBackground = contrastRatio(foreground, background) >= 4.5 ? background : "#ffffff";

  if (format === "png") {
    const png = await QRCode.toBuffer(stableUrl, {
      errorCorrectionLevel: redirect.qr_ecc,
      margin: 4,
      width: 1200,
      color: { dark: safeForeground, light: safeBackground },
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="${filename(redirect.slug, "png")}"`,
        "cache-control": "private, no-store",
      },
    });
  }

  const svg = await QRCode.toString(stableUrl, {
    type: "svg",
    errorCorrectionLevel: redirect.qr_ecc,
    margin: 4,
    color: { dark: safeForeground, light: safeBackground },
  });
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "content-disposition": `attachment; filename="${filename(redirect.slug, "svg")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
