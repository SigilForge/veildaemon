import { NextRequest, NextResponse } from "next/server";
import { product } from "@/lib/config";
import { requireUser } from "@/lib/store";
import { getStripeClient, veillinkIntegrationIdentifier } from "@/lib/stripe";

const prices: Record<string, string | undefined> = {
  "pro-monthly": process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  "pro-yearly": process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  "business-monthly": process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
  "business-yearly": process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID,
};

export async function POST(request: NextRequest) {
  const { user } = await requireUser();
  const form = await request.formData();
  const requestedPlan = String(form.get("plan") || "pro-monthly");
  const priceId = prices[requestedPlan];
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !priceId) {
    return NextResponse.json({ ok: false, error: "Stripe checkout is not configured." }, { status: 503 });
  }
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${product.appUrl}/billing?checkout=success`,
    cancel_url: `${product.appUrl}/pricing?checkout=cancelled`,
    metadata: { user_id: user.id, requested_plan: requestedPlan },
    integration_identifier: veillinkIntegrationIdentifier(),
  });
  return NextResponse.redirect(session.url || `${product.appUrl}/billing`, 303);
}
