import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  buildDossierSnapshot,
  normalizeDossierInput,
  sectionsForPurpose,
  sha256Hex,
} from "@/lib/rights/dossier";
import type { CreatorRightsRecord } from "@/lib/rights/schema";

function record(overrides: Partial<CreatorRightsRecord> = {}): CreatorRightsRecord {
  return {
    id: "record-1",
    user_id: "user-1",
    record_id: "SFR-2026-000001",
    slug: "test-record",
    title: "Test Record",
    work_type: "software",
    category: "software",
    availability: "public",
    description: "A test record.",
    creator_name: "Creator",
    public_display_name: "Creator",
    rights_holder_name: "Publisher",
    contact_email: "private@example.com",
    creation_date: "2026-07-01",
    publication_date: "2026-07-02",
    edition: "v1.0.0",
    external_identifier: "v1.0.0",
    source_url: "https://github.com/SigilForge/veildaemon",
    licensing_contact: "private@example.com",
    copyright_notice: "Copyright 2026 Creator",
    copyright_license_id: "mit",
    copyright_license_name: "MIT License",
    copyright_license_spdx_id: "MIT",
    copyright_license_url: "https://opensource.org/license/mit/",
    registry_framework_id: "sfr",
    registry_framework_version: "1.0",
    rights_statement: "Released under MIT with SFR record semantics.",
    ai_permissions: {
      generalTraining: "license_required",
      foundationModelPretraining: "license_required",
      fineTuning: "prohibited",
      embeddings: "allowed",
      rag: "allowed",
      generation: "license_required",
      datasetRedistribution: "prohibited",
      researchUse: "research_only",
      commercialUse: "license_required",
      attributionRequired: "license_required",
      licenseRequired: "license_required",
    },
    ai_permissions_summary: "AI use is creator-defined.",
    human_commercial_license_available: "case_by_case",
    record_status: "published",
    entitlement_status: "active",
    qr_asset_version: 1,
    qr_preferences: {},
    published_at: "2026-07-02T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-02T00:00:00.000Z",
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    stripe_customer_id: null,
    amount_paid: null,
    currency: null,
    payment_status: null,
    payment_confirmed_at: null,
    filename: "release.zip",
    file_size: 42,
    mime_type: "application/zip",
    sha256_hash: "a".repeat(64),
    hash_created_at: "2026-07-02T01:00:00.000Z",
    ...overrides,
  };
}

describe("Creator Dossier", () => {
  it("keeps required sections even when a custom request omits them", () => {
    const input = normalizeDossierInput({ purpose: "custom", includedSections: ["timeline"] });
    expect(input.includedSections).toContain("rights_summary");
    expect(input.includedSections).toContain("primary_license");
    expect(input.includedSections).toContain("registry_framework");
    expect(input.includedSections).toContain("ai_permissions");
    expect(input.includedSections).toContain("timeline");
  });

  it("uses one dossier model with purpose-based presets", () => {
    expect(sectionsForPurpose("publisher")).toContain("primary_license");
    expect(sectionsForPurpose("open_source")).toContain("ai_permissions");
    expect(sectionsForPurpose("open_source")).not.toContain("identifiers");
  });

  it("builds a manifest without mutating the Creator Rights Record", () => {
    const source = record();
    const before = JSON.stringify(source);
    const snapshot = buildDossierSnapshot({
      record: source,
      userId: "user-1",
      input: { purpose: "publisher" },
      dossierVersion: 2,
      now: "2026-07-29T00:00:00.000Z",
    });

    expect(JSON.stringify(source)).toBe(before);
    expect(snapshot.manifest.dossierVersion).toBe(2);
    expect(snapshot.manifest.privateByDefault).toBe(true);
    expect(snapshot.manifest.copyrightLicense).toMatchObject({ id: "mit", spdxId: "MIT" });
    expect(snapshot.manifest.registryFramework).toEqual({ id: "sfr", version: "1.0" });
    expect(snapshot.manifest.includedSections).toContain("ai_permissions");
    expect(snapshot.manifest.files.some((file) => file.path.endsWith("CREATOR-RIGHTS-RECORD.json"))).toBe(true);
    expect(snapshot.manifest.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.exportHashes.htmlSha256).toBe(sha256Hex(snapshot.html));
  });

  it("classifies suspected use as a reported observation", () => {
    const snapshot = buildDossierSnapshot({
      record: record(),
      userId: "user-1",
      input: {
        purpose: "suspected_use",
        suspectedUse: {
          providerName: "Example AI",
          factualObservation: "The creator reports a similar output.",
        },
      },
      dossierVersion: 1,
      now: "2026-07-29T00:00:00.000Z",
    });

    expect(snapshot.manifest.includedSections).toContain("suspected_use_report");
    expect(snapshot.manifest.evidenceClasses.reported_observation).toContain("Not a determination");
    expect(snapshot.html).toContain("does not independently determine");
    expect(snapshot.html).not.toContain("Verified infringement");
  });

  it("keeps dossier exports behind the owned-record route boundary", async () => {
    const source = await readFile(new URL("../app/api/rights/[id]/dossier/export/route.ts", import.meta.url), "utf8");
    const accountPage = await readFile(new URL("../app/account/rights/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("requireUser()");
    expect(source).toContain("getOwnedRightsRecord(user.id, id)");
    expect(source).toContain("content-disposition");
    expect(accountPage).toContain("Build Creator Dossier");
    expect(accountPage).not.toContain("Build Evidence");
  });
});
