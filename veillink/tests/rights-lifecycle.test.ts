import { describe, expect, it } from "vitest";
import {
  assertCanPublish,
  buildVersionSnapshot,
  canCreateCheckout,
  isPrivatePrePublicationStatus,
  isPublicRightsStatus,
} from "@/lib/rights/lifecycle";
import type { CreatorRightsRecord } from "@/lib/rights/schema";

function rightsRecord(overrides: Partial<CreatorRightsRecord> = {}): CreatorRightsRecord {
  return {
    id: "record-1",
    user_id: "user-1",
    record_id: null,
    slug: "test-record",
    title: "Test Record",
    work_type: "book",
    description: "A lifecycle test record.",
    creator_name: "Creator",
    public_display_name: "Creator",
    rights_holder_name: "Rights Holder",
    contact_email: "creator@example.com",
    creation_date: "2026-07-27",
    publication_date: null,
    edition: "Draft",
    external_identifier: null,
    source_url: null,
    licensing_contact: "creator@example.com",
    copyright_notice: "© 2026 Creator",
    rights_statement: "All rights reserved.",
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
    ai_permissions_summary: "AI use requires written permission.",
    human_commercial_license_available: "case_by_case",
    record_status: "draft",
    published_at: null,
    created_at: "2026-07-27T00:00:00.000Z",
    updated_at: "2026-07-27T00:00:00.000Z",
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    stripe_customer_id: null,
    amount_paid: null,
    currency: null,
    payment_status: null,
    payment_confirmed_at: null,
    filename: null,
    file_size: null,
    mime_type: null,
    sha256_hash: null,
    hash_created_at: null,
    ...overrides,
  };
}

const paidWebhook = {
  kind: "stripe_webhook" as const,
  checkoutSessionId: "cs_live_123",
  paymentIntentId: "pi_123",
  paymentStatus: "paid" as const,
  amountPaid: 999,
  currency: "usd",
  confirmedAt: "2026-07-27T01:00:00.000Z",
};

describe("Creator Rights lifecycle", () => {
  it("keeps draft, pending payment, and paid records private until publication", () => {
    expect(isPrivatePrePublicationStatus("draft")).toBe(true);
    expect(isPrivatePrePublicationStatus("pending_payment")).toBe(true);
    expect(isPrivatePrePublicationStatus("paid")).toBe(true);
    expect(isPublicRightsStatus("published")).toBe(true);
    expect(isPublicRightsStatus("withdrawn")).toBe(true);
    expect(isPublicRightsStatus("pending_payment")).toBe(false);
  });

  it("allows checkout creation without treating checkout as publication", () => {
    expect(canCreateCheckout("draft")).toBe(true);
    expect(canCreateCheckout("pending_payment")).toBe(true);
    expect(canCreateCheckout("paid")).toBe(false);
    expect(canCreateCheckout("published")).toBe(false);
  });

  it("requires a paid webhook or explicit internal authority to publish", () => {
    expect(() => assertCanPublish(rightsRecord(), paidWebhook)).not.toThrow();
    expect(() =>
      assertCanPublish(rightsRecord(), {
        ...paidWebhook,
        paymentStatus: "open" as never,
      })
    ).toThrow(/paid Stripe Checkout Session/);
  });

  it("does not allow an existing public record to republish through another route", () => {
    expect(() =>
      assertCanPublish(
        rightsRecord({
          record_id: "SFR-2026-000001",
          record_status: "published",
          published_at: "2026-07-27T01:00:00.000Z",
        }),
        paidWebhook
      )
    ).toThrow(/already published/);
  });

  it("builds certificate/version input from the immutable published record state", () => {
    const snapshot = buildVersionSnapshot(
      rightsRecord({
        record_id: "SFR-2026-000001",
        record_status: "published",
        published_at: "2026-07-27T01:00:00.000Z",
        sha256_hash: "a".repeat(64),
        filename: "work.pdf",
        file_size: 1234,
        mime_type: "application/pdf",
        hash_created_at: "2026-07-27T00:30:00.000Z",
      })
    );

    expect(snapshot.recordId).toBe("SFR-2026-000001");
    expect(snapshot.status).toBe("published");
    expect(snapshot.publishedAt).toBe("2026-07-27T01:00:00.000Z");
    expect(snapshot.fileFingerprint).toEqual({
      algorithm: "SHA-256",
      filename: "work.pdf",
      fileSize: 1234,
      mimeType: "application/pdf",
      value: "a".repeat(64),
      createdAt: "2026-07-27T00:30:00.000Z",
    });
  });
});
