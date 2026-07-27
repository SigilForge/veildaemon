import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";
import { listOwnedRightsRecords, recordUrl } from "@/lib/rights/records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = buildMetadata({
  title: "Rights Records",
  description: "Manage Creator Rights Record drafts, published records, QR downloads, and update status.",
  path: "/account/rights",
  noIndex: true,
});

export default async function AccountRightsPage() {
  const { user } = await requireUser().catch(() => redirect("/login?next=/account/rights"));
  const records = await listOwnedRightsRecords(user.id).catch(() => []);

  return (
    <main className="page">
      <p className="eyebrow">Account</p>
      <h1 className="page-title">Rights Records</h1>
      <p className="lede">Drafts remain private. Published records receive permanent IDs, QR targets, JSON metadata, and immutable snapshots.</p>
      <div className="toolbar">
        <Link className="button" href="/rights/create">Create record</Link>
        <a className="button secondary" href="https://veildaemon.app/studio/creator-rights/" target="_blank" rel="noopener noreferrer">Public overview</a>
      </div>

      <section className="section">
        {records.length ? (
          <div className="grid">
            {records.map((record) => (
              <article className="panel" key={record.id}>
                <p className="panel-kicker">{record.record_id || "Draft ID pending"} · {record.record_status}</p>
                <h2>{record.title}</h2>
                <p className="muted">{record.ai_permissions_summary}</p>
                <div className="toolbar">
                  <Link className="button secondary" href={`/rights/${record.slug}`}>Preview</Link>
                  <a className="button secondary" href={recordUrl(record.slug)} target="_blank" rel="noopener noreferrer">Public URL</a>
                  <a className="button secondary" href={`/api/rights/${record.id}/qr?format=svg`}>QR SVG</a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel">
            <p className="panel-kicker">No records yet</p>
            <h2>Create the first draft.</h2>
            <p className="muted">The dashboard is ready for drafts once the migration is applied to Supabase.</p>
          </div>
        )}
      </section>
    </main>
  );
}
