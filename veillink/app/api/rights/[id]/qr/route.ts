import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { generateArtisticQrSvg } from "@/lib/qr-generator";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { exampleRightsRecords, recordUrl } from "@/lib/rights/records";
import type { CreatorRightsRecord } from "@/lib/rights/schema";

function filename(slug: string, extension: string) {
  return `creator-rights-${slug}.${extension}`;
}

async function getRecord(id: string) {
  const example = exampleRightsRecords.find((record) => record.id === id || record.slug === id);
  try {
    const admin = getSupabaseAdminClient() as any;
    const { data, error } = await admin.from("creator_rights_records").select("*").eq("id", id).maybeSingle();
    if (!error && data) return data as CreatorRightsRecord;
  } catch {
    return example || null;
  }
  return example || null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await getRecord(id);
  if (!record) return NextResponse.json({ ok: false, error: "Rights record not found." }, { status: 404 });
  const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const svg = await generateArtisticQrSvg({
    url: recordUrl(record.slug),
    art: "seal",
    frameStyle: "tech-card",
    frameTitle: "CREATOR RIGHTS RECORD",
    frameSubtitle: record.record_id || "DRAFT",
    node: "RIGHTS REGISTRY",
    clearance: record.record_status.toUpperCase(),
    footer: "PUBLIC NOTICE // RIGHTS POSITION DECLARED BY CREATOR",
  });

  if (format === "png") {
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return new NextResponse(pngBuffer, {
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="${filename(record.slug, "png")}"`,
        "cache-control": "private, no-store",
      },
    });
  }

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "content-disposition": `attachment; filename="${filename(record.slug, "svg")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
