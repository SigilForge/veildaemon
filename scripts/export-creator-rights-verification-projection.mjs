import fs from "node:fs/promises";
import path from "node:path";
import {
  assertProjectionIsPublicSafe,
  buildProjection,
  finalizeProjection,
  mergeProjectionIntoRecord,
  projectionPath,
} from "./creator-rights-verification-projection.mjs";

const root = process.cwd();
const rightsDir = path.join(root, "rights");
const outputPath = path.join(root, projectionPath);
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture="));
const checkOnly = process.argv.includes("--check");
const source = sourceArg ? sourceArg.split("=")[1] : "supabase";

function parseEnvValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadEnvFile(file) {
  try {
    const body = await fs.readFile(file, "utf8");
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 1) continue;
      const key = trimmed.slice(0, index).trim();
      if (!process.env[key]) process.env[key] = parseEnvValue(trimmed.slice(index + 1));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function loadStaticRecords() {
  const files = (await fs.readdir(rightsDir))
    .filter((file) => file.endsWith(".json") && file !== "creator-rights-record.schema.json" && file !== "verification-projection.json")
    .sort();
  const records = [];
  for (const file of files) {
    const record = JSON.parse(await fs.readFile(path.join(rightsDir, file), "utf8"));
    records.push({ ...record, slug: file.replace(/\.json$/, "") });
  }
  return records;
}

async function loadFixtureEvidence(fixturePath, records) {
  const fixture = JSON.parse(await fs.readFile(path.resolve(root, fixturePath), "utf8"));
  const evidenceBySlug = {};
  for (const [slug, value] of Object.entries(fixture.records || {})) {
    evidenceBySlug[slug] = value.evidence || value.verification?.evidence || [];
  }
  for (const record of records) {
    if (fixture.records?.[record.slug]?.verification) {
      evidenceBySlug[record.slug] = fixture.records[record.slug].verification.evidence || [];
    }
  }
  return evidenceBySlug;
}

async function loadSupabaseEvidence(records) {
  await loadEnvFile(path.join(root, "veillink", ".env"));
  await loadEnvFile(path.join(root, "veillink", ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase export requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const slugs = records.map((record) => record.slug);
  async function restGet(table, params) {
    const endpoint = new URL(`${url.replace(/\/$/, "")}/rest/v1/${table}`);
    for (const [name, value] of Object.entries(params)) endpoint.searchParams.set(name, value);
    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        accept: "application/json",
      },
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase REST ${table} read failed (${response.status}): ${body}`);
    }
    return JSON.parse(body);
  }

  const dbRecords = (await restGet("creator_rights_records", {
    select: "id,slug,record_id,sha256_hash",
  })).filter((record) => slugs.includes(record.slug));

  const recordById = new Map((dbRecords || []).map((record) => [record.id, record]));
  const slugById = new Map((dbRecords || []).map((record) => [record.id, record.slug]));
  if (!recordById.size) {
    return {
      evidenceBySlug: {},
      sourceProject: new URL(url).hostname,
    };
  }

  const ids = Array.from(recordById.keys());
  const evidenceRows = await restGet("creator_rights_verification_evidence", {
    select: "id,record_id,method,status,claim,target,verified_at,revoked_at,proof,created_at",
    record_id: `in.(${ids.join(",")})`,
    order: "created_at.desc",
  });

  const evidenceBySlug = {};
  for (const row of evidenceRows || []) {
    const slug = slugById.get(row.record_id);
    if (!slug) continue;
    evidenceBySlug[slug] ||= [];
    evidenceBySlug[slug].push(row);
  }
  return {
    evidenceBySlug,
    sourceProject: new URL(url).hostname,
  };
}

async function writeFileAtomic(file, body) {
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, body);
  await fs.rename(tmp, file);
}

async function writeMergedRecordsAtomic(records, projection) {
  const writes = [];
  for (const record of records) {
    const merged = {
      ...mergeProjectionIntoRecord(record, projection.records[record.slug]),
      aiPolicy: record.aiPolicy || {
        effectiveFrom: "2026-07-28",
        appliesTo: [
          "model_training",
          "fine_tuning",
          "retrieval",
          "generation",
          "commercial_output",
        ],
      },
    };
    const { slug, ...recordJson } = merged;
    writes.push({
      file: path.join(rightsDir, `${slug}.json`),
      body: `${JSON.stringify(recordJson, null, 2)}\n`,
    });
  }
  for (const write of writes) await writeFileAtomic(write.file, write.body);
}

const records = await loadStaticRecords();
let evidenceBySlug = {};
let actualSource = source;
let projectionMode = source === "supabase" ? "live" : "local_bootstrap";
let sourceProject = null;

if (source === "supabase") {
  const live = await loadSupabaseEvidence(records);
  evidenceBySlug = live.evidenceBySlug;
  sourceProject = live.sourceProject;
  actualSource = "creator_rights_verification_evidence";
} else if (source === "fixture") {
  const fixture = fixtureArg?.split("=")[1];
  if (!fixture) throw new Error("--source=fixture requires --fixture=<path>.");
  evidenceBySlug = await loadFixtureEvidence(fixture, records);
  actualSource = `fixture:${fixture}`;
} else if (source === "static") {
  evidenceBySlug = Object.fromEntries(records.map((record) => [record.slug, record.verification?.evidence || []]));
} else {
  throw new Error(`Unsupported verification projection source: ${source}`);
}

const projection = await finalizeProjection(await buildProjection(records, evidenceBySlug, {
  source: actualSource,
  projectionMode,
  sourceProject,
}));
assertProjectionIsPublicSafe(projection);

if (checkOnly) {
  const current = JSON.parse(await fs.readFile(outputPath, "utf8"));
  const comparableCurrent = { ...current };
  const comparableProjection = { ...projection };
  delete comparableCurrent.generatedAt;
  delete comparableCurrent.payloadSha256;
  delete comparableProjection.generatedAt;
  delete comparableProjection.payloadSha256;
  if (JSON.stringify(comparableCurrent) !== JSON.stringify(comparableProjection)) {
    throw new Error("Verification projection is stale. Run rights:verification:export for Supabase or rights:verification:sync-local for local records.");
  }
  console.log(`Creator Rights verification projection check passed for ${records.length} record(s).`);
} else {
  await writeFileAtomic(outputPath, `${JSON.stringify(projection, null, 2)}\n`);
  await writeMergedRecordsAtomic(records, projection);
  console.log(`Exported Creator Rights verification projection from ${actualSource} for ${records.length} record(s).`);
}
