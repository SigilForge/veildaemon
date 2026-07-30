import { describe, expect, it } from "vitest";
import {
  buildGitHubRepositoryDraft,
  buildUploadedFileDraft,
  extractCopyrightNotices,
  licenseIdForSpdx,
  parseGitHubRepositoryUrl,
} from "@/lib/rights/import-draft";

describe("Creator Rights repository import drafts", () => {
  it("accepts only canonical public GitHub repository URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/SigilForge/veildaemon")).toEqual({
      owner: "SigilForge",
      repo: "veildaemon",
      url: "https://github.com/SigilForge/veildaemon",
    });
    expect(parseGitHubRepositoryUrl("https://github.com/SigilForge/veildaemon.git").repo).toBe("veildaemon");
    expect(() => parseGitHubRepositoryUrl("https://example.com/SigilForge/veildaemon")).toThrow(/github/i);
    expect(() => parseGitHubRepositoryUrl("file:///etc/passwd")).toThrow(/github/i);
  });

  it("maps SPDX identifiers through the supported catalog", () => {
    expect(licenseIdForSpdx("MIT")).toBe("mit");
    expect(licenseIdForSpdx("Apache-2.0")).toBe("apache-2.0");
    expect(licenseIdForSpdx("NOASSERTION")).toBeNull();
    expect(licenseIdForSpdx("LicenseRef-Custom")).toBeNull();
  });

  it("extracts bounded copyright notices from selected repository text", () => {
    expect(extractCopyrightNotices("Copyright © 2026 SigilForge Studios.\nMIT License")[0]).toBe("Copyright © 2026 SigilForge Studios");
  });

  it("builds a draft without promoting repository owner to rights holder", () => {
    const draft = buildGitHubRepositoryDraft({
      repositoryUrl: "https://github.com/SigilForge/veildaemon",
      owner: "SigilForge",
      name: "veildaemon",
      description: "Creator Rights registry and routing surface.",
      defaultBranch: "main",
      htmlUrl: "https://github.com/SigilForge/veildaemon",
      latestReleaseTag: "v1.0.0",
      headSha: "abc123",
      licenseSpdxId: "MIT",
      licenseName: "MIT License",
      packageJson: { name: "@sigilforge/veildaemon", description: "Package metadata description" },
      readmeText: "Copyright 2026 SigilForge Studios.",
      licenseText: "MIT License",
    });

    expect(draft.fields.title.value).toBe("veildaemon");
    expect(draft.fields.workType.value).toBe("software");
    expect(draft.fields.category.value).toBe("software");
    expect(draft.fields.copyrightLicenseId.value).toBe("mit");
    expect(draft.fields.sourceUrl.status).toBe("found");
    expect(draft.fields.rightsHolderName.value).toBeNull();
    expect(draft.fields.rightsHolderName.status).toBe("needs_review");
    expect(draft.fields.creatorName.value).toBeNull();
    expect(draft.fields.publicDisplayName.value).toBe("SigilForge");
    expect(draft.warnings.join(" ")).toContain("not treated as the legal rights holder");
  });

  it("builds an uploaded-file draft with hash evidence and review-needed identity fields", () => {
    const hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    const draft = buildUploadedFileDraft({
      name: "Book One Manuscript.pdf",
      size: 4096,
      type: "application/pdf",
      lastModified: 1785369600000,
      sha256Hash: hash,
    });

    expect(draft.importKind).toBe("uploaded_file");
    expect(draft.sourceLabel).toBe("Book One Manuscript.pdf");
    expect(draft.fields.title.value).toBe("Book One Manuscript");
    expect(draft.fields.workType.value).toBe("document");
    expect(draft.fields.fileName.value).toBe("Book One Manuscript.pdf");
    expect(draft.fields.fileSize.value).toBe("4096");
    expect(draft.fields.mimeType.value).toBe("application/pdf");
    expect(draft.fields.sha256Hash.value).toBe(hash);
    expect(draft.fields.rightsHolderName.value).toBeNull();
    expect(draft.fields.rightsHolderName.status).toBe("needs_review");
    expect(draft.fields.copyrightLicenseId.status).toBe("needs_review");
    expect(draft.warnings.join(" ")).toContain("file bytes stay in your browser");
  });

  it("infers common file work types without treating inference as confirmation", () => {
    const hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    expect(buildUploadedFileDraft({ name: "library.ts", size: 1, type: "text/typescript", sha256Hash: hash }).fields.workType.value).toBe("software");
    expect(buildUploadedFileDraft({ name: "training-data.csv", size: 1, type: "text/csv", sha256Hash: hash }).fields.workType.value).toBe("dataset");
    expect(buildUploadedFileDraft({ name: "cover.webp", size: 1, type: "image/webp", sha256Hash: hash }).fields.workType.value).toBe("artwork");
    expect(buildUploadedFileDraft({ name: "theme.mp3", size: 1, type: "audio/mpeg", sha256Hash: hash }).fields.workType.value).toBe("audio");
    expect(buildUploadedFileDraft({ name: "trailer.mp4", size: 1, type: "video/mp4", sha256Hash: hash }).fields.workType.value).toBe("video");
    expect(buildUploadedFileDraft({ name: "unknown.bin", size: 1, type: "", sha256Hash: hash }).fields.workType.status).toBe("inferred");
  });
});
