import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { RIGHTS_DISCLAIMER, RIGHTS_PRICE_CENTS } from "@/lib/rights/schema";
import { exampleRightsRecords, recordUrl } from "@/lib/rights/records";

export const metadata: Metadata = buildMetadata({
  title: "Creator Rights Records",
  description: "Create permanent rights records with AI-use terms, licensing contact paths, QR targets, and JSON metadata.",
  path: "/rights",
  image: "https://veildaemon.app/studio/assets/social/creator-rights-record-og.webp",
  imageAlt: "Creator Rights Record verification card from SigilForge Studios",
  imageWidth: 1200,
  imageHeight: 675,
  noIndex: false,
});

export default function RightsIndexPage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">SigilForge Rights</p>
        <h1>Creator Rights Records</h1>
        <p className="lede">
          A paid record for declared ownership, licensing terms, AI permissions, and a stable URL creators can place in
          books, decks, packets, and product pages.
        </p>
        <div className="toolbar">
          <Link className="button" href="/rights/create">
            Create a permanent record
          </Link>
          <a className="button secondary" href="https://veildaemon.app/studio/creator-rights/" target="_blank" rel="noopener noreferrer">
            Public overview
          </a>
        </div>
      </section>

      <section className="notice">
        <strong>${(RIGHTS_PRICE_CENTS / 100).toFixed(2)} per published record.</strong> {RIGHTS_DISCLAIMER}
      </section>

      <section className="section" aria-labelledby="records-heading">
        <div className="section-head">
          <p className="eyebrow">Published records</p>
          <h2 id="records-heading">Records from the Studio shelf.</h2>
        </div>
        <div className="grid">
          {exampleRightsRecords.map((record) => (
            <article className="panel" key={record.id}>
              <p className="panel-kicker">{record.record_id}</p>
              <h2>{record.title}</h2>
              <p className="muted">{record.ai_permissions_summary}</p>
              <div className="toolbar">
                <Link className="button secondary" href={`/rights/${record.slug}`}>
                  App record
                </Link>
                <a className="button secondary" href={recordUrl(record.slug)} target="_blank" rel="noopener noreferrer">
                  Public URL
                </a>
                {record.source_url ? (
                  <a className="button secondary" href={record.source_url} target="_blank" rel="noopener noreferrer">
                    View project
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
