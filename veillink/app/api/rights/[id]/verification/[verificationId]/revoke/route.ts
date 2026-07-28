import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/store";
import { revokeVerificationEvidence } from "@/lib/rights/verification-store";

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : "Verification revoke failed." },
    { status: Number.isFinite(status) ? status : 500 }
  );
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string; verificationId: string }> }) {
  try {
    const { user } = await requireUser();
    const { id, verificationId } = await context.params;
    const result = await revokeVerificationEvidence(user.id, id, verificationId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
