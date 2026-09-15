const assert = require("node:assert/strict");
const test = require("node:test");

const registry = require("../../api/creator-rights/registry.js");

test("Creator Rights registry API projects public-safe live records", () => {
  const record = registry._private.publicRecordForRow({
    slug: "neon-zine",
    record_id: "SFR-2026-999999",
    title: "Neon Zine",
    work_type: "art",
    category: "marketing",
    description: "A public creative release.",
    public_display_name: "A. Creator",
    creator_name: "Private Creator Name",
    rights_holder_name: "Creator Studio",
    rights_statement: "All rights reserved.",
    ai_permissions: {
      rag: "allowed",
      embeddings: "allowed",
      fine_tuning: "prohibited",
    },
    human_commercial_license_available: "license_required",
    record_status: "published",
    published_at: "2026-09-15T12:00:00.000Z",
    created_at: "2026-09-15T11:00:00.000Z",
    sha256_hash: "a".repeat(64),
    availability: "public",
    licensing_contact: "creator@example.com",
    copyright_license_id: "proprietary",
    copyright_license_name: "Proprietary / all rights reserved",
    copyright_license_spdx_id: null,
    copyright_license_url: null,
    registry_framework_id: "sfr",
    registry_framework_version: "1.0",
    contact_email: "private@example.com",
  });

  assert.equal(record.slug, "neon-zine");
  assert.equal(record.title, "Neon Zine");
  assert.equal(record.work.type, "art");
  assert.equal(record.licensing.availability, "paid_license");
  assert.equal(record.permissions.rag, "allowed");
  assert.equal(record.verification.level, "artifact_verified");
  assert.match(record.publicRecordUrl, /^https:\/\/app\.veildaemon\.app\/rights\/neon-zine$/);
  assert.equal(JSON.stringify(record).includes("private@example.com"), false);
  assert.equal(JSON.stringify(record).includes("creator@example.com"), false);
});
