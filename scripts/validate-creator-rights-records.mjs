import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rightsDir = path.join(root, "rights");
const schemaPath = path.join(rightsDir, "creator-rights-record.schema.json");

function enumFor(schema, pointer) {
  let current = schema;
  for (const part of pointer.split("/").filter(Boolean)) {
    current = current?.[part];
  }
  if (!Array.isArray(current?.enum)) throw new Error(`Schema enum missing at ${pointer}`);
  return new Set(current.enum);
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validateRecord(record, schema, filename) {
  const errors = [];
  const permissionValues = enumFor(schema, "$defs/permissionValue");
  const workTypes = enumFor(schema, "properties/work/properties/type");
  const categories = enumFor(schema, "properties/work/properties/category");
  const publisherTypes = enumFor(schema, "properties/publisher/properties/type");
  const licensingAvailability = enumFor(schema, "properties/licensing/properties/availability");
  const commercialReadiness = enumFor(schema, "properties/licensing/properties/commercialReadiness");
  const verificationLevels = enumFor(schema, "properties/verification/properties/level");
  const verificationMethods = enumFor(schema, "properties/verification/properties/methods/items");

  assert(record.recordType === "CreatorRightsRecord", "recordType must be CreatorRightsRecord", errors);
  assert(record.schemaVersion === "1.1", "schemaVersion must be 1.1", errors);
  assert(record.work && typeof record.work === "object", "work facet is required", errors);
  assert(workTypes.has(record.work?.type), `work.type has uncontrolled value ${record.work?.type}`, errors);
  assert(categories.has(record.work?.category), `work.category has uncontrolled value ${record.work?.category}`, errors);
  assert(record.publisher && typeof record.publisher === "object", "publisher facet is required", errors);
  assert(publisherTypes.has(record.publisher?.type), `publisher.type has uncontrolled value ${record.publisher?.type}`, errors);

  for (const [key, value] of Object.entries(record.permissions || {})) {
    assert(permissionValues.has(value), `permissions.${key} has uncontrolled value ${value}`, errors);
  }

  assert(record.licensing && typeof record.licensing === "object", "licensing facet is required", errors);
  assert(
    licensingAvailability.has(record.licensing?.availability),
    `licensing.availability has uncontrolled value ${record.licensing?.availability}`,
    errors
  );
  assert(
    commercialReadiness.has(record.licensing?.commercialReadiness),
    `licensing.commercialReadiness has uncontrolled value ${record.licensing?.commercialReadiness}`,
    errors
  );
  assert(typeof record.licensing?.contactUrl === "string", "licensing.contactUrl must be a string", errors);

  assert(record.verification && typeof record.verification === "object", "verification facet is required", errors);
  assert(verificationLevels.has(record.verification?.level), `verification.level has uncontrolled value ${record.verification?.level}`, errors);
  assert(Array.isArray(record.verification?.methods), "verification.methods must be an array", errors);
  for (const method of record.verification?.methods || []) {
    assert(verificationMethods.has(method), `verification.methods has uncontrolled value ${method}`, errors);
  }
  assert(Array.isArray(record.verification?.evidence), "verification.evidence must be an array", errors);

  const artifacts = record.technicalArtifacts;
  assert(artifacts && typeof artifacts === "object", "technicalArtifacts facet is required", errors);
  for (const key of ["jsonAvailable", "canonicalUrl", "sha256Available", "signatureAvailable", "versionHistoryAvailable"]) {
    assert(typeof artifacts?.[key] === "boolean", `technicalArtifacts.${key} must be boolean`, errors);
  }

  if (record.fileFingerprint) {
    assert(record.fileFingerprint.algorithm === "SHA-256", "fileFingerprint.algorithm must be SHA-256", errors);
    assert(/^[a-f0-9]{64}$/i.test(record.fileFingerprint.value || ""), "fileFingerprint.value must be a SHA-256 hex digest", errors);
    assert(record.verification.level === "artifact_verified", "fingerprinted records must be artifact_verified", errors);
    assert(record.verification.methods.includes("sha256"), "fingerprinted records must include sha256 verification method", errors);
    assert(artifacts?.sha256Available === true, "fingerprinted records must set sha256Available", errors);
  }

  return errors.map((error) => `${filename}: ${error}`);
}

const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const files = (await readdir(rightsDir))
  .filter((file) => file.endsWith(".json") && file !== "creator-rights-record.schema.json")
  .sort();

const failures = [];
for (const file of files) {
  const fullPath = path.join(rightsDir, file);
  const record = JSON.parse(await readFile(fullPath, "utf8"));
  failures.push(...validateRecord(record, schema, `rights/${file}`));
}

if (failures.length) {
  console.error(`Creator Rights validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Creator Rights validation passed for ${files.length} record(s).`);
