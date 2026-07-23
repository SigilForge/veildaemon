import { NextResponse } from "next/server";
import { product } from "@/lib/config";
import { requireUser } from "@/lib/store";
import { getStripeClient, veillinkIntegrationIdentifier } from "@/lib/stripe";

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

export async function POST() {
  try {
    const { user } = await requireUser();
    const priceId = process.env.BOOK_ONE_STRIPE_PRICE_ID;
    const claimUrl = process.env.BOOK_ONE_CLAIM_URL || "https://api.veildaemon.app/api/book-one/claim";
    const cancelUrl = process.env.BOOK_ONE_CANCEL_URL || "https://veildaemon.app/studio/shelf/book-one/";

    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
      return NextResponse.json({ ok: false, error: "Book One checkout is not configured." }, { status: 503 });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${claimUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        product_key: "book_one_pdf",
        user_id: user.id,
      },
      integration_identifier: veillinkIntegrationIdentifier(),
    });

    return NextResponse.redirect(session.url || `${product.appUrl}/book-one`, 303);
  } catch (error) {
    return jsonError(error);
  }
}
