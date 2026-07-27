import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { requireUser } from "@/lib/store";
import { RIGHTS_DISCLAIMER, permissionValues, workTypes } from "@/lib/rights/schema";

export const metadata: Metadata = buildMetadata({
  title: "Create a Creator Rights Record",
  description: "Create a draft rights record with ownership, licensing, AI permissions, and optional file fingerprint metadata.",
  path: "/rights/create",
  noIndex: true,
});

const permissionFields = [
  ["generalTraining", "General AI training"],
  ["foundationModelPretraining", "Foundation-model pretraining"],
  ["fineTuning", "Fine-tuning"],
  ["embeddings", "Embeddings"],
  ["rag", "Retrieval-augmented generation"],
  ["generation", "Text or image generation"],
  ["datasetRedistribution", "Dataset redistribution"],
  ["researchUse", "Research use"],
  ["commercialUse", "Commercial use"],
  ["attributionRequired", "Attribution required"],
  ["licenseRequired", "License required"],
] as const;

function optionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
}

export default async function CreateRightsRecordPage() {
  const { user } = await requireUser().catch(() => redirect("/login?next=/rights/create"));

  return (
    <main className="page">
      <p className="eyebrow">Creator Rights Record</p>
      <h1 className="page-title">Create draft</h1>
      <p className="lede">
        Enter the declared rights position, review the generated AI-use summary, then publish only after verified payment.
      </p>
      <p className="notice">{RIGHTS_DISCLAIMER}</p>

      <form className="form rights-form" action="/api/rights/create" method="post">
        <input type="hidden" name="email" value={user.email || ""} />
        <label>Creator name<input name="creatorName" required /></label>
        <label>Public display name<input name="publicDisplayName" required /></label>
        <label>Rights-holder name<input name="rightsHolderName" required /></label>
        <label>Work title<input name="title" required /></label>
        <label>Slug<input name="slug" placeholder="auto-generated when left blank" /></label>
        <label>
          Work type
          <select name="workType" defaultValue="book">
            {workTypes.map((type) => <option key={type} value={type}>{optionLabel(type)}</option>)}
          </select>
        </label>
        <label className="full">Description<textarea name="description" rows={4} required /></label>
        <label>Creation date<input name="creationDate" placeholder="YYYY-MM-DD" /></label>
        <label>First publication date<input name="publicationDate" placeholder="YYYY-MM-DD" /></label>
        <label>Edition or version<input name="edition" /></label>
        <label>Original publication URL<input name="sourceUrl" type="url" /></label>
        <label>ISBN, registration number, or other identifier<input name="externalIdentifier" /></label>
        <label>Licensing contact<input name="licensingContact" placeholder={user.email || "rights@example.com"} /></label>
        <label>Copyright notice<input name="copyrightNotice" /></label>
        <label className="full">Rights statement<textarea name="rightsStatement" rows={5} required /></label>

        <fieldset className="full permission-fieldset">
          <legend>AI permissions</legend>
          <div className="permission-grid">
            {permissionFields.map(([name, label]) => (
              <label className="permission-select" key={name}>
                <span>{label}</span>
                <select name={`permissions.${name}`} defaultValue={name === "fineTuning" || name === "datasetRedistribution" ? "prohibited" : "license_required"}>
                  {permissionValues.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          Human commercial licensing availability
          <select name="humanCommercialLicenseAvailable" defaultValue="case_by_case">
            {permissionValues.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
          </select>
        </label>
        <label>Filename for fingerprint<input name="fileName" /></label>
        <label>File size in bytes<input name="fileSize" type="number" min="0" /></label>
        <label>MIME type<input name="mimeType" placeholder="application/pdf" /></label>
        <label className="full">SHA-256 fingerprint<input name="sha256Hash" pattern="[A-Fa-f0-9]{64}" /></label>
        <label className="full checkbox-label">
          <input name="aiSummaryApproved" type="checkbox" value="yes" required />
          <span>I will review and approve the generated AI-use summary before publication.</span>
        </label>
        <button type="submit">Create draft</button>
      </form>
    </main>
  );
}
