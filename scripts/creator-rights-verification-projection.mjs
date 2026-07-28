export const projectionSchemaVersion = "1.0";
export const projectionExporterVersion = "1.1";
export const projectionPath = "rights/verification-projection.json";
export const verificationStatements = {
  declared: {
    claim: "declared",
    statement: "This record was published by an authenticated account.",
  },
  surface_verified: {
    claim: "surface_control",
    statement: "The authenticated account demonstrated control of the referenced publication surface.",
  },
  artifact_verified: {
    claim: "artifact_fingerprint",
    statement: "The recorded artifact matched the listed fingerprint.",
  },
  signed: {
    claim: "signed_release",
    statement: "The record or artifact was cryptographically signed.",
  },
};

export async function sha256Hex(value) {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function stableSortEvidence(a, b) {
  return [
    String(a.method).localeCompare(String(b.method)),
    String(a.status).localeCompare(String(b.status)),
    String(a.target || "").localeCompare(String(b.target || "")),
    String(a.verifiedAt || "").localeCompare(String(b.verifiedAt || "")),
    String(a.id || "").localeCompare(String(b.id || "")),
  ].find((value) => value !== 0) || 0;
}

export function publicEvidence(row) {
  return {
    id: row.id,
    method: row.method,
    status: row.status,
    claim: row.claim,
    target: row.target || null,
    verifiedAt: row.verified_at || row.verifiedAt || null,
    revokedAt: row.revoked_at || row.revokedAt || null,
    proof: row.proof || undefined,
  };
}

export function effectiveVerification(record, evidence = []) {
  const publicEvidenceRows = evidence.map(publicEvidence).sort(stableSortEvidence);
  const activeEvidence = publicEvidenceRows.filter((item) => item.status !== "revoked");
  const methods = [];
  if (activeEvidence.some((item) => item.status === "passed" && item.method === "domain")) methods.push("domain");
  if (activeEvidence.some((item) => item.status === "passed" && item.method === "github")) methods.push("github");
  if (record.fileFingerprint || record.sha256_hash) methods.push("sha256");

  const level = record.fileFingerprint || record.sha256_hash
    ? "artifact_verified"
    : methods.includes("domain") || methods.includes("github")
      ? "surface_verified"
      : "declared";

  return {
    level,
    claim: verificationStatements[level].claim,
    statement: verificationStatements[level].statement,
    methods: Array.from(new Set(methods)),
    evidence: publicEvidenceRows,
  };
}

export async function buildProjection(records, evidenceBySlug = {}, options = {}) {
  const {
    source = "static",
    projectionMode = "local_bootstrap",
    sourceProject = null,
    generatedAt = new Date().toISOString(),
  } = typeof options === "string" ? { source: options } : options;
  const projectedRecords = {};
  for (const record of [...records].sort((a, b) => String(a.slug).localeCompare(String(b.slug)))) {
    const slug = record.slug;
    if (!slug) throw new Error("Projection records require a slug.");
    projectedRecords[slug] = {
      recordId: record.recordId || record.record_id || null,
      verification: effectiveVerification(record, evidenceBySlug[slug] || []),
    };
  }
  return {
    schemaVersion: projectionSchemaVersion,
    artifactType: "creator_rights_verification_projection",
    exporterVersion: projectionExporterVersion,
    projectionMode,
    source,
    sourceProject,
    generatedAt,
    recordCount: Object.keys(projectedRecords).length,
    records: projectedRecords,
  };
}

export async function finalizeProjection(projection) {
  const payload = { ...projection };
  delete payload.payloadSha256;
  return {
    ...projection,
    payloadSha256: await sha256Hex(`${JSON.stringify(payload)}\n`),
  };
}

export function mergeProjectionIntoRecord(record, projected) {
  if (!projected?.verification) return record;
  return {
    ...record,
    verification: projected.verification,
  };
}

export function assertProjectionIsPublicSafe(projection) {
  const serialized = JSON.stringify(projection);
  const forbidden = ["token_hash", "challenge=", "challengeToken", "SUPABASE_SERVICE_ROLE_KEY"];
  const leaked = forbidden.filter((term) => serialized.includes(term));
  if (leaked.length) {
    throw new Error(`Verification projection contains private verifier material: ${leaked.join(", ")}`);
  }
}
