import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "registry", "records.json");
const pagePath = path.join(root, "registry", "index.html");

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const page = await readFile(pagePath, "utf8");
const cardSlugs = [...page.matchAll(/data-rights-slug="([^"]+)"/g)].map((match) => match[1]).sort();
const indexSlugs = (registry.records || []).map((record) => record.slug).sort();

const errors = [];

if (registry.sourceSchemaVersion !== "1.1") {
  errors.push(`registry.sourceSchemaVersion must be 1.1, found ${registry.sourceSchemaVersion}`);
}

if (cardSlugs.length !== indexSlugs.length) {
  errors.push(`card count ${cardSlugs.length} does not match registry index count ${indexSlugs.length}`);
}

const cardSet = new Set(cardSlugs);
const indexSet = new Set(indexSlugs);

for (const slug of indexSlugs) {
  if (!cardSet.has(slug)) errors.push(`registry/records.json has no visible card for ${slug}`);
}

for (const slug of cardSlugs) {
  if (!indexSet.has(slug)) errors.push(`registry/index.html card has no structured index record for ${slug}`);
}

for (const record of registry.records || []) {
  for (const field of ["work", "publisher", "permissions", "licensing", "verification", "technicalArtifacts"]) {
    if (!record[field] || typeof record[field] !== "object") {
      errors.push(`${record.slug} is missing structured ${field} facet`);
    }
  }
}

if (errors.length) {
  console.error(`Creator Rights registry index validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Creator Rights registry index validation passed for ${indexSlugs.length} record(s).`);
