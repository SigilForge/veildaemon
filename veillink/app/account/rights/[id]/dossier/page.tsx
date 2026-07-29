import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";
import { CreatorDossierBuilderFields } from "@/components/CreatorDossierBuilderFields";
import { evidenceClassDescriptions, dossierPurposeValues, type DossierPurpose } from "@/lib/rights/dossier";
import { publicLicenseShape, publicRegistryFrameworkShape } from "@/lib/rights/license-catalog";
import { getOwnedRightsRecord, recordUrl } from "@/lib/rights/records";
import { availabilityLabel, permissionLabel, workTypeLabel } from "@/lib/rights/schema";
import { effectiveVerification, verificationLevelLabel } from "@/lib/rights/verification";
import { listVerificationState } from "@/lib/rights/verification-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = buildMetadata({
  title: "Build Creator Dossier",
  description: "Generate a professional dossier from a Creator Rights Record.",
  path: "/account/rights",
  noIndex: true,
});

function selectedPurpose(value: string | string[] | undefined): DossierPurpose {
  const raw = Array.isArray(value) ? value[0] : value;
  return dossierPurposeValues.includes(raw as DossierPurpose) ? (raw as DossierPurpose) : "publisher";
}

export default async function BuildDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser().catch(() => redirect("/login?next=/account/rights"));
  const { id } = await params;
  const query = await searchParams;
  let record;
  try {
    record = await getOwnedRightsRecord(user.id, id);
  } catch {
    notFound();
  }
  const purpose = selectedPurpose(query.purpose);
  const verification = await listVerificationState(record, true)
    .then((state) => state.projection)
    .catch(() => effectiveVerification(record));
  const license = publicLicenseShape(record.copyright_license_id);
  const framework = publicRegistryFrameworkShape(record.registry_framework_id, record.registry_framework_version);
  const canonicalUrl = recordUrl(record.slug);
  const fingerprintCount = record.sha256_hash ? 1 : 0;

  return (
    <main className="page creator-dossier-page">
      <p className="eyebrow">Creator Dossier</p>
      <h1 className="page-title">Build Creator Dossier</h1>
      <p className="lede">
        Generate a professionally organized record of this work&apos;s ownership declarations, publication history,
        licenses, identifiers, provenance, verification status, and selected supporting documents.
      </p>
      <p className="notice">One work. One record. One professional dossier.</p>

      <div className="toolbar">
        <Link className="button secondary" href="/account/rights">
          Back to portal
        </Link>
        <Link className="button secondary" href={`/rights/${record.slug}`}>
          View record
        </Link>
      </div>

      <form className="form rights-form dossier-builder" action={`/api/rights/${record.id}/dossier/export`} method="post">
        <CreatorDossierBuilderFields initialPurpose={purpose} />

        <section className="form-step full">
          <div className="form-step-head">
            <p className="eyebrow">Step 3</p>
            <h2>Supporting documents</h2>
          </div>
          <p className="notice full">
            Secure attachment upload is intentionally deferred. This first dossier uses the canonical record, current
            verification projection, identifiers, and stored artifact fingerprints. Private documents are not made public
            by this flow.
          </p>
          <div className="preflight-summary full">
            <div><span>Selected attachments</span><strong>0</strong></div>
            <div><span>Stored fingerprints</span><strong>{fingerprintCount}</strong></div>
            <div><span>Visibility</span><strong>Private by default</strong></div>
          </div>
        </section>

        <section className="form-step full">
          <div className="form-step-head">
            <p className="eyebrow">Step 4</p>
            <h2>Timeline and classification</h2>
          </div>
          <div className="dossier-class-grid full">
            {Object.entries(evidenceClassDescriptions).map(([key, value]) => (
              <article className="panel" key={key}>
                <p className="panel-kicker">{key.replace(/_/g, " ")}</p>
                <p className="muted">{value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="form-step review-step full">
          <div className="form-step-head">
            <p className="eyebrow">Step 5</p>
            <h2>Review and generate</h2>
          </div>
          <div className="preflight-summary">
            <div><span>Title</span><strong>{record.title}</strong></div>
            <div><span>Work</span><strong>{workTypeLabel(record.work_type)} · {availabilityLabel(record.availability)}</strong></div>
            <div><span>Rights holder</span><strong>{record.rights_holder_name}</strong></div>
            <div><span>Primary license</span><strong>{license.shortName}{license.spdxId ? ` · ${license.spdxId}` : ""}</strong></div>
            <div><span>Registry framework</span><strong>{framework.shortName} v{framework.version}</strong></div>
            <div><span>Verification</span><strong>{verificationLevelLabel(verification.level)}</strong></div>
            <div><span>AI permissions</span><strong>{record.ai_permissions_summary}</strong></div>
            <div><span>Canonical URL</span><strong>{canonicalUrl}</strong></div>
          </div>
          <div className="toolbar">
            <button name="format" value="package" type="submit">
              Download dossier package
            </button>
            <button name="format" value="html" type="submit">
              Download Creator Dossier HTML
            </button>
            <button className="button secondary" name="format" value="manifest" type="submit">
              Download JSON manifest
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
