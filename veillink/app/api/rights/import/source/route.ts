import { NextRequest, NextResponse } from "next/server";
import { buildExternalSourceDraft, licenseIdForSpdx } from "@/lib/rights/import-draft";
import type { CopyrightLicenseId, KnownWorkType } from "@/lib/rights/schema";
import { publicError } from "@/lib/store";

type SourceKind = "npm" | "pypi" | "doi" | "isbn" | "steam" | "itch";

const sourceKinds = new Set<SourceKind>(["npm", "pypi", "doi", "isbn", "steam", "itch"]);

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

async function publicJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "veildaemon-creator-rights-import",
    },
    cache: "no-store",
  });
  if (response.status === 404) throw publicError(`${label} was not found.`, 404);
  if (response.status === 403 || response.status === 429) throw publicError(`${label} refused the import request. Try again later.`, 503);
  if (!response.ok) throw publicError(`${label} import failed with status ${response.status}.`, 502);
  return (await response.json()) as T;
}

function bodyValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function detectSourceType(value: string): SourceKind {
  if (/^npm:/i.test(value)) return "npm";
  if (/^pypi:/i.test(value)) return "pypi";
  try {
    const parsed = new URL(value);
    if (parsed.hostname === "www.npmjs.com" || parsed.hostname === "npmjs.com") return "npm";
    if (parsed.hostname === "pypi.org") return "pypi";
    if (parsed.hostname === "doi.org" || parsed.hostname === "dx.doi.org") return "doi";
    if (parsed.hostname === "openlibrary.org" || parsed.pathname.toLowerCase().includes("isbn")) return "isbn";
    if (["store.steampowered.com", "steamcommunity.com"].includes(parsed.hostname)) return "steam";
    if (parsed.hostname.endsWith(".itch.io")) return "itch";
  } catch {}
  if (/^(?:doi:\s*)?10\.\S+\/\S+$/i.test(value) || /^https?:\/\/(?:dx\.)?doi\.org\//i.test(value)) return "doi";
  if (/^(?:isbn[:\s-]*)?(?:97[89][0-9Xx -]{10,17}|[0-9Xx -]{10,13})$/i.test(value)) return "isbn";
  if (/^@?[A-Za-z0-9_.~-]+\/[A-Za-z0-9_.~-]+$/.test(value) || /^[A-Za-z0-9_.~-]+$/.test(value)) return "npm";
  throw publicError("Could not recognize that source. Paste a supported package, publication, store URL, DOI, ISBN, npm package, or PyPI project.", 400);
}

function packageNameFromNpm(value: string) {
  const trimmed = value.trim().replace(/^npm:/i, "").trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "www.npmjs.com" || parsed.hostname === "npmjs.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "package" && parts[1]) return decodeURIComponent(parts.slice(1).join("/"));
    }
  } catch {}
  return trimmed;
}

function packageNameFromPypi(value: string) {
  const trimmed = value.trim().replace(/^pypi:/i, "").trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "pypi.org") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "project" && parts[1]) return decodeURIComponent(parts[1]);
    }
  } catch {}
  return trimmed;
}

function normalizeDoi(value: string) {
  return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
}

function normalizeIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function parseSteamUrl(value: string) {
  const trimmed = value.trim();
  const parsed = new URL(trimmed);
  if (!["store.steampowered.com", "steamcommunity.com"].includes(parsed.hostname)) {
    throw publicError("Enter a Steam store URL.", 400);
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  const appIndex = parts.indexOf("app");
  const id = appIndex >= 0 ? parts[appIndex + 1] : "";
  if (!/^[0-9]{1,12}$/.test(id)) throw publicError("Steam import needs a store app URL containing /app/{id}.", 400);
  const slug = parts[appIndex + 2] || `steam-app-${id}`;
  return { id, title: slug.replace(/[_-]+/g, " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase()), url: `https://store.steampowered.com/app/${id}` };
}

function parseItchUrl(value: string) {
  const parsed = new URL(value.trim());
  if (!parsed.hostname.endsWith(".itch.io")) throw publicError("Enter an itch.io project URL.", 400);
  const slug = parsed.pathname.split("/").filter(Boolean)[0] || parsed.hostname.replace(".itch.io", "");
  return {
    id: `${parsed.hostname}${parsed.pathname}`,
    title: slug.replace(/[_-]+/g, " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase()),
    url: `https://${parsed.hostname}/${slug}`,
    owner: parsed.hostname.replace(".itch.io", ""),
  };
}

function licenseFromValue(value: unknown) {
  if (typeof value !== "string") return null;
  return licenseIdForSpdx(value) || (value.toLowerCase().includes("mit") ? "mit" : null);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { sourceType?: string; value?: string } | null;
    const value = bodyValue(body?.value);
    if (!value) throw publicError("Enter a source URL or identifier.", 400);
    const requestedSourceType = bodyValue(body?.sourceType);
    const sourceType = sourceKinds.has(requestedSourceType as SourceKind) ? (requestedSourceType as SourceKind) : detectSourceType(value);

    if (sourceType === "npm") {
      const packageName = packageNameFromNpm(value);
      if (!/^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(packageName)) throw publicError("Enter a valid npm package name or URL.", 400);
      const encoded = encodeURIComponent(packageName);
      const packument = await publicJson<Record<string, unknown>>(`https://registry.npmjs.org/${encoded}`, "npm package");
      const tags = (packument["dist-tags"] || {}) as Record<string, unknown>;
      const latest = bodyValue(tags.latest);
      const versions = (packument.versions || {}) as Record<string, Record<string, unknown>>;
      const latestData = latest ? versions[latest] || {} : {};
      const repository = latestData.repository as { url?: string } | string | undefined;
      const repositoryUrl = typeof repository === "string" ? repository : repository?.url || "";
      const author = latestData.author as { name?: string } | string | undefined;
      const authorName = typeof author === "string" ? author : author?.name || "";
      const licenseId = licenseFromValue(latestData.license) as CopyrightLicenseId | null;
      return NextResponse.json({
        ok: true,
        draft: buildExternalSourceDraft({
          importKind: "npm_package",
          sourceLabel: `npm:${packageName}`,
          sourceValue: packageName,
          sourceUrl: `https://www.npmjs.com/package/${packageName}`,
          source: "package_registry",
          title: packageName,
          description: bodyValue(packument.description) || bodyValue(latestData.description),
          workType: "software",
          category: "software",
          externalIdentifier: `npm:${packageName}@${latest || "latest"}`,
          edition: latest,
          publicDisplayName: authorName,
          licenseId,
          licenseEvidence: licenseId ? "npm package metadata license field." : "npm package metadata did not provide a mapped SPDX license.",
          summary: [`We found npm package metadata for ${packageName}.`, latest ? `Latest version is ${latest}.` : "No latest version tag was available."],
          warnings: repositoryUrl ? [`Repository URL reported by npm: ${repositoryUrl}`] : [],
        }),
      });
    }

    if (sourceType === "pypi") {
      const project = packageNameFromPypi(value);
      if (!/^[A-Za-z0-9_.-]{1,220}$/.test(project)) throw publicError("Enter a valid PyPI project name or URL.", 400);
      const payload = await publicJson<{ info?: Record<string, unknown>; releases?: Record<string, Array<{ digests?: { sha256?: string } }>> }>(`https://pypi.org/pypi/${encodeURIComponent(project)}/json`, "PyPI project");
      const info = payload.info || {};
      const version = bodyValue(info.version);
      const licenseId = licenseFromValue(info.license) as CopyrightLicenseId | null;
      const sha = version ? payload.releases?.[version]?.[0]?.digests?.sha256 || "" : "";
      return NextResponse.json({
        ok: true,
        draft: buildExternalSourceDraft({
          importKind: "pypi_package",
          sourceLabel: `PyPI:${project}`,
          sourceValue: project,
          sourceUrl: bodyValue(info.package_url) || `https://pypi.org/project/${project}/`,
          source: "package_registry",
          title: bodyValue(info.name) || project,
          description: bodyValue(info.summary),
          workType: "software",
          category: "software",
          externalIdentifier: `pypi:${project}${version ? `@${version}` : ""}${sha ? ` sha256:${sha}` : ""}`,
          edition: version,
          publicDisplayName: bodyValue(info.author) || bodyValue(info.maintainer),
          licenseId,
          licenseEvidence: licenseId ? "PyPI project metadata license field." : "PyPI metadata did not provide a mapped SPDX license.",
          summary: [`We found PyPI project metadata for ${project}.`, version ? `Latest version is ${version}.` : "No version was available."],
          warnings: ["PyPI notes that JSON metadata comes from upload-time project metadata and may not match later file contents."],
        }),
      });
    }

    if (sourceType === "doi") {
      const doi = normalizeDoi(value);
      if (!/^10\.\S+\/\S+$/i.test(doi)) throw publicError("Enter a valid DOI.", 400);
      const payload = await publicJson<{ message?: Record<string, unknown> }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, "DOI");
      const message = payload.message || {};
      const title = Array.isArray(message.title) ? bodyValue(message.title[0]) : doi;
      const publisher = bodyValue(message.publisher);
      const published = ((message["published-print"] || message["published-online"] || {}) as { "date-parts"?: number[][] })["date-parts"]?.[0]?.join("-") || "";
      return NextResponse.json({
        ok: true,
        draft: buildExternalSourceDraft({
          importKind: "doi",
          sourceLabel: `DOI:${doi}`,
          sourceValue: doi,
          sourceUrl: `https://doi.org/${doi}`,
          source: "publication_registry",
          title: title || doi,
          description: bodyValue(message.subtitle),
          workType: "research",
          category: "research",
          externalIdentifier: `doi:${doi}`,
          edition: published,
          publicDisplayName: publisher,
          licenseId: null,
          summary: [`We found Crossref metadata for DOI ${doi}.`],
          warnings: ["DOI metadata identifies a publication record, not legal ownership of the work."],
        }),
      });
    }

    if (sourceType === "isbn") {
      const isbn = normalizeIsbn(value);
      if (!/^(?:[0-9]{10}|[0-9]{13}|[0-9]{9}X)$/.test(isbn)) throw publicError("Enter a valid ISBN-10 or ISBN-13.", 400);
      const payload = await publicJson<Record<string, unknown>>(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, "ISBN");
      const publishers = Array.isArray(payload.publishers) ? payload.publishers.map(bodyValue).filter(Boolean) : [];
      return NextResponse.json({
        ok: true,
        draft: buildExternalSourceDraft({
          importKind: "isbn",
          sourceLabel: `ISBN:${isbn}`,
          sourceValue: isbn,
          sourceUrl: `https://openlibrary.org/isbn/${isbn}`,
          source: "publication_registry",
          title: bodyValue(payload.title) || isbn,
          description: bodyValue(payload.subtitle),
          workType: "book",
          category: "fiction",
          externalIdentifier: `isbn:${isbn}`,
          edition: bodyValue(payload.publish_date),
          publicDisplayName: publishers[0] || "",
          licenseId: null,
          summary: [`We found Open Library metadata for ISBN ${isbn}.`],
          warnings: ["ISBN metadata is publication evidence. It does not prove legal ownership."],
        }),
      });
    }

    if (sourceType === "steam") {
      const parsed = parseSteamUrl(value);
      return NextResponse.json({
        ok: true,
        draft: buildExternalSourceDraft({
          importKind: "steam_listing",
          sourceLabel: `Steam:${parsed.id}`,
          sourceValue: parsed.id,
          sourceUrl: parsed.url,
          source: "store_listing",
          title: parsed.title,
          description: "Steam store listing imported from URL.",
          workType: "game",
          category: "software",
          externalIdentifier: `steam:${parsed.id}`,
          licenseId: null,
          summary: [`We recognized Steam app ${parsed.id}.`],
          warnings: ["Steam URL import currently records the store surface and app id; it does not fetch or verify publisher metadata."],
        }),
      });
    }

    const parsed = parseItchUrl(value);
    return NextResponse.json({
      ok: true,
      draft: buildExternalSourceDraft({
        importKind: "itch_listing",
        sourceLabel: `itch:${parsed.id}`,
        sourceValue: parsed.id,
        sourceUrl: parsed.url,
        source: "store_listing",
        title: parsed.title,
        description: "itch.io project listing imported from URL.",
        workType: "game",
        category: "software",
        externalIdentifier: `itch:${parsed.id}`,
        publicDisplayName: parsed.owner,
        licenseId: null,
        summary: [`We recognized itch.io listing ${parsed.id}.`],
        warnings: ["itch.io URL import currently records the store surface; it does not fetch or verify publisher metadata."],
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
