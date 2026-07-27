import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getStripeClient } from "@/lib/stripe";
import {
  RIGHTS_PURCHASE_TYPE,
  customerIdFromSession,
  paymentIntentIdFromSession,
  validateRightsCheckoutSession,
} from "@/lib/rights/lifecycle";
import {
  markRightsCheckoutExpired,
  publishRightsRecordFromCheckout,
} from "@/lib/rights/records";
import { RIGHTS_PRICE_CENTS } from "@/lib/rights/schema";
import type { CreatorRightsRecord } from "@/lib/rights/schema";

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
    .update({ last_error: error instanceof Error ? error.message : "Unknown rights webhook processing error." })
    .eq("id", event.id);
}

async function getRightsRecord(admin: ReturnType<typeof getSupabaseAdminClient>, id: string) {
  const { data, error } = await (admin as any)
    .from("creator_rights_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as CreatorRightsRecord | null;
}

async function processCompletedSession(stripe: Stripe, admin: ReturnType<typeof getSupabaseAdminClient>, session: Stripe.Checkout.Session) {
  const priceId = process.env.RIGHTS_STRIPE_PRICE_ID;
  if (!priceId) throw new Error("Creator Rights Stripe price is not configured.");

  const metadata = session.metadata || {};
  if (metadata.purchase_type !== RIGHTS_PURCHASE_TYPE) return;
  const recordId = String(metadata.rights_record_uuid || "");
  const ownerUserId = String(metadata.owner_user_id || "");
  if (!recordId || !ownerUserId) throw new Error("Creator Rights Stripe metadata is incomplete.");

  const record = await getRightsRecord(admin, recordId);
  if (!record) throw new Error("Creator Rights record not found for Checkout Session.");

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  validateRightsCheckoutSession(record, session, lineItems.data, {
    priceId,
    amount: RIGHTS_PRICE_CENTS,
    currency: "usd",
  });

  await publishRightsRecordFromCheckout({
    recordId: record.id,
    ownerUserId,
    checkoutSessionId: session.id,
    paymentIntentId: paymentIntentIdFromSession(session),
    stripeCustomerId: customerIdFromSession(session) || null,
    amountPaid: session.amount_total || RIGHTS_PRICE_CENTS,
    currency: (session.currency || "usd").toLowerCase(),
    paymentStatus: "paid",
  });
}

async function processExpiredSession(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  if (metadata.purchase_type !== RIGHTS_PURCHASE_TYPE) return;
  const recordId = String(metadata.rights_record_uuid || "");
  if (!recordId) throw new Error("Creator Rights expired Checkout Session is missing record metadata.");
  await markRightsCheckoutExpired(recordId, session.id);
}

export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.RIGHTS_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!key || !secret || !signature) {
    return NextResponse.json({ ok: false, error: "Creator Rights Stripe webhook is not configured." }, { status: 503 });
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
      await processCompletedSession(stripe, admin, event.data.object as Stripe.Checkout.Session);
    }
    if (event.type === "checkout.session.expired") {
      await processExpiredSession(event.data.object as Stripe.Checkout.Session);
    }
    await markStripeEventProcessed(admin, event);
  } catch (error) {
    await markStripeEventFailed(admin, event, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Creator Rights webhook failed." },
      { status: 400 }
    );
  }

  return NextResponse.json({ received: true });
}
