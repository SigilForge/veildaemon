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

  it("keeps license selection guided by work type instead of dumping the whole catalog", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../components/RightsCreateForm.tsx", import.meta.url), "utf8"));
    expect(source).toContain("Not sure which license fits your project?");
    expect(source).toContain("The license picker is an assistive recommendation system, not an automatic legal decision.");
    expect(source).toContain("Choose the goal that sounds closest");
    expect(source).toContain("Imported repository or package metadata may prefill a draft license");
    expect(source).toContain("If evidence conflicts, the picker enters a review state instead of silently choosing a winner.");
    expect(source).toContain("You always make the final selection.");
    expect(source).toContain("workTypeLicenseOptions.map");
    expect(source).not.toContain("LICENSE_CATALOG.map");
  });

  it("presents source import as one draft review surface instead of verification", async () => {
    const fs = await import("node:fs/promises");
    const formSource = await fs.readFile(new URL("../components/RightsCreateForm.tsx", import.meta.url), "utf8");
    const routeSource = await fs.readFile(new URL("../app/api/rights/import/github/route.ts", import.meta.url), "utf8");
    expect(formSource).toContain("Import from artifact or source");
    expect(formSource).toContain("Upload work file");
    expect(formSource).toContain("Supported files: EPUB, PDF, Office documents, Blender and 3D models, Unity assets");
    expect(formSource).toContain("Source URL or identifier");
    expect(formSource).toContain("Supported sources: GitHub, npm, PyPI, DOI, ISBN, Steam, and itch.io.");
    expect(formSource).toContain("Import source");
    expect(formSource).toContain("Use the uploaded file hash");
    expect(formSource).toContain("Hash already calculated from the uploaded import file.");
    expect(formSource).toContain("buildUploadedFileDraft");
    expect(formSource).toContain("Found automatically");
    expect(formSource).toContain("Likely, please confirm");
    expect(formSource).toContain("Still needed");
    expect(formSource).toContain("advanced editor");
    expect(routeSource).toContain("await requireUser()");
    expect(routeSource).toContain("https://api.github.com");
    expect(routeSource).not.toContain("fetch(body");
  });

  it("keeps the public Creator Rights overview aligned with artifact-first intake", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../../studio/creator-rights/index.html", import.meta.url), "utf8"));
    expect(source).toContain("License guidance");
    expect(source).toContain("Not sure which license fits your project?");
    expect(source).toContain("Answer a few plain-language questions");
    expect(source).toContain("The software can guide, compare, and prefill.");
    expect(source).toContain("Artifact first");
    expect(source).toContain("One source field accepts supported URLs or identifiers.");
    expect(source).toContain("Artifact first. Draft, not fact. Agreement increases confidence. Disagreement lowers confidence. Conflict never resolves silently.");
    expect(source).toContain("No source wins silently");
    expect(source).toContain("Uploaded files are fingerprinted with SHA-256 in the browser.");
    expect(source).toContain("The license picker asks plain-language questions");
    expect(source).toContain("It is not an automatic legal decision.");
    expect(source).toContain("The SigilForge Rights Framework layers provenance");
    expect(source).toContain("It does not replace or modify that license.");
    expect(source).toContain("Creator Dossier package");
    expect(source).not.toContain("Import from artifact or GitHub");
    expect(source).not.toContain("Import repository");
  });
});
