import { createHash, randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import { RIGHTS_DISCLAIMER, permissionLabel, workTypeLabel, type CreatorRightsRecord } from "./schema";
import { publicLicenseShape, publicRegistryFrameworkShape } from "./license-catalog";
import { recordUrl, rightsJson } from "./records";
import { effectiveVerification, verificationLevelLabel, type VerificationProjection } from "./verification";

export const DOSSIER_SCHEMA_VERSION = "1.0";

export const dossierPurposeValues = [
  "publisher",
  "licensing",
  "grant",
  "archive",
  "open_source",
  "suspected_use",
  "general",
  "custom",
] as const;

export type DossierPurpose = (typeof dossierPurposeValues)[number];

export const dossierSectionValues = [
  "rights_summary",
  "work_identity",
  "parties",
  "primary_license",
  "registry_framework",
  "ai_permissions",
  "publication_history",
  "identifiers",
  "artifact_inventory",
  "verification_status",
  "timeline",
  "canonical_urls",
  "suspected_use_report",
] as const;

export type DossierSection = (typeof dossierSectionValues)[number];

export type EvidenceClass = "verified_fact" | "creator_declaration" | "supporting_attachment" | "reported_observation";

export type DossierFileEntry = {
  path: string;
  role: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  evidenceClass: EvidenceClass;
};

export type DossierTimelineEntry = {
  label: string;
  date: string;
  evidenceClass: EvidenceClass;
  source: string;
};

export type DossierBuildInput = {
  purpose: DossierPurpose;
  includedSections?: DossierSection[];
  suspectedUse?: {
    providerName?: string;
    modelName?: string;
    observedAt?: string;
    allegationType?: string;
    factualObservation?: string;
    creatorInterpretation?: string;
    testingMethod?: string;
    status?: string;
  };
};

export type CreatorDossierManifest = {
  dossierId: string;
  dossierVersion: number;
  schemaVersion: string;
  generatedAt: string;
  generatedBy: string;
  purpose: DossierPurpose;
  record: {
    recordId: string | null;
    recordUuid: string;
    recordVersion: number;
    canonicalUrl: string;
    title: string;
    workType: string;
  };
  copyrightLicense: {
    id: string;
    name: string;
    spdxId?: string | null;
    officialUrl?: string;
  };
  registryFramework: {
    id: "sfr";
    version: string;
  };
  includedSections: DossierSection[];
  evidenceClasses: Record<EvidenceClass, string>;
  timeline: DossierTimelineEntry[];
  files: DossierFileEntry[];
  manifestSha256: string;
  packageSha256: string;
  privateByDefault: true;
  disclaimer: string;
};

const requiredSections: DossierSection[] = [
  "rights_summary",
  "work_identity",
  "parties",
  "primary_license",
  "registry_framework",
  "ai_permissions",
  "canonical_urls",
];

const purposeDefaults: Record<DossierPurpose, DossierSection[]> = {
  publisher: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "canonical_urls",
    "timeline",
  ],
  licensing: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "identifiers",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  grant: [
    "rights_summary",
    "work_identity",
    "parties",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  archive: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  open_source: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  suspected_use: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
    "suspected_use_report",
  ],
  general: [
    "rights_summary",
    "work_identity",
    "parties",
    "primary_license",
    "registry_framework",
    "ai_permissions",
    "publication_history",
    "identifiers",
    "artifact_inventory",
    "verification_status",
    "canonical_urls",
    "timeline",
  ],
  custom: [...requiredSections, "timeline"],
};

export const evidenceClassDescriptions: Record<EvidenceClass, string> = {
  verified_fact: "Computed, verified, or independently checkable record fact.",
  creator_declaration: "Creator-entered declaration recorded by the system.",
  supporting_attachment: "Supporting material selected by the creator. Not independently verified by upload alone.",
  reported_observation: "Creator-reported observation or interpretation. Not a determination of infringement.",
};

export function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function sectionsForPurpose(purpose: DossierPurpose) {
  return purposeDefaults[purpose] || purposeDefaults.general;
}

export function normalizeDossierInput(input: Partial<DossierBuildInput>): DossierBuildInput {
  const purpose = dossierPurposeValues.includes(input.purpose as DossierPurpose)
    ? (input.purpose as DossierPurpose)
    : "general";
  const requested = input.includedSections?.filter((section): section is DossierSection =>
    dossierSectionValues.includes(section as DossierSection)
  );
  const sections = requested?.length ? requested : sectionsForPurpose(purpose);
  return {
    purpose,
    includedSections: [...new Set([...requiredSections, ...sections])],
    suspectedUse: input.suspectedUse,
  };
}

function bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function permissionSummary(record: CreatorRightsRecord) {
  return Object.entries(record.ai_permissions || {})
    .map(([key, value]) => `${titleCase(key)}: ${permissionLabel(value)}`)
    .join("\n");
}

function markdownRightsSummary(record: CreatorRightsRecord, verification: VerificationProjection) {
  const license = publicLicenseShape(record.copyright_license_id);
  const framework = publicRegistryFrameworkShape(record.registry_framework_id, record.registry_framework_version);
  return [
    `# Rights Summary: ${record.title}`,
    "",
    `Creator: ${record.public_display_name || record.creator_name}`,
    `Rights holder: ${record.rights_holder_name}`,
    `Work type: ${workTypeLabel(record.work_type)}`,
    `Primary license: ${license.name}${license.spdxId ? ` (${license.spdxId})` : ""}`,
    `Registry framework: ${framework.shortName} ${framework.version}`,
    `Verification: ${verificationLevelLabel(verification.level)}`,
    `Canonical URL: ${recordUrl(record.slug)}`,
    "",
    record.ai_permissions_summary,
  ].join("\n");
}

function markdownSfr(record: CreatorRightsRecord) {
  const framework = publicRegistryFrameworkShape(record.registry_framework_id, record.registry_framework_version);
  return [
    `# ${framework.name} (${framework.shortName}) ${framework.version}`,
    "",
    framework.summary,
    "",
    framework.supplementalNotice,
    "",
    `Record: ${record.record_id || record.id}`,
    `Title: ${record.title}`,
    `Rights holder: ${record.rights_holder_name}`,
    `Canonical URL: ${recordUrl(record.slug)}`,
  ].join("\n");
}

function licenseSummary(record: CreatorRightsRecord) {
  const license = publicLicenseShape(record.copyright_license_id);
  return [
    `# License Summary`,
    "",
    `Primary License: ${license.name}`,
    `SPDX: ${license.spdxId || "Not applicable"}`,
    `Official URL: ${license.url}`,
    "",
    license.summary,
    "",
    "This summary is not a substitute for the selected license text or a separate written agreement.",
  ].join("\n");
}

function licenseNotice(record: CreatorRightsRecord) {
  const license = publicLicenseShape(record.copyright_license_id);
  if (license.spdxId) {
    return `Primary license: ${license.name} (${license.spdxId})\nOfficial license URL: ${license.url}\n\nCanonical license text is not modified by the Creator Rights Record or SFR framework.`;
  }
  return `${record.copyright_notice || "Copyright notice not specified."}\n\n${record.rights_statement}`;
}

function buildTimeline(record: CreatorRightsRecord, verification: VerificationProjection): DossierTimelineEntry[] {
  const entries: DossierTimelineEntry[] = [];
  if (record.creation_date) {
    entries.push({ label: "Work created", date: record.creation_date, evidenceClass: "creator_declaration", source: "Creator Rights Record" });
  }
  if (record.publication_date) {
    entries.push({ label: "First publication", date: record.publication_date, evidenceClass: "creator_declaration", source: "Creator Rights Record" });
  }
  if (record.hash_created_at) {
    entries.push({ label: "Artifact fingerprinted", date: record.hash_created_at, evidenceClass: "verified_fact", source: "SHA-256 record" });
  }
  if (record.created_at) {
    entries.push({ label: "Creator Rights Record created", date: record.created_at, evidenceClass: "verified_fact", source: "VeilLink" });
  }
  if (verification.evidence?.length) {
    for (const item of verification.evidence) {
      if (!item.verifiedAt) continue;
      entries.push({
        label: `${titleCase(item.method)} verification ${item.status}`,
        date: item.verifiedAt,
        evidenceClass: item.status === "passed" ? "verified_fact" : "creator_declaration",
        source: "Creator Rights verification",
      });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export function buildDossierSnapshot(args: {
  record: CreatorRightsRecord;
  userId: string;
  input: Partial<DossierBuildInput>;
  dossierVersion: number;
  verification?: VerificationProjection;
  now?: string;
}) {
  const verification = args.verification || effectiveVerification(args.record);
  const normalized = normalizeDossierInput(args.input);
  const now = args.now || new Date().toISOString();
  const dossierId = randomUUID();
  const license = publicLicenseShape(args.record.copyright_license_id);
  const framework = publicRegistryFrameworkShape(args.record.registry_framework_id, args.record.registry_framework_version);
  const recordJson = JSON.stringify(rightsJson(args.record, verification), null, 2);
  const rightsSummary = markdownRightsSummary(args.record, verification);
  const licenseSummaryText = licenseSummary(args.record);
  const licenseText = licenseNotice(args.record);
  const sfrText = markdownSfr(args.record);
  const files: DossierFileEntry[] = [
    {
      path: "creator-dossier/CREATOR-RIGHTS-RECORD.json",
      role: "canonical_record",
      sha256: sha256Hex(recordJson),
      sizeBytes: bytes(recordJson),
      mimeType: "application/json",
      evidenceClass: "verified_fact",
    },
    {
      path: "creator-dossier/RIGHTS-SUMMARY.md",
      role: "human_summary",
      sha256: sha256Hex(rightsSummary),
      sizeBytes: bytes(rightsSummary),
      mimeType: "text/markdown",
      evidenceClass: "creator_declaration",
    },
    {
      path: "creator-dossier/LICENSE-SUMMARY.md",
      role: "license_summary",
      sha256: sha256Hex(licenseSummaryText),
      sizeBytes: bytes(licenseSummaryText),
      mimeType: "text/markdown",
      evidenceClass: "creator_declaration",
    },
    {
      path: "creator-dossier/LICENSE",
      role: license.spdxId ? "canonical_license_reference" : "rights_notice",
      sha256: sha256Hex(licenseText),
      sizeBytes: bytes(licenseText),
      mimeType: "text/plain",
      evidenceClass: "creator_declaration",
    },
    {
      path: "creator-dossier/SFR.md",
      role: "registry_framework",
      sha256: sha256Hex(sfrText),
      sizeBytes: bytes(sfrText),
      mimeType: "text/markdown",
      evidenceClass: "creator_declaration",
    },
  ];
  const timeline = buildTimeline(args.record, verification);
  const packageSha256 = sha256Hex(files.map((file) => `${file.sha256}  ${file.path}`).join("\n"));
  const manifestWithoutHash = {
    dossierId,
    dossierVersion: args.dossierVersion,
    schemaVersion: DOSSIER_SCHEMA_VERSION,
    generatedAt: now,
    generatedBy: args.userId,
    purpose: normalized.purpose,
    record: {
      recordId: args.record.record_id,
      recordUuid: args.record.id,
      recordVersion: 1,
      canonicalUrl: recordUrl(args.record.slug),
      title: args.record.title,
      workType: String(args.record.work_type),
    },
    copyrightLicense: {
      id: license.id,
      name: license.name,
      spdxId: license.spdxId,
      officialUrl: license.url,
    },
    registryFramework: {
      id: framework.id,
      version: framework.version,
    },
    includedSections: normalized.includedSections || sectionsForPurpose(normalized.purpose),
    evidenceClasses: evidenceClassDescriptions,
    timeline,
    files,
    packageSha256,
    privateByDefault: true as const,
    disclaimer: RIGHTS_DISCLAIMER,
  };
  const manifestSha256 = sha256Hex(JSON.stringify(manifestWithoutHash));
  const manifest: CreatorDossierManifest = { ...manifestWithoutHash, manifestSha256 };
  const html = renderDossierHtml(args.record, manifest, verification, normalized);
  return {
    dossierId,
    manifest,
    html,
    exportHashes: {
      manifestSha256,
      htmlSha256: sha256Hex(html),
      packageSha256,
    },
  };
}

export function renderDossierHtml(
  record: CreatorRightsRecord,
  manifest: CreatorDossierManifest,
  verification: VerificationProjection,
  input: DossierBuildInput
) {
  const license = publicLicenseShape(record.copyright_license_id);
  const framework = publicRegistryFrameworkShape(record.registry_framework_id, record.registry_framework_version);
  const suspected = input.purpose === "suspected_use" ? input.suspectedUse : null;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Creator Dossier - ${escapeHtml(record.title)}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;line-height:1.55;color:#171514;margin:0;background:#f6f3ed}
    main{max-width:920px;margin:0 auto;padding:48px 28px}
    section{page-break-inside:avoid;margin:0 0 28px;padding:22px;border:1px solid #d8d0c4;background:#fff}
    h1{font-family:Georgia,serif;font-size:42px;margin:0 0 8px} h2{margin:0 0 12px;font-size:22px}
    .eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#8a4a42;font-weight:700}
    dl{display:grid;grid-template-columns:180px 1fr;gap:8px 16px} dt{font-weight:700;color:#5c5f5c} dd{margin:0;overflow-wrap:anywhere}
    table{width:100%;border-collapse:collapse} td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
    .notice{border-left:4px solid #8a4a42;padding:10px 14px;background:#faf3ef}.muted{color:#5c5f5c}
  </style>
</head>
<body>
<main>
  <p class="eyebrow">Creator Dossier</p>
  <h1>${escapeHtml(record.title)}</h1>
  <p>One work. One record. One professional dossier.</p>
  <section>
    <h2>Executive Rights Summary</h2>
    <p>This dossier documents the declared authorship, rights-holder identity, publication history, licensing position, registered identifiers, and artifact fingerprints for <em>${escapeHtml(record.title)}</em>. Supporting records and versioned files are indexed in the attached manifest.</p>
    <dl>
      <dt>Purpose</dt><dd>${escapeHtml(titleCase(manifest.purpose))}</dd>
      <dt>Creator</dt><dd>${escapeHtml(record.public_display_name || record.creator_name)}</dd>
      <dt>Rights holder</dt><dd>${escapeHtml(record.rights_holder_name)}</dd>
      <dt>Primary License</dt><dd>${escapeHtml(license.name)}${license.spdxId ? ` (${escapeHtml(license.spdxId)})` : ""}</dd>
      <dt>Registry Framework</dt><dd>${escapeHtml(framework.shortName)} ${escapeHtml(framework.version)}</dd>
      <dt>Canonical Record</dt><dd>${escapeHtml(recordUrl(record.slug))}</dd>
    </dl>
  </section>
  <section>
    <h2>AI Permissions</h2>
    <p>${escapeHtml(record.ai_permissions_summary)}</p>
    <pre>${escapeHtml(permissionSummary(record))}</pre>
  </section>
  <section>
    <h2>Verification and Provenance</h2>
    <dl>
      <dt>Verification level</dt><dd>${escapeHtml(verificationLevelLabel(verification.level))}</dd>
      <dt>Methods</dt><dd>${escapeHtml(verification.methods.join(", ") || "Declared only")}</dd>
      <dt>SHA-256</dt><dd>${escapeHtml(record.sha256_hash || "No artifact fingerprint attached")}</dd>
    </dl>
  </section>
  <section>
    <h2>Timeline</h2>
    <table><thead><tr><th>Date</th><th>Event</th><th>Evidence class</th><th>Source</th></tr></thead><tbody>
      ${manifest.timeline.map((entry) => `<tr><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(entry.label)}</td><td>${escapeHtml(titleCase(entry.evidenceClass))}</td><td>${escapeHtml(entry.source)}</td></tr>`).join("") || "<tr><td colspan=\"4\">No dated timeline entries selected.</td></tr>"}
    </tbody></table>
  </section>
  <section>
    <h2>Manifest Summary</h2>
    <dl>
      <dt>Dossier ID</dt><dd>${escapeHtml(manifest.dossierId)}</dd>
      <dt>Dossier version</dt><dd>${manifest.dossierVersion}</dd>
      <dt>Manifest SHA-256</dt><dd>${escapeHtml(manifest.manifestSha256)}</dd>
      <dt>Package SHA-256</dt><dd>${escapeHtml(manifest.packageSha256)}</dd>
    </dl>
  </section>
  ${suspected ? `<section><h2>Reported Observation</h2><p class="notice">This section records the creator's report and supporting materials. It does not independently determine whether infringement or unauthorized use occurred.</p><dl><dt>Provider</dt><dd>${escapeHtml(suspected.providerName || "Not specified")}</dd><dt>Model or service</dt><dd>${escapeHtml(suspected.modelName || "Not specified")}</dd><dt>Observation date</dt><dd>${escapeHtml(suspected.observedAt || "Not specified")}</dd><dt>Factual observation</dt><dd>${escapeHtml(suspected.factualObservation || "Not specified")}</dd><dt>Creator interpretation</dt><dd>${escapeHtml(suspected.creatorInterpretation || "Not specified")}</dd></dl></section>` : ""}
  <section>
    <h2>Certification and Disclaimers</h2>
    <p class="notice">${escapeHtml(RIGHTS_DISCLAIMER)} This dossier is private by default and is derived from the canonical Creator Rights Record. It does not independently determine infringement, authorship, or legal ownership.</p>
  </section>
</main>
</body>
</html>`;
}

export async function nextDossierVersion(recordId: string) {
  const admin = getSupabaseAdminClient() as any;
  const { count, error } = await admin
    .from("creator_rights_dossiers")
    .select("id", { count: "exact", head: true })
    .eq("record_id", recordId);
  if (error) throw error;
  return (count || 0) + 1;
}

export async function persistDossierSnapshot(args: {
  recordId: string;
  userId: string;
  snapshot: ReturnType<typeof buildDossierSnapshot>;
}) {
  const admin = getSupabaseAdminClient() as any;
  const { error } = await admin.from("creator_rights_dossiers").insert({
    id: args.snapshot.dossierId,
    record_id: args.recordId,
    user_id: args.userId,
    dossier_version: args.snapshot.manifest.dossierVersion,
    purpose: args.snapshot.manifest.purpose,
    snapshot_json: args.snapshot.manifest as unknown as Json,
    manifest_sha256: args.snapshot.exportHashes.manifestSha256,
    export_hashes: args.snapshot.exportHashes as unknown as Json,
  });
  if (error) throw error;
}
