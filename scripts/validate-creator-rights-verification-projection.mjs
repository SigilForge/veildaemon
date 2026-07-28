import fs from "node:fs/promises";
import path from "node:path";
import { assertProjectionIsPublicSafe, projectionPath, sha256Hex } from "./creator-rights-verification-projection.mjs";

const root = process.cwd();
const rightsDir = path.join(root, "rights");
const projection = JSON.parse(await fs.readFile(path.join(root, projectionPath), "utf8"));
assertProjectionIsPublicSafe(projection);
const maxAgeArg = process.argv.find((arg) => arg.startsWith("--max-age="));
const requireLive = process.argv.includes("--require-live");

function parseMaxAge(value) {
  const match = /^(\d+)(m|h|d)$/.exec(value);
  if (!match) throw new Error("--max-age must use a value like 30m, 24h, or 7d.");
  const amount = Number(match[1]);
  return amount * ({ m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]);
}

const files = (await fs.readdir(rightsDir))
  .filter((file) => file.endsWith(".json") && file !== "creator-rights-record.schema.json" && file !== "verification-projection.json")
  .sort();

const errors = [];
if (projection.artifactType !== "creator_rights_verification_projection") errors.push("projection artifactType is missing or invalid");
if (!["live", "local_bootstrap"].includes(projection.projectionMode)) errors.push("projectionMode must be live or local_bootstrap");
if (requireLive && projection.projectionMode !== "live") errors.push("projectionMode must be live for this check");
if (typeof projection.recordCount !== "number") errors.push("recordCount is required");
if (!projection.generatedAt || Number.isNaN(new Date(projection.generatedAt).getTime())) errors.push("generatedAt must be an ISO timestamp");
if (!/^[a-f0-9]{64}$/.test(projection.payloadSha256 || "")) errors.push("payloadSha256 must be a SHA-256 hex digest");
if (projection.payloadSha256) {
  const comparable = { ...projection };
  delete comparable.payloadSha256;
  const expectedHash = await sha256Hex(`${JSON.stringify(comparable)}\n`);
  if (projection.payloadSha256 !== expectedHash) errors.push("payloadSha256 does not match the canonical projection payload");
}
if (maxAgeArg && projection.generatedAt) {
  const maxAgeMs = parseMaxAge(maxAgeArg.split("=")[1]);
  const ageMs = Date.now() - new Date(projection.generatedAt).getTime();
  if (ageMs > maxAgeMs) errors.push(`projection is stale: age ${Math.round(ageMs / 60000)}m exceeds ${maxAgeArg.split("=")[1]}`);
}
for (const file of files) {
  const slug = file.replace(/\.json$/, "");
  const record = JSON.parse(await fs.readFile(path.join(rightsDir, file), "utf8"));
  const projected = projection.records?.[slug];
  if (!projected) {
    errors.push(`${file}: missing projection entry`);
    continue;
  }
  if (JSON.stringify(record.verification) !== JSON.stringify(projected.verification)) {
    errors.push(`${file}: verification does not match rights/verification-projection.json`);
  }
}

if (projection.recordCount !== files.length) errors.push(`recordCount ${projection.recordCount} does not match rights record count ${files.length}`);

for (const slug of Object.keys(projection.records || {})) {
  if (!files.includes(`${slug}.json`)) errors.push(`${slug}: projection has no matching rights JSON record`);
}

if (errors.length) {
  console.error(`Creator Rights verification projection validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Creator Rights verification projection validation passed for ${files.length} record(s).`);
