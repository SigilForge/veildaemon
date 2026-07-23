import type { Metadata } from "next";
import Link from "next/link";
import { product } from "@/lib/config";
import { buildMetadata, faqJsonLd, siteConfig, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: `${siteConfig.name} · Dynamic QR Codes & Short Links`,
  description: siteConfig.description,
  path: "/",
  keywords: [
    "print once change QR destination",
    "stable QR code for menus",
    "business QR code short link",
    "editable destination QR",
  ],
});

export default function HomePage() {
  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <section className="hero hero-grid">
        <div>
          <p className="eyebrow">Short links · dynamic QR</p>
          <h1>
            Editable QR codes
            <br />
            without the <em>ransom note</em>.
          </h1>
          <p className="lede">
            Print once. Change the destination whenever the business moves. Your QR stays the same file; the redirect
            behind it updates when you do.
          </p>
          <div className="toolbar">
            <Link className="button" href="/signup">
              Create a free link
            </Link>
            <Link className="button secondary" href="/pricing">
              See pricing
            </Link>
          </div>
          <div className="proof-row" aria-label="Product traits">
            <span className="proof-chip">PNG + SVG downloads</span>
            <span className="proof-chip">Scan counts</span>
            <span className="proof-chip">Pause + expire</span>
            <span className="proof-chip">No fake metrics</span>
          </div>
        </div>

        <aside className="demo-plate" aria-label="How a VeilLink redirect works">
          <a
            className="demo-qr"
            href="https://play.veildaemon.app/"
            target="_blank"
            rel="noopener noreferrer"
            title="Scan or open play.veildaemon.app"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/demo-qr-play.webp?v=20260723-color2"
              alt="Colorful QR code linking to play.veildaemon.app"
              width={688}
              height={688}
              decoding="async"
            />
          </a>
          <div className="demo-meta">
            <strong>One code. Moving target.</strong>
            <span>
              Live demo QR → <a href="https://play.veildaemon.app/" target="_blank" rel="noopener noreferrer">play.veildaemon.app</a>.
              Same idea as a VeilLink: stable print target, editable destination.
            </span>
          </div>
          <div className="demo-flow" aria-hidden="true">
            <b>Printed QR</b>
            <em>→</em>
            <b>play.veildaemon.app</b>
          </div>
          <div className="demo-flow" aria-hidden="true">
            <b>{product.pathHost}/you</b>
            <em>→</em>
            <b>your live URL</b>
          </div>
        </aside>
      </section>

      <section className="section" aria-labelledby="how-heading">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading">A stable front door for destinations that change.</h2>
        </div>
        <div className="steps">
          <article>
            <div>
              <h3>Create a short link</h3>
              <p className="muted">
                Pick a slug on {product.pathHost}. That URL is what the QR encodes—not your current booking page.
              </p>
            </div>
          </article>
          <article>
            <div>
              <h3>Print or share the QR</h3>
              <p className="muted">
                Download PNG or SVG. Stickers, flyers, menus, and tables can use a code that does not age out with the
                first redesign.
              </p>
            </div>
          </article>
          <article>
            <div>
              <h3>Edit the destination later</h3>
              <p className="muted">
                Swap the landing page, pause traffic, or set an expiration—without regenerating every physical print.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="section" aria-label={`${product.name} features`}>
        <div className="section-head">
          <p className="eyebrow">What you get</p>
          <h2>Useful by default. Honest about tradeoffs.</h2>
        </div>
        <div className="grid">
          <div className="panel">
            <p className="panel-kicker">Dynamic redirects</p>
            <h2>Change the target, keep the code</h2>
            <p className="muted">
              The QR points at a VeilLink URL you control. Update the destination when the business does.
            </p>
          </div>
          <div className="panel">
            <p className="panel-kicker">Static truth</p>
            <h2>Static vs dynamic, plain English</h2>
            <p className="muted">
              Static QR files keep working as files. Dynamic redirects depend on this service staying active—we say that
              out loud.
            </p>
          </div>
          <div className="panel">
            <p className="panel-kicker">Operator tools</p>
            <h2>Counts, pause, and expiry</h2>
            <p className="muted">
              Scan totals, pause controls, expiration dates, and short-path or subdomain routing when your plan allows.
            </p>
          </div>
          <div className="panel">
            <p className="panel-kicker">Built for sanity</p>
            <h2>No theatrical SaaS fog</h2>
            <p className="muted">
              No fake customer counts, no mystery lock-in, no pretending a redirect is more magical than it is.
            </p>
          </div>
        </div>
      </section>

      <section className="closing" aria-labelledby="closing-heading">
        <p className="eyebrow">Start small</p>
        <h2 id="closing-heading">Three free active redirects. Upgrade when the wall of stickers gets real.</h2>
        <p className="lede">
          Free is enough to prove the workflow. Pro and Business add capacity when you are past the experiment stage.
        </p>
        <div className="toolbar">
          <Link className="button" href="/signup">
            Start free
          </Link>
          <Link className="button secondary" href="/pricing">
            Compare plans
          </Link>
        </div>
      </section>
    </main>
  );
}
