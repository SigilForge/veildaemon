import type { Metadata } from "next";
import Link from "next/link";
import { plans } from "@/lib/config";
import { buildMetadata, pricingJsonLd, siteConfig } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "QR & Links Pricing",
  description: `${siteConfig.name} QR & Links pricing: free plan with 3 active redirects, Pro at $7/mo, Business at $19/mo.`,
  path: "/links/pricing",
  keywords: [
    "dynamic QR code pricing",
    "cheap editable QR codes",
    "short link subscription",
  ],
});

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

export default function LinksPricingPage() {
  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd()) }}
      />
      <p className="eyebrow">
        <Link href="/links">QR &amp; Links</Link> · Pricing
      </p>
      <h1 className="page-title">Clear tiers. No theatrical plans.</h1>
      <p className="lede">
        Dynamic redirects for editable QR links and short links. Transparent pricing, zero hidden fees. Looking for
        Creator Rights, Book One, or Web Design pricing?{" "}
        <Link href="/pricing">See the full SigilForge pricing catalog</Link>.
      </p>

      <section className="price-grid" aria-label="VeilLink Redirect Plans">
        {Object.values(plans).map((plan) => {
          const copy = planCopy[plan.id as keyof typeof planCopy];
          const featured = plan.id === "pro";
          return (
            <article className={`price-card${featured ? " featured" : ""}`} key={plan.id}>
              {featured ? <span className="price-badge">Most common</span> : null}
              <p className="panel-kicker">{plan.label} Redirects</p>
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
              <Link className="button" href="/signup?next=%2Fdashboard">
                {plan.id === "free" ? "Start free" : `Start ${plan.label}`}
              </Link>
            </article>
          );
        })}
      </section>

      <section className="section panel">
        <h2>Plain-English limits for dynamic redirects</h2>
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
