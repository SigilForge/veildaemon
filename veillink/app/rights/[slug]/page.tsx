import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { generateArtisticQrSvg } from "@/lib/qr-generator";
import { RIGHTS_DISCLAIMER, availabilityLabel, categoryLabel, categoryOrDefault, permissionLabel, workTypeLabel } from "@/lib/rights/schema";
import { findRightsRecord, permissionEntries, recordUrl, rightsJsonLd } from "@/lib/rights/records";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = await findRightsRecord(slug);
  if (!record) return buildMetadata({ title: "Rights record not found", description: "Creator Rights Record unavailable.", path: `/rights/${slug}`, noIndex: true });
  return buildMetadata({
    title: `${record.title} Rights, Copyright and AI Use Record`,
    description: `View the declared copyright, ownership, licensing terms, AI permissions, and recorded version for ${record.title} by ${record.public_display_name || record.creator_name}.`,
    path: `/rights/${record.slug}`,
    image: "https://veildaemon.app/assets/social/creator-rights-record-og.webp",
    imageAlt: "Creator Rights Record verification card from SigilForge Studios",
    imageWidth: 1200,
    imageHeight: 675,
    keywords: [
      "AI permissions",
      "copyright metadata",
      "creator rights",
      "digital publication verification",
      "digital provenance",
      "machine-readable license",
      "publication record",
      "rights metadata",
      "SHA-256 file verification",
      "version history for creative work",
    ],
    noIndex: record.record_status === "draft",
  });
}

export default async function RightsRecordPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = await findRightsRecord(slug);
  if (!record) notFound();
  const stableUrl = recordUrl(record.slug);
  const qrSvg = await generateArtisticQrSvg({
    url: stableUrl,
    art: "emblem",
    frameStyle: "tech-card",
    frameTitle: "CREATOR RIGHTS RECORD",
    frameSubtitle: record.record_id || "DRAFT",
    node: "SIGILFORGE RIGHTS",
    clearance: record.record_status.toUpperCase(),
    footer: "PUBLIC NOTICE // RIGHTS POSITION DECLARED BY CREATOR",
  }).then((svg) => svg.replace(/^<\?xml[^>]*>\s*/, ""));
  const publishedDate = record.published_at ? new Date(record.published_at).toLocaleDateString("en-US") : "Draft";
  const publicationDate = record.publication_date
    ? new Date(`${record.publication_date}T00:00:00.000Z`).toLocaleDateString("en-US", { timeZone: "UTC" })
    : "Not specified";
  const purchaseUrl = record.slug === "the-anchor-and-the-glitch" ? "https://app.veildaemon.app/book-one" : null;

  return (
    <main className="page rights-record-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(rightsJsonLd(record)) }} />
      <section className="hero">
        <p className="eyebrow">Creator Rights Record</p>
        <h1>{record.title}</h1>
        <p className="lede">{record.description}</p>
        <dl className="record-meta-row">
          <div><dt>Record ID</dt><dd>{record.record_id || "Draft ID pending"}</dd></div>
          <div><dt>Published</dt><dd>{publicationDate}</dd></div>
          <div><dt>Status</dt><dd>Verified Publication Record</dd></div>
          <div><dt>Version</dt><dd>1</dd></div>
        </dl>
        <div className="proof-row">
          <span className="proof-chip status-chip">Active Record</span>
          <span className="proof-chip">{workTypeLabel(record.work_type)}</span>
          <span className="proof-chip">{categoryLabel(categoryOrDefault(record.category))}</span>
          <span className="proof-chip">{availabilityLabel(record.availability)}</span>
          <span className="proof-chip">{record.edition || "Version not specified"}</span>
        </div>
      </section>

      <section className="rights-record-grid">
        <article className="panel">
          <p className="panel-kicker">Declared position</p>
          <h2>{record.rights_holder_name}</h2>
          <dl className="rights-facts">
            <div><dt>Creator</dt><dd>{record.public_display_name || record.creator_name}</dd></div>
            <div><dt>Work type</dt><dd>{workTypeLabel(record.work_type)}</dd></div>
            <div><dt>Category</dt><dd>{categoryLabel(categoryOrDefault(record.category))}</dd></div>
            <div><dt>Recorded</dt><dd>{publishedDate}</dd></div>
            <div><dt>Publication</dt><dd>{publicationDate}</dd></div>
            <div><dt>Availability</dt><dd>{availabilityLabel(record.availability)}</dd></div>
            <div><dt>Identifier</dt><dd>{record.external_identifier || record.record_id || "Draft ID pending"}</dd></div>
          </dl>
          <p>{record.rights_statement}</p>
          <div className="toolbar">
            {record.source_url ? (
              <a className="button secondary" href={record.source_url} target="_blank" rel="noopener noreferrer">
                View project
              </a>
            ) : null}
            {purchaseUrl ? (
              <a className="button secondary" href={purchaseUrl} target="_blank" rel="noopener noreferrer">
                Buy publication
              </a>
            ) : null}
          </div>
        </article>

        <aside className="panel rights-qr-panel">
          <p className="panel-kicker">Stable record URL</p>
          <div className="rights-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="muted">{stableUrl}</p>
          <div className="toolbar">
            <a className="button secondary" href={`/api/rights/${record.id}/qr?format=svg`}>
              SVG
            </a>
            <a className="button secondary" href={`/api/rights/${record.id}/qr?format=png`}>
              PNG
            </a>
            <Link className="button secondary" href={`/rights/${record.slug}/record.json`}>
              JSON
            </Link>
          </div>
        </aside>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">AI permissions</p>
          <h2>Machine-readable terms, translated for humans.</h2>
        </div>
        <p className="lede">{record.ai_permissions_summary}</p>
        <div className="permission-grid">
          {permissionEntries(record).map((entry) => (
            <div className="permission-row" key={entry.key}>
              <span>{entry.label}</span>
              <strong>{entry.value}</strong>
            </div>
          ))}
          <div className="permission-row">
            <span>Human commercial license</span>
            <strong>{permissionLabel(record.human_commercial_license_available)}</strong>
          </div>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <p className="panel-kicker">Revision history</p>
          <h2>Version 1</h2>
          <p className="muted">Published {publicationDate}. Initial immutable snapshot; updates create a new version rather than rewriting this one.</p>
        </article>
        <article className="panel">
          <p className="panel-kicker">Fingerprint</p>
          <h2>{record.sha256_hash ? "File hash recorded" : "No file hash on this record"}</h2>
          <p className="muted">
            {record.sha256_hash
              ? `SHA-256 ${record.sha256_hash}`
              : "A creator may associate a SHA-256 fingerprint with a record. The hash proves association with the record at the listed time, not authorship."}
          </p>
        </article>
        <article className="panel">
          <p className="panel-kicker">Licensing</p>
          <h2>Request a license</h2>
          <p className="muted">Use the inquiry route for commercial, research, dataset, adaptation, or AI-use requests.</p>
          <Link className="button secondary" href={`/rights/${record.slug}/license`}>
            Request a license
          </Link>
        </article>
      </section>

      <p className="notice">{RIGHTS_DISCLAIMER}</p>
    </main>
  );
}
