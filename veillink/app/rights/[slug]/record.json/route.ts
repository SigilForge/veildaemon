import { NextResponse } from "next/server";
import { findRightsRecord, rightsJson } from "@/lib/rights/records";
import { effectiveVerification } from "@/lib/rights/verification";
import { publicVerificationForRecord } from "@/lib/rights/verification-store";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const record = await findRightsRecord(slug);
  if (!record) return NextResponse.json({ ok: false, error: "Rights record not found." }, { status: 404 });
  const verification = await publicVerificationForRecord(record).catch(() => effectiveVerification(record));
  return NextResponse.json(rightsJson(record, verification), {
    headers: {
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
