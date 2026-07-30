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
  importKind: "github_repository" | "uploaded_file";
  sourceLabel: string;
  repository?: {
    owner: string;
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string | null;
  };
  file?: {
    name: string;
    size: number;
    mimeType: string;
    sha256Hash: string;
    lastModified: number | null;
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
    fileName: DraftField<string>;
    fileSize: DraftField<string>;
    mimeType: DraftField<string>;
    sha256Hash: DraftField<string>;
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

export type UploadedFileImportInput = {
  name: string;
  size: number;
  type?: string | null;
  lastModified?: number | null;
  sha256Hash: string;
};

type GitHubRepositoryRef = {
  owner: string;
  repo: string;
  url: string;
};

const GITHUB_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const COPYRIGHT_NOTICE_PATTERN = /copyright\s*(?:\(c\)|©)?\s*(?:\d{4}(?:-\d{4})?\s*)?[^.\n\r]{2,180}/gi;
const SOFTWARE_EXTENSIONS = new Set(["js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "c", "cc", "cpp", "cs", "php", "swift", "kt", "mjs", "cjs", "html", "css"]);
const DATA_EXTENSIONS = new Set(["csv", "tsv", "json", "jsonl", "xml", "parquet", "ndjson", "sqlite", "db"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "odt", "rtf", "txt", "md"]);
const BOOK_EXTENSIONS = new Set(["epub", "mobi", "azw3"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "mkv", "avi"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "psd"]);

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

function extensionForFileName(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match?.[1].toLowerCase() || "";
}

function titleFromFileName(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function inferFileWorkType(name: string, mimeType: string): { workType: KnownWorkType; category: CategoryValue; confidence: DraftFieldConfidence; evidence: string } {
  const extension = extensionForFileName(name);
  if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) {
    return { workType: "artwork", category: "other", confidence: "medium", evidence: "Inferred from image MIME type or file extension." };
  }
  if (mimeType.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)) {
    return { workType: "audio", category: "other", confidence: "medium", evidence: "Inferred from audio MIME type or file extension." };
  }
  if (mimeType.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) {
    return { workType: "video", category: "other", confidence: "medium", evidence: "Inferred from video MIME type or file extension." };
  }
  if (SOFTWARE_EXTENSIONS.has(extension)) {
    return { workType: "software", category: "software", confidence: "medium", evidence: "Inferred from source-code file extension." };
  }
  if (DATA_EXTENSIONS.has(extension)) {
    return { workType: "dataset", category: "research", confidence: "medium", evidence: "Inferred from structured-data file extension." };
  }
  if (BOOK_EXTENSIONS.has(extension)) {
    return { workType: "book", category: "fiction", confidence: "low", evidence: "Inferred from ebook file extension. Confirm the category before publishing." };
  }
  if (DOCUMENT_EXTENSIONS.has(extension) || mimeType === "application/pdf" || mimeType.startsWith("text/")) {
    return { workType: "document", category: "other", confidence: "low", evidence: "Inferred from document MIME type or file extension. Confirm the work type before publishing." };
  }
  return { workType: "other", category: "other", confidence: "low", evidence: "File type was not specific enough to infer a stronger work type." };
}

export function buildUploadedFileDraft(input: UploadedFileImportInput): CreatorRightsImportDraft {
  const mimeType = input.type?.trim() || "application/octet-stream";
  const title = titleFromFileName(input.name) || input.name;
  const inferred = inferFileWorkType(input.name, mimeType);
  const licenseId = defaultLicenseIdForWorkType(inferred.workType) as CopyrightLicenseId;
  const formattedSize = String(input.size);
  const summary = [
    `We read the filename, MIME type, and file size from the selected artifact.`,
    `We calculated a SHA-256 fingerprint in this browser.`,
    `We identified this as ${inferred.workType.replace(/_/g, " ")} from file metadata.`,
  ];
  const warnings = [
    "Uploaded-file metadata is draft evidence, not verification.",
    "The file bytes stay in your browser for this draft import; only the hash and metadata are added to the form.",
    "Creator name, rights holder, licensing contact, and rights statement still need creator review.",
  ];

  return {
    importKind: "uploaded_file",
    sourceLabel: input.name,
    file: {
      name: input.name,
      size: input.size,
      mimeType,
      sha256Hash: input.sha256Hash,
      lastModified: input.lastModified ?? null,
    },
    fields: {
      creatorName: field<string>(null, "uploaded_file", "low", "needs_review", "A file does not prove the creator of the work."),
      publicDisplayName: field<string>(null, "uploaded_file", "low", "needs_review", "No public display name was available from the file metadata."),
      rightsHolderName: field<string>(null, "uploaded_file", "low", "needs_review", "Rights-holder identity must be confirmed by the creator."),
      title: field(title, "uploaded_file", "medium", "found", "Filename without extension."),
      slug: field(normalizeSlugInput(title), "metadata", "high", "inferred", "Generated from the imported filename."),
      workType: field(inferred.workType, "metadata", inferred.confidence, "inferred", inferred.evidence),
      category: field(inferred.category, "metadata", inferred.confidence, "inferred", inferred.evidence),
      availability: field("public", "user", "low", "needs_review", "Availability cannot be determined from a local file."),
      description: field(`Artifact imported from ${input.name}.`, "metadata", "low", "inferred", "Generated from the selected filename."),
      sourceUrl: field("", "user", "low", "needs_review", "A local file does not provide a public source URL."),
      externalIdentifier: field(input.sha256Hash, "uploaded_file", "high", "found", "SHA-256 fingerprint calculated in the browser."),
      edition: field("", "user", "low", "needs_review", "Version or edition could not be determined from basic file metadata."),
      fileName: field(input.name, "uploaded_file", "high", "found", "Browser-provided filename."),
      fileSize: field(formattedSize, "uploaded_file", "high", "found", "Browser-provided file size in bytes."),
      mimeType: field(mimeType, "uploaded_file", mimeType === "application/octet-stream" ? "low" : "high", mimeType === "application/octet-stream" ? "needs_review" : "found", "Browser-provided MIME type."),
      sha256Hash: field(input.sha256Hash, "uploaded_file", "high", "found", "SHA-256 fingerprint calculated in the browser."),
      copyrightNotice: field("", "user", "low", "needs_review", "Basic browser metadata did not expose a copyright notice."),
      copyrightLicenseId: field(licenseId, "metadata", "low", "needs_review", "No canonical license text was detected from this file import; the draft uses the conservative default."),
      rightsStatement: field("", "user", "low", "needs_review", "The rights statement is the creator's declaration and must be written or accepted by the creator."),
    },
    summary,
    warnings,
  };
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
    sourceLabel: `${input.owner}/${input.name}`,
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
      fileName: field("", "repository", "low", "needs_review", "Repository import did not select a release artifact file."),
      fileSize: field("", "repository", "low", "needs_review", "Repository import did not select a release artifact file."),
      mimeType: field("", "repository", "low", "needs_review", "Repository import did not select a release artifact file."),
      sha256Hash: field("", "repository", "low", "needs_review", "Repository import did not select a release artifact file."),
      copyrightNotice: field(notices[0] || "", notices.length ? "metadata" : "repository", notices.length ? "medium" : "low", notices.length ? "found" : "needs_review", notices.length ? "First copyright notice found in LICENSE or README." : "No copyright notice found."),
      copyrightLicenseId: field(licenseId as CopyrightLicenseId, "repository", selectedLicense.id === "proprietary" ? "low" : "high", selectedLicense.id === "proprietary" ? "needs_review" : "found", input.licenseSpdxId ? `GitHub license detector returned ${input.licenseSpdxId}.` : "License inferred from package metadata or conservative default."),
      rightsStatement: field("", "user", "low", "needs_review", "The rights statement is the creator's declaration and must be written or accepted by the creator."),
    },
    summary,
    warnings,
  };
}
