import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { generateArtisticQrSvg } from "@/lib/qr-generator";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireUser } from "@/lib/store";
import { canGenerateRightsQrAssets } from "@/lib/rights/entitlement";
import {
  defaultRightsQrPreferences,
  parseRightsQrPreferences,
  preferencesFromSearchParams,
  toGeneratorOptions,
  type RightsQrPreferences,
} from "@/lib/rights/qr-options";
import { verifyQrDecodesToUrl } from "@/lib/rights/qr-verify";
import {
  exampleRightsRecords,
  recordIsPublic,
  recordUrl,
  saveOwnedRightsQrPreferences,
} from "@/lib/rights/records";
import type { CreatorRightsRecord } from "@/lib/rights/schema";

function filename(slug: string, extension: string, version?: number | null) {
  const v = version && version > 0 ? `-v${version}` : "";
  return `creator-rights-${slug}${v}.${extension}`;
}

async function getRecord(id: string) {
  const example = exampleRightsRecords.find((record) => record.id === id || record.slug === id);
  try {
    const admin = getSupabaseAdminClient() as any;
    const { data, error } = await admin.from("creator_rights_records").select("*").eq("id", id).maybeSingle();
    if (!error && data) return data as CreatorRightsRecord;
    if (example) return example;
    const bySlug = await admin.from("creator_rights_records").select("*").eq("slug", id).maybeSingle();
    if (!bySlug.error && bySlug.data) return bySlug.data as CreatorRightsRecord;
  } catch {
    return example || null;
  }
  return example || null;
}

function resolvePreferences(record: CreatorRightsRecord, request: NextRequest, bodyPrefs?: unknown): RightsQrPreferences {
  const fromQuery = preferencesFromSearchParams(request.nextUrl.searchParams);
  const merged = {
    ...defaultRightsQrPreferences(record),
    ...(record.qr_preferences && typeof record.qr_preferences === "object" ? record.qr_preferences : {}),
    ...(typeof fromQuery === "object" && fromQuery ? fromQuery : {}),
    ...(bodyPrefs && typeof bodyPrefs === "object" ? bodyPrefs : {}),
  };
  // Drop empty strings so schema defaults apply cleanly.
  for (const [key, value] of Object.entries(merged)) {
    if (value === "" || value === null || value === undefined) {
      if (key === "frameSubtitle") (merged as any)[key] = record.record_id || "ISSUED RECORD";
      else if (key === "clearance") (merged as any)[key] = (record.record_status || "published").toUpperCase();
      else delete (merged as any)[key];
    }
  }
  const safety = parseRightsQrPreferences(merged);
  if (!safety.ok) {
    throw Object.assign(new Error(safety.error), { status: 400 });
  }
  return safety.preferences;
}

async function authorizeAssetAccess(record: CreatorRightsRecord) {
  // Studio example seed records: public default asset only (no owner, no coupon abuse surface).
  if (!record.user_id) {
    if (!recordIsPublic(record)) {
      throw Object.assign(new Error("Rights record not found."), { status: 404 });
    }
    return { kind: "public_example" as const, userId: null as string | null };
  }

  const session = await requireUser().catch(() => null);
  if (!session) {
    throw Object.assign(new Error("Sign in required to download branded Rights Record QR assets."), { status: 401 });
  }
  if (record.user_id !== session.user.id) {
    throw Object.assign(new Error("Rights record not found."), { status: 404 });
  }
  if (!canGenerateRightsQrAssets(record)) {
    throw Object.assign(
      new Error("This Rights Record is not issued yet. Complete publication payment to unlock branded QR downloads."),
      { status: 402 }
    );
  }
  return { kind: "entitled_owner" as const, userId: session.user.id };
}

async function renderRightsQr(record: CreatorRightsRecord, preferences: RightsQrPreferences, format: "svg" | "png") {
  const durableUrl = recordUrl(record.slug);
  // Decode-verify a clean badge matrix with the same payload, colors, and center mark.
  // Framed print assets can include chrome that confuses full-canvas raster decode.
  const probe = await generateArtisticQrSvg(
    toGeneratorOptions({ ...preferences, frameStyle: "badge" }, durableUrl)
  );
  await verifyQrDecodesToUrl(probe, durableUrl);
  const svg = await generateArtisticQrSvg(toGeneratorOptions(preferences, durableUrl));

  if (format === "png") {
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="${filename(record.slug, "png", record.qr_asset_version)}"`,
        "cache-control": "private, no-store",
        "x-rights-entitlement": record.entitlement_status || "active",
        "x-rights-qr-version": String(record.qr_asset_version || 1),
      },
    });
  }

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "content-disposition": `attachment; filename="${filename(record.slug, "svg", record.qr_asset_version)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-rights-entitlement": record.entitlement_status || "active",
      "x-rights-qr-version": String(record.qr_asset_version || 1),
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await getRecord(id);
    if (!record) return NextResponse.json({ ok: false, error: "Rights record not found." }, { status: 404 });

    const access = await authorizeAssetAccess(record);
    const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";

    // Public examples: force safe defaults (no query customization coupon path).
    const preferences =
      access.kind === "public_example"
        ? defaultRightsQrPreferences(record)
        : resolvePreferences(record, request);

    return await renderRightsQr(record, preferences, format);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "QR generation failed." },
      { status: Number.isFinite(status) ? status : 500 }
    );
  }
}

/**
 * Issued-record owners POST preferences to save + download a verified branded asset.
 * Browser redirect success alone never unlocks this — server checks issuance state.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await getRecord(id);
    if (!record) return NextResponse.json({ ok: false, error: "Rights record not found." }, { status: 404 });

    const access = await authorizeAssetAccess(record);
    if (access.kind !== "entitled_owner" || !access.userId) {
      return NextResponse.json(
        { ok: false, error: "This Rights Record is not issued yet. Publish to unlock branded QR downloads." },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const format = body.format === "png" ? "png" : "svg";
    const persist = body.save !== false;
    const preferences = resolvePreferences(record, request, body.preferences || body);

    let active = record;
    if (persist) {
      active = await saveOwnedRightsQrPreferences(access.userId, record.id, preferences);
    }

    return await renderRightsQr(active, preferences, format);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "QR generation failed." },
      { status: Number.isFinite(status) ? status : 500 }
    );
  }
}
