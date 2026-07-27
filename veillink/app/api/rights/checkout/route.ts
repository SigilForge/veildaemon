import { NextRequest, NextResponse } from "next/server";
import { product } from "@/lib/config";
import { requireUser } from "@/lib/store";
import { getStripeClient, veillinkIntegrationIdentifier } from "@/lib/stripe";
import { RIGHTS_PURCHASE_TYPE, canCreateCheckout } from "@/lib/rights/lifecycle";
import { attachRightsCheckoutSession, getOwnedRightsRecord } from "@/lib/rights/records";

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

async function recordIdFromRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return String(body.recordId || "").trim();
  }
  const form = await request.formData();
  return String(form.get("recordId") || "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const priceId = process.env.RIGHTS_STRIPE_PRICE_ID;
    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
      return NextResponse.json({ ok: false, error: "Creator Rights checkout is not configured." }, { status: 503 });
    }

    const recordId = await recordIdFromRequest(request);
    if (!recordId) return NextResponse.json({ ok: false, error: "Rights record id is required." }, { status: 400 });

    const record = await getOwnedRightsRecord(user.id, recordId);
    if (!canCreateCheckout(record.record_status)) {
      return NextResponse.json({ ok: false, error: "Rights record is not eligible for checkout." }, { status: 409 });
    }
    if (record.stripe_checkout_session_id && record.record_status === "pending_payment") {
      return NextResponse.json({ ok: false, error: "Rights record already has a pending Checkout Session." }, { status: 409 });
    }

    const stripe = getStripeClient();
    const appUrl = product.appUrl.replace(/\/$/, "");
    const successUrl = process.env.RIGHTS_SUCCESS_URL || `${appUrl}/account/rights?checkout=success`;
    const cancelUrl = process.env.RIGHTS_CANCEL_URL || `${appUrl}/account/rights?checkout=cancelled`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        rights_record_uuid: record.id,
        owner_user_id: user.id,
        purchase_type: RIGHTS_PURCHASE_TYPE,
      },
      custom_text: {
        submit: {
          message:
            "Creator Rights Records document declared ownership, rights position, and licensing preferences. They do not replace government registration or independently prove legal ownership.",
        },
      },
      integration_identifier: veillinkIntegrationIdentifier(),
    });

    await attachRightsCheckoutSession(user.id, record.id, session.id);
    return NextResponse.redirect(session.url || successUrl, 303);
  } catch (error) {
    return jsonError(error);
  }
}
