import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rightsDir = path.join(root, "rights");
const cradlepointRoot = "/home/nox/projects/cradlepoint-ttrpg";
const generatedAt = "2026-07-29T00:00:00.000Z";

const artifactBySlug = {
  "the-anchor-and-the-glitch": "Fiction/Book 1 - Complete Editing/THE_CRADLEPOINT_ARCHIVE_BOOK_ONE_v47_2C_RELEASE.epub",
  "sanguine-sacrament": "Fiction/Book 2 - In Development/THE_CRADLEPOINT_ARCHIVE_BOOK_TWO_SANGUINE_SACRAMENT_WORKING_9_EDITED.md",
  "cradlepoint-operator-core": "Published/Paid/Operator Core/CRADLEPOINT_OPERATOR_CORE_RELEASE_PACK.zip",
  "cradlepoint-handler-core": "Published/Paid/Handler Core/CRADLEPOINT_HANDLER_CORE_RELEASE_PACK.zip",
  "cradlepoint-field-dossier": "Published/Paid/Core Books/CRADLEPOINT FIELD DOSSIER.md",
  "cradlepoint-handler-expansion-myth-tech-and-the-epic-lotus": "Published/Paid/Core Books/CRADLEPOINT HANDLER EXPANSION — MYTH-TECH & THE EPIC LOTUS.md",
  "cradlepoint-handler-guide": "Published/Paid/Core Books/CRADLEPOINT HANDLER GUIDE.md",
  "cradlepoint-monster-manual": "Published/Paid/Core Books/CRADLEPOINT MONSTER MANUAL.md",
  "cradlepoint-operator-guide": "Published/Paid/Core Books/CRADLEPOINT OPERATOR GUIDE.md",
  "cradlepoint-systems-metaphysics": "Published/Paid/Core Books/CRADLEPOINT SYSTEMS METAPHYSICS.md",
};

function mimeTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".epub") return "application/epub+zip";
  if (ext === ".mobi") return "application/x-mobipocket-ebook";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".zip") return "application/zip";
  if (ext === ".md") return "text/markdown";
  return "application/octet-stream";
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function writeJsonAtomic(file, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, body);
  await fs.rename(tmp, file);
}

function withArtifactVerification(record, fingerprint) {
  const existingEvidence = Array.isArray(record.verification?.evidence) ? record.verification.evidence : [];
  const nonHashEvidence = existingEvidence.filter((item) => item.method !== "sha256");
  return {
    ...record,
    verification: {
      level: "artifact_verified",
      claim: "artifact_fingerprint",
      statement: "The recorded artifact matched the listed fingerprint.",
      methods: Array.from(new Set([...(record.verification?.methods || []), "sha256"])),
      evidence: [
        ...nonHashEvidence,
        {
          id: `${path.basename(fingerprint.sourcePath).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-sha256`,
          method: "sha256",
          status: "passed",
          claim: "artifact_fingerprint",
          target: fingerprint.filename,
          verifiedAt: generatedAt,
          revokedAt: null,
          proof: {
            algorithm: "SHA-256",
            value: fingerprint.value,
            fileSize: fingerprint.fileSize,
            sourcePath: fingerprint.sourcePath,
          },
        },
      ],
    },
    technicalArtifacts: {
      ...record.technicalArtifacts,
      sha256Available: true,
    },
    fileFingerprint: {
      algorithm: "SHA-256",
      value: fingerprint.value,
      filename: fingerprint.filename,
      fileSize: fingerprint.fileSize,
      mimeType: fingerprint.mimeType,
      createdAt: generatedAt,
    },
  };
}

const updates = [];
for (const [slug, relativePath] of Object.entries(artifactBySlug)) {
  const artifactPath = path.join(cradlepointRoot, relativePath);
  const recordPath = path.join(rightsDir, `${slug}.json`);
  const [buffer, stat, recordBody] = await Promise.all([
    fs.readFile(artifactPath),
    fs.stat(artifactPath),
    fs.readFile(recordPath, "utf8"),
  ]);
  const fingerprint = {
    value: sha256(buffer),
    filename: path.basename(artifactPath),
    fileSize: stat.size,
    mimeType: mimeTypeFor(artifactPath),
    sourcePath: relativePath,
  };
  const record = JSON.parse(recordBody);
  await writeJsonAtomic(recordPath, withArtifactVerification(record, fingerprint));
  updates.push({ slug, ...fingerprint });
}

for (const update of updates) {
  console.log(`${update.slug}: ${update.value}  ${update.sourcePath}`);
}
