import { describe, expect, it } from "vitest";
import {
  LICENSE_CATALOG,
  SFR_REGISTRY_FRAMEWORK,
  defaultLicenseIdForWorkType,
  licenseById,
  licenseWorkTypeWarning,
  publicLicenseShape,
  publicRegistryFrameworkShape,
} from "@/lib/rights/license-catalog";
import { normalizeRightsInput, rightsJson } from "@/lib/rights/records";
import type { CreatorRightsRecord } from "@/lib/rights/schema";

function record(overrides: Partial<CreatorRightsRecord> = {}): CreatorRightsRecord {
  return {
    id: "record-1",
    record_id: "SFR-2026-000001",
    slug: "software-record",
    title: "Software Record",
    work_type: "software",
    category: "software",
    availability: "public",
    description: "A software record.",
    creator_name: "Creator",
    public_display_name: "Creator",
    rights_holder_name: "Publisher",
    contact_email: "private@example.com",
    creation_date: "2026-07-29",
    publication_date: "2026-07-29",
    edition: "v1.0.0",
    external_identifier: null,
    source_url: "https://github.com/SigilForge/veildaemon",
    licensing_contact: "private@example.com",
    copyright_notice: "Copyright 2026 Creator",
    copyright_license_id: "mit",
    copyright_license_name: "MIT License",
    copyright_license_spdx_id: "MIT",
    copyright_license_url: "https://opensource.org/license/mit/",
    registry_framework_id: "sfr",
    registry_framework_version: "1.0",
    rights_statement: "Released under MIT with SFR registry metadata.",
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
    published_at: "2026-07-29T00:00:00.000Z",
    created_at: "2026-07-29T00:00:00.000Z",
    updated_at: "2026-07-29T00:00:00.000Z",
    sha256_hash: null,
    hash_created_at: null,
    ...overrides,
  };
}

describe("Creator Rights license composition", () => {
  it("uses stable controlled license ids and SPDX values", () => {
    const ids = new Set(LICENSE_CATALOG.map((entry) => entry.id));
    expect(ids.size).toBe(LICENSE_CATALOG.length);
    expect(licenseById("mit").spdxId).toBe("MIT");
    expect(licenseById("mpl-2.0").spdxId).toBe("MPL-2.0");
    expect(publicLicenseShape("custom").spdxId).toBeNull();
  });

  it("keeps SFR as the registry framework instead of a SPDX replacement", () => {
    const json = rightsJson(record());
    expect(json.copyrightLicense).toMatchObject({ id: "mit", spdxId: "MIT" });
    expect(json.registryFramework).toMatchObject({ id: "sfr", shortName: "SFR", version: "1.0" });
    expect(JSON.stringify(json.copyrightLicense)).not.toContain("SFR");
    expect(json.permissions.fineTuning).toBe("prohibited");
  });

  it("normalizes creator input into primary license plus SFR registry framework", () => {
    const normalized = normalizeRightsInput({
      creatorName: "Creator",
      publicDisplayName: "Creator",
      rightsHolderName: "Publisher",
      email: "creator@example.com",
      title: "Library",
      workType: "software",
      category: "software",
      availability: "public",
      description: "A library.",
      copyrightLicenseId: "apache-2.0",
      rightsStatement: "Apache licensed.",
      aiSummaryApproved: "yes",
      permissions: {},
      humanCommercialLicenseAvailable: "case_by_case",
    });

    expect(normalized.copyrightLicense.spdxId).toBe("Apache-2.0");
    expect(publicRegistryFrameworkShape("sfr", "1.0")).toMatchObject(SFR_REGISTRY_FRAMEWORK);
  });

  it("warns when a license family does not match the selected work type", () => {
    expect(defaultLicenseIdForWorkType("software")).toBe("mit");
    expect(defaultLicenseIdForWorkType("book")).toBe("proprietary");
    expect(licenseWorkTypeWarning("mit", "book")).toContain("Open-source software licenses");
    expect(licenseWorkTypeWarning("cc-by-4.0", "software")).toContain("Creative Commons");
  });
});
