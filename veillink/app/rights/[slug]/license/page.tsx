import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { findRightsRecord } from "@/lib/rights/records";
import { publicLicenseShape, publicRegistryFrameworkShape } from "@/lib/rights/license-catalog";
import { effectiveVerification, verificationClaimFor, verificationLevelLabel } from "@/lib/rights/verification";
import { publicVerificationForRecord } from "@/lib/rights/verification-store";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = await findRightsRecord(slug);
  return buildMetadata({
    title: record ? `License inquiry for ${record.title}` : "License inquiry",
    description: "Request commercial, research, dataset, adaptation, or AI-use licensing from the rights holder.",
    path: `/rights/${slug}/license`,
    noIndex: true,
  });
}

export default async function LicenseInquiryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = await findRightsRecord(slug);
  if (!record) notFound();
  const verification = await publicVerificationForRecord(record).catch(() => effectiveVerification(record));
  const copyrightLicense = publicLicenseShape(record.copyright_license_id);
  const registryFramework = publicRegistryFrameworkShape(record.registry_framework_id, record.registry_framework_version);

  return (
    <main className="page">
      <p className="eyebrow">License inquiry</p>
      <h1 className="page-title">{record.title}</h1>
      <p className="lede">This route defines the inquiry shape without exposing the rights holder&apos;s private contact address.</p>
      <section className="panel rights-verification-panel">
        <p className="panel-kicker">Verification</p>
        <h2>{verificationLevelLabel(verification.level)}</h2>
        <p className="muted">{verification.statement || verificationClaimFor(verification.level)}</p>
      </section>
      <section className="grid license-composition-public">
        <article className="panel">
          <p className="panel-kicker">Primary License</p>
          <h2>{copyrightLicense.name}</h2>
          <p className="muted">{copyrightLicense.summary}</p>
          <dl className="rights-facts compact-facts">
            <div><dt>SPDX</dt><dd>{copyrightLicense.spdxId || "Not applicable"}</dd></div>
            <div>
              <dt>License URL</dt>
              <dd>
                <a href={copyrightLicense.url} target="_blank" rel="noopener noreferrer">
                  {copyrightLicense.url}
                </a>
              </dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <p className="panel-kicker">Registry Framework</p>
          <h2>{registryFramework.name} ({registryFramework.shortName}) v{registryFramework.version}</h2>
          <p className="muted">{registryFramework.summary}</p>
          <p className="notice">{registryFramework.supplementalNotice}</p>
        </article>
      </section>
      <form className="form rights-form" aria-describedby="license-disabled-note">
        <label>Requester name<input name="requester_name" required /></label>
        <label>Company<input name="company" /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Intended use<textarea name="intended_use" rows={4} required /></label>
        <label>AI use type<input name="ai_use_type" /></label>
        <label>Commercial or research<select name="use_class"><option>Commercial</option><option>Research</option><option>Mixed</option></select></label>
        <label>Dataset size<input name="dataset_size" /></label>
        <label>Expected duration<input name="expected_duration" /></label>
        <label>Distribution plan<textarea name="distribution_plan" rows={3} /></label>
        <label>Budget range<input name="budget_range" /></label>
        <label className="full">Notes<textarea name="notes" rows={4} /></label>
        <button type="button" disabled>Inquiry storage pending</button>
      </form>
      <p id="license-disabled-note" className="notice">
        Public inquiry storage and creator notification are intentionally disabled until the deployed storage, rate-limit,
        and notification path is verified.
      </p>
    </main>
  );
}
