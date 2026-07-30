import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { buildGitHubRepositoryDraft, parseGitHubRepositoryUrl } from "@/lib/rights/import-draft";
import { publicError } from "@/lib/store";

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
};

type GitHubRepoResponse = {
  name?: string;
  full_name?: string;
  description?: string | null;
  default_branch?: string | null;
  html_url?: string | null;
  homepage?: string | null;
  pushed_at?: string | null;
  owner?: { login?: string };
  license?: { spdx_id?: string | null; name?: string | null } | null;
};

type GitHubLicenseResponse = GitHubContentResponse & {
  license?: { spdx_id?: string | null; name?: string | null } | null;
};

type GitHubReleaseResponse = {
  tag_name?: string | null;
};

type GitHubCommitResponse = {
  sha?: string | null;
};

const GITHUB_API = "https://api.github.com";

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

async function githubJson<T>(path: string, optional = false): Promise<T | null> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "veildaemon-creator-rights-import",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (optional && response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 403) throw publicError("GitHub refused the import request. The public API may be rate-limited; try again later.", 503);
    if (response.status === 404) throw publicError("GitHub repository was not found or is not public.", 404);
    throw publicError(`GitHub import failed with status ${response.status}.`, 502);
  }
  return (await response.json()) as T;
}

function decodeContent(response: GitHubContentResponse | null) {
  if (!response?.content || response.encoding !== "base64") return "";
  try {
    return Buffer.from(response.content.replace(/\s+/g, ""), "base64").toString("utf8").slice(0, 200000);
  } catch {
    return "";
  }
}

function parsePackageJson(response: GitHubContentResponse | null) {
  const text = decodeContent(response);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { repositoryUrl?: string } | null;
    const ref = parseGitHubRepositoryUrl(body?.repositoryUrl || "");
    const owner = encodeURIComponent(ref.owner);
    const repo = encodeURIComponent(ref.repo);
    const repository = await githubJson<GitHubRepoResponse>(`/repos/${owner}/${repo}`);
    if (!repository) throw publicError("GitHub repository was not found or is not public.", 404);

    const defaultBranch = repository.default_branch || "main";
    const [license, readme, packageJson, latestRelease, headCommit] = await Promise.all([
      githubJson<GitHubLicenseResponse>(`/repos/${owner}/${repo}/license`, true),
      githubJson<GitHubContentResponse>(`/repos/${owner}/${repo}/readme`, true),
      githubJson<GitHubContentResponse>(`/repos/${owner}/${repo}/contents/package.json?ref=${encodeURIComponent(defaultBranch)}`, true),
      githubJson<GitHubReleaseResponse>(`/repos/${owner}/${repo}/releases/latest`, true),
      githubJson<GitHubCommitResponse>(`/repos/${owner}/${repo}/commits/${encodeURIComponent(defaultBranch)}`, true),
    ]);

    const draft = buildGitHubRepositoryDraft({
      repositoryUrl: ref.url,
      owner: repository.owner?.login || ref.owner,
      name: repository.name || ref.repo,
      description: repository.description || null,
      defaultBranch,
      htmlUrl: repository.html_url || ref.url,
      homepage: repository.homepage || null,
      pushedAt: repository.pushed_at || null,
      latestReleaseTag: latestRelease?.tag_name || null,
      headSha: headCommit?.sha || null,
      licenseSpdxId: license?.license?.spdx_id || repository.license?.spdx_id || null,
      licenseName: license?.license?.name || repository.license?.name || null,
      packageJson: parsePackageJson(packageJson),
      readmeText: decodeContent(readme),
      licenseText: decodeContent(license),
    });

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return jsonError(error);
  }
}
