import { describe, expect, it } from "vitest";
import {
  assertCanPublish,
  buildVersionSnapshot,
  canCreateCheckout,
  canGenerateRightsQrAssets,
  hasActiveRightsEntitlement,
  validateRightsCheckoutSession,
  isPrivatePrePublicationStatus,
  isPublicRightsStatus,
} from "@/lib/rights/lifecycle";
import { rightsJson } from "@/lib/rights/records";
import { parseRightsQrPreferences } from "@/lib/rights/qr-options";
import { creatorRightsInputSchema } from "@/lib/rights/schema";
import type { CreatorRightsRecord } from "@/lib/rights/schema";

function rightsRecord(overrides: Partial<CreatorRightsRecord> = {}): CreatorRightsRecord {
  return {
    id: "record-1",
    user_id: "user-1",
    record_id: null,
    slug: "test-record",
    title: "Test Record",
    work_type: "book",
    category: "fiction",
    availability: "public",
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
    entitlement_status: "none",
    qr_asset_version: 0,
    qr_preferences: {},
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

const expectedCheckout = {
  priceId: "price_rights",
  amount: 999,
  currency: "usd",
};

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_live_123",
    amount_total: 999,
    currency: "usd",
    customer: "cus_123",
    metadata: {
      rights_record_uuid: "record-1",
      owner_user_id: "user-1",
      purchase_type: "creator_rights_record",
    },
    payment_intent: "pi_123",
    payment_status: "paid",
    ...overrides,
  };
}

const rightsLineItems = [{ price: { id: "price_rights" } }];

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
    expect(snapshot.workType).toBe("book");
    expect(snapshot.category).toBe("fiction");
    expect(snapshot.availability).toBe("public");
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

  it("public JSON excludes owner identity, private email, and payment fields", () => {
    const json = rightsJson(
      rightsRecord({
        record_id: "SFR-2026-000001",
        record_status: "published",
        contact_email: "private@example.com",
        licensing_contact: "rights-private@example.com",
        stripe_checkout_session_id: "cs_live_secret",
        stripe_payment_intent_id: "pi_secret",
        stripe_customer_id: "cus_secret",
        payment_status: "paid",
      })
    );
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("rights-private@example.com");
    expect(serialized).not.toContain("user-1");
    expect(serialized).not.toContain("cs_live_secret");
    expect(serialized).not.toContain("pi_secret");
    expect(serialized).not.toContain("cus_secret");
    expect(serialized).not.toContain("payment_status");
    expect(json).toMatchObject({
      recordType: "CreatorRightsRecord",
      recordId: "SFR-2026-000001",
      workType: "book",
      workTypeLabel: "Book",
      category: "fiction",
      categoryLabel: "Fiction",
      availability: "public",
      availabilityLabel: "Public",
      licenseContact: "/rights/test-record/license",
    });
  });

  it("validates generalized non-written work types with creator-selected category", () => {
    const parsed = creatorRightsInputSchema.parse({
      creatorName: "Creator",
      publicDisplayName: "Creator",
      rightsHolderName: "Rights Holder",
      email: "creator@example.com",
      title: "Neon Archive Model",
      workType: "3d_model",
      category: "marketing",
      availability: "restricted",
      description: "A promotional 3D model with restricted asset access.",
      rightsStatement: "All rights reserved.",
      aiSummaryApproved: "yes",
      permissions: {},
      humanCommercialLicenseAvailable: "case_by_case",
    });

    expect(parsed.workType).toBe("3d_model");
    expect(parsed.category).toBe("marketing");
    expect(parsed.availability).toBe("restricted");
  });

  it("pending payment and paid records are not public statuses", () => {
    expect(isPublicRightsStatus("pending_payment")).toBe(false);
    expect(isPublicRightsStatus("paid")).toBe(false);
  });

  it("validates the exact Checkout Session before publication", () => {
    expect(() =>
      validateRightsCheckoutSession(
        rightsRecord({ record_status: "pending_payment", stripe_checkout_session_id: "cs_live_123" }),
        paidSession(),
        rightsLineItems,
        expectedCheckout
      )
    ).not.toThrow();
  });

  it("rejects unpaid or mismatched Checkout Sessions", () => {
    const record = rightsRecord({ record_status: "pending_payment", stripe_checkout_session_id: "cs_live_123" });
    expect(() => validateRightsCheckoutSession(record, paidSession({ payment_status: "unpaid" }), rightsLineItems, expectedCheckout)).toThrow(/not paid/);
    expect(() => validateRightsCheckoutSession(record, paidSession({ amount_total: 1999 }), rightsLineItems, expectedCheckout)).toThrow(/amount/);
    expect(() => validateRightsCheckoutSession(record, paidSession({ currency: "eur" }), rightsLineItems, expectedCheckout)).toThrow(/currency/);
    expect(() => validateRightsCheckoutSession(record, paidSession(), [{ price: { id: "price_other" } }], expectedCheckout)).toThrow(/configured Creator Rights price/);
  });

  it("treats payment publication as durable entitlement for QR assets", () => {
    const unpaidDraft = rightsRecord();
    expect(hasActiveRightsEntitlement(unpaidDraft)).toBe(false);
    expect(canGenerateRightsQrAssets(unpaidDraft)).toBe(false);

    const entitled = rightsRecord({
      record_status: "published",
      payment_status: "paid",
      entitlement_status: "active",
      record_id: "SFR-2026-000099",
      published_at: "2026-07-27T01:00:00.000Z",
      qr_asset_version: 1,
    });
    expect(hasActiveRightsEntitlement(entitled)).toBe(true);
    expect(canGenerateRightsQrAssets(entitled)).toBe(true);

    const revoked = rightsRecord({
      record_status: "published",
      payment_status: "paid",
      entitlement_status: "revoked",
    });
    expect(canGenerateRightsQrAssets(revoked)).toBe(false);

    // Browser success alone (pending_payment without active entitlement) never unlocks assets.
    expect(
      canGenerateRightsQrAssets(
        rightsRecord({ record_status: "pending_payment", payment_status: "pending", entitlement_status: "none" })
      )
    ).toBe(false);
  });

  it("enforces controlled QR customization and contrast floor", () => {
    const ok = parseRightsQrPreferences({
      foreground: "#111827",
      background: "#ffffff",
      art: "seal",
      frameStyle: "tech-card",
      frameTitle: "CREATOR RIGHTS RECORD",
    });
    expect(ok.ok).toBe(true);

    const weak = parseRightsQrPreferences({
      foreground: "#777777",
      background: "#888888",
      art: "seal",
    });
    expect(weak.ok).toBe(false);
    if (!weak.ok) expect(weak.error).toMatch(/contrast/i);

    const wild = parseRightsQrPreferences({
      foreground: "red",
      background: "#000000",
    });
    expect(wild.ok).toBe(false);

    const customMissing = parseRightsQrPreferences({
      foreground: "#111827",
      background: "#ffffff",
      art: "custom",
    });
    expect(customMissing.ok).toBe(false);

    const customOk = parseRightsQrPreferences({
      foreground: "#111827",
      background: "#ffffff",
      art: "custom",
      customArtUrl: "data:image/png;base64,iVBORw0KGgo=",
    });
    expect(customOk.ok).toBe(true);
  });

  it("rejects metadata mismatch and records attached to a different Checkout Session", () => {
    expect(() =>
      validateRightsCheckoutSession(
        rightsRecord({ record_status: "pending_payment", stripe_checkout_session_id: "cs_live_123" }),
        paidSession({ metadata: { rights_record_uuid: "record-2", owner_user_id: "user-1", purchase_type: "creator_rights_record" } }),
        rightsLineItems,
        expectedCheckout
      )
    ).toThrow(/record metadata/);
    expect(() =>
      validateRightsCheckoutSession(
        rightsRecord({ record_status: "pending_payment", stripe_checkout_session_id: "cs_live_123" }),
        paidSession({ metadata: { rights_record_uuid: "record-1", owner_user_id: "user-2", purchase_type: "creator_rights_record" } }),
        rightsLineItems,
        expectedCheckout
      )
    ).toThrow(/owner metadata/);
    expect(() =>
      validateRightsCheckoutSession(
        rightsRecord({ record_status: "pending_payment", stripe_checkout_session_id: "cs_live_other" }),
        paidSession(),
        rightsLineItems,
        expectedCheckout
      )
    ).toThrow(/another Checkout Session/);
  });
});
