import { NextResponse } from "next/server";
import { requireUser } from "@/lib/store";

export async function POST() {
  try {
    await requireUser();
    return NextResponse.json(
      {
        ok: false,
        error:
          "Creator Rights checkout is scaffolded but not configured. Publishing must wait for a Stripe Checkout Session and webhook-confirmed payment.",
      },
      { status: 503 }
    );
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
  }
}
