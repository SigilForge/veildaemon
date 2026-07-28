import { describe, expect, it } from "vitest";
import type { CreatorRightsRecord } from "@/lib/rights/schema";
import {
  assertSafeHttpsUrl,
  effectiveVerification,
  generateChallengeToken,
  isBlockedIp,
  normalizeGithubRepoUrl,
  normalizeIsbn,
  proofContents,
  sha256Hex,
  tokenHash,
  verifyDomainChallenge,
  verifyGithubChallenge,
  type VerificationChallenge,
  type VerificationEvidence,
} from "@/lib/rights/verification";

function record(overrides: Partial<CreatorRightsRecord> = {}): CreatorRightsRecord {
  return {
    id: "record-uuid",
    user_id: "user-1",
    record_id: "SFR-2026-000001",
    slug: "test-record",
    title: "Test Record",
    work_type: "book",
    category: "fiction",
    availability: "public",
    description: "A verification test.",
    creator_name: "Creator",
    public_display_name: "Creator",
    rights_holder_name: "Rights Holder",
    contact_email: "creator@example.com",
    creation_date: "2026-07-28",
    publication_date: "2026-07-28",
    edition: "First",
    external_identifier: null,
    source_url: null,
    licensing_contact: null,
    copyright_notice: null,
    rights_statement: "All rights reserved.",
    ai_permissions: {
      generalTraining: "license_required",
      foundationModelPretraining: "license_required",
      fineTuning: "prohibited",
      embeddings: "license_required",
      rag: "license_required",
      generation: "license_required",
      datasetRedistribution: "prohibited",
      researchUse: "research_only",
      commercialUse: "license_required",
      attributionRequired: "license_required",
      licenseRequired: "license_required",
    },
    ai_permissions_summary: "AI use requires written permission.",
    human_commercial_license_available: "case_by_case",
    record_status: "published",
    published_at: "2026-07-28T00:00:00.000Z",
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: "2026-07-28T00:00:00.000Z",
    ...overrides,
  };
}

function challenge(method: "domain" | "github", token: string, target: string): VerificationChallenge {
  return {
    id: "challenge-1",
    record_id: "record-uuid",
    user_id: "user-1",
    method,
    target,
    token_hash: tokenHash(token),
    created_at: "2026-07-28T00:00:00.000Z",
    expires_at: "2026-07-29T00:00:00.000Z",
    attempt_count: 0,
    max_attempts: 5,
    status: "pending",
    result: null,
    verified_at: null,
    evidence_snapshot: null,
  };
}

const resolvePublic = async () => [{ address: "203.0.113.10", family: 4 }];

describe("Creator Rights verification", () => {
  it("creates random challenge tokens and stores only a hashable verifier", () => {
    const a = generateChallengeToken();
    const b = generateChallengeToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
    expect(tokenHash(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash(a)).not.toContain(a);
  });

  it("builds exact proof contents for a record-bound challenge", () => {
    expect(proofContents(record(), "token-1")).toContain("record_id=SFR-2026-000001");
    expect(proofContents(record(), "token-1")).toContain("challenge=token-1");
    expect(proofContents(record(), "token-1")).toContain("canonical_url=https://veildaemon.app/rights/test-record");
  });

  it("rejects non-HTTPS verification targets", async () => {
    await expect(assertSafeHttpsUrl("http://example.com", { resolve: resolvePublic })).rejects.toThrow(/HTTPS/);
  });

  it("rejects localhost and loopback names", async () => {
    await expect(assertSafeHttpsUrl("https://localhost", { resolve: resolvePublic })).rejects.toThrow(/not allowed/);
  });

  it("rejects IPv4 and IPv6 loopback targets", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
  });

  it("rejects private IPv4 targets", () => {
    expect(isBlockedIp("10.0.0.5")).toBe(true);
    expect(isBlockedIp("172.16.0.5")).toBe(true);
    expect(isBlockedIp("192.168.1.5")).toBe(true);
  });

  it("rejects private IPv6, link-local, and cloud metadata targets", async () => {
    expect(isBlockedIp("fd00::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
    await expect(assertSafeHttpsUrl("https://169.254.169.254", { resolve: resolvePublic })).rejects.toThrow(/not allowed/);
  });

  it("rejects DNS resolution to a disallowed address", async () => {
    await expect(assertSafeHttpsUrl("https://example.com", { resolve: async () => [{ address: "127.0.0.1", family: 4 }] })).rejects.toThrow(/disallowed/);
  });

  it("rejects redirects to a disallowed address", async () => {
    const fetchImpl = async () => new Response("", { status: 302, headers: { location: "https://127.0.0.1/proof.txt" } });
    await expect(verifyDomainChallenge(record(), challenge("domain", "token-1", "https://example.com"), { fetch: fetchImpl, resolve: resolvePublic })).rejects.toThrow(/not allowed/);
  });

  it("rejects oversized proof responses", async () => {
    const fetchImpl = async () => new Response("x".repeat(8193), { status: 200 });
    await expect(verifyDomainChallenge(record(), challenge("domain", "token-1", "https://example.com"), { fetch: fetchImpl, resolve: resolvePublic })).rejects.toThrow(/too large/);
  });

  it("accepts successful domain proof", async () => {
    const token = "token-1";
    const body = proofContents(record(), token);
    const fetchImpl = async () => new Response(body, { status: 200 });
    const evidence = await verifyDomainChallenge(record(), challenge("domain", token, "https://example.com"), {
      fetch: fetchImpl,
      resolve: resolvePublic,
      now: () => new Date("2026-07-28T12:00:00.000Z"),
    });
    expect(evidence).toMatchObject({
      method: "domain",
      status: "passed",
      claim: "surface_control",
      target: "https://example.com",
      verifiedAt: "2026-07-28T12:00:00.000Z",
    });
    expect(evidence.proof.bodySha256).toBe(sha256Hex(body));
  });

  it("fails domain proof with a wrong token", async () => {
    const body = proofContents(record(), "wrong-token");
    const fetchImpl = async () => new Response(body, { status: 200 });
    await expect(verifyDomainChallenge(record(), challenge("domain", "token-1", "https://example.com"), { fetch: fetchImpl, resolve: resolvePublic })).rejects.toThrow(/token/);
  });

  it("normalizes GitHub repository URLs", () => {
    expect(normalizeGithubRepoUrl("https://github.com/SigilForge/veildaemon.git")).toEqual({
      owner: "SigilForge",
      repo: "veildaemon",
      normalizedUrl: "https://github.com/SigilForge/veildaemon",
    });
  });

  it("accepts successful GitHub proof", async () => {
    const token = "token-1";
    const body = proofContents(record(), token);
    const fetchImpl = async () => new Response(JSON.stringify({
      name: "rights-verification.txt",
      encoding: "base64",
      content: Buffer.from(body, "utf8").toString("base64"),
      sha: "blob123",
      html_url: "https://github.com/SigilForge/veildaemon/blob/main/.sigilforge/rights-verification.txt",
    }), { status: 200 });
    const evidence = await verifyGithubChallenge(record(), challenge("github", token, "https://github.com/SigilForge/veildaemon"), {
      fetch: fetchImpl,
      resolve: resolvePublic,
    });
    expect(evidence).toMatchObject({
      method: "github",
      status: "passed",
      target: "https://github.com/SigilForge/veildaemon",
    });
    expect(evidence.proof.blobSha).toBe("blob123");
  });

  it("fails missing GitHub proof files", async () => {
    const fetchImpl = async () => new Response("{}", { status: 404 });
    await expect(verifyGithubChallenge(record(), challenge("github", "token-1", "https://github.com/SigilForge/veildaemon"), { fetch: fetchImpl, resolve: resolvePublic })).rejects.toThrow(/not reachable/);
  });

  it("fails mismatched GitHub proof files", async () => {
    const body = proofContents(record(), "wrong-token");
    const fetchImpl = async () => new Response(JSON.stringify({
      name: "rights-verification.txt",
      encoding: "base64",
      content: Buffer.from(body, "utf8").toString("base64"),
    }), { status: 200 });
    await expect(verifyGithubChallenge(record(), challenge("github", "token-1", "https://github.com/SigilForge/veildaemon"), { fetch: fetchImpl, resolve: resolvePublic })).rejects.toThrow(/token/);
  });

  it("passed evidence updates effective verification level", () => {
    const evidence: VerificationEvidence[] = [{ method: "github", status: "passed", claim: "surface_control", target: "https://github.com/a/b" }];
    expect(effectiveVerification(record(), evidence).level).toBe("surface_verified");
    expect(effectiveVerification(record(), evidence).methods).toContain("github");
  });

  it("revoked evidence removes its contribution", () => {
    const evidence: VerificationEvidence[] = [{ method: "github", status: "revoked", claim: "surface_control", target: "https://github.com/a/b" }];
    expect(effectiveVerification(record(), evidence).level).toBe("declared");
    expect(effectiveVerification(record(), evidence).methods).not.toContain("github");
  });

  it("public evidence projection never exposes challenge tokens", () => {
    const projection = effectiveVerification(record(), [{
      method: "domain",
      status: "passed",
      claim: "surface_control",
      target: "https://example.com",
      proof: { bodySha256: "a".repeat(64) },
    }]);
    expect(JSON.stringify(projection)).not.toContain("token-1");
    expect(JSON.stringify(projection)).not.toContain("challenge=");
  });

  it("validates ISBN-10 and converts to ISBN-13", () => {
    expect(normalizeIsbn("0-306-40615-2")).toEqual({ isbn10: "0306406152", isbn13: "9780306406157" });
  });

  it("validates ISBN-13", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toEqual({ isbn10: null, isbn13: "9780306406157" });
  });

  it("rejects invalid ISBN check digits", () => {
    expect(() => normalizeIsbn("9780306406158")).toThrow(/check digit/);
  });

  it("does not treat ISBN alone as surface verification", () => {
    const evidence: VerificationEvidence[] = [{ method: "isbn", status: "attached", claim: "linked_publication_evidence", target: "9780306406157" }];
    expect(effectiveVerification(record(), evidence).level).toBe("declared");
    expect(effectiveVerification(record(), evidence).methods).toEqual([]);
  });
});
