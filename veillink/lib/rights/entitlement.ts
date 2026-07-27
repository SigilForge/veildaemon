import type { CreatorRightsRecord, RecordStatus } from "./schema";

export type EntitlementStatus = "none" | "active" | "revoked";

/** Statuses that keep a paid issuance usable for public verification and QR assets. */
const entitledPublicStatuses: RecordStatus[] = [
  "published",
  "updated",
  "transferred",
  "disputed",
  "under_review",
];

/**
 * Durable issuance entitlement — not a one-shot download flag.
 * Source of truth is entitlement_status when present; payment + public status is a legacy fallback.
 */
export function entitlementStatusOf(record: Pick<CreatorRightsRecord, "entitlement_status" | "payment_status" | "record_status">): EntitlementStatus {
  if (record.entitlement_status === "active" || record.entitlement_status === "revoked" || record.entitlement_status === "none") {
    return record.entitlement_status;
  }
  if (record.payment_status === "paid" && entitledPublicStatuses.includes(record.record_status)) {
    return "active";
  }
  return "none";
}

export function hasActiveRightsEntitlement(record: Pick<CreatorRightsRecord, "entitlement_status" | "payment_status" | "record_status">) {
  return entitlementStatusOf(record) === "active";
}

/** Branded QR downloads and preference saves require an active entitlement + ownership (checked by caller). */
export function canGenerateRightsQrAssets(record: Pick<CreatorRightsRecord, "entitlement_status" | "payment_status" | "record_status">) {
  return hasActiveRightsEntitlement(record);
}

/** Owners may edit draft freely; entitled public records may update declared metadata under version control. */
export function canEditRightsRecord(record: Pick<CreatorRightsRecord, "record_status" | "entitlement_status" | "payment_status">) {
  if (record.record_status === "draft" || record.record_status === "pending_payment") return true;
  if (record.record_status === "withdrawn" || record.record_status === "archived") return false;
  return hasActiveRightsEntitlement(record);
}

/**
 * Customer-facing issuance language. Keep DB column `entitlement_status`;
 * never surface "entitlement" in the portal UI.
 */
export function entitlementLabel(status: EntitlementStatus) {
  if (status === "active") return "Issued";
  if (status === "revoked") return "Revoked";
  return "Not issued";
}

/** Short chip copy for manage cards and QR studio. */
export function issuanceChipLabel(status: EntitlementStatus) {
  if (status === "active") return "Issued · Active";
  if (status === "revoked") return "Issuance revoked";
  return "Not issued yet";
}
