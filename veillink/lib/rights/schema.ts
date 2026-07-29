import { z } from "zod";

export const RIGHTS_SCHEMA_VERSION = "1.1";
export const RIGHTS_PRICE_CENTS = 999;
export const RIGHTS_DISCLAIMER =
  "This record documents the creator's declared ownership, rights position, and licensing preferences. It does not replace government copyright registration or independently prove legal ownership.";

export const permissionValues = [
  "allowed",
  "prohibited",
  "license_required",
  "research_only",
  "case_by_case",
  "custom_terms",
  "not_specified",
] as const;

export const recordStatuses = [
  "draft",
  "pending_payment",
  "paid",
  "published",
  "updated",
  "transferred",
  "disputed",
  "under_review",
  "withdrawn",
  "archived",
] as const;

export const workTypes = [
  "book",
  "short_story",
  "ttrpg",
  "artwork",
  "photography",
  "screenplay",
  "music",
  "audio",
  "video",
  "animation",
  "comic",
  "software",
  "game",
  "website",
  "dataset",
  "3d_model",
  "map",
  "asset_pack",
  "document",
  "research",
  "course",
  "other",
] as const;

export const categoryValues = [
  "fiction",
  "tabletop",
  "publishing",
  "technical",
  "software",
  "legal",
  "research",
  "marketing",
  "reference",
  "canon",
  "internal",
  "other",
] as const;

export const availabilityCategories = [
  "public",
  "licensed",
  "scheduled",
  "restricted",
  "internal",
  "archive_only",
  "redacted",
  "lost",
] as const;

export const catalogWorkTypes = [
  "book",
  "software",
  "game",
  "dataset",
  "music",
  "art",
  "video",
  "website",
  "model",
  "other",
] as const;

export const publisherTypes = [
  "individual",
  "studio",
  "company",
  "university",
  "nonprofit",
  "government",
  "other",
] as const;

export const licensingAvailabilityValues = [
  "unavailable",
  "contact",
  "open",
  "paid_license",
  "enterprise",
  "exclusive",
] as const;

export const commercialReadinessValues = [
  "inquiry_only",
  "template_available",
  "checkout_available",
  "enterprise_review_required",
] as const;

export const verificationLevels = [
  "declared",
  "surface_verified",
  "artifact_verified",
  "signed",
] as const;

export const verificationMethods = [
  "domain",
  "github",
  "publisher_profile",
  "package_registry",
  "signed_release",
  "sha256",
] as const;

export const copyrightLicenseIds = [
  "proprietary",
  "mit",
  "apache-2.0",
  "bsd-3-clause",
  "mpl-2.0",
  "gpl-3.0-only",
  "lgpl-3.0-only",
  "agpl-3.0-only",
  "unlicense",
  "cc-by-4.0",
  "cc-by-sa-4.0",
  "cc-by-nc-4.0",
  "cc0-1.0",
  "custom",
] as const;

export const registryFrameworkIds = ["sfr"] as const;

export const rightsPermissionSchema = z.enum(permissionValues);
export const copyrightLicenseIdSchema = z.enum(copyrightLicenseIds);
export const registryFrameworkIdSchema = z.enum(registryFrameworkIds);

export const aiPermissionBlockSchema = z.object({
  generalTraining: rightsPermissionSchema.default("license_required"),
  foundationModelPretraining: rightsPermissionSchema.default("license_required"),
  fineTuning: rightsPermissionSchema.default("prohibited"),
  embeddings: rightsPermissionSchema.default("license_required"),
  rag: rightsPermissionSchema.default("license_required"),
  generation: rightsPermissionSchema.default("license_required"),
  datasetRedistribution: rightsPermissionSchema.default("prohibited"),
  researchUse: rightsPermissionSchema.default("research_only"),
  commercialUse: rightsPermissionSchema.default("license_required"),
  attributionRequired: rightsPermissionSchema.default("license_required"),
  licenseRequired: rightsPermissionSchema.default("license_required"),
});

export const creatorRightsInputSchema = z.object({
  creatorName: z.string().trim().min(1).max(160),
  publicDisplayName: z.string().trim().min(1).max(160),
  rightsHolderName: z.string().trim().min(1).max(180),
  email: z.string().trim().email().max(320),
  title: z.string().trim().min(1).max(220),
  slug: z.string().trim().min(3).max(90).optional().or(z.literal("")),
  workType: z.enum(workTypes),
  category: z.enum(categoryValues).default("other"),
  availability: z.enum(availabilityCategories).default("public"),
  description: z.string().trim().min(1).max(4000),
  creationDate: z.string().trim().max(40).optional().or(z.literal("")),
  publicationDate: z.string().trim().max(40).optional().or(z.literal("")),
  edition: z.string().trim().max(120).optional().or(z.literal("")),
  sourceUrl: z.string().trim().url().max(2048).optional().or(z.literal("")),
  externalIdentifier: z.string().trim().max(160).optional().or(z.literal("")),
  licensingContact: z.string().trim().max(320).optional().or(z.literal("")),
  copyrightNotice: z.string().trim().max(260).optional().or(z.literal("")),
  copyrightLicenseId: copyrightLicenseIdSchema.default("proprietary"),
  rightsStatement: z.string().trim().min(1).max(4000),
  aiSummaryApproved: z.literal("yes"),
  permissions: aiPermissionBlockSchema,
  humanCommercialLicenseAvailable: rightsPermissionSchema.default("license_required"),
  fileName: z.string().trim().max(260).optional().or(z.literal("")),
  fileSize: z.coerce.number().int().nonnegative().optional(),
  mimeType: z.string().trim().max(160).optional().or(z.literal("")),
  sha256Hash: z.string().trim().regex(/^[a-f0-9]{64}$/i).optional().or(z.literal("")),
});

export type PermissionValue = (typeof permissionValues)[number];
export type RecordStatus = (typeof recordStatuses)[number];
export type KnownWorkType = (typeof workTypes)[number];
export type WorkType = KnownWorkType | (string & {});
export type CategoryValue = (typeof categoryValues)[number];
export type AvailabilityCategory = (typeof availabilityCategories)[number];
export type CatalogWorkType = (typeof catalogWorkTypes)[number];
export type PublisherType = (typeof publisherTypes)[number];
export type LicensingAvailability = (typeof licensingAvailabilityValues)[number];
export type CommercialReadiness = (typeof commercialReadinessValues)[number];
export type VerificationLevel = (typeof verificationLevels)[number];
export type VerificationMethod = (typeof verificationMethods)[number];
export type CopyrightLicenseId = (typeof copyrightLicenseIds)[number];
export type RegistryFrameworkId = (typeof registryFrameworkIds)[number];
export type AiPermissionBlock = z.infer<typeof aiPermissionBlockSchema>;
export type CreatorRightsInput = z.infer<typeof creatorRightsInputSchema>;

export type CreatorRightsRecord = {
  id: string;
  user_id?: string | null;
  record_id: string | null;
  slug: string;
  title: string;
  work_type: WorkType;
  category: CategoryValue | (string & {});
  availability: AvailabilityCategory;
  description: string;
  creator_name: string;
  public_display_name: string;
  rights_holder_name: string;
  contact_email: string;
  creation_date: string | null;
  publication_date: string | null;
  edition: string | null;
  external_identifier: string | null;
  source_url: string | null;
  licensing_contact: string | null;
  copyright_notice: string | null;
  copyright_license_id?: CopyrightLicenseId | (string & {}) | null;
  copyright_license_name?: string | null;
  copyright_license_spdx_id?: string | null;
  copyright_license_url?: string | null;
  registry_framework_id?: RegistryFrameworkId | (string & {}) | null;
  registry_framework_version?: string | null;
  rights_statement: string;
  ai_permissions: AiPermissionBlock;
  ai_permissions_summary: string;
  human_commercial_license_available: PermissionValue;
  record_status: RecordStatus;
  /** Durable issuance entitlement: none | active | revoked */
  entitlement_status?: "none" | "active" | "revoked" | null;
  /** Monotonic branded QR asset version under an active entitlement */
  qr_asset_version?: number | null;
  /** Last controlled QR customization preferences */
  qr_preferences?: Record<string, unknown> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_customer_id?: string | null;
  amount_paid?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  payment_confirmed_at?: string | null;
  filename?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  sha256_hash?: string | null;
  hash_created_at?: string | null;
};

export function permissionLabel(value: PermissionValue) {
  return {
    allowed: "Allowed",
    prohibited: "Prohibited",
    license_required: "License Required",
    research_only: "Research Only",
    case_by_case: "Case by Case",
    custom_terms: "Custom Terms",
    not_specified: "Not Specified",
  }[value];
}

function fallbackLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
}

export function workTypeLabel(value: string) {
  const labels: Record<KnownWorkType, string> = {
    book: "Book",
    short_story: "Short story",
    ttrpg: "TTRPG",
    artwork: "Artwork",
    photography: "Photography",
    screenplay: "Screenplay",
    music: "Music",
    audio: "Audio",
    video: "Video",
    animation: "Animation",
    comic: "Comic",
    software: "Software",
    game: "Game",
    website: "Website",
    dataset: "Dataset",
    "3d_model": "3D model",
    map: "Map",
    asset_pack: "Asset pack",
    document: "Document",
    research: "Research",
    course: "Course",
    other: "Other",
  };
  return value in labels ? labels[value as KnownWorkType] : fallbackLabel(value);
}

export function categoryLabel(value: string) {
  const labels: Record<CategoryValue, string> = {
    fiction: "Fiction",
    tabletop: "Tabletop",
    publishing: "Publishing",
    technical: "Technical",
    software: "Software",
    legal: "Legal",
    research: "Research",
    marketing: "Marketing",
    reference: "Reference",
    canon: "Canon",
    internal: "Internal",
    other: "Other",
  };
  return value in labels ? labels[value as CategoryValue] : fallbackLabel(value);
}

export function categoryOrDefault(value?: string | null) {
  return value || "other";
}

export function availabilityLabel(value: AvailabilityCategory) {
  return {
    public: "Public",
    licensed: "Licensed",
    scheduled: "Scheduled",
    restricted: "Restricted",
    internal: "Internal",
    archive_only: "Archive Only",
    redacted: "Redacted",
    lost: "Lost",
  }[value];
}

export function catalogWorkTypeFor(workType: string): CatalogWorkType {
  const mapped: Record<string, CatalogWorkType> = {
    book: "book",
    short_story: "book",
    ttrpg: "game",
    artwork: "art",
    photography: "art",
    screenplay: "book",
    music: "music",
    audio: "music",
    video: "video",
    animation: "video",
    comic: "book",
    software: "software",
    game: "game",
    website: "website",
    dataset: "dataset",
    "3d_model": "model",
    map: "art",
    asset_pack: "other",
    document: "book",
    research: "book",
    course: "video",
    other: "other",
  };
  return mapped[workType] || "other";
}

export function licensingAvailabilityFor(availability: AvailabilityCategory): LicensingAvailability {
  const mapped: Record<AvailabilityCategory, LicensingAvailability> = {
    public: "contact",
    licensed: "paid_license",
    scheduled: "contact",
    restricted: "contact",
    internal: "unavailable",
    archive_only: "unavailable",
    redacted: "unavailable",
    lost: "unavailable",
  };
  return mapped[availability];
}
