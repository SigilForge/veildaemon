import { describe, expect, it } from "vitest";
import {
  aiSummaryForPermissions,
  copyrightSuggestion,
  fileMetadataForFingerprint,
  isValidSha256,
  normalizeSha256Input,
  normalizeSlugInput,
  permissionMeaning,
  permissionsForPreset,
  recommendedAiPermissions,
  sha256Example,
  sha256ValidationMessage,
  slugHelpText,
} from "@/lib/rights/create-form-helpers";

describe("Creator Rights create form helpers", () => {
  it("generates and preserves URL-safe slugs", () => {
    expect(normalizeSlugInput("The Anchor & The Glitch!")).toBe("the-anchor-the-glitch");
    expect(slugHelpText("The Anchor & The Glitch!", "")).toContain("/rights/the-anchor-the-glitch");
    expect(slugHelpText("Ignored title", "custom-slug")).toContain("/rights/custom-slug");
  });

  it("validates SHA-256 values and normalizes uppercase input", () => {
    expect(isValidSha256(sha256Example)).toBe(true);
    expect(normalizeSha256Input(sha256Example.toUpperCase())).toBe(sha256Example);
    expect(sha256ValidationMessage(`sha256:${sha256Example}`)).toMatch(/prefix/);
    expect(sha256ValidationMessage(`${sha256Example.slice(0, 8)} ${sha256Example.slice(8)}`)).toMatch(/spaces/);
    expect(sha256ValidationMessage("abc")).toMatch(/exactly 64/);
    expect(sha256ValidationMessage("z".repeat(64))).toMatch(/hexadecimal/);
  });

  it("applies presets without approving the final review", () => {
    expect(permissionsForPreset("all_rights_reserved")).toEqual(recommendedAiPermissions);
    expect(permissionsForPreset("custom")).toBeNull();
  });

  it("builds visible review text from selected permissions", () => {
    const summary = aiSummaryForPermissions({
      ...recommendedAiPermissions,
      embeddings: "allowed",
    });
    expect(summary).toContain("Embeddings");
    expect(summary).toContain("Model training, retrieval use, and commercial use require written permission.");
    expect(summary).toContain("Embeddings and research use are permitted only within the stated record terms.");
    expect(permissionMeaning("license_required")).toContain("written permission");
  });

  it("uses singular wording for one licensed permission", () => {
    const summary = aiSummaryForPermissions({
      ...recommendedAiPermissions,
      generalTraining: "allowed",
      rag: "allowed",
    });
    expect(summary).toContain("Commercial use requires written permission.");
  });

  it("suggests copyright notices from year and rights holder", () => {
    expect(copyrightSuggestion("2026", "SigilForge Studios")).toBe("Copyright © 2026 SigilForge Studios. All rights reserved.");
    expect(copyrightSuggestion("", "")).toBe("");
  });

  it("auto-populates file metadata for fingerprinted files", () => {
    expect(fileMetadataForFingerprint({ name: "record.pdf", size: 2048, type: "application/pdf" })).toEqual({
      fileName: "record.pdf",
      fileSize: "2048",
      mimeType: "application/pdf",
    });
  });

  it("keeps help content keyboard accessible with native details and summary", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../components/RightsCreateForm.tsx", import.meta.url), "utf8"));
    expect(source).toContain("<details className=\"field-help\"");
    expect(source).toContain("<summary aria-label=\"Show field help\">?</summary>");
    expect(source).not.toContain("onMouseEnter");
  });
});
