import { PRODUCTION_APP_URL, product } from "@/lib/config";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import {
  RIGHTS_DISCLAIMER,
  RIGHTS_SCHEMA_VERSION,
  RIGHTS_PRICE_CENTS,
  creatorRightsInputSchema,
  availabilityLabel,
  catalogWorkTypeFor,
  categoryOrDefault,
  categoryLabel,
  licensingAvailabilityFor,
  permissionLabel,
  workTypeLabel,
  type AiPermissionBlock,
  type AvailabilityCategory,
  type CategoryValue,
  type CreatorRightsInput,
  type CreatorRightsRecord,
  type LicensingAvailability,
} from "./schema";
import { isPublicRightsStatus } from "./lifecycle";
import { canEditRightsRecord, canGenerateRightsQrAssets } from "./entitlement";
import { effectiveVerification, type VerificationProjection } from "./verification";
import type { RightsQrPreferences } from "./qr-options";

/**
 * Durable public record host for issuance QR targets.
 * Prefer RIGHTS_PUBLIC_ORIGIN, then production app — never localhost in paid assets.
 */
export const rightsPublicOrigin = (process.env.RIGHTS_PUBLIC_ORIGIN || PRODUCTION_APP_URL).replace(/\/$/, "");

export function recordUrl(slug: string) {
  return `${rightsPublicOrigin}/rights/${slug}`;
}

export function appRecordUrl(slug: string) {
  const app = product.appUrl.replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(app)) return recordUrl(slug);
  return `${app}/rights/${slug}`;
}

export function slugFromTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildAiSummary(permissions: AiPermissionBlock) {
  const blocked = [
    permissions.generalTraining === "prohibited" ? "model training" : "",
    permissions.fineTuning === "prohibited" ? "fine-tuning" : "",
    permissions.datasetRedistribution === "prohibited" ? "dataset redistribution" : "",
  ].filter(Boolean);
  const licensed = [
    permissions.generalTraining === "license_required" ? "model training" : "",
    permissions.rag === "license_required" ? "retrieval use" : "",
    permissions.commercialUse === "license_required" ? "commercial use" : "",
  ].filter(Boolean);
  const allowed = [
    permissions.embeddings === "allowed" ? "embeddings" : "",
    permissions.researchUse === "research_only" ? "research use" : "",
  ].filter(Boolean);

  const sentences = [];
  if (blocked.length) sentences.push(`This work may not be used for ${blocked.join(", ")} without a separate written license.`);
  if (licensed.length) sentences.push(`${licensed.map((item) => item[0].toUpperCase() + item.slice(1)).join(", ")} require written permission.`);
  if (allowed.length) sentences.push(`${allowed.map((item) => item[0].toUpperCase() + item.slice(1)).join(", ")} are permitted only within the stated record terms.`);
  return sentences.join(" ") || "AI use permissions are not specified; contact the rights holder before use.";
}

export function normalizeRightsInput(raw: unknown) {
  const parsed = creatorRightsInputSchema.parse(raw);
  return {
    ...parsed,
    slug: parsed.slug ? slugFromTitle(parsed.slug) : slugFromTitle(parsed.title),
    aiPermissionsSummary: buildAiSummary(parsed.permissions),
  };
}

const defaultCradlePointAiPermissions: AiPermissionBlock = {
  generalTraining: "license_required",
  foundationModelPretraining: "license_required",
  fineTuning: "prohibited",
  embeddings: "license_required",
  rag: "license_required",
  generation: "license_required",
  datasetRedistribution: "prohibited",
  researchUse: "research_only",
  commercialUse: "license_required",
  attributionRequired: "license_required",
  licenseRequired: "license_required",
};

const ttrpgRightsStatement =
  "Original rules expression, terminology, procedures, table structures, and creative setting material are reserved except where a separate written agreement, Creator Rights Record, file-specific notice, or media-use guideline explicitly grants permission.";

const ttrpgAiSummary =
  "This work may not be used for model training, fine-tuning, or dataset redistribution without a separate written license. Retrieval use, generation, and commercial use require written permission.";

function publishedTtrpgBookRecord(input: {
  id: string;
  recordId: string;
  slug: string;
  title: string;
  description: string;
  edition: string;
  externalIdentifier: string;
  sourceUrl?: string;
  availability?: AvailabilityCategory;
  category?: CategoryValue;
  workType?: string;
}): CreatorRightsRecord {
  return {
    id: input.id,
    record_id: input.recordId,
    slug: input.slug,
    title: input.title,
    work_type: input.workType || "ttrpg",
    category: input.category || "tabletop",
    availability: input.availability || "licensed",
    description: input.description,
    creator_name: "J. Donavon Love",
    public_display_name: "S. KAELËN VALE",
    rights_holder_name: "SigilForge Studios",
    contact_email: "J.Donavon.Love@gmail.com",
    creation_date: "2025-01-01",
    publication_date: "2026-07-15",
    edition: input.edition,
    external_identifier: input.externalIdentifier,
    source_url: input.sourceUrl || "https://play.veildaemon.app/",
    licensing_contact: "J.Donavon.Love@gmail.com",
    copyright_notice: "© 2025-2026 J. Donavon Love, under the SigilForge Studios name",
    rights_statement: ttrpgRightsStatement,
    ai_permissions: defaultCradlePointAiPermissions,
    ai_permissions_summary: ttrpgAiSummary,
    human_commercial_license_available: "case_by_case",
    record_status: "published",
    published_at: "2026-07-27T00:00:00.000Z",
    created_at: "2026-07-27T00:00:00.000Z",
    updated_at: "2026-07-27T00:00:00.000Z",
    sha256_hash: null,
    hash_created_at: null,
  };
}

export const exampleRightsRecords: CreatorRightsRecord[] = [
  {
    id: "example-anchor-glitch",
    record_id: "SFR-2026-000001",
    slug: "the-anchor-and-the-glitch",
    title: "The Anchor and the Glitch",
    work_type: "book",
    category: "fiction",
    availability: "licensed",
    description: "CradlePoint Book One direct digital edition and associated publication record.",
    creator_name: "J. Donavon Love",
    public_display_name: "S. KAELËN VALE",
    rights_holder_name: "SigilForge Studios",
    contact_email: "J.Donavon.Love@gmail.com",
    creation_date: "2024-01-01",
    publication_date: "2026-07-23",
    edition: "Book One digital release",
    external_identifier: "SigilForge internal edition v47.2C",
    source_url: "https://veildaemon.app/studio/shelf/book-one/",
    licensing_contact: "J.Donavon.Love@gmail.com",
    copyright_notice: "© 2024-2026 J. Donavon Love, under the SigilForge Studios name",
    rights_statement: "All rights reserved except where a separate written agreement, Creator Rights Record, file-specific notice, or media-use guideline explicitly grants permission.",
    ai_permissions: {
      generalTraining: "license_required",
      foundationModelPretraining: "license_required",
      fineTuning: "prohibited",
      embeddings: "license_required",
      rag: "license_required",
      generation: "license_required",
      datasetRedistribution: "prohibited",
      researchUse: "research_only",
      commercialUse: "license_required",
      attributionRequired: "license_required",
      licenseRequired: "license_required",
    },
    ai_permissions_summary:
      "This work may not be used for fine-tuning or dataset redistribution without a separate written license. Model training, retrieval use, and commercial use require written permission.",
    human_commercial_license_available: "case_by_case",
    record_status: "published",
    published_at: "2026-07-27T00:00:00.000Z",
    created_at: "2026-07-27T00:00:00.000Z",
    updated_at: "2026-07-27T00:00:00.000Z",
    sha256_hash: null,
    hash_created_at: null,
  },
  {
    id: "example-sanguine-sacrament",
    record_id: "SFR-2026-000002",
    slug: "sanguine-sacrament",
    title: "Sanguine Sacrament",
    work_type: "ttrpg",
    category: "tabletop",
    availability: "scheduled",
    description: "A CradlePoint NeedlePoint case record for tabletop publication and licensing notice.",
    creator_name: "J. Donavon Love",
    public_display_name: "S. KAELËN VALE",
    rights_holder_name: "SigilForge Studios",
    contact_email: "J.Donavon.Love@gmail.com",
    creation_date: "2026-01-01",
    publication_date: "2026-07-15",
    edition: "NeedlePoint release record",
    external_identifier: "SigilForge NeedlePoint",
    source_url: "https://veildaemon.app/studio/shelf/",
    licensing_contact: "J.Donavon.Love@gmail.com",
    copyright_notice: "© 2026 J. Donavon Love, under the SigilForge Studios name",
    rights_statement: "Original text, table structure, pressure grammar, and setting expression remain owned by the rights holder unless separately licensed.",
    ai_permissions: {
      generalTraining: "license_required",
      foundationModelPretraining: "license_required",
      fineTuning: "prohibited",
      embeddings: "license_required",
      rag: "license_required",
      generation: "license_required",
      datasetRedistribution: "prohibited",
      researchUse: "research_only",
      commercialUse: "license_required",
      attributionRequired: "license_required",
      licenseRequired: "license_required",
    },
    ai_permissions_summary:
      "This work may not be used for fine-tuning or dataset redistribution without a separate written license. Commercial AI use requires written permission.",
    human_commercial_license_available: "case_by_case",
    record_status: "published",
    published_at: "2026-07-27T00:00:00.000Z",
    created_at: "2026-07-27T00:00:00.000Z",
    updated_at: "2026-07-27T00:00:00.000Z",
    sha256_hash: null,
    hash_created_at: null,
  },
  {
    id: "example-operator-core",
    record_id: "SFR-2026-000003",
    slug: "cradlepoint-operator-core",
    title: "CradlePoint Operator Core",
    work_type: "ttrpg",
    category: "tabletop",
    availability: "licensed",
    description: "Player PDF pack with the rules, identity structure, and table-facing material an Operator needs for CradlePoint play.",
    creator_name: "J. Donavon Love",
    public_display_name: "S. KAELËN VALE",
    rights_holder_name: "SigilForge Studios",
    contact_email: "J.Donavon.Love@gmail.com",
    creation_date: "2025-01-01",
    publication_date: "2026-07-15",
    edition: "Published Operator Core PDF pack",
    external_identifier: "SigilForge rules corpus",
    source_url: "https://veildaemon.app/operator/",
    licensing_contact: "J.Donavon.Love@gmail.com",
    copyright_notice: "© 2025-2026 J. Donavon Love, under the SigilForge Studios name",
    rights_statement: "Original rules expression, terminology, and creative setting material are reserved except where a separate written agreement, Creator Rights Record, file-specific notice, or media-use guideline explicitly grants permission.",
    ai_permissions: {
      generalTraining: "license_required",
      foundationModelPretraining: "license_required",
      fineTuning: "prohibited",
      embeddings: "allowed",
      rag: "license_required",
      generation: "license_required",
      datasetRedistribution: "prohibited",
      researchUse: "research_only",
      commercialUse: "license_required",
      attributionRequired: "license_required",
      licenseRequired: "license_required",
    },
    ai_permissions_summary:
      "This work may not be used for model training, fine-tuning, or dataset redistribution without a separate written license. Embeddings for search are permitted with attribution under the stated terms.",
    human_commercial_license_available: "case_by_case",
    record_status: "published",
    published_at: "2026-07-27T00:00:00.000Z",
    created_at: "2026-07-27T00:00:00.000Z",
    updated_at: "2026-07-27T00:00:00.000Z",
    sha256_hash: null,
    hash_created_at: null,
  },
  {
    id: "example-veildaemon",
    record_id: "SFR-2026-000011",
    slug: "veildaemon",
    title: "VeilDaemon",
    work_type: "software",
    category: "software",
    availability: "restricted",
    description: "Production SaaS and public platform software operated by SigilForge Studios, including the public surface, Creator Rights Records, QR infrastructure, licensing workflows, and related service logic.",
    creator_name: "J. Donavon Love",
    public_display_name: "SigilForge Studios",
    rights_holder_name: "SigilForge Studios",
    contact_email: "J.Donavon.Love@gmail.com",
    creation_date: "2024-01-01",
    publication_date: "2025-06-01",
    edition: "First public live platform record",
    external_identifier: "VeilDaemon.app production SaaS",
    source_url: "https://veildaemon.app/",
    licensing_contact: "J.Donavon.Love@gmail.com",
    copyright_notice: "© 2024-2026 J. Donavon Love, under the SigilForge Studios name",
    rights_statement: "VeilDaemon is proprietary commercial software. Unless a file-specific written notice or separate written agreement explicitly says otherwise, no rights are granted to copy, modify, redistribute, host, sublicense, sell, publish, or create derivative works from the software, service implementation, business logic, APIs, MCP services, QR generation, Creator Rights Registry, Relay backend, or related platform code.",
    ai_permissions: {
      generalTraining: "license_required",
      foundationModelPretraining: "license_required",
      fineTuning: "prohibited",
      embeddings: "license_required",
      rag: "license_required",
      generation: "license_required",
      datasetRedistribution: "prohibited",
      researchUse: "research_only",
      commercialUse: "license_required",
      attributionRequired: "license_required",
      licenseRequired: "license_required",
    },
    ai_permissions_summary:
      "This software, service implementation, business logic, API surface, and related platform code may not be used for model training, fine-tuning, dataset redistribution, cloning, self-hosting, or commercial AI use without a separate written license.",
    human_commercial_license_available: "case_by_case",
    record_status: "published",
    published_at: "2026-07-27T00:00:00.000Z",
    created_at: "2026-07-27T00:00:00.000Z",
    updated_at: "2026-07-27T00:00:00.000Z",
    sha256_hash: null,
    hash_created_at: null,
  },
  {
    id: "example-veilforge",
    record_id: "SFR-2026-000012",
    slug: "veilforge",
    title: "VeilForge",
    work_type: "software",
    category: "software",
    availability: "public",
    description: "MPL 2.0 local-first AI runtime and orchestration engine for terminal workflows, governed automation, explicit safety gates, permission-gated tool execution, and traceable runtime state.",
    creator_name: "J. Donavon Love",
    public_display_name: "SigilForge Studios",
    rights_holder_name: "SigilForge Studios",
    contact_email: "J.Donavon.Love@gmail.com",
    creation_date: "2025-11-29",
    publication_date: "2025-12-02",
    edition: "VeilForge 0.2.2 development runtime record",
    external_identifier: "Python package veilforge; local-first governed runtime",
    source_url: "https://github.com/VeilForge/VeilForge",
    licensing_contact: "J.Donavon.Love@gmail.com",
    copyright_notice: "© 2025-2026 J. Donavon Love, under the SigilForge Studios name",
    rights_statement: "VeilForge is intended to be licensed under the Mozilla Public License 2.0. Improvements to MPL-covered source files must follow MPL 2.0 obligations, while separately authored works, extensions, deployments, services, product names, trademarks, and studio-specific integrations may remain under their own terms unless explicitly licensed otherwise.",
    ai_permissions: {
      generalTraining: "license_required",
      foundationModelPretraining: "license_required",
      fineTuning: "prohibited",
      embeddings: "allowed",
      rag: "allowed",
      generation: "license_required",
      datasetRedistribution: "license_required",
      researchUse: "research_only",
      commercialUse: "license_required",
      attributionRequired: "license_required",
      licenseRequired: "license_required",
    },
    ai_permissions_summary:
      "VeilForge source covered by MPL 2.0 may be used under that license. Model training, fine-tuning, dataset redistribution, hosted cloning, enterprise deployment, trademark use, and commercial AI use should be reviewed against MPL 2.0, file-specific notices, and any separately published product terms.",
    human_commercial_license_available: "case_by_case",
    record_status: "published",
    published_at: "2026-07-27T00:00:00.000Z",
    created_at: "2026-07-27T00:00:00.000Z",
    updated_at: "2026-07-27T00:00:00.000Z",
    sha256_hash: null,
    hash_created_at: null,
  },
  publishedTtrpgBookRecord({
    id: "example-handler-core",
    recordId: "SFR-2026-000004",
    slug: "cradlepoint-handler-core",
    title: "CradlePoint Handler Core",
    description: "Published Handler PDF pack for running CradlePoint sessions, clocks, consequences, cases, and table procedures.",
    edition: "Published Handler Core PDF pack",
    externalIdentifier: "Published/Paid/Handler Core",
    availability: "licensed",
  }),
  publishedTtrpgBookRecord({
    id: "example-field-dossier",
    recordId: "SFR-2026-000005",
    slug: "cradlepoint-field-dossier",
    title: "CradlePoint Field Dossier",
    description: "Published CradlePoint field reference and dossier text for tabletop orientation, setting procedure, and evidence-style play.",
    edition: "Published core book",
    externalIdentifier: "Published/Paid/Core Books/CRADLEPOINT FIELD DOSSIER.md",
    workType: "document",
    category: "reference",
  }),
  publishedTtrpgBookRecord({
    id: "example-handler-expansion-myth-tech-epic-lotus",
    recordId: "SFR-2026-000006",
    slug: "cradlepoint-handler-expansion-myth-tech-and-the-epic-lotus",
    title: "CradlePoint Handler Expansion: Myth-Tech and the Epic Lotus",
    description: "Published Handler expansion covering myth-tech procedures, the Epic Lotus, and advanced CradlePoint table material.",
    edition: "Published core book",
    externalIdentifier: "Published/Paid/Core Books/CRADLEPOINT HANDLER EXPANSION - MYTH-TECH & THE EPIC LOTUS.md",
    availability: "scheduled",
  }),
  publishedTtrpgBookRecord({
    id: "example-handler-guide",
    recordId: "SFR-2026-000007",
    slug: "cradlepoint-handler-guide",
    title: "CradlePoint Handler Guide",
    description: "Published facilitator-facing guide for Handler procedures, scene pressure, cases, consequences, and campaign operation.",
    edition: "Published core book",
    externalIdentifier: "Published/Paid/Core Books/CRADLEPOINT HANDLER GUIDE.md",
    workType: "document",
  }),
  publishedTtrpgBookRecord({
    id: "example-monster-manual",
    recordId: "SFR-2026-000008",
    slug: "cradlepoint-monster-manual",
    title: "CradlePoint Monster Manual",
    description: "Published creature, anomaly, and opposition reference for CradlePoint tabletop play and Handler preparation.",
    edition: "Published core book",
    externalIdentifier: "Published/Paid/Core Books/CRADLEPOINT MONSTER MANUAL.md",
    availability: "scheduled",
  }),
  publishedTtrpgBookRecord({
    id: "example-operator-guide",
    recordId: "SFR-2026-000009",
    slug: "cradlepoint-operator-guide",
    title: "CradlePoint Operator Guide",
    description: "Published player-facing guide for Operator creation, advancement, presentations, field procedure, and table play.",
    edition: "Published core book",
    externalIdentifier: "Published/Paid/Core Books/CRADLEPOINT OPERATOR GUIDE.md",
    workType: "document",
  }),
  publishedTtrpgBookRecord({
    id: "example-systems-metaphysics",
    recordId: "SFR-2026-000010",
    slug: "cradlepoint-systems-metaphysics",
    title: "CradlePoint Systems Metaphysics",
    description: "Published systems and metaphysics reference for CradlePoint ontology, procedures, presentation logic, and setting rules.",
    edition: "Published core book",
    externalIdentifier: "Published/Paid/Core Books/CRADLEPOINT SYSTEMS METAPHYSICS.md",
    workType: "document",
    category: "internal",
    availability: "restricted",
  }),
];

export function rightsJson(record: CreatorRightsRecord, verification?: VerificationProjection) {
  const hasFingerprint = Boolean(record.sha256_hash);
  const verificationState = verification || effectiveVerification(record);
  const licenseContact = `/rights/${record.slug}/license`;
  const canonicalUrl = recordUrl(record.slug);
  const licensingAvailability: LicensingAvailability = record.rights_holder_name === "SigilForge Studios"
    ? "paid_license"
    : licensingAvailabilityFor(record.availability);

  return {
    recordType: "CreatorRightsRecord",
    schemaVersion: RIGHTS_SCHEMA_VERSION,
    recordId: record.record_id,
    status: record.record_status,
    workType: record.work_type,
    workTypeLabel: workTypeLabel(record.work_type),
    category: categoryOrDefault(record.category),
    categoryLabel: categoryLabel(categoryOrDefault(record.category)),
    availability: record.availability,
    availabilityLabel: availabilityLabel(record.availability),
    work: {
      type: catalogWorkTypeFor(record.work_type),
      category: categoryOrDefault(record.category),
    },
    publisher: {
      type: record.rights_holder_name === "SigilForge Studios" ? "studio" : "individual",
    },
    title: record.title,
    creator: record.public_display_name || record.creator_name,
    rightsHolder: record.rights_holder_name,
    recordedAt: record.published_at || record.created_at,
    publicationDate: record.publication_date,
    workVersion: record.edition,
    copyrightNotice: record.copyright_notice,
    permissions: record.ai_permissions,
    permissionsSummary: record.ai_permissions_summary,
    aiPolicy: {
      effectiveFrom: "2026-07-28",
      appliesTo: [
        "model_training",
        "fine_tuning",
        "retrieval",
        "generation",
        "commercial_output",
      ],
    },
    licensing: {
      availability: licensingAvailability,
      commercialReadiness: "inquiry_only",
      contactUrl: licenseContact,
    },
    verification: verificationState,
    technicalArtifacts: {
      jsonAvailable: true,
      canonicalUrl: true,
      sha256Available: hasFingerprint,
      signatureAvailable: false,
      versionHistoryAvailable: true,
    },
    licenseContact,
    publicRecordUrl: canonicalUrl,
    fileFingerprint: record.sha256_hash
      ? {
          algorithm: "SHA-256",
          value: record.sha256_hash,
          filename: record.filename,
          fileSize: record.file_size,
          mimeType: record.mime_type,
          createdAt: record.hash_created_at,
        }
      : null,
    disclaimer: RIGHTS_DISCLAIMER,
  };
}

export function schemaTypeForWorkType(workType: string) {
  const schemaTypes: Record<string, string> = {
    book: "Book",
    artwork: "VisualArtwork",
    photography: "Photograph",
    music: "MusicComposition",
    audio: "AudioObject",
    video: "VideoObject",
    software: "SoftwareApplication",
    game: "Game",
    website: "WebSite",
    dataset: "Dataset",
    research: "ScholarlyArticle",
    course: "Course",
  };
  return schemaTypes[workType] || "CreativeWork";
}

export function rightsJsonLd(record: CreatorRightsRecord) {
  return {
    "@context": "https://schema.org",
    "@type": schemaTypeForWorkType(record.work_type),
    name: record.title,
    genre: categoryLabel(categoryOrDefault(record.category)),
    creator: record.public_display_name || record.creator_name,
    copyrightHolder: record.rights_holder_name,
    copyrightNotice: record.copyright_notice,
    dateCreated: record.creation_date,
    datePublished: record.publication_date,
    version: record.edition,
    url: recordUrl(record.slug),
    identifier: record.record_id || record.id,
    conditionsOfAccess: `${availabilityLabel(record.availability)}. ${record.ai_permissions_summary}`,
  };
}

export async function findRightsRecord(slug: string) {
  const example = exampleRightsRecords.find((record) => record.slug === slug);
  try {
    const admin = getSupabaseAdminClient() as any;
    const { data, error } = await admin
      .from("creator_rights_records")
      .select("*")
      .eq("slug", slug)
      .in("record_status", ["published", "updated", "transferred", "disputed", "under_review", "withdrawn", "archived"])
      .maybeSingle();
    if (!error && data) return data as CreatorRightsRecord;
  } catch {
    return example || null;
  }
  return example || null;
}

export function recordIsPublic(record: CreatorRightsRecord) {
  return isPublicRightsStatus(record.record_status);
}

export async function listOwnedRightsRecords(userId: string) {
  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("creator_rights_records")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CreatorRightsRecord[];
}

export async function getOwnedRightsRecord(userId: string, id: string) {
  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("creator_rights_records")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("Rights record not found.");
  return data as CreatorRightsRecord;
}

export async function attachRightsCheckoutSession(userId: string, id: string, checkoutSessionId: string) {
  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("creator_rights_records")
    .update({
      record_status: "pending_payment",
      stripe_checkout_session_id: checkoutSessionId,
      currency: "usd",
      payment_status: "pending",
    })
    .eq("id", id)
    .eq("user_id", userId)
    .in("record_status", ["draft", "pending_payment"])
    .select("*")
    .single();
  if (error || !data) throw new Error("Rights record checkout session could not be attached.");
  await admin.from("creator_rights_payment_attempts").insert({
    record_id: id,
    user_id: userId,
    stripe_checkout_session_id: checkoutSessionId,
    amount_expected: RIGHTS_PRICE_CENTS,
    currency: "usd",
    attempt_status: "pending",
  });
  return data as CreatorRightsRecord;
}

export async function markRightsCheckoutExpired(id: string, checkoutSessionId: string) {
  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("creator_rights_records")
    .update({
      record_status: "draft",
      payment_status: "expired",
    })
    .eq("id", id)
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .eq("record_status", "pending_payment")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  await admin
    .from("creator_rights_payment_attempts")
    .update({ attempt_status: "expired" })
    .eq("record_id", id)
    .eq("stripe_checkout_session_id", checkoutSessionId);
  return (data || null) as CreatorRightsRecord | null;
}

export async function publishRightsRecordFromCheckout(args: {
  recordId: string;
  ownerUserId: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  stripeCustomerId: string | null;
  amountPaid: number;
  currency: string;
  paymentStatus: "paid";
}) {
  const admin = getSupabaseAdminClient() as any;
  await admin
    .from("creator_rights_records")
    .update({ record_status: "paid", payment_status: "paid" })
    .eq("id", args.recordId)
    .eq("user_id", args.ownerUserId)
    .eq("stripe_checkout_session_id", args.checkoutSessionId)
    .eq("record_status", "pending_payment");
  const { data, error } = await admin.rpc("creator_rights_publish_record", {
    record_id_input: args.recordId,
    actor_user_id_input: args.ownerUserId,
    checkout_session_id_input: args.checkoutSessionId,
    payment_intent_id_input: args.paymentIntentId,
    stripe_customer_id_input: args.stripeCustomerId,
    amount_paid_input: args.amountPaid,
    currency_input: args.currency,
    payment_status_input: args.paymentStatus,
    internal_publication_input: false,
  });
  if (error) throw error;
  await admin
    .from("creator_rights_payment_attempts")
    .update({
      stripe_payment_intent_id: args.paymentIntentId,
      stripe_customer_id: args.stripeCustomerId,
      amount_paid: args.amountPaid,
      attempt_status: "paid",
      completed_at: new Date().toISOString(),
    })
    .eq("record_id", args.recordId)
    .eq("stripe_checkout_session_id", args.checkoutSessionId);
  return data as CreatorRightsRecord;
}

export async function createDraftRightsRecord(userId: string, input: CreatorRightsInput) {
  const normalized = normalizeRightsInput(input);
  const admin = getSupabaseAdminClient() as any;
  const insert = {
    user_id: userId,
    slug: normalized.slug,
    title: normalized.title,
    work_type: normalized.workType,
    category: normalized.category,
    availability: normalized.availability,
    description: normalized.description,
    creator_name: normalized.creatorName,
    public_display_name: normalized.publicDisplayName,
    rights_holder_name: normalized.rightsHolderName,
    contact_email: normalized.email,
    creation_date: normalized.creationDate || null,
    publication_date: normalized.publicationDate || null,
    edition: normalized.edition || null,
    external_identifier: normalized.externalIdentifier || null,
    source_url: normalized.sourceUrl || null,
    licensing_contact: normalized.licensingContact || normalized.email,
    copyright_notice: normalized.copyrightNotice || null,
    rights_statement: normalized.rightsStatement,
    ai_permissions: normalized.permissions as unknown as Json,
    ai_permissions_summary: normalized.aiPermissionsSummary,
    human_commercial_license_available: normalized.humanCommercialLicenseAvailable,
    filename: normalized.fileName || null,
    file_size: normalized.fileSize || null,
    mime_type: normalized.mimeType || null,
    sha256_hash: normalized.sha256Hash || null,
    hash_created_at: normalized.sha256Hash ? new Date().toISOString() : null,
    entitlement_status: "none",
    qr_asset_version: 0,
    qr_preferences: {},
  };
  const { data, error } = await admin.from("creator_rights_records").insert(insert).select("*").single();
  if (error) throw error;
  return data as CreatorRightsRecord;
}

const draftEditableKeys = [
  "title",
  "description",
  "creator_name",
  "public_display_name",
  "rights_holder_name",
  "creation_date",
  "publication_date",
  "edition",
  "external_identifier",
  "source_url",
  "licensing_contact",
  "copyright_notice",
  "rights_statement",
  "ai_permissions",
  "ai_permissions_summary",
  "human_commercial_license_available",
  "work_type",
  "category",
  "availability",
  "filename",
  "file_size",
  "mime_type",
  "sha256_hash",
] as const;

/** Limited fields an entitled creator may update after issuance (versioned). */
const publishedEditableKeys = [
  "description",
  "licensing_contact",
  "copyright_notice",
  "rights_statement",
  "ai_permissions",
  "ai_permissions_summary",
  "human_commercial_license_available",
  "availability",
  "edition",
  "source_url",
  "filename",
  "file_size",
  "mime_type",
  "sha256_hash",
] as const;

export async function updateOwnedRightsRecord(
  userId: string,
  id: string,
  patch: Partial<CreatorRightsRecord> & { permissions?: AiPermissionBlock; aiPermissionsSummary?: string }
) {
  const current = await getOwnedRightsRecord(userId, id);
  if (!canEditRightsRecord(current)) {
    throw Object.assign(new Error("This rights record cannot be edited in its current state."), { status: 409 });
  }

  const allowed = new Set(
    current.record_status === "draft" || current.record_status === "pending_payment"
      ? draftEditableKeys
      : publishedEditableKeys
  );

  const update: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    if (key === "permissions" && patch.permissions && allowed.has("ai_permissions")) {
      update.ai_permissions = patch.permissions;
      update.ai_permissions_summary = patch.aiPermissionsSummary || buildAiSummary(patch.permissions);
      continue;
    }
    if (typeof key === "string" && allowed.has(key as (typeof draftEditableKeys)[number]) && patch[key] !== undefined) {
      update[key] = patch[key];
    }
  }

  if (Object.keys(update).length === 0) {
    throw Object.assign(new Error("No editable fields provided."), { status: 400 });
  }

  if (patch.sha256_hash || update.sha256_hash) {
    update.hash_created_at = new Date().toISOString();
  }

  // Issued records stay public under "updated" when metadata changes.
  if (isPublicRightsStatus(current.record_status) || current.record_status === "published") {
    update.record_status = current.record_status === "published" ? "updated" : current.record_status;
  }

  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("creator_rights_records")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw Object.assign(new Error(error?.message || "Rights record could not be updated."), { status: 500 });

  if (isPublicRightsStatus((data as CreatorRightsRecord).record_status)) {
    const { count } = await admin
      .from("creator_rights_record_versions")
      .select("id", { count: "exact", head: true })
      .eq("record_id", id);
    await admin.from("creator_rights_record_versions").insert({
      record_id: id,
      version_number: (count || 0) + 1,
      snapshot_json: data,
      change_summary: "Creator metadata update",
      created_by: userId,
    });
  }

  return data as CreatorRightsRecord;
}

/** Persist controlled QR preferences and bump QR asset version for an issued record. */
export async function saveOwnedRightsQrPreferences(userId: string, id: string, preferences: RightsQrPreferences) {
  const current = await getOwnedRightsRecord(userId, id);
  if (!canGenerateRightsQrAssets(current)) {
    throw Object.assign(new Error("Publish this Rights Record before saving branded QR assets."), { status: 402 });
  }

  const nextVersion = Math.max(1, Number(current.qr_asset_version || 0) + 1);
  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("creator_rights_records")
    .update({
      qr_preferences: preferences as unknown as Json,
      qr_asset_version: nextVersion,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw Object.assign(new Error(error?.message || "QR preferences could not be saved."), { status: 500 });
  return data as CreatorRightsRecord;
}

export function permissionEntries(record: CreatorRightsRecord) {
  return Object.entries(record.ai_permissions).map(([key, value]) => ({
    key,
    label: key.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase()),
    value: permissionLabel(value),
  }));
}
