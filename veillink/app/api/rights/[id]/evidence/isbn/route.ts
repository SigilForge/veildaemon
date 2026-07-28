import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/store";
import { attachIsbnEvidence } from "@/lib/rights/verification-store";

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : "ISBN evidence request failed." },
    { status: Number.isFinite(status) ? status : 500 }
  );
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await attachIsbnEvidence(user.id, id, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
