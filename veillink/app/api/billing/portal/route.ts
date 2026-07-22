import { NextResponse } from "next/server";
import { product } from "@/lib/config";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireUser } from "@/lib/store";
import { getStripeClient } from "@/lib/stripe";

export async function POST() {
  const { user } = await requireUser();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Stripe portal is not configured." }, { status: 503 });

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("billing_customer_id").eq("id", user.id).single();
  if (!profile?.billing_customer_id) {
    return NextResponse.json({ ok: false, error: "No Stripe customer is linked yet." }, { status: 409 });
  }
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.billing_customer_id,
    return_url: `${product.appUrl}/billing`,
  });
  return NextResponse.redirect(session.url, 303);
}
