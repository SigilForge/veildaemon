"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  aiSummaryForPermissions,
  copyrightSuggestion,
  fileMetadataForFingerprint,
  isValidSha256,
  normalizeSha256Input,
  normalizeSlugInput,
  permissionMeaning,
  permissionPresets,
  permissionsForPreset,
  recommendedAiPermissions,
  sha256Example,
  sha256ValidationMessage,
  slugHelpText,
  type FingerprintMode,
  type PermissionPresetKey,
} from "@/lib/rights/create-form-helpers";
import {
  SFR_REGISTRY_FRAMEWORK,
  defaultLicenseIdForWorkType,
  licenseById,
  licenseOptionsForWorkType,
  licenseWorkTypeWarning,
} from "@/lib/rights/license-catalog";
import type { CreatorRightsImportDraft, DraftField, DraftFieldStatus } from "@/lib/rights/import-draft";
import type { AiPermissionBlock, PermissionValue } from "@/lib/rights/schema";

type SelectOption = { value: string; label: string };
type PermissionField = { name: keyof AiPermissionBlock; label: string; help: string };

type FormState = {
  creatorName: string;
  publicDisplayName: string;
  rightsHolderName: string;
  title: string;
  slug: string;
  roleForWork: string;
  workType: string;
  category: string;
  availability: string;
  description: string;
  creationDate: string;
  publicationDate: string;
  edition: string;
  sourceUrl: string;
  externalIdentifier: string;
  licensingContact: string;
  copyrightNotice: string;
  copyrightLicenseId: string;
  rightsStatement: string;
  humanCommercialLicenseAvailable: PermissionValue;
  fileName: string;
  fileSize: string;
  mimeType: string;
  sha256Hash: string;
};

type Props = {
  email: string;
  workTypes: SelectOption[];
  categories: SelectOption[];
  availabilityCategories: SelectOption[];
  permissionValues: SelectOption[];
  disclaimer: string;
};

const permissionFields: PermissionField[] = [
  { name: "generalTraining", label: "General AI training", help: "Use in model-training datasets or broad model improvement workflows." },
  { name: "foundationModelPretraining", label: "Foundation-model pretraining", help: "Use in large base-model training before a model is specialized." },
  { name: "fineTuning", label: "Fine-tuning", help: "Use to adapt an existing model toward this work, style, data, or behavior." },
  { name: "embeddings", label: "Embeddings", help: "Use to convert the work into vectors for search, clustering, or retrieval." },
  { name: "rag", label: "Retrieval-augmented generation", help: "Use where a model retrieves this work as context before answering." },
  { name: "generation", label: "Text or image generation", help: "Use to generate new text, images, audio, or other outputs derived from the work." },
  { name: "datasetRedistribution", label: "Dataset redistribution", help: "Sharing the work, transformed copies, or extracted data as a dataset." },
  { name: "researchUse", label: "Research use", help: "Use by researchers, labs, universities, or internal evaluation teams." },
  { name: "commercialUse", label: "Commercial use", help: "Use in a product, paid service, client work, or revenue-generating workflow." },
  { name: "attributionRequired", label: "Attribution required", help: "Whether public or licensed use must credit the creator or rights holder." },
  { name: "licenseRequired", label: "License required", help: "General fallback when a use is not covered by a more specific permission." },
];

const availabilityHelp: Record<string, string> = {
  public: "Public means the work is released and the record can be discovered publicly.",
  licensed: "Licensed means permission is available under separate written terms.",
  scheduled: "Scheduled means publication is planned but not released yet.",
  restricted: "Restricted means access or reuse is limited.",
  internal: "Internal means the record describes private or operational material.",
  archive_only: "Archive only means the record is preserved but not actively offered.",
  redacted: "Redacted means some record details are intentionally withheld.",
  lost: "Lost means the record documents material whose source artifact may no longer be available.",
};

const roleOptions = ["Creator", "Publisher", "Rights Holder", "Licensee", "Other"];

type LicenseIntentId = "all_rights" | "broad_reuse" | "reciprocal_open" | "creative_reuse";

type LicenseIntentOption = {
  id: LicenseIntentId;
  title: string;
  summary: string;
  goodFor: string;
  recommendedLicenseIds: string[];
};

type ImportStatus = "idle" | "loading" | "ready";

type ImportReviewGroup = {
  title: string;
  fields: Array<[string, DraftField<unknown>]>;
};

const licenseIntentOptions: LicenseIntentOption[] = [
  {
    id: "all_rights",
    title: "Keep all rights",
    summary: "Nobody may reuse it without separate permission.",
    goodFor: "Commercial works, unreleased projects, books, art, and private releases.",
    recommendedLicenseIds: ["proprietary", "custom"],
  },
  {
    id: "broad_reuse",
    title: "Allow broad reuse",
    summary: "Best for open-source software where reuse should be simple.",
    goodFor: "Libraries, developer tools, examples, and small software projects.",
    recommendedLicenseIds: ["mit", "apache-2.0", "bsd-3-clause", "unlicense"],
  },
  {
    id: "reciprocal_open",
    title: "Require improvements to stay open",
    summary: "Best for software where modified code should remain available.",
    goodFor: "Open software projects that want file-level, program-level, or network-service reciprocity.",
    recommendedLicenseIds: ["mpl-2.0", "gpl-3.0-only", "lgpl-3.0-only", "agpl-3.0-only"],
  },
  {
    id: "creative_reuse",
    title: "Allow creative reuse",
    summary: "Best for books, art, music, video, courses, datasets, and similar work.",
    goodFor: "Creative or educational work where sharing, attribution, noncommercial use, or public-domain dedication matters.",
    recommendedLicenseIds: ["cc-by-4.0", "cc-by-sa-4.0", "cc-by-nc-4.0", "cc0-1.0"],
  },
];

function FieldHelp({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <details className="field-help" id={id}>
      <summary aria-label="Show field help">?</summary>
      <p>{children}</p>
    </details>
  );
}

function LabelText({ children, help, required = false }: { children: React.ReactNode; help?: React.ReactNode; required?: boolean }) {
  const helpId = typeof children === "string" ? `help-${children.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined;
  return (
    <span className="field-label">
      <span>{children}</span>
      <span className={required ? "field-badge required" : "field-badge"}>{required ? "Required" : "Optional"}</span>
      {help && helpId ? <FieldHelp id={helpId}>{help}</FieldHelp> : null}
    </span>
  );
}

function optionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
}

function intentForLicense(licenseId: string): LicenseIntentId {
  return licenseIntentOptions.find((intent) => intent.recommendedLicenseIds.includes(licenseId))?.id || "all_rights";
}

function draftStatusLabel(status: DraftFieldStatus) {
  return {
    found: "Found",
    inferred: "Inferred",
    needs_review: "Needs review",
    confirmed: "Confirmed",
  }[status];
}

function draftStatusClass(status: DraftFieldStatus) {
  return `draft-status ${status.replace("_", "-")}`;
}

async function sha256ForFile(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function RightsCreateForm({ email, workTypes, categories, availabilityCategories, permissionValues, disclaimer }: Props) {
  const [form, setForm] = useState<FormState>({
    creatorName: "",
    publicDisplayName: "",
    rightsHolderName: "",
    title: "",
    slug: "",
    roleForWork: "Creator",
    workType: "book",
    category: "fiction",
    availability: "public",
    description: "",
    creationDate: "",
    publicationDate: "",
    edition: "",
    sourceUrl: "",
    externalIdentifier: "",
    licensingContact: email,
    copyrightNotice: "",
    copyrightLicenseId: "proprietary",
    rightsStatement: "",
    humanCommercialLicenseAvailable: "case_by_case",
    fileName: "",
    fileSize: "",
    mimeType: "",
    sha256Hash: "",
  });
  const [permissions, setPermissions] = useState<AiPermissionBlock>(recommendedAiPermissions);
  const [preset, setPreset] = useState<PermissionPresetKey | "custom">("all_rights_reserved");
  const [fingerprintMode, setFingerprintMode] = useState<FingerprintMode>("skip");
  const [slugEdited, setSlugEdited] = useState(false);
  const [hashError, setHashError] = useState("");
  const [slugError, setSlugError] = useState("");
  const [fileStatus, setFileStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [licenseIntent, setLicenseIntent] = useState<LicenseIntentId>("all_rights");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importError, setImportError] = useState("");
  const [importDraft, setImportDraft] = useState<CreatorRightsImportDraft | null>(null);

  const aiSummary = useMemo(() => aiSummaryForPermissions(permissions), [permissions]);
  const selectedLicense = useMemo(() => licenseById(form.copyrightLicenseId), [form.copyrightLicenseId]);
  const workTypeLicenseOptions = useMemo(() => licenseOptionsForWorkType(form.workType), [form.workType]);
  const selectedIntent = licenseIntentOptions.find((intent) => intent.id === licenseIntent) || licenseIntentOptions[0];
  const exactLicenseOptions = workTypeLicenseOptions.filter((license) => selectedIntent.recommendedLicenseIds.includes(license.id));
  const visibleExactLicenseOptions = exactLicenseOptions.length ? exactLicenseOptions : workTypeLicenseOptions;
  const licenseWarning = licenseWorkTypeWarning(form.copyrightLicenseId, form.workType);
  const slugPreview = slugHelpText(form.title, form.slug);
  const publicContact = form.licensingContact || email || "Not specified";
  const hasFingerprint = fingerprintMode !== "skip" && Boolean(form.sha256Hash);
  const importReviewGroups: ImportReviewGroup[] = importDraft
    ? [
        {
          title: "Found automatically",
          fields: [
            ["Work title", importDraft.fields.title],
            ["Repository", importDraft.fields.sourceUrl],
            ["Primary license", importDraft.fields.copyrightLicenseId],
            ["Version or release", importDraft.fields.externalIdentifier],
          ],
        },
        {
          title: "Likely, please confirm",
          fields: [
            ["Work type", importDraft.fields.workType],
            ["Public display name", importDraft.fields.publicDisplayName],
            ["Category", importDraft.fields.category],
            ["Copyright notice", importDraft.fields.copyrightNotice],
          ],
        },
        {
          title: "Still needed",
          fields: [
            ["Creator name", importDraft.fields.creatorName],
            ["Rights holder", importDraft.fields.rightsHolderName],
            ["Rights statement", importDraft.fields.rightsStatement],
          ],
        },
      ]
    : [];

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseLicense(licenseId: string) {
    setLicenseIntent(intentForLicense(licenseId));
    setField("copyrightLicenseId", licenseId);
  }

  function chooseLicenseIntent(intentId: LicenseIntentId) {
    const intent = licenseIntentOptions.find((option) => option.id === intentId) || licenseIntentOptions[0];
    const recommended = workTypeLicenseOptions.find((license) => intent.recommendedLicenseIds.includes(license.id));
    setLicenseIntent(intent.id);
    if (recommended) setField("copyrightLicenseId", recommended.id);
  }

  function setWorkType(value: string) {
    const options = licenseOptionsForWorkType(value);
    const currentStillFits = options.some((license) => license.id === form.copyrightLicenseId);
    setForm((current) => ({
      ...current,
      workType: value,
      copyrightLicenseId: currentStillFits ? current.copyrightLicenseId : defaultLicenseIdForWorkType(value),
    }));
    if (!currentStillFits) setLicenseIntent(intentForLicense(defaultLicenseIdForWorkType(value)));
  }

  function setTitle(value: string) {
    setForm((current) => ({
      ...current,
      title: value,
      slug: slugEdited ? current.slug : normalizeSlugInput(value),
    }));
  }

  function setRightsHolder(value: string) {
    setForm((current) => ({
      ...current,
      rightsHolderName: value,
      copyrightNotice: current.copyrightNotice || copyrightSuggestion(current.creationDate.slice(0, 4), value),
    }));
  }

  function applyImportDraft(draft: CreatorRightsImportDraft) {
    const fields = draft.fields;
    const nextTitle = fields.title.value || "";
    const nextLicenseId = fields.copyrightLicenseId.value || defaultLicenseIdForWorkType(fields.workType.value || "software");
    setForm((current) => ({
      ...current,
      creatorName: current.creatorName || fields.creatorName.value || "",
      publicDisplayName: current.publicDisplayName || fields.publicDisplayName.value || "",
      rightsHolderName: current.rightsHolderName || fields.rightsHolderName.value || "",
      title: current.title || nextTitle,
      slug: current.slug || fields.slug.value || normalizeSlugInput(nextTitle),
      workType: fields.workType.value || current.workType,
      category: fields.category.value || current.category,
      availability: fields.availability.value || current.availability,
      description: current.description || fields.description.value || "",
      sourceUrl: current.sourceUrl || fields.sourceUrl.value || "",
      externalIdentifier: current.externalIdentifier || fields.externalIdentifier.value || "",
      edition: current.edition || fields.edition.value || "",
      copyrightNotice: current.copyrightNotice || fields.copyrightNotice.value || "",
      copyrightLicenseId: nextLicenseId,
      rightsStatement: current.rightsStatement || fields.rightsStatement.value || "",
    }));
    setLicenseIntent(intentForLicense(nextLicenseId));
  }

  async function importRepositoryDraft() {
    setImportError("");
    setImportStatus("loading");
    try {
      const response = await fetch("/api/rights/import/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl }),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; draft?: CreatorRightsImportDraft };
      if (!response.ok || !payload.draft) {
        setImportError(payload.error || "The repository could not be imported. Check the URL and try again.");
        setImportStatus("idle");
        return;
      }
      setImportDraft(payload.draft);
      applyImportDraft(payload.draft);
      setImportStatus("ready");
    } catch {
      setImportError("Network error while importing the repository. You can still complete the form manually.");
      setImportStatus("idle");
    }
  }

  function setCreationDate(value: string) {
    setForm((current) => ({
      ...current,
      creationDate: value,
      copyrightNotice: current.copyrightNotice || copyrightSuggestion(value.slice(0, 4), current.rightsHolderName),
    }));
  }

  function setPermission(name: keyof AiPermissionBlock, value: PermissionValue) {
    setPreset("custom");
    setPermissions((current) => ({ ...current, [name]: value }));
  }

  function applyPreset(value: PermissionPresetKey | "custom") {
    setPreset(value);
    const next = permissionsForPreset(value);
    if (next) setPermissions(next);
  }

  function useRecommendedDefaults() {
    setPreset("all_rights_reserved");
    setPermissions(recommendedAiPermissions);
  }

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileStatus("Calculating SHA-256 in this browser...");
    setHashError("");
    const metadata = fileMetadataForFingerprint(file);
    setForm((current) => ({
      ...current,
      ...metadata,
      sha256Hash: "",
    }));
    try {
      const hash = await sha256ForFile(file);
      setForm((current) => ({ ...current, sha256Hash: hash }));
      setFileStatus("Fingerprint calculated. Review the hash before creating the draft.");
    } catch {
      setFileStatus("");
      setHashError("This browser could not calculate the file fingerprint. Paste a SHA-256 hash instead.");
    }
  }

  function updateHash(value: string) {
    const normalized = normalizeSha256Input(value);
    setField("sha256Hash", normalized);
    setHashError(sha256ValidationMessage(value));
  }

  function updateSlug(value: string) {
    setSlugEdited(true);
    const normalized = normalizeSlugInput(value);
    setField("slug", normalized);
    setSlugError(normalized && normalized.length < 3 ? "Slug must be at least 3 URL-safe characters." : "");
  }

  function updateFingerprintMode(value: FingerprintMode) {
    setFingerprintMode(value);
    setHashError("");
    setFileStatus("");
    if (value === "skip") {
      setForm((current) => ({ ...current, fileName: "", fileSize: "", mimeType: "", sha256Hash: "" }));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    const nextSlug = form.slug || normalizeSlugInput(form.title);
    if (nextSlug.length < 3) {
      setSlugError("Enter a title that can create a public URL slug, or edit the slug.");
      return;
    }
    if (fingerprintMode !== "skip" && !isValidSha256(form.sha256Hash)) {
      setHashError(sha256ValidationMessage(form.sha256Hash) || "Provide a valid SHA-256 hash or skip fingerprinting.");
      return;
    }

    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    data.set("slug", nextSlug);
    data.set("sha256Hash", fingerprintMode === "skip" ? "" : normalizeSha256Input(form.sha256Hash));
    if (fingerprintMode === "skip") {
      data.set("fileName", "");
      data.delete("fileSize");
      data.set("mimeType", "");
    }

    try {
      const response = await fetch("/api/rights/create", {
        method: "POST",
        body: data,
      });
      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(payload.error || "The draft could not be created. Review the highlighted fields and try again.");
        return;
      }
      window.location.assign("/account/rights");
    } catch {
      setSubmitError("Network error while creating the draft. Your entered values are still here.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form rights-form guided-rights-form" action="/api/rights/create" method="post" onSubmit={onSubmit} noValidate>
      <input type="hidden" name="email" value={email} />

      <section className="form-step import-source-panel full">
        <div className="form-step-head">
          <p className="eyebrow">Start from source</p>
          <h2>Import a GitHub repository</h2>
        </div>
        <p className="field-hint full">
          Paste a public repository URL to draft the record from source metadata. Imported data is a review queue, not a verified rights claim.
        </p>
        <label className="source-url-field">
          <LabelText help="Use a public repository URL such as https://github.com/SigilForge/veildaemon. The server fetches only constructed GitHub API URLs.">Repository URL</LabelText>
          <input
            inputMode="url"
            placeholder="https://github.com/owner/repository"
            type="url"
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
          />
        </label>
        <button className="button secondary import-button" disabled={importStatus === "loading"} onClick={importRepositoryDraft} type="button">
          {importStatus === "loading" ? "Importing..." : "Import repository"}
        </button>
        {importError ? <p className="form-error full" role="alert">{importError}</p> : null}
        {importDraft ? (
          <div className="import-review-panel full" aria-live="polite">
            <div>
              <p className="panel-kicker">Draft import</p>
              <h3>{importDraft.repository.fullName}</h3>
            </div>
            <ul className="import-summary">
              {importDraft.summary.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="import-review-groups">
              {importReviewGroups.map((group) => (
                <section className="import-review-group" key={group.title}>
                  <h4>{group.title}</h4>
                  <div className="import-review-grid">
                    {group.fields.map(([label, field]) => (
                      <div className="import-review-item" key={String(label)}>
                        <span className={draftStatusClass(field.status)}>{draftStatusLabel(field.status)}</span>
                        <strong>{String(field.value || "Not determined")}</strong>
                        <small>{String(label)} · {field.evidence}</small>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <p className="field-hint">
              The sections below are the advanced editor for correcting the draft before publication.
            </p>
            <p className="notice">
              {importDraft.warnings.join(" ")} Review the highlighted fields before creating the draft.
            </p>
          </div>
        ) : null}
      </section>

      <div className="completion-strip full" aria-label="Creator Rights form sections">
        {["Work identity", "Rights and publication", "AI permissions", "File verification", "Review"].map((step, index) => (
          <span key={step}><strong>{index + 1}</strong>{step}</span>
        ))}
      </div>

      <section className="form-step full">
        <div className="form-step-head">
          <p className="eyebrow">Step 1</p>
          <h2>Work identity</h2>
        </div>
        <label>
          <LabelText required help="The person or group credited as creator in this declaration. This is a declaration, not legal proof.">Creator name</LabelText>
          <input name="creatorName" value={form.creatorName} required onChange={(event) => setField("creatorName", event.target.value)} />
        </label>
        <label>
          <LabelText required help="The name shown publicly on the record. It may be a pen name, studio name, or publisher-facing name.">Public display name</LabelText>
          <input name="publicDisplayName" value={form.publicDisplayName} required onChange={(event) => setField("publicDisplayName", event.target.value)} />
        </label>
        <label>
          <LabelText required help="The creator, company, publisher, studio, or other legal rights holder for this declaration.">Rights-holder name</LabelText>
          <input name="rightsHolderName" value={form.rightsHolderName} required onChange={(event) => setRightsHolder(event.target.value)} />
        </label>
        <label>
          <LabelText required help="The title of the work or product this record describes.">Work title</LabelText>
          <input name="title" value={form.title} required onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <LabelText help="The slug becomes part of the permanent public URL. Use lowercase letters, numbers, and hyphens. Example: the-anchor-and-the-glitch">Slug</LabelText>
          <input name="slug" value={form.slug} placeholder="generated from title" pattern="[a-z0-9-]{3,90}" onChange={(event) => updateSlug(event.target.value)} />
          <span className={slugError ? "field-error" : "field-hint"}>{slugError || slugPreview}</span>
        </label>
        <label>
          <LabelText help="Your role describes why this account is making the declaration. It does not independently prove ownership.">Your role for this work</LabelText>
          <select name="roleForWork" value={form.roleForWork} onChange={(event) => setField("roleForWork", event.target.value)}>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <label>
          <LabelText required help="Choose the closest kind of work so buyers and AI teams can filter records later.">Work type</LabelText>
          <select name="workType" value={form.workType} onChange={(event) => setWorkType(event.target.value)}>
            {workTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label>
          <LabelText help="Category adds a second filter such as fiction, software, legal, or research.">Category</LabelText>
          <select name="category" value={form.category} onChange={(event) => setField("category", event.target.value)}>
            {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
        </label>
        <label className="full">
          <LabelText required help="Plain-language description shown on the draft and public record.">Description</LabelText>
          <textarea name="description" rows={4} value={form.description} required onChange={(event) => setField("description", event.target.value)} />
        </label>
      </section>

      <section className="form-step full">
        <div className="form-step-head">
          <p className="eyebrow">Step 2</p>
          <h2>Rights and publication</h2>
        </div>
        <label>
          <LabelText help="Availability tells visitors whether licensing is open, restricted, scheduled, or archival.">Availability</LabelText>
          <select name="availability" value={form.availability} onChange={(event) => setField("availability", event.target.value)}>
            {availabilityCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          <span className="field-hint">{availabilityHelp[form.availability] || "Choose the closest public licensing posture."}</span>
        </label>
        <label>
          <LabelText help="Creation date is when the work was created or began. Publication date is when it was first made available.">Creation date</LabelText>
          <input name="creationDate" value={form.creationDate} type="date" onChange={(event) => setCreationDate(event.target.value)} />
        </label>
        <label>
          <LabelText help="First publication date is the first public or canonical release date, if one exists.">First publication date</LabelText>
          <input name="publicationDate" value={form.publicationDate} type="date" onChange={(event) => setField("publicationDate", event.target.value)} />
        </label>
        <details className="advanced-fields full">
          <summary>Additional identifiers and verification</summary>
          <p className="field-hint">Optional publication links and identifiers help future buyers match this record to a release. They are not required to create a draft.</p>
          <label>
            <LabelText help="Version text helps distinguish editions, releases, or printings. Example: v1.0, First edition, Release 2026.07.">Edition or version</LabelText>
            <input name="edition" value={form.edition} onChange={(event) => setField("edition", event.target.value)} />
          </label>
          <label>
            <LabelText help="A public release or canonical project page, if one exists. Example: https://github.com/SigilForge/veildaemon">Original publication URL</LabelText>
            <input name="sourceUrl" type="url" value={form.sourceUrl} onChange={(event) => setField("sourceUrl", event.target.value)} />
          </label>
          <label>
            <LabelText help="Optional identifier. Examples: ISBN, DOI, Git commit, release tag, copyright registration number, or internal publication ID.">Registration number, release ID, repository, or other identifier</LabelText>
            <input name="externalIdentifier" value={form.externalIdentifier} placeholder="ISBN 978..., v1.0.0, commit abc123" onChange={(event) => setField("externalIdentifier", event.target.value)} />
          </label>
        </details>
        <label>
          <LabelText help="This contact becomes the licensing contact for the record. Review it before publication.">Licensing contact</LabelText>
          <input name="licensingContact" value={form.licensingContact} placeholder={email || "rights@example.com"} onChange={(event) => setField("licensingContact", event.target.value)} />
        </label>
        <label>
          <LabelText help="Suggested from the creation year and rights holder. You may edit it.">Copyright notice</LabelText>
          <input name="copyrightNotice" value={form.copyrightNotice} placeholder={copyrightSuggestion(form.creationDate.slice(0, 4), form.rightsHolderName)} onChange={(event) => setField("copyrightNotice", event.target.value)} />
        </label>
        <div className="license-composition full">
          <div className="form-step-head">
            <p className="eyebrow">License composition</p>
            <h3>Choose how your work may be reused</h3>
          </div>
          <p className="field-hint">
            Your record will combine your selected copyright license with the SigilForge Rights Framework for
            provenance, verification, and AI permissions.
          </p>
          <div className="license-intent-grid">
            {licenseIntentOptions.map((intent) => {
              const recommended = workTypeLicenseOptions.filter((license) => intent.recommendedLicenseIds.includes(license.id));
              const compatible = recommended.length > 0;
              return (
                <button
                  aria-pressed={licenseIntent === intent.id}
                  className={licenseIntent === intent.id ? "license-intent-card selected" : "license-intent-card"}
                  disabled={!compatible}
                  key={intent.id}
                  onClick={() => chooseLicenseIntent(intent.id)}
                  type="button"
                >
                  <span>{intent.title}</span>
                  <strong>{intent.summary}</strong>
                  <small>{compatible ? intent.goodFor : "Not recommended for the selected work type."}</small>
                </button>
              );
            })}
          </div>
          <label>
            <LabelText required help="Choose the exact copyright license for this reuse intent. SFR stays separate and does not replace SPDX identifiers or canonical license text.">Exact copyright license</LabelText>
            <select
              name="copyrightLicenseId"
              value={form.copyrightLicenseId}
              onChange={(event) => chooseLicense(event.target.value)}
            >
              {workTypeLicenseOptions.map((license) => (
                <option key={license.id} value={license.id}>
                  {license.name}{license.spdxId ? ` (${license.spdxId})` : ""}
                </option>
              ))}
            </select>
            <span className={licenseWarning ? "field-error" : "field-hint"}>
              {licenseWarning || selectedLicense.summary}
            </span>
          </label>
          <div className="license-guide">
            {visibleExactLicenseOptions.map((license) => (
              <article
                className={license.id === selectedLicense.id ? "license-option selected" : "license-option"}
                key={license.id}
              >
                <div>
                  <p className="panel-kicker">{license.spdxId || "No SPDX ID"}</p>
                  <h4>{license.shortName}</h4>
                  <p>{license.summary}</p>
                  <p className="muted">{license.goodFor}</p>
                </div>
                <button className="button secondary" type="button" onClick={() => chooseLicense(license.id)}>
                  Use {license.shortName}
                </button>
              </article>
            ))}
          </div>
          <div className="registry-framework-row">
            <span>Registry Framework</span>
            <strong>{SFR_REGISTRY_FRAMEWORK.name} ({SFR_REGISTRY_FRAMEWORK.shortName}) v{SFR_REGISTRY_FRAMEWORK.version}</strong>
            <p>{SFR_REGISTRY_FRAMEWORK.summary}</p>
          </div>
          <p className="notice sfr-notice">
            SFR does not replace your selected copyright license. It publishes additional creator declarations,
            attribution guidance, AI permissions, provenance metadata, verification state, and machine-readable rights
            information alongside that license.
          </p>
        </div>
        <label className="full">
          <LabelText required help="A rights statement is human-readable. The AI permission grid below is structured machine-readable policy. Example: All rights reserved except where a separate written agreement grants permission.">Rights statement</LabelText>
          <textarea name="rightsStatement" rows={5} value={form.rightsStatement} required onChange={(event) => setField("rightsStatement", event.target.value)} />
        </label>
      </section>

      <fieldset className="form-step full permission-fieldset">
        <legend>Step 3 · AI permissions</legend>
        <p className="field-hint">
          Allowed means the use is permitted under this record. License required means written permission is needed. Prohibited means the use is not granted by this declaration.
        </p>
        <div className="preset-row">
          <label>
            <LabelText help="Presets only fill the fields. They do not approve or submit the record.">Permission preset</LabelText>
            <select value={preset} onChange={(event) => applyPreset(event.target.value as PermissionPresetKey | "custom")}>
              {Object.entries(permissionPresets).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              <option value="custom">Custom</option>
            </select>
          </label>
          <button className="button secondary" type="button" onClick={useRecommendedDefaults}>Use recommended defaults</button>
        </div>
        <div className="permission-grid">
          {permissionFields.map((field) => (
            <label className="permission-select guided-permission" key={field.name}>
              <LabelText help={field.help}>{field.label}</LabelText>
              <select name={`permissions.${field.name}`} value={permissions[field.name]} onChange={(event) => setPermission(field.name, event.target.value as PermissionValue)}>
                {permissionValues.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}
              </select>
              <span className="field-hint">{permissionMeaning(permissions[field.name])}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="form-step full">
        <div className="form-step-head">
          <p className="eyebrow">Step 4</p>
          <h2>File verification</h2>
        </div>
        <p className="field-hint">
          SHA-256 is optional. It identifies one exact file version; it does not prove authorship or legal ownership.
        </p>
        <div className="segmented-choice" role="radiogroup" aria-label="Fingerprint option">
          {[
            ["file", "I have a file to fingerprint"],
            ["hash", "I already have a SHA-256 hash"],
            ["skip", "Skip fingerprinting"],
          ].map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="fingerprintMode" value={value} checked={fingerprintMode === value} onChange={() => updateFingerprintMode(value as FingerprintMode)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {fingerprintMode === "file" ? (
          <div className="fingerprint-panel">
            <label className="full">
              <LabelText help="The file stays in your browser for hashing. The form sends the hash and metadata, not the file bytes.">File</LabelText>
              <input type="file" onChange={onFileSelected} />
            </label>
            {fileStatus ? <p className="field-hint">{fileStatus}</p> : null}
          </div>
        ) : null}
        {fingerprintMode !== "skip" ? (
          <div className="fingerprint-panel">
            <label className="full">
              <LabelText required help={`Paste exactly 64 hexadecimal characters. Example: ${sha256Example}`}>SHA-256 fingerprint</LabelText>
              <input name="sha256Hash" value={form.sha256Hash} inputMode="text" pattern="[a-f0-9]{64}" placeholder={sha256Example} readOnly={fingerprintMode === "file"} onChange={(event) => updateHash(event.target.value)} />
              <span className={hashError ? "field-error" : "field-hint"}>{hashError || "Stored lowercase. Prefixes such as sha256: are not accepted."}</span>
            </label>
            <details className="advanced-fields full" open={fingerprintMode === "file"}>
              <summary>File metadata</summary>
              <p className="field-hint">Filename, size, and MIME type are optional metadata. MIME examples: application/pdf, image/png, text/plain.</p>
              <label>
                <LabelText help="Automatically populated when you select a file. Optional when you paste a hash.">Filename</LabelText>
                <input name="fileName" value={form.fileName} readOnly={fingerprintMode === "file"} onChange={(event) => setField("fileName", event.target.value)} />
              </label>
              <label>
                <LabelText help="Automatically populated in bytes when you select a file.">File size in bytes</LabelText>
                <input name="fileSize" type="number" min="0" value={form.fileSize} readOnly={fingerprintMode === "file"} onChange={(event) => setField("fileSize", event.target.value)} />
              </label>
              <label>
                <LabelText help="Optional browser-supplied file type. Examples: application/pdf, image/png, text/plain.">MIME type</LabelText>
                <input name="mimeType" value={form.mimeType} placeholder="application/pdf" readOnly={fingerprintMode === "file"} onChange={(event) => setField("mimeType", event.target.value)} />
              </label>
            </details>
          </div>
        ) : null}
      </section>

      <section className="form-step review-step full">
        <div className="form-step-head">
          <p className="eyebrow">Step 5</p>
          <h2>Review and create draft</h2>
        </div>
        <div className="preflight-summary" aria-live="polite">
          <div><span>Public name</span><strong>{form.publicDisplayName || "Not entered"}</strong></div>
          <div><span>Work title</span><strong>{form.title || "Not entered"}</strong></div>
          <div><span>Rights holder</span><strong>{form.rightsHolderName || "Not entered"}</strong></div>
          <div><span>Primary License</span><strong>{selectedLicense.shortName}</strong></div>
          <div><span>Registry Framework</span><strong>SFR v{SFR_REGISTRY_FRAMEWORK.version}</strong></div>
          <div><span>AI Permissions</span><strong>Creator-defined</strong></div>
          <div><span>Availability</span><strong>{optionLabel(form.availability)}</strong></div>
          <div><span>Licensing contact</span><strong>{publicContact}</strong></div>
          <div><span>File verification</span><strong>{hasFingerprint ? "SHA-256 attached" : "Skipped"}</strong></div>
        </div>
        <div className="ai-summary-review">
          <h3>Generated AI-use summary</h3>
          <p>{aiSummary}</p>
        </div>
        <p className="notice">{disclaimer}</p>
        {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}
        <label className="full checkbox-label">
          <input name="aiSummaryApproved" type="checkbox" value="yes" required />
          <span>I reviewed the generated AI-use summary and understand this record is a declaration, not independent legal proof.</span>
        </label>
        <button type="submit" disabled={submitting}>{submitting ? "Creating draft..." : "Create draft"}</button>
      </section>
    </form>
  );
}
