import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { audit } from "@/lib/store";
import { getStripeClient } from "@/lib/stripe";

function planFromPrice(priceId: string | null | undefined) {
  if (!priceId) return "free";
  if ([process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID, process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID].includes(priceId)) return "business";
  if ([process.env.STRIPE_PRO_MONTHLY_PRICE_ID, process.env.STRIPE_PRO_YEARLY_PRICE_ID].includes(priceId)) return "pro";
  return "free";
}

async function claimStripeEvent(admin: ReturnType<typeof getSupabaseAdminClient>, event: Stripe.Event) {
  const { error } = await admin.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
  });
  if (!error) return true;

  if (error.code !== "23505") throw error;

  const { data, error: readError } = await admin
    .from("stripe_webhook_events")
    .select("processed_at")
    .eq("id", event.id)
    .single();
  if (readError) throw readError;
  return !data?.processed_at;
}

async function markStripeEventProcessed(admin: ReturnType<typeof getSupabaseAdminClient>, event: Stripe.Event) {
  await admin
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString(), last_error: null })
    .eq("id", event.id);
}

async function markStripeEventFailed(admin: ReturnType<typeof getSupabaseAdminClient>, event: Stripe.Event, error: unknown) {
  await admin
    .from("stripe_webhook_events")
    .update({ last_error: error instanceof Error ? error.message : "Unknown webhook processing error." })
    .eq("id", event.id);
}

export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!key || !secret || !signature) {
    return NextResponse.json({ ok: false, error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid Stripe signature." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const shouldProcess = await claimStripeEvent(admin, event);
  if (!shouldProcess) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (userId && session.customer && session.subscription) {
        await admin.from("profiles").update({
          billing_provider: "stripe",
          billing_customer_id: String(session.customer),
          billing_subscription_id: String(session.subscription),
          billing_status: "active",
        }).eq("id", userId);
        await audit(userId, "billing.checkout.completed", "profile", userId, { provider: "stripe", stripe_event_id: event.id });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;
      await admin.from("profiles").update({
        plan: subscription.status === "active" ? planFromPrice(priceId) : "free",
        billing_status: subscription.status,
        billing_subscription_id: subscription.id,
      }).eq("billing_customer_id", String(subscription.customer));
    }

    await markStripeEventProcessed(admin, event);
  } catch (error) {
    await markStripeEventFailed(admin, event, error);
    throw error;
  }

  return NextResponse.json({ received: true });
}
