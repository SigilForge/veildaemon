import { product } from "@/lib/config";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import {
  RIGHTS_DISCLAIMER,
  RIGHTS_SCHEMA_VERSION,
  RIGHTS_PRICE_CENTS,
  creatorRightsInputSchema,
  availabilityLabel,
  permissionLabel,
  type AiPermissionBlock,
  type AvailabilityCategory,
  type CreatorRightsInput,
  type CreatorRightsRecord,
} from "./schema";
import { isPublicRightsStatus } from "./lifecycle";

export const rightsPublicOrigin = "https://veildaemon.app";

export function recordUrl(slug: string) {
  return `${rightsPublicOrigin}/rights/${slug}`;
}

export function appRecordUrl(slug: string) {
  return `${product.appUrl.replace(/\/$/, "")}/rights/${slug}`;
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
}): CreatorRightsRecord {
  return {
    id: input.id,
    record_id: input.recordId,
    slug: input.slug,
    title: input.title,
    work_type: "game",
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
    availability: "public",
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
    work_type: "game",
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
    work_type: "worldbuilding",
    availability: "public",
    description: "Core player-facing rules and Operator identity structure for CradlePoint play.",
    creator_name: "J. Donavon Love",
    public_display_name: "S. KAELËN VALE",
    rights_holder_name: "SigilForge Studios",
    contact_email: "J.Donavon.Love@gmail.com",
    creation_date: "2025-01-01",
    publication_date: "2026-07-15",
    edition: "Public Operator core record",
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
  publishedTtrpgBookRecord({
    id: "example-handler-core",
    recordId: "SFR-2026-000004",
    slug: "cradlepoint-handler-core",
    title: "CradlePoint Handler Core",
    description: "Published Handler-facing core release pack for running CradlePoint sessions, clocks, consequences, cases, and table procedures.",
    edition: "Published Handler Core release pack",
    externalIdentifier: "Published/Paid/Handler Core",
    availability: "public",
  }),
  publishedTtrpgBookRecord({
    id: "example-field-dossier",
    recordId: "SFR-2026-000005",
    slug: "cradlepoint-field-dossier",
    title: "CradlePoint Field Dossier",
    description: "Published CradlePoint field reference and dossier text for tabletop orientation, setting procedure, and evidence-style play.",
    edition: "Published core book",
    externalIdentifier: "Published/Paid/Core Books/CRADLEPOINT FIELD DOSSIER.md",
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
  }),
  publishedTtrpgBookRecord({
    id: "example-systems-metaphysics",
    recordId: "SFR-2026-000010",
    slug: "cradlepoint-systems-metaphysics",
    title: "CradlePoint Systems Metaphysics",
    description: "Published systems and metaphysics reference for CradlePoint ontology, procedures, presentation logic, and setting rules.",
    edition: "Published core book",
    externalIdentifier: "Published/Paid/Core Books/CRADLEPOINT SYSTEMS METAPHYSICS.md",
    availability: "restricted",
  }),
];

export function rightsJson(record: CreatorRightsRecord) {
  return {
    recordType: "CreatorRightsRecord",
    schemaVersion: RIGHTS_SCHEMA_VERSION,
    recordId: record.record_id,
    status: record.record_status,
    availability: record.availability,
    availabilityLabel: availabilityLabel(record.availability),
    title: record.title,
    creator: record.public_display_name || record.creator_name,
    rightsHolder: record.rights_holder_name,
    recordedAt: record.published_at || record.created_at,
    publicationDate: record.publication_date,
    workVersion: record.edition,
    copyrightNotice: record.copyright_notice,
    permissions: record.ai_permissions,
    permissionsSummary: record.ai_permissions_summary,
    licenseContact: `/rights/${record.slug}/license`,
    publicRecordUrl: recordUrl(record.slug),
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

export function rightsJsonLd(record: CreatorRightsRecord) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: record.title,
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
  };
  const { data, error } = await admin.from("creator_rights_records").insert(insert).select("*").single();
  if (error) throw error;
  return data as CreatorRightsRecord;
}

export function permissionEntries(record: CreatorRightsRecord) {
  return Object.entries(record.ai_permissions).map(([key, value]) => ({
    key,
    label: key.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase()),
    value: permissionLabel(value),
  }));
}
