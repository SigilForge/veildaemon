import type { Metadata } from "next";
import Link from "next/link";
import { plans, product } from "@/lib/config";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Simple ${product.name} pricing for dynamic QR codes and short links. Free to start, Pro and Business when you need more active redirects.`,
};

const rows = [
  ["Dynamic redirects", "3 active", "100 active", "1,000 active"],
  ["Editable destinations", "Yes", "Yes", "Yes"],
  ["Analytics", "Total count", "Basic dashboard", "Basic dashboard"],
  ["Expiration dates", "No", "Yes", "Yes"],
  ["Path links", "Yes", "Yes", "Yes"],
  ["Wildcard subdomain links", "No", "Yes", "Yes"],
  ["Custom domains", "No", "No", "Planned"],
];

const planCopy = {
  free: {
    blurb: "Prove the workflow on a few codes before you print a crate of stickers.",
    features: ["3 active redirects", "Editable destinations", "Total scan count", "Path links on go.veildaemon.app"],
  },
  pro: {
    blurb: "The default for shops, venues, and creators who actually ship printed materials.",
    features: [
      "100 active redirects",
      "Basic analytics dashboard",
      "Expiration dates",
      "Path + subdomain routing",
    ],
  },
  business: {
    blurb: "More headroom when you are running campaigns, locations, or a messy multi-code inventory.",
    features: [
      "1,000 active redirects",
      "Basic analytics dashboard",
      "Expiration dates",
      "Path + subdomain routing",
      "Custom domains planned",
    ],
  },
} as const;

export default function PricingPage() {
  return (
    <main className="page">
      <p className="eyebrow">Pricing</p>
      <h1 className="page-title">Clear plans. No theatrical tiers.</h1>
      <p className="lede">
        A dynamic QR code is just a QR pointing at an editable redirect. Useful, honest, and much less dramatic than most
        subscription pages make it sound.
      </p>

      <section className="price-grid" aria-label="Plans">
        {Object.values(plans).map((plan) => {
          const copy = planCopy[plan.id as keyof typeof planCopy];
          const featured = plan.id === "pro";
          return (
            <article className={`price-card${featured ? " featured" : ""}`} key={plan.id}>
              {featured ? <span className="price-badge">Most common</span> : null}
              <p className="panel-kicker">{plan.label}</p>
              <p className="amount">
                {plan.monthlyPrice ? (
                  <>
                    ${plan.monthlyPrice}
                    <span>/mo</span>
                  </>
                ) : (
                  <>$0</>
                )}
              </p>
              <p className="muted">
                {plan.yearlyPrice ? `$${plan.yearlyPrice}/yr if you prefer annual` : "Start small. Upgrade later."}
              </p>
              <p>{copy.blurb}</p>
              <ul>
                {copy.features.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="button" href="/signup">
                {plan.id === "free" ? "Start free" : `Start ${plan.label}`}
              </Link>
            </article>
          );
        })}
      </section>

      <section className="section panel">
        <h2>Plain-English limits</h2>
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th>Pro</th>
                <th>Business</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell) => (
                    <td key={`${row[0]}-${cell}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Exported static QR files are yours. Dynamic redirects depend on the service remaining active. Paid checkout and
          subscription management are handled through Stripe; webhook-driven billing state supplies the signal for plan
          changes and cancellation.
        </p>
      </section>
    </main>
  );
}
