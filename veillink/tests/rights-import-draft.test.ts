import { describe, expect, it } from "vitest";
import {
  buildGitHubRepositoryDraft,
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
});
