import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { plans } from "@/lib/config";
import { buildMetadata } from "@/lib/seo";
import { formatRedirectUsage } from "@/lib/policy";
import { isCheckoutPlan } from "@/lib/plan-handoff";
import { getUsage, requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Billing",
  description: "Manage your VeilLink subscription and plan limits.",
  path: "/billing",
  noIndex: true,
});

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams;
  // A plan picked on a pricing CTA (via /start); kept through login so the purchase isn't lost.
  const requested = isCheckoutPlan(params.plan) ? params.plan : null;
  const self = requested ? `/billing?plan=${requested}` : "/billing";
  const { profile, user } = await requireUser().catch(() => redirect(`/login?next=${encodeURIComponent(self)}`));
  const usage = await getUsage(user.id, profile.plan, { role: profile.role, email: profile.email || user.email });
  const plan = plans[profile.plan];
  const chosen = requested ? plans[requested.split("-")[0] as keyof typeof plans] : null;
  return (
    <main className="page">
      <h1 className="page-title">Billing</h1>
      {chosen && profile.plan !== chosen.id ? (
        <section className="panel">
          <h2>Upgrade to {chosen.label}</h2>
          <p className="muted">
            ${chosen.monthlyPrice}/mo, or ${chosen.yearlyPrice}/yr. Checkout is handled by Stripe.
          </p>
          <div className="toolbar">
            <form action="/api/billing/checkout" method="post"><button name="plan" value={`${chosen.id}-monthly`}>Continue to checkout · monthly</button></form>
            <form action="/api/billing/checkout" method="post"><button className="secondary" name="plan" value={`${chosen.id}-yearly`}>Continue to checkout · yearly</button></form>
          </div>
        </section>
      ) : null}
      <section className="panel">
        <h2>{plan.label}</h2>
        <p className="muted">Usage: {formatRedirectUsage(usage.activeRedirects, usage.limit)}</p>
        <p>Billing status: {profile.billing_status}</p>
        <div className="toolbar">
          <form action="/api/billing/checkout" method="post"><button name="plan" value="pro-monthly">Upgrade to Pro</button></form>
          <form action="/api/billing/portal" method="post"><button className="secondary" type="submit">Manage billing</button></form>
        </div>
        <p className="muted">Stripe checkout and portal routes are present, but they require Stripe keys, price IDs, and a webhook secret before they can process real subscriptions.</p>
      </section>
    </main>
  );
}
