import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { findRightsRecord } from "@/lib/rights/records";
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
