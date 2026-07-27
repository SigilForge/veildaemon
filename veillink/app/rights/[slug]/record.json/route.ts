import { NextResponse } from "next/server";
import { findRightsRecord, rightsJson } from "@/lib/rights/records";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const record = await findRightsRecord(slug);
  if (!record) return NextResponse.json({ ok: false, error: "Rights record not found." }, { status: 404 });
  return NextResponse.json(rightsJson(record), {
    headers: {
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
