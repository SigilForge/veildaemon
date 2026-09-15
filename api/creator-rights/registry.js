const PUBLIC_STATUSES = ["published", "updated", "transferred", "disputed", "under_review", "withdrawn", "archived"];
const WORK_TYPES = new Set(["book", "software", "game", "dataset", "music", "art", "video", "website", "model", "other"]);
const WORK_CATEGORIES = new Set(["fiction", "tabletop", "publishing", "technical", "software", "legal", "research", "marketing", "reference", "canon", "internal", "other"]);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, statusCode, payload) {
  setCors(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", statusCode === 200
    ? "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
    : "no-store");
  res.end(JSON.stringify(payload));
}

function safeEnum(value, allowed, fallback) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return allowed.has(normalized) ? normalized : fallback;
}

function safeText(value, maxLength = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function absoluteUrl(pathOrUrl, origin) {
  const value = safeText(pathOrUrl, 400);
  if (/^https:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${origin.replace(/\/+$/, "")}${value}`;
  return "";
}

function licenseAvailability(row) {
  const licenseId = String(row.copyright_license_id || "").toLowerCase();
  const commercial = String(row.human_commercial_license_available || "").toLowerCase();
  if (licenseId && licenseId !== "proprietary" && licenseId !== "custom") return "open";
  if (commercial === "allowed") return "open";
  if (commercial === "prohibited") return "unavailable";
  if (commercial === "case_by_case" || commercial === "custom_terms") return "contact";
  if (commercial === "license_required") return "paid_license";
  return row.licensing_contact ? "contact" : "unavailable";
}

function publicRecordForRow(row) {
  const recordOrigin = process.env.CREATOR_RIGHTS_PUBLIC_RECORD_ORIGIN || "https://app.veildaemon.app";
  const jsonOrigin = process.env.CREATOR_RIGHTS_PUBLIC_JSON_ORIGIN || "https://api.veildaemon.app";
  const slug = safeText(row.slug, 120);
  const publicRecordUrl = absoluteUrl(`/rights/${slug}`, recordOrigin);
  const hasHash = Boolean(row.sha256_hash);
  const licenseId = row.copyright_license_id || "proprietary";

  return {
    slug,
    recordId: row.record_id || null,
    title: safeText(row.title, 180),
    status: row.record_status || "published",
    work: {
      type: safeEnum(row.work_type, WORK_TYPES, "other"),
      category: safeEnum(row.category, WORK_CATEGORIES, "other"),
    },
    publisher: {
      type: "individual",
      name: safeText(row.public_display_name || row.creator_name || row.rights_holder_name, 120),
    },
    rightsHolder: safeText(row.rights_holder_name, 180),
    description: safeText(row.description, 360),
    availability: safeText(row.availability, 80) || "public",
    copyrightLicense: {
      id: licenseId,
      name: row.copyright_license_name || "Proprietary / all rights reserved",
      shortName: row.copyright_license_spdx_id || row.copyright_license_name || "All rights reserved",
      spdxId: row.copyright_license_spdx_id || null,
      category: licenseId !== "proprietary" && licenseId !== "custom" ? "open_content" : "proprietary",
      url: row.copyright_license_url || "https://www.copyright.gov/help/faq/",
      summary: row.rights_statement || "No reuse rights are granted unless a separate notice, agreement, or license says otherwise.",
      requiresNotice: Boolean(row.copyright_license_spdx_id),
    },
    registryFramework: {
      id: row.registry_framework_id || "sfr",
      name: "SigilForge Rights Framework",
      shortName: "SFR",
      version: row.registry_framework_version || "1.0",
      url: "https://veildaemon.app/rights/",
      summary: "Defines Creator Rights Record behavior, provenance metadata, verification state, AI permissions, and machine-readable rights posture.",
      supplementalNotice: "SFR supplements the selected copyright license. It does not replace or modify that license.",
    },
    permissions: publicPermissions(row),
    licensing: {
      availability: licenseAvailability(row),
      commercialReadiness: row.licensing_contact ? "inquiry_ready" : "inquiry_only",
      contactUrl: publicRecordUrl ? `${publicRecordUrl}/license` : "",
    },
    verification: {
      level: hasHash ? "artifact_verified" : "declared",
      claim: hasHash ? "artifact_fingerprint" : "declared",
      statement: hasHash
        ? "The recorded artifact has an associated SHA-256 fingerprint."
        : "This record was published by an authenticated account.",
      methods: hasHash ? ["sha256"] : [],
      evidence: [],
    },
    technicalArtifacts: {
      jsonAvailable: true,
      canonicalUrl: true,
      sha256Available: hasHash,
      signatureAvailable: false,
      versionHistoryAvailable: true,
    },
    recordedAt: row.created_at || null,
    publishedAt: row.published_at || null,
    publicRecordUrl,
    jsonUrl: `${jsonOrigin.replace(/\/+$/, "")}/api/creator-rights/registry?slug=${encodeURIComponent(slug)}`,
  };
}

function publicPermissions(row) {
  const ai = row.ai_permissions && typeof row.ai_permissions === "object" ? row.ai_permissions : {};
  return {
    generalTraining: ai.generalTraining || ai.general_training || "license_required",
    foundationModelPretraining: ai.foundationModelPretraining || ai.foundation_model_pretraining || "license_required",
    fineTuning: ai.fineTuning || ai.fine_tuning || "prohibited",
    embeddings: ai.embeddings || "license_required",
    rag: ai.rag || "license_required",
    generation: ai.generation || "license_required",
    datasetRedistribution: ai.datasetRedistribution || ai.dataset_redistribution || "prohibited",
    researchUse: ai.researchUse || ai.research_use || "research_only",
    commercialUse: ai.commercialUse || ai.commercial_use || row.human_commercial_license_available || "license_required",
    attributionRequired: ai.attributionRequired || ai.attribution_required || "license_required",
    licenseRequired: ai.licenseRequired || ai.license_required || "license_required",
  };
}

async function supabaseRestGet(table, params) {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    const error = new Error("Supabase registry source is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const endpoint = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [name, value] of Object.entries(params)) endpoint.searchParams.set(name, value);
  const response = await fetch(endpoint, {
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`,
      accept: "application/json",
    },
  });
  const body = await response.text();
  if (!response.ok) {
    const error = new Error(`Supabase registry read failed (${response.status}).`);
    error.statusCode = 502;
    error.details = body.slice(0, 500);
    throw error;
  }
  return JSON.parse(body);
}

async function loadRegistryRows(query = {}) {
  const select = [
    "id",
    "record_id",
    "slug",
    "title",
    "work_type",
    "category",
    "description",
    "creator_name",
    "public_display_name",
    "rights_holder_name",
    "rights_statement",
    "ai_permissions",
    "human_commercial_license_available",
    "record_status",
    "published_at",
    "created_at",
    "sha256_hash",
    "availability",
    "licensing_contact",
    "copyright_license_id",
    "copyright_license_name",
    "copyright_license_spdx_id",
    "copyright_license_url",
    "registry_framework_id",
    "registry_framework_version",
  ].join(",");
  const params = {
    select,
    record_status: `in.(${PUBLIC_STATUSES.join(",")})`,
    order: "published_at.desc.nullslast",
    limit: "200",
  };
  if (query.slug) params.slug = `eq.${safeText(query.slug, 120)}`;
  return supabaseRestGet("creator_rights_records", params);
}

async function registryPayload(query = {}) {
  const records = (await loadRegistryRows(query))
    .map(publicRecordForRow)
    .filter((record) => record.slug && record.title);
  return {
    schemaVersion: "1.0",
    sourceSchemaVersion: "1.1",
    generatedFrom: "supabase:creator_rights_records",
    generatedAt: new Date().toISOString(),
    records,
  };
}

async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const query = req.query || Object.fromEntries(new URL(req.url || "/", "https://api.veildaemon.app").searchParams);
    return json(res, 200, await registryPayload(query));
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Creator Rights registry unavailable.",
    });
  }
}

module.exports = handler;
module.exports._private = {
  publicRecordForRow,
  registryPayload,
};
