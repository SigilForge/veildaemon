import { z } from "zod";

export const RIGHTS_SCHEMA_VERSION = "1.0";
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
  "screenplay",
  "game",
  "visual_art",
  "music",
  "software",
  "worldbuilding",
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

export const rightsPermissionSchema = z.enum(permissionValues);

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
  availability: z.enum(availabilityCategories).default("public"),
  description: z.string().trim().min(1).max(4000),
  creationDate: z.string().trim().max(40).optional().or(z.literal("")),
  publicationDate: z.string().trim().max(40).optional().or(z.literal("")),
  edition: z.string().trim().max(120).optional().or(z.literal("")),
  sourceUrl: z.string().trim().url().max(2048).optional().or(z.literal("")),
  externalIdentifier: z.string().trim().max(160).optional().or(z.literal("")),
  licensingContact: z.string().trim().max(320).optional().or(z.literal("")),
  copyrightNotice: z.string().trim().max(260).optional().or(z.literal("")),
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
export type WorkType = (typeof workTypes)[number];
export type AvailabilityCategory = (typeof availabilityCategories)[number];
export type AiPermissionBlock = z.infer<typeof aiPermissionBlockSchema>;
export type CreatorRightsInput = z.infer<typeof creatorRightsInputSchema>;

export type CreatorRightsRecord = {
  id: string;
  user_id?: string | null;
  record_id: string | null;
  slug: string;
  title: string;
  work_type: WorkType;
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
  rights_statement: string;
  ai_permissions: AiPermissionBlock;
  ai_permissions_summary: string;
  human_commercial_license_available: PermissionValue;
  record_status: RecordStatus;
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

export function workTypeLabel(value: WorkType) {
  return {
    book: "Book",
    screenplay: "Screenplay",
    game: "Interactive work",
    visual_art: "Visual art",
    music: "Music",
    software: "Software",
    worldbuilding: "Worldbuilding",
    other: "Other",
  }[value];
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
