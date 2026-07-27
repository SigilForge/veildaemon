import { categoryOrDefault, type CreatorRightsRecord, type RecordStatus } from "./schema";

export const RIGHTS_PURCHASE_TYPE = "creator_rights_record";

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

export type RightsCheckoutSessionLike = {
  id: string;
  amount_total: number | null;
  currency: string | null;
  customer: string | { id?: string } | null;
  metadata: Record<string, string> | null;
  payment_intent: string | { id?: string } | null;
  payment_status: string | null;
};

export type RightsLineItemLike = {
  price?: {
    id?: string;
  } | null;
};

export type RightsCheckoutExpectation = {
  priceId: string;
  amount: number;
  currency: string;
};

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

function idFromStripeValue(value: string | { id?: string } | null) {
  if (!value) return "";
  return typeof value === "string" ? value : value.id || "";
}

export function validateRightsCheckoutSession(
  record: Pick<CreatorRightsRecord, "id" | "user_id" | "record_status" | "stripe_checkout_session_id">,
  session: RightsCheckoutSessionLike,
  lineItems: RightsLineItemLike[],
  expected: RightsCheckoutExpectation
) {
  const metadata = session.metadata || {};
  if (metadata.purchase_type !== RIGHTS_PURCHASE_TYPE) {
    throw new Error("Stripe session purchase type is not a Creator Rights Record.");
  }
  if (metadata.rights_record_uuid !== record.id) {
    throw new Error("Stripe session rights record metadata mismatch.");
  }
  if (metadata.owner_user_id !== record.user_id) {
    throw new Error("Stripe session owner metadata mismatch.");
  }
  if (record.record_status !== "pending_payment" && record.record_status !== "paid") {
    throw new Error(`Rights record cannot publish from ${record.record_status}.`);
  }
  if (record.stripe_checkout_session_id && record.stripe_checkout_session_id !== session.id) {
    throw new Error("Rights record is attached to another Checkout Session.");
  }
  if (session.payment_status !== "paid") {
    throw new Error("Stripe session is not paid.");
  }
  if (session.amount_total !== expected.amount) {
    throw new Error("Stripe session amount does not match Creator Rights price.");
  }
  if ((session.currency || "").toLowerCase() !== expected.currency.toLowerCase()) {
    throw new Error("Stripe session currency does not match Creator Rights price.");
  }
  if (!idFromStripeValue(session.payment_intent)) {
    throw new Error("Stripe session is missing a PaymentIntent.");
  }
  if (!lineItems.some((item) => item.price?.id === expected.priceId)) {
    throw new Error("Stripe session does not contain the configured Creator Rights price.");
  }
}

export function paymentIntentIdFromSession(session: RightsCheckoutSessionLike) {
  return idFromStripeValue(session.payment_intent);
}

export function customerIdFromSession(session: RightsCheckoutSessionLike) {
  return idFromStripeValue(session.customer);
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
    category: categoryOrDefault(record.category),
    availability: record.availability,
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
