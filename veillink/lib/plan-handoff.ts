// Plan intent carried from static marketing CTAs to the right next step.
// Paid plans end at /billing?plan=..., whose buttons POST to
// /api/billing/checkout (the checkout route keeps its own auth); signed-out
// visitors sign up first with that destination as `next`.

export const CHECKOUT_PLANS = ["pro-monthly", "pro-yearly", "business-monthly", "business-yearly"] as const;

export type CheckoutPlan = (typeof CHECKOUT_PLANS)[number];

export function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  return typeof value === "string" && (CHECKOUT_PLANS as readonly string[]).includes(value);
}

/** Where a plan CTA should land: paid plans at their checkout step, anything else at the dashboard. */
export function planHandoffTarget(plan: string | null | undefined, signedIn: boolean) {
  const destination = isCheckoutPlan(plan) ? `/billing?plan=${plan}` : "/dashboard";
  return signedIn ? destination : `/signup?next=${encodeURIComponent(destination)}`;
}
