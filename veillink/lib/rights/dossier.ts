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

export type DossierPackageFile = DossierFileEntry & {
  content: string;
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
  dossierCode: string;
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

function packageFile(args: Omit<DossierFileEntry, "sha256" | "sizeBytes"> & { content: string }): DossierPackageFile {
  return {
    ...args,
    sha256: sha256Hex(args.content),
    sizeBytes: bytes(args.content),
  };
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

function humanDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function dossierCode(dossierId: string, generatedAt: string) {
  const year = new Date(generatedAt).getUTCFullYear();
  return `DOS-${year}-${sha256Hex(dossierId).slice(0, 10).toUpperCase()}`;
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

function markdownTimeline(timeline: DossierTimelineEntry[]) {
  return [
    "# Timeline",
    "",
    ...(
      timeline.length
        ? timeline.flatMap((entry) => [
            `## ${entry.date}`,
            "",
            `Event: ${entry.label}`,
            `Evidence class: ${titleCase(entry.evidenceClass)}`,
            `Source: ${entry.source}`,
            "",
          ])
        : ["No dated timeline entries were available for this dossier.", ""]
    ),
  ].join("\n");
}

function packageReadme(args: {
  record: CreatorRightsRecord;
  manifest: CreatorDossierManifest;
}) {
  return [
    "# Creator Dossier",
    "",
    `Dossier ID: ${args.manifest.dossierCode}`,
    "",
    `Generated: ${humanDate(args.manifest.generatedAt)}`,
    "",
    `Purpose: ${titleCase(args.manifest.purpose)}`,
    "",
    `Work: ${args.record.title}`,
    "",
    "## Contents",
    "",
    "LICENSE",
    "Canonical license or rights notice.",
    "",
    "LICENSE-SUMMARY.md",
    "Plain-language explanation.",
    "",
    "SFR.md",
    "Registry framework declaration.",
    "",
    "CREATOR-RIGHTS-RECORD.json",
    "Canonical machine-readable record.",
    "",
    "DOSSIER-MANIFEST.json",
    "Integrity manifest.",
    "",
    "CREATOR-DOSSIER.html",
    "Professional printable view.",
    "",
    "Timeline.md",
    "Publication and verification history.",
    "",
    "This package supplements the selected copyright license. It does not replace or modify that license.",
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
  const sourceFiles: DossierPackageFile[] = [
    packageFile({
      path: "CREATOR-RIGHTS-RECORD.json",
      role: "canonical_record",
      mimeType: "application/json",
      evidenceClass: "verified_fact",
      content: recordJson,
    }),
    packageFile({
      path: "RIGHTS-SUMMARY.md",
      role: "human_summary",
      mimeType: "text/markdown",
      evidenceClass: "creator_declaration",
      content: rightsSummary,
    }),
    packageFile({
      path: "LICENSE-SUMMARY.md",
      role: "license_summary",
      mimeType: "text/markdown",
      evidenceClass: "creator_declaration",
      content: licenseSummaryText,
    }),
    packageFile({
      path: "LICENSE",
      role: license.spdxId ? "canonical_license_reference" : "rights_notice",
      mimeType: "text/plain",
      evidenceClass: "creator_declaration",
      content: licenseText,
    }),
    packageFile({
      path: "SFR.md",
      role: "registry_framework",
      mimeType: "text/markdown",
      evidenceClass: "creator_declaration",
      content: sfrText,
    }),
  ];
  const files: DossierFileEntry[] = sourceFiles.map(({ content: _content, ...file }) => file);
  const timeline = buildTimeline(args.record, verification);
  const packageSha256 = sha256Hex(files.map((file) => `${file.sha256}  ${file.path}`).join("\n"));
  const publicDossierCode = dossierCode(dossierId, now);
  const manifestWithoutHash = {
    dossierId,
    dossierCode: publicDossierCode,
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
  const manifestJson = JSON.stringify(manifest, null, 2);
  const timelineText = markdownTimeline(timeline);
  const packageFiles: DossierPackageFile[] = [
    packageFile({
      path: "CREATOR-DOSSIER.html",
      role: "print_ready_html",
      mimeType: "text/html",
      evidenceClass: "creator_declaration",
      content: html,
    }),
    packageFile({
      path: "DOSSIER-MANIFEST.json",
      role: "package_manifest",
      mimeType: "application/json",
      evidenceClass: "verified_fact",
      content: manifestJson,
    }),
    packageFile({
      path: "Timeline.md",
      role: "timeline",
      mimeType: "text/markdown",
      evidenceClass: "creator_declaration",
      content: timelineText,
    }),
    ...sourceFiles,
    packageFile({
      path: "README.md",
      role: "package_readme",
      mimeType: "text/markdown",
      evidenceClass: "creator_declaration",
      content: packageReadme({ record: args.record, manifest }),
    }),
  ].sort((a, b) => a.path.localeCompare(b.path));
  return {
    dossierId,
    manifest,
    html,
    packageFiles,
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
      <dt>Dossier code</dt><dd>${escapeHtml(manifest.dossierCode)}</dd>
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

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
  const year = 2026 - 1980;
  const month = 7;
  const day = 29;
  const hour = 12;
  const minute = 0;
  const second = 0;
  return {
    time: (hour << 11) | (minute << 5) | Math.floor(second / 2),
    date: (year << 9) | (month << 5) | day,
  };
}

export function buildDossierZip(files: DossierPackageFile[]) {
  const encoder = new TextEncoder();
  const { date, time } = dosDateTime();
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const name = Buffer.from(file.path.replace(/\\/g, "/"), "utf8");
    const data = Buffer.from(encoder.encode(file.content));
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralOffset = offset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}
