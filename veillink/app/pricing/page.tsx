import type { Metadata } from "next";
import Link from "next/link";
import { plans } from "@/lib/config";
import { RIGHTS_PRICE_CENTS } from "@/lib/rights/schema";
import { buildMetadata, pricingJsonLd, siteConfig } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Pricing — Dynamic Redirects & SigilForge Rights (SFR)",
  description: `${siteConfig.name} pricing: free plan with 3 active redirects, Pro at $7/mo, Business at $19/mo, plus one-time Creator Rights Records ($9.99 lifetime Registry license) under the SigilForge Rights Framework (SFR).`,
  path: "/pricing",
  keywords: [
    "dynamic QR code pricing",
    "cheap editable QR codes",
    "short link subscription",
    "SigilForge Rights SFR",
    "creator rights record CRR pricing",
    "creator rights registry cost",
    "lifetime rights record license",
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

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PricingPage() {
  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd()) }}
      />
      <p className="eyebrow">Pricing</p>
      <h1 className="page-title">Clear products. No theatrical tiers.</h1>
      <p className="lede">
        Dynamic redirects for editable QR links, plus one-time Creator Rights Records for durable publication provenance.
        Transparent pricing, zero hidden fees.
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
              <Link className="button" href="/signup">
                {plan.id === "free" ? "Start free" : `Start ${plan.label}`}
              </Link>
            </article>
          );
        })}
      </section>

      <section className="section panel rights-pricing-section" style={{ marginTop: "2.5rem" }}>
        <p className="eyebrow">Standalone Product · SFR</p>
        <h2>SigilForge Rights (SFR) — Creator Rights Records (CRR)</h2>
        <p className="lede" style={{ fontSize: "1rem", margin: "0.25rem 0 1.25rem" }}>
          A standalone, creator-declared publication record with machine-readable AI permissions, SHA-256 fingerprinting,
          versioned evidence, QR verification, and Creator Dossier export under the SigilForge Rights Framework (SFR). Covered by a single one-time lifetime license.
        </p>

        <article className="price-card featured" style={{ maxWidth: "100%", width: "100%" }}>
          <span className="price-badge">One-Time Lifetime License</span>
          <p className="panel-kicker">SigilForge Rights Registry</p>
          <p className="amount">
            {money(RIGHTS_PRICE_CENTS)}
            <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "var(--muted)" }}> / one-time per record</span>
          </p>
          <p className="muted">
            Each CRR includes permanent hosting of the record, public verification page, Creator Dossier generation, and future access. Zero recurring subscription fees required.
          </p>
          <ul style={{ margin: "1.25rem 0" }}>
            <li><strong>One-time payment</strong> — no recurring monthly or annual subscription fees to keep your record active</li>
            <li><strong>Permanent hosted record</strong> &amp; public verification page at <code>/rights/&lt;slug&gt;</code></li>
            <li><strong>Machine-readable AI permissions</strong> for training, fine-tuning, retrieval, and commercial licensing</li>
            <li><strong>SHA-256 file fingerprinting</strong> &amp; branded QR verification assets</li>
            <li><strong>Creator Dossier export</strong> for publisher review, dispute intake, procurement, or archival delivery</li>
            <li><strong>Free public Advisor</strong> available without an account to inspect files and compare SPDX licenses</li>
          </ul>
          <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
            <Link className="button" href="/rights/create">
              Preserve rights record
            </Link>
            <Link className="button secondary" href="/rights/advisor">
              Open public Advisor
            </Link>
            <a className="button secondary" href="https://veildaemon.app/studio/creator-rights/" target="_blank" rel="noopener noreferrer">
              SigilForge Rights overview
            </a>
          </div>
        </article>
        <p className="note" style={{ marginTop: "1rem", fontSize: "0.8125rem" }}>
          Registry fees support long-term record storage, verification infrastructure, maintenance, and the continued operation of this independent creator-focused service under the SigilForge Rights Framework. Each CRR is covered by a single one-time lifetime Registry license.
        </p>
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
