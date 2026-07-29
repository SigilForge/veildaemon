import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rightsDir = path.join(root, "rights");
const outputPath = path.join(root, "registry", "records.json");

const files = (await readdir(rightsDir))
  .filter((file) => file.endsWith(".json") && file !== "creator-rights-record.schema.json" && file !== "verification-projection.json")
  .sort();

const records = [];

for (const file of files) {
  const record = JSON.parse(await readFile(path.join(rightsDir, file), "utf8"));
  const slug = file.replace(/\.json$/, "");

  records.push({
    slug,
    recordId: record.recordId,
    title: record.title,
    status: record.status,
    work: record.work,
    publisher: record.publisher,
    copyrightLicense: record.copyrightLicense,
    registryFramework: record.registryFramework,
    permissions: record.permissions,
    licensing: record.licensing,
    verification: record.verification,
    technicalArtifacts: record.technicalArtifacts,
    publicRecordUrl: record.publicRecordUrl,
    jsonUrl: `/rights/${slug}.json`,
  });
}

const registry = {
  schemaVersion: "1.0",
  sourceSchemaVersion: "1.1",
  generatedFrom: "/rights/*.json",
  records,
};

await writeFile(outputPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Wrote registry index for ${records.length} record(s) to registry/records.json.`);
