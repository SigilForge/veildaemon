import type { Metadata } from "next";
import Link from "next/link";
import { plans } from "@/lib/config";
import { RIGHTS_PRICE_CENTS, RIGHTS_PRICE_LABEL } from "@/lib/rights/schema";
import { RIGHTS_PRODUCT_ADVISOR_PATH, RIGHTS_PRODUCT_CREATE_PATH, RIGHTS_PRODUCT_STUDIO_OVERVIEW } from "@/lib/rights/product-nav";
import { buildMetadata, siteConfig } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Pricing",
  description: `SigilForge Studios pricing across every product on one identity: Book One at $9.99, Creator Rights Records at ${money(RIGHTS_PRICE_CENTS)} one-time, QR & Links from free, and Web Design from $250.`,
  path: "/pricing",
  keywords: [
    "SigilForge Studios pricing",
    "VeilLink pricing",
    "creator rights record CRR pricing",
    "dynamic QR code pricing",
    "web design pricing",
  ],
});

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PricingPage() {
  return (
    <main className="page">
      <p className="eyebrow">Pricing</p>
      <h1 className="page-title">What SigilForge Studios sells, and what it costs.</h1>
      <p className="lede">
        One SigilForge identity, several products. This page is the catalog — each product keeps its own detailed
        pricing and checkout where it already lives; this page summarizes and routes you there.
      </p>

      <section className="section" aria-labelledby="publishing-pricing-heading">
        <div className="section-head">
          <p className="eyebrow">Publishing</p>
          <h2 id="publishing-pricing-heading">Book One and the wider TTRPG line.</h2>
        </div>
        <div className="grid">
          <div className="panel">
            <p className="panel-kicker">Direct digital</p>
            <h2>Book One — $9.99 launch sale price</h2>
            <p className="muted">
              CradlePoint: VeilSight. DRM-free PDF, EPUB, and MOBI, plus a wallpaper pack, kept in your VeilLink
              account.
            </p>
            <p>
              <Link className="button secondary" href="/book-one">
                Get Book One
              </Link>
            </p>
          </div>
          <div className="panel">
            <p className="panel-kicker">Tabletop line</p>
            <h2>TTRPG products</h2>
            <p className="muted">
              CradlePoint tabletop releases, dossiers, and Studio editions ship through the itch storefront — current
              pricing lives there, not here.
            </p>
            <p>
              <a className="button secondary" href="https://play.veildaemon.app/" target="_blank" rel="noopener noreferrer">
                See TTRPG products
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="section panel rights-pricing-section" aria-labelledby="rights-pricing-heading" style={{ marginTop: "2.5rem" }}>
        <p className="eyebrow" id="rights-pricing-heading">Creator Rights · SFR</p>
        <h2>SigilForge Rights (SFR) — Creator Rights Records (CRR)</h2>
        <p className="lede" style={{ fontSize: "1rem", margin: "0.25rem 0 1.25rem" }}>
          A standalone, creator-declared publication record with machine-readable AI permissions, SHA-256 fingerprinting,
          versioned evidence, QR verification, and Creator Dossier export under the SigilForge Rights Framework (SFR). Covered by a single one-time lifetime license.
        </p>

        <article className="price-card featured" style={{ maxWidth: "100%", width: "100%" }}>
          <span className="price-badge">{RIGHTS_PRICE_LABEL} · One-Time Lifetime License</span>
          <p className="panel-kicker">SigilForge Rights Registry</p>
          <p className="amount">
            {money(RIGHTS_PRICE_CENTS)}
            <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "var(--muted)" }}> / one-time per record</span>
          </p>
          <p className="muted">
            Founders pricing covers each CRR with permanent hosting of the record, public verification page, Creator Dossier generation, and future access. Zero recurring subscription fees required.
          </p>
          <ul style={{ margin: "1.25rem 0" }}>
            <li><strong>One-time payment</strong> — no recurring monthly or annual subscription fees to keep your record active</li>
            <li><strong>Permanent hosted record</strong> &amp; public verification page at <code>/rights/&lt;slug&gt;</code></li>
            <li><strong>Machine-readable AI permissions</strong> for training, fine-tuning, retrieval, and commercial licensing</li>
            <li><strong>SHA-256 file fingerprinting</strong> &amp; branded QR verification assets</li>
            <li><strong>Creator Dossier export</strong> for publisher review, dispute intake, procurement, or archival delivery</li>
            <li><strong>Portable by design</strong> — export a complete, self-contained Creator Dossier (ZIP package with JSON metadata, evidence manifests, and SHA-256 fingerprints) anytime so your evidence stays in your control independent of platform hosting</li>
            <li><strong>Free public Advisor</strong> available without an account to inspect files and compare SPDX licenses</li>
          </ul>
          <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
            <Link className="button" href={RIGHTS_PRODUCT_CREATE_PATH}>
              Preserve rights record
            </Link>
            <Link className="button secondary" href={RIGHTS_PRODUCT_ADVISOR_PATH}>
              Open public Advisor
            </Link>
            <a className="button secondary" href={RIGHTS_PRODUCT_STUDIO_OVERVIEW} target="_blank" rel="noopener noreferrer">
              SigilForge Rights overview
            </a>
          </div>
        </article>
      </section>

      <section className="section" aria-labelledby="links-pricing-heading" style={{ marginTop: "2.5rem" }}>
        <div className="section-head">
          <p className="eyebrow">QR &amp; Links</p>
          <h2 id="links-pricing-heading">Dynamic redirects, from free.</h2>
        </div>
        <div className="grid">
          {Object.values(plans).map((plan) => (
            <div className="panel" key={plan.id}>
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
              <p className="muted">{plan.activeRedirectLimit.toLocaleString()} active redirects</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: "1rem" }}>
          <Link className="button secondary" href="/links/pricing">
            See full QR &amp; Links pricing &amp; feature comparison
          </Link>
        </p>
      </section>

      <section className="section" aria-labelledby="client-services-heading" style={{ marginTop: "2.5rem" }}>
        <div className="section-head">
          <p className="eyebrow">Client Services</p>
          <h2 id="client-services-heading">Web Design.</h2>
        </div>
        <div className="panel">
          <p className="muted">
            Small-business web design and monthly care plans, scoped and billed on the Studio site — the pricing below
            is a summary; the authoritative packages, terms, and checkout live at{" "}
            <a href="https://veildaemon.app/studio/web-design/" target="_blank" rel="noopener noreferrer">
              /studio/web-design/
            </a>
            .
          </p>
          <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))", marginTop: "1rem" }}>
            <div>
              <p className="panel-kicker">Build</p>
              <ul>
                <li>Launch Page — from $250</li>
                <li>Business — from $500</li>
                <li>Custom — from $900</li>
              </ul>
            </div>
            <div>
              <p className="panel-kicker">Care · monthly</p>
              <ul>
                <li>Website Care — $40/mo</li>
                <li>Business Care — $75/mo</li>
                <li>Growth Partner — $150/mo</li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: "1rem" }}>
            <a className="button secondary" href="https://veildaemon.app/studio/web-design/" target="_blank" rel="noopener noreferrer">
              See Web Design packages &amp; book
            </a>
          </p>
        </div>
      </section>

      <p className="note" style={{ marginTop: "2rem" }}>
        {siteConfig.name} is the account and identity layer across SigilForge Studios. Paid checkout and subscription
        management for each product above are handled by that product&apos;s own surface, not this page.
      </p>
    </main>
  );
}
