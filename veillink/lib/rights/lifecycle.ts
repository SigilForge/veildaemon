import type { CreatorRightsRecord, RecordStatus } from "./schema";

export const privatePrePublicationStatuses: RecordStatus[] = ["draft", "pending_payment", "paid"];
export const publicRecordStatuses: RecordStatus[] = [
  "published",
  "updated",
  "transferred",
  "disputed",
  "under_review",
  "withdrawn",
  "archived",
];

export type RightsPublicationAuthority =
  | {
      kind: "stripe_webhook";
      checkoutSessionId: string;
      paymentIntentId: string;
      paymentStatus: "paid";
      amountPaid: number;
      currency: string;
      stripeCustomerId?: string | null;
      confirmedAt: string;
    }
  | {
      kind: "internal";
      actorUserId: string;
      reason: string;
      confirmedAt: string;
    };

export function isPublicRightsStatus(status: RecordStatus) {
  return publicRecordStatuses.includes(status);
}

export function isPrivatePrePublicationStatus(status: RecordStatus) {
  return privatePrePublicationStatuses.includes(status);
}

export function canCreateCheckout(status: RecordStatus) {
  return status === "draft" || status === "pending_payment";
}

export function assertCanPublish(record: Pick<CreatorRightsRecord, "record_status" | "published_at">, authority: RightsPublicationAuthority) {
  if (authority.kind === "stripe_webhook" && authority.paymentStatus !== "paid") {
    throw new Error("Rights record publication requires a paid Stripe Checkout Session.");
  }
  if (record.record_status === "withdrawn" || record.record_status === "archived") {
    throw new Error("Withdrawn or archived rights records cannot be republished.");
  }
  if (isPublicRightsStatus(record.record_status) && record.published_at) {
    throw new Error("Rights record is already published; create a new immutable version instead.");
  }
  if (!privatePrePublicationStatuses.includes(record.record_status)) {
    throw new Error(`Rights record cannot publish from ${record.record_status}.`);
  }
}

export function buildVersionSnapshot(record: CreatorRightsRecord) {
  return {
    recordType: "CreatorRightsRecordSnapshot",
    snapshotVersion: 1,
    recordId: record.record_id,
    recordUuid: record.id,
    status: record.record_status,
    slug: record.slug,
    title: record.title,
    workType: record.work_type,
    creatorName: record.creator_name,
    publicDisplayName: record.public_display_name,
    rightsHolderName: record.rights_holder_name,
    creationDate: record.creation_date,
    publicationDate: record.publication_date,
    edition: record.edition,
    copyrightNotice: record.copyright_notice,
    rightsStatement: record.rights_statement,
    aiPermissions: record.ai_permissions,
    aiPermissionsSummary: record.ai_permissions_summary,
    humanCommercialLicenseAvailable: record.human_commercial_license_available,
    fileFingerprint: record.sha256_hash
      ? {
          algorithm: "SHA-256",
          filename: record.filename,
          fileSize: record.file_size,
          mimeType: record.mime_type,
          value: record.sha256_hash,
          createdAt: record.hash_created_at,
        }
      : null,
    publishedAt: record.published_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
