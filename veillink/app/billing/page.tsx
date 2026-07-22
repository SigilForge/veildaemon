import { redirect } from "next/navigation";
import { getUsage, requireUser } from "@/lib/store";
import { plans } from "@/lib/config";

export default async function BillingPage() {
  const { profile, user } = await requireUser().catch(() => redirect("/login"));
  const usage = await getUsage(user.id, profile.plan);
  const plan = plans[profile.plan];
  return (
    <main className="page">
      <h1 className="page-title">Billing</h1>
      <section className="panel">
        <h2>{plan.label}</h2>
        <p className="muted">Usage: {usage.activeRedirects} / {usage.limit} active redirects</p>
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
