import {
  LICENSE_CATALOG,
  defaultLicenseIdForWorkType,
  licenseById,
} from "./license-catalog";
import { normalizeSlugInput } from "./create-form-helpers";
import type { CategoryValue, CopyrightLicenseId, KnownWorkType } from "./schema";

export type DraftFieldSource = "uploaded_file" | "repository" | "metadata" | "user";
export type DraftFieldConfidence = "high" | "medium" | "low";
export type DraftFieldStatus = "found" | "inferred" | "needs_review" | "confirmed";

export type DraftField<T> = {
  value: T | null;
  source: DraftFieldSource;
  confidence: DraftFieldConfidence;
  evidence?: string;
  confirmedByUser: boolean;
  status: DraftFieldStatus;
};

export type CreatorRightsImportDraft = {
  importKind: "github_repository";
  repository: {
    owner: string;
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string | null;
  };
  fields: {
    creatorName: DraftField<string>;
    publicDisplayName: DraftField<string>;
    rightsHolderName: DraftField<string>;
    title: DraftField<string>;
    slug: DraftField<string>;
    workType: DraftField<KnownWorkType>;
    category: DraftField<CategoryValue>;
    availability: DraftField<string>;
    description: DraftField<string>;
    sourceUrl: DraftField<string>;
    externalIdentifier: DraftField<string>;
    edition: DraftField<string>;
    copyrightNotice: DraftField<string>;
    copyrightLicenseId: DraftField<CopyrightLicenseId>;
    rightsStatement: DraftField<string>;
  };
  summary: string[];
  warnings: string[];
};

export type GitHubRepositoryImportInput = {
  repositoryUrl: string;
  owner: string;
  name: string;
  description?: string | null;
  defaultBranch?: string | null;
  htmlUrl?: string | null;
  homepage?: string | null;
  pushedAt?: string | null;
  latestReleaseTag?: string | null;
  headSha?: string | null;
  licenseSpdxId?: string | null;
  licenseName?: string | null;
  packageJson?: Record<string, unknown> | null;
  readmeText?: string | null;
  licenseText?: string | null;
};

type GitHubRepositoryRef = {
  owner: string;
  repo: string;
  url: string;
};

const GITHUB_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const COPYRIGHT_NOTICE_PATTERN = /copyright\s*(?:\(c\)|©)?\s*(?:\d{4}(?:-\d{4})?\s*)?[^.\n\r]{2,180}/gi;

function field<T>(
  value: T | null,
  source: DraftFieldSource,
  confidence: DraftFieldConfidence,
  status: DraftFieldStatus,
  evidence?: string,
): DraftField<T> {
  return {
    value,
    source,
    confidence,
    evidence,
    confirmedByUser: status === "confirmed",
    status,
  };
}

export function parseGitHubRepositoryUrl(value: string): GitHubRepositoryRef {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid GitHub repository URL.");
  }

  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com") {
    throw new Error("Repository import currently accepts public https://github.com/{owner}/{repo} URLs.");
  }

  const [owner, rawRepo] = parsed.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, "");
  if (!owner || !repo || !GITHUB_NAME_PATTERN.test(owner) || !GITHUB_NAME_PATTERN.test(repo)) {
    throw new Error("Enter a GitHub repository URL with an owner and repository name.");
  }

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}

export function licenseIdForSpdx(spdxId: string | null | undefined): CopyrightLicenseId | null {
  const normalized = spdxId?.trim().toLowerCase();
  if (!normalized || normalized === "noassertion") return null;
  return (LICENSE_CATALOG.find((license) => license.spdxId?.toLowerCase() === normalized)?.id as CopyrightLicenseId | undefined) || null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function licenseIdFromPackageJson(packageJson: Record<string, unknown> | null | undefined) {
  const license = packageJson ? stringValue(packageJson.license) : "";
  return licenseIdForSpdx(license);
}

function packageName(packageJson: Record<string, unknown> | null | undefined) {
  const name = packageJson ? stringValue(packageJson.name) : "";
  if (!name) return "";
  return name.split("/").pop()?.replace(/[-_]+/g, " ") || name;
}

export function extractCopyrightNotices(...texts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const notices: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(COPYRIGHT_NOTICE_PATTERN)) {
      const notice = match[0].replace(/\s+/g, " ").trim();
      const normalized = notice.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        notices.push(notice);
      }
      if (notices.length >= 3) return notices;
    }
  }
  return notices;
}

function titleCaseRepositoryName(name: string) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function buildGitHubRepositoryDraft(input: GitHubRepositoryImportInput): CreatorRightsImportDraft {
  const packageTitle = packageName(input.packageJson);
  const title = packageTitle || titleCaseRepositoryName(input.name);
  const licenseId = licenseIdForSpdx(input.licenseSpdxId) || licenseIdFromPackageJson(input.packageJson) || defaultLicenseIdForWorkType("software");
  const selectedLicense = licenseById(licenseId);
  const notices = extractCopyrightNotices(input.licenseText, input.readmeText);
  const releaseOrCommit = input.latestReleaseTag || input.headSha || input.defaultBranch || "";
  const description = input.description || stringValue(input.packageJson?.description) || `Software repository published at ${input.htmlUrl || input.repositoryUrl}.`;
  const sourceUrl = input.htmlUrl || input.repositoryUrl;

  const summary = [
    `We found a GitHub repository named ${input.owner}/${input.name}.`,
    `We identified this as software.`,
  ];
  if (selectedLicense.id !== "proprietary") {
    summary.push(`We found ${selectedLicense.name}${selectedLicense.spdxId ? ` (${selectedLicense.spdxId})` : ""}.`);
  } else {
    summary.push("We could not map the repository license to a supported SPDX entry, so the draft keeps reuse rights conservative.");
  }

  const warnings = [
    "Repository metadata is draft evidence, not verification.",
    "Repository owner or organization is not treated as the legal rights holder until the creator confirms it.",
  ];
  if (!notices.length) warnings.push("We could not find a copyright notice in the selected repository files.");

  return {
    importKind: "github_repository",
    repository: {
      owner: input.owner,
      name: input.name,
      fullName: `${input.owner}/${input.name}`,
      url: sourceUrl,
      defaultBranch: input.defaultBranch || null,
    },
    fields: {
      creatorName: field<string>(null, "repository", "low", "needs_review", "A GitHub account name does not prove the creator of the work."),
      publicDisplayName: field(input.owner, "repository", "medium", "inferred", "Repository owner or organization login."),
      rightsHolderName: field<string>(null, "repository", "low", "needs_review", "Rights-holder identity must be confirmed by the creator."),
      title: field(title, "repository", "high", "found", packageTitle ? "package.json name" : "Repository name."),
      slug: field(normalizeSlugInput(title), "metadata", "high", "inferred", "Generated from the imported title."),
      workType: field("software", "repository", "high", "inferred", "GitHub repository import currently creates software drafts."),
      category: field("software", "repository", "high", "inferred", "GitHub repository import currently creates software drafts."),
      availability: field("public", "repository", "medium", "inferred", "Public GitHub repository was readable at import time."),
      description: field(description, "repository", input.description ? "high" : "medium", input.description ? "found" : "inferred", input.description ? "GitHub repository description." : "Fallback description from package metadata or repository URL."),
      sourceUrl: field(sourceUrl, "repository", "high", "found", "Canonical GitHub repository URL."),
      externalIdentifier: field(releaseOrCommit, "repository", releaseOrCommit ? "medium" : "low", releaseOrCommit ? "found" : "needs_review", input.latestReleaseTag ? "Latest GitHub release tag." : input.headSha ? "Latest default-branch commit SHA." : "No release or commit identifier was available."),
      edition: field(input.latestReleaseTag || "", "repository", input.latestReleaseTag ? "medium" : "low", input.latestReleaseTag ? "found" : "needs_review", input.latestReleaseTag ? "Latest GitHub release tag." : "No latest release was available."),
      copyrightNotice: field(notices[0] || "", notices.length ? "metadata" : "repository", notices.length ? "medium" : "low", notices.length ? "found" : "needs_review", notices.length ? "First copyright notice found in LICENSE or README." : "No copyright notice found."),
      copyrightLicenseId: field(licenseId as CopyrightLicenseId, "repository", selectedLicense.id === "proprietary" ? "low" : "high", selectedLicense.id === "proprietary" ? "needs_review" : "found", input.licenseSpdxId ? `GitHub license detector returned ${input.licenseSpdxId}.` : "License inferred from package metadata or conservative default."),
      rightsStatement: field("", "user", "low", "needs_review", "The rights statement is the creator's declaration and must be written or accepted by the creator."),
    },
    summary,
    warnings,
  };
}
