const test = require("node:test");
const assert = require("node:assert/strict");

async function loadProjectionModule() {
  return import("../../scripts/creator-rights-verification-projection.mjs");
}

const baseRecord = {
  slug: "example-record",
  recordId: "SFR-2026-000001",
  verification: {
    level: "declared",
    methods: [],
    evidence: [],
  },
};

test("passed domain or GitHub evidence contributes surface verification", async () => {
  const { buildProjection } = await loadProjectionModule();
  const projection = await buildProjection([baseRecord], {
    "example-record": [{
      id: "ev-1",
      method: "github",
      status: "passed",
      claim: "surface_control",
      target: "https://github.com/SigilForge/veildaemon",
      verified_at: "2026-07-28T20:00:00.000Z",
      proof: { path: ".sigilforge/rights-verification.txt", blobSha: "abc123" },
    }],
  }, "fixture");

  assert.equal(projection.records["example-record"].verification.level, "surface_verified");
  assert.equal(projection.records["example-record"].verification.claim, "surface_control");
  assert.match(projection.records["example-record"].verification.statement, /demonstrated control/);
  assert.deepEqual(projection.records["example-record"].verification.methods, ["github"]);
  assert.equal(projection.records["example-record"].verification.evidence[0].proof.blobSha, "abc123");
});

test("revoked evidence remains public but stops contributing to level", async () => {
  const { buildProjection } = await loadProjectionModule();
  const projection = await buildProjection([baseRecord], {
    "example-record": [{
      id: "ev-1",
      method: "domain",
      status: "revoked",
      claim: "surface_control",
      target: "https://example.com",
      verified_at: "2026-07-28T20:00:00.000Z",
      revoked_at: "2026-07-28T21:00:00.000Z",
      proof: { bodySha256: "a".repeat(64) },
    }],
  }, "fixture");

  assert.equal(projection.records["example-record"].verification.level, "declared");
  assert.deepEqual(projection.records["example-record"].verification.methods, []);
  assert.equal(projection.records["example-record"].verification.evidence[0].status, "revoked");
});

test("ISBN evidence does not create surface verification", async () => {
  const { buildProjection } = await loadProjectionModule();
  const projection = await buildProjection([baseRecord], {
    "example-record": [{
      id: "ev-isbn",
      method: "isbn",
      status: "attached",
      claim: "linked_publication_evidence",
      target: "9780306406157",
      proof: { isbn13: "9780306406157" },
    }],
  }, "fixture");

  assert.equal(projection.records["example-record"].verification.level, "declared");
  assert.deepEqual(projection.records["example-record"].verification.methods, []);
  assert.equal(projection.records["example-record"].verification.evidence[0].method, "isbn");
});

test("active evidence contributes when another record for the same surface is revoked", async () => {
  const { buildProjection } = await loadProjectionModule();
  const projection = await buildProjection([baseRecord], {
    "example-record": [{
      id: "ev-revoked",
      method: "github",
      status: "revoked",
      claim: "surface_control",
      target: "https://github.com/SigilForge/old",
      revoked_at: "2026-07-28T21:00:00.000Z",
    }, {
      id: "ev-active",
      method: "github",
      status: "passed",
      claim: "surface_control",
      target: "https://github.com/SigilForge/veildaemon",
      verified_at: "2026-07-28T22:00:00.000Z",
    }],
  }, "fixture");

  assert.equal(projection.records["example-record"].verification.level, "surface_verified");
  assert.deepEqual(projection.records["example-record"].verification.methods, ["github"]);
  assert.equal(projection.records["example-record"].verification.evidence.length, 2);
});

test("projection output is deterministic for identical source data", async () => {
  const { buildProjection, finalizeProjection } = await loadProjectionModule();
  const evidence = {
    "example-record": [{
      id: "b",
      method: "github",
      status: "passed",
      claim: "surface_control",
      target: "https://github.com/SigilForge/veildaemon",
      verified_at: "2026-07-28T22:00:00.000Z",
    }, {
      id: "a",
      method: "isbn",
      status: "attached",
      claim: "linked_publication_evidence",
      target: "9780306406157",
    }],
  };
  const options = {
    source: "fixture",
    projectionMode: "local_bootstrap",
    generatedAt: "2026-07-28T22:30:00.000Z",
  };
  const one = await finalizeProjection(await buildProjection([baseRecord], evidence, options));
  const two = await finalizeProjection(await buildProjection([baseRecord], evidence, options));

  assert.equal(JSON.stringify(one), JSON.stringify(two));
  assert.match(one.payloadSha256, /^[a-f0-9]{64}$/);
});

test("public projection rejects challenge token material", async () => {
  const { assertProjectionIsPublicSafe } = await loadProjectionModule();
  assert.throws(() => assertProjectionIsPublicSafe({
    schemaVersion: "1.0",
    records: {
      "example-record": {
        verification: {
          level: "surface_verified",
          methods: ["domain"],
          evidence: [{ proof: { raw: "challenge=secret-token" } }],
        },
      },
    },
  }), /private verifier material/);
});
