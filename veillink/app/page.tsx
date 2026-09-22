import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";
import { RIGHTS_PRODUCT_ADVISOR_PATH, RIGHTS_PRODUCT_REGISTRY_PATH } from "@/lib/rights/product-nav";
import { login } from "./(auth)/actions";

export const metadata: Metadata = buildMetadata({
  // The root page shares its segment with the root layout, so title.template does NOT
  // apply here (only to nested child routes) -- write the full resolved title directly.
  title: "VeilLink · SigilForge Studios",
  description:
    "VeilLink is the account, ownership, and identity layer across SigilForge Studios: connected play, Book One, Creator Rights, and QR & Links.",
  path: "/",
});

export default function PortalPage() {
  return (
    <main className="page">
      <section className="hero hero-grid">
        <div>
          <p className="eyebrow">VeilLink</p>
          <h1>One account across SigilForge Studios.</h1>
          <p className="lede">
            Sign in to access your purchases, Creator Rights records, connected play identity, QR &amp; links, and
            account tools — one SigilForge identity for everything below.
          </p>
        </div>
        <figure className="portal-hero-art">
          <Image
            src="/brand/hero-veillink.webp"
            alt="A single identity radiating out to connected play, Creator Rights, QR codes, and account records"
            width={1672}
            height={941}
            priority
            sizes="(max-width: 900px) 100vw, 45vw"
          />
        </figure>
      </section>

      <section className="section" aria-labelledby="portal-doors-heading">
        <div className="section-head">
          <p className="eyebrow">What VeilLink covers</p>
          <h2 id="portal-doors-heading">Five products. One identity.</h2>
        </div>
        <div className="hero-grid">
          <div className="grid">
            <div className="panel">
              <h2>Connected Play</h2>
              <p className="muted">
                Your identity for Operator + Handler and Connect to Cell. Cell connection and sign-in happen inside
                the play surface itself.
              </p>
              <div className="toolbar">
                <a className="button secondary" href="https://veildaemon.app/operator/">
                  Open Operator
                </a>
                <a className="button secondary" href="https://veildaemon.app/handler/">
                  Open Handler
                </a>
              </div>
            </div>
            <div className="panel">
              <h2>Book One / Library</h2>
              <p className="muted">Purchase and recover The Anchor and the Glitch direct digital edition.</p>
              <p>
                <Link className="button secondary" href="/book-one">
                  Get Book One
                </Link>
              </p>
            </div>
            <div className="panel">
              <h2>Creator Rights</h2>
              <p className="muted">Create, manage, verify, and license permanent rights records.</p>
              <div className="toolbar">
                <Link className="button secondary" href={RIGHTS_PRODUCT_REGISTRY_PATH}>
                  Registry
                </Link>
                <Link className="button secondary" href={RIGHTS_PRODUCT_ADVISOR_PATH}>
                  Free Advisor
                </Link>
              </div>
            </div>
            <div className="panel">
              <h2>QR &amp; Links</h2>
              <p className="muted">Stable QR codes, editable destinations, downloads, and scan records.</p>
              <p>
                <Link className="button secondary" href="/links">
                  Manage QR &amp; Links
                </Link>
              </p>
            </div>
            <div className="panel">
              <h2>Account &amp; Billing</h2>
              <p className="muted">Identity, plan, purchases, and billing — sign in to manage them.</p>
              <p>
                <Link className="button secondary" href="/login?next=%2Faccount">
                  Account
                </Link>
              </p>
            </div>
          </div>
          <AuthForm embedded title="Log in" action={login} submit="Log in" next="/home" />
        </div>
      </section>

      <section className="closing" aria-labelledby="closing-heading">
        <p className="eyebrow">New here</p>
        <h2 id="closing-heading">Create a free account to start on any of the above.</h2>
        <p className="lede">
          One account, one SigilForge identity. Start from whichever product brought you here — the rest stay one
          sign-in away.
        </p>
        <div className="toolbar">
          <Link className="button" href="/signup">
            Create a free account
          </Link>
          <Link className="button secondary" href="/pricing">
            See QR &amp; Links pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
