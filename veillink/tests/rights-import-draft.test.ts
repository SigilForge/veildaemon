import { describe, expect, it } from "vitest";
import {
  buildGitHubRepositoryDraft,
  buildUploadedFileDraft,
  extractCopyrightNotices,
  licenseIdForSpdx,
  licenseIdFromText,
  parseGitHubRepositoryUrl,
  reconcileImportDrafts,
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

  it("detects common canonical license text from uploaded files", () => {
    expect(licenseIdFromText("MIT License\n\nPermission is hereby granted, free of charge")).toBe("mit");
    expect(licenseIdFromText("Apache License\nVersion 2.0, January 2004")).toBe("apache-2.0");
    expect(licenseIdFromText("Not a license")).toBeNull();
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

  it("detects uploaded LICENSE file contents without confirming them as the creator declaration", () => {
    const hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    const draft = buildUploadedFileDraft({
      name: "LICENSE-conflict-apache",
      size: 1200,
      type: "",
      sha256Hash: hash,
      textContent: "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.",
    });

    expect(draft.fields.copyrightLicenseId.value).toBe("mit");
    expect(draft.fields.copyrightLicenseId.source).toBe("uploaded_file");
    expect(draft.fields.copyrightLicenseId.status).toBe("found");
    expect(draft.fields.copyrightLicenseId.confirmedByUser).toBe(false);
    expect(draft.summary.join(" ")).toContain("MIT License");
  });

  it("conflicting_license_sources_require_review", () => {
    const hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    const githubDraft = buildGitHubRepositoryDraft({
      repositoryUrl: "https://github.com/SigilForge/veildaemon",
      owner: "SigilForge",
      name: "veildaemon",
      defaultBranch: "main",
      htmlUrl: "https://github.com/SigilForge/veildaemon",
      licenseSpdxId: "Apache-2.0",
      packageJson: { name: "@sigilforge/veildaemon" },
    });
    const fileDraft = buildUploadedFileDraft({
      name: "LICENSE",
      size: 1200,
      type: "text/plain",
      sha256Hash: hash,
      textContent: "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.",
    });

    const reconciled = reconcileImportDrafts(githubDraft, fileDraft);
    expect(reconciled.fields.copyrightLicenseId.value).toBeNull();
    expect(reconciled.fields.copyrightLicenseId.status).toBe("needs_review");
    expect(reconciled.fields.copyrightLicenseId.confidence).toBe("low");
    expect(reconciled.fields.copyrightLicenseId.resolution).toBeNull();
    expect(reconciled.fields.copyrightLicenseId.candidates).toEqual([
      expect.objectContaining({ value: "apache-2.0", source: "repository" }),
      expect.objectContaining({ value: "mit", source: "uploaded_file" }),
    ]);
    expect(reconciled.warnings[0]).toContain("Conflicting license evidence found");
  });

  it("matching license sources increase confidence without requiring conflict review", () => {
    const hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    const githubDraft = buildGitHubRepositoryDraft({
      repositoryUrl: "https://github.com/SigilForge/veildaemon",
      owner: "SigilForge",
      name: "veildaemon",
      defaultBranch: "main",
      htmlUrl: "https://github.com/SigilForge/veildaemon",
      licenseSpdxId: "MIT",
      packageJson: { name: "@sigilforge/veildaemon" },
    });
    const fileDraft = buildUploadedFileDraft({
      name: "LICENSE",
      size: 1200,
      type: "text/plain",
      sha256Hash: hash,
      textContent: "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.",
    });

    const reconciled = reconcileImportDrafts(githubDraft, fileDraft);
    expect(reconciled.fields.copyrightLicenseId.value).toBe("mit");
    expect(reconciled.fields.copyrightLicenseId.status).toBe("found");
    expect(reconciled.fields.copyrightLicenseId.confidence).toBe("high");
    expect(reconciled.fields.copyrightLicenseId.candidates).toHaveLength(2);
    expect(reconciled.summary.join(" ")).toContain("Multiple sources agree");
  });

  it("infers common file work types without treating inference as confirmation", () => {
    const hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    expect(buildUploadedFileDraft({ name: "library.ts", size: 1, type: "text/typescript", sha256Hash: hash }).fields.workType.value).toBe("software");
    expect(buildUploadedFileDraft({ name: "training-data.csv", size: 1, type: "text/csv", sha256Hash: hash }).fields.workType.value).toBe("dataset");
    expect(buildUploadedFileDraft({ name: "cover.webp", size: 1, type: "image/webp", sha256Hash: hash }).fields.workType.value).toBe("artwork");
    expect(buildUploadedFileDraft({ name: "theme.mp3", size: 1, type: "audio/mpeg", sha256Hash: hash }).fields.workType.value).toBe("audio");
    expect(buildUploadedFileDraft({ name: "trailer.mp4", size: 1, type: "video/mp4", sha256Hash: hash }).fields.workType.value).toBe("video");
    expect(buildUploadedFileDraft({ name: "novel.epub", size: 1, type: "application/epub+zip", sha256Hash: hash }).fields.workType.value).toBe("book");
    expect(buildUploadedFileDraft({ name: "press-kit.docx", size: 1, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sha256Hash: hash }).fields.workType.value).toBe("document");
    expect(buildUploadedFileDraft({ name: "official-round.blend", size: 1, type: "", sha256Hash: hash }).fields.workType.value).toBe("3d_model");
    expect(buildUploadedFileDraft({ name: "prototype.unitypackage", size: 1, type: "", sha256Hash: hash }).fields.workType.value).toBe("game");
    expect(buildUploadedFileDraft({ name: "unknown.bin", size: 1, type: "", sha256Hash: hash }).fields.workType.status).toBe("inferred");
  });
});
