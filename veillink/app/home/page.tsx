import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { RIGHTS_PRODUCT_ADVISOR_PATH, RIGHTS_PRODUCT_REGISTRY_PATH } from "@/lib/rights/product-nav";
import { listOwnedRightsRecords } from "@/lib/rights/records";
import { getUsage, requireUser } from "@/lib/store";

export const metadata: Metadata = buildMetadata({
  title: "Home",
  description: "Your SigilForge identity: connected play, Book One, Creator Rights, QR & links, and account.",
  path: "/home",
  noIndex: true,
});

export default async function VeilLinkHomePage() {
  const { user, profile } = await requireUser().catch(() => redirect("/login?next=/home"));
  const [usage, rightsRecords] = await Promise.all([
    getUsage(user.id, profile.plan).catch(() => null),
    listOwnedRightsRecords(user.id).catch(() => null),
  ]);

  return (
    <main className="page">
      <p className="eyebrow">Signed in as {user.email}</p>
      <h1 className="page-title">VeilLink</h1>
      <p className="lede">
        Your SigilForge identity, ownership, and connection layer. Everything below runs on this one account.
      </p>
      <section className="grid">
        <div className="panel">
          <h2>Connected Play</h2>
          <p className="muted">
            Operator and Handler entry points. Cell connection and VeilLink sign-in happen inside the play surface
            itself.
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
          <h2>Book One</h2>
          <p className="muted">
            The Anchor and the Glitch, direct digital edition. Purchase or open your existing downloads.
          </p>
          <p>
            <Link className="button secondary" href="/book-one">
              Open Book One
            </Link>
          </p>
        </div>
        <div className="panel">
          <h2>Creator Rights</h2>
          <p className="muted">
            {rightsRecords
              ? `${rightsRecords.length} record${rightsRecords.length === 1 ? "" : "s"} on this account.`
              : "Registry records, the free Advisor, and Creator Dossiers."}
          </p>
          <div className="toolbar">
            <Link className="button secondary" href={RIGHTS_PRODUCT_REGISTRY_PATH}>
              Registry
            </Link>
            <Link className="button secondary" href={RIGHTS_PRODUCT_ADVISOR_PATH}>
              Advisor
            </Link>
          </div>
        </div>
        <div className="panel">
          <h2>QR &amp; Links</h2>
          <p className="muted">
            {usage
              ? `${usage.activeRedirects} of ${usage.limit} active redirects.`
              : "Dynamic QR codes and short links: create, edit destinations, download, and track scans."}
          </p>
          <p>
            <Link className="button secondary" href="/dashboard">
              Open QR &amp; Links
            </Link>
          </p>
        </div>
        <div className="panel">
          <h2>Account &amp; Billing</h2>
          <p className="muted">Plan, payment, data export, and sign-out.</p>
          <div className="toolbar">
            <Link className="button secondary" href="/account">
              Account
            </Link>
            <Link className="button secondary" href="/billing">
              Billing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
