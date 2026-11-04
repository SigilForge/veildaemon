import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-06-24.dahlia";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe secret key is not configured.");
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      // Next's server build bundles stripe's Node entry, whose default client
      // uses node:https. On Cloudflare Workers that request never settles (the
      // runtime cancels it as hung, Error 1101); fetch works on Workers and Node.
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return stripeClient;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function veillinkIntegrationIdentifier() {
  return "veillink_nqxbtrfp";
}
