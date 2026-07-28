import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/store";
import { createVerificationChallenge, listVerificationState } from "@/lib/rights/verification-store";
import { getOwnedRightsRecord } from "@/lib/rights/records";

function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ ok: false, error: error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
  }
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : "Verification request failed." },
    { status: Number.isFinite(status) ? status : 500 }
  );
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await context.params;
    const record = await getOwnedRightsRecord(user.id, id);
    const state = await listVerificationState(record, true);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await createVerificationChallenge(user.id, id, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
