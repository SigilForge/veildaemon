import crypto from "node:crypto";
import { promises as dns } from "node:dns";
import net from "node:net";
import { z } from "zod";
export {
  ARTIFACT_CLAIM,
  DECLARED_CLAIM,
  VERIFICATION_BOUNDED_CLAIM,
  verificationClaimFor,
  verificationLevelLabel,
} from "@/lib/rights/verification-display";
import type { CreatorRightsRecord, VerificationLevel, VerificationMethod } from "@/lib/rights/schema";

export const challengeMethods = ["domain", "github"] as const;
export const challengeStatuses = ["pending", "passed", "failed", "expired", "revoked"] as const;
export const isbnEvidenceMethod = "isbn" as const;
export const verificationProofPath = ".sigilforge/rights-verification.txt";
export const domainProofPath = "/.well-known/sigilforge-rights-verification.txt";
export const verificationPublicOrigin = (process.env.RIGHTS_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_RIGHTS_PUBLIC_ORIGIN || "https://veildaemon.app").replace(/\/$/, "");

export type ChallengeMethod = (typeof challengeMethods)[number];
export type ChallengeStatus = (typeof challengeStatuses)[number];
export type EvidenceMethod = ChallengeMethod | "isbn" | VerificationMethod;
export type EvidenceStatus = ChallengeStatus | "attached";
export type EvidenceClaim = "surface_control" | "linked_publication_evidence" | "artifact_fingerprint";

export type VerificationEvidence = {
  id?: string;
  method: EvidenceMethod;
  status: EvidenceStatus;
  claim: EvidenceClaim;
  target?: string | null;
  verifiedAt?: string | null;
  revokedAt?: string | null;
  proof?: Record<string, unknown>;
};

export type VerificationProjection = {
  level: VerificationLevel;
  methods: VerificationMethod[];
  evidence: VerificationEvidence[];
};

export type VerificationChallenge = {
  id: string;
  record_id: string;
  user_id: string;
  method: ChallengeMethod;
  target: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  attempt_count: number;
  max_attempts: number;
  status: ChallengeStatus;
  result: Record<string, unknown> | null;
  verified_at: string | null;
  evidence_snapshot: Record<string, unknown> | null;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type ResolveLike = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export type VerificationDeps = {
  fetch?: FetchLike;
  resolve?: ResolveLike;
  now?: () => Date;
};

export const createChallengeSchema = z.object({
  method: z.enum(challengeMethods),
  target: z.string().trim().min(1).max(2048),
});

export const isbnEvidenceSchema = z.object({
  isbn: z.string().trim().min(9).max(32),
});

export function generateChallengeToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function tokenHash(token: string) {
  return sha256Hex(`creator-rights-verification:${token}`);
}

export function proofContents(record: CreatorRightsRecord, token: string) {
  return [
    `record_id=${record.record_id || record.id}`,
    `challenge=${token}`,
    `canonical_url=${verificationRecordUrl(record.slug)}`,
  ].join("\n");
}

export function verificationRecordUrl(slug: string) {
  return `${verificationPublicOrigin}/rights/${slug}`;
}

export function normalizeGithubRepoUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw Object.assign(new Error("Enter a valid GitHub repository URL."), { status: 400, code: "invalid_github_url" });
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw Object.assign(new Error("Only https://github.com repository URLs are supported."), { status: 400, code: "invalid_github_url" });
  }
  const [owner, repoRaw] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repoRaw) {
    throw Object.assign(new Error("GitHub repository URL must include owner and repository."), { status: 400, code: "invalid_github_url" });
  }
  const repo = repoRaw.replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw Object.assign(new Error("GitHub repository owner or name has unsupported characters."), { status: 400, code: "invalid_github_url" });
  }
  return {
    owner,
    repo,
    normalizedUrl: `https://github.com/${owner}/${repo}`,
  };
}

export function normalizeDomainTarget(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw Object.assign(new Error("Enter a valid domain URL."), { status: 400, code: "invalid_domain_url" });
  }
  if (url.protocol !== "https:") {
    throw Object.assign(new Error("Domain verification requires an HTTPS URL."), { status: 400, code: "invalid_domain_url" });
  }
  if (isBlockedHostname(url.hostname) || isBlockedIp(url.hostname)) {
    throw Object.assign(new Error("That verification target is not allowed."), { status: 400, code: "unsafe_url" });
  }
  return `https://${url.hostname}`;
}

function isbnDigits(value: string) {
  return value.toUpperCase().replace(/[^0-9X]/g, "");
}

function isbn13CheckDigit(first12: string) {
  const sum = first12.split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

export function normalizeIsbn(value: string) {
  const cleaned = isbnDigits(value);
  if (/^\d{9}[\dX]$/.test(cleaned)) {
    const sum = cleaned.split("").reduce((total, digit, index) => {
      const n = digit === "X" ? 10 : Number(digit);
      return total + n * (10 - index);
    }, 0);
    if (sum % 11 !== 0) {
      throw Object.assign(new Error("ISBN-10 check digit is invalid."), { status: 400, code: "invalid_isbn" });
    }
    const first12 = `978${cleaned.slice(0, 9)}`;
    return { isbn10: cleaned, isbn13: `${first12}${isbn13CheckDigit(first12)}` };
  }
  if (/^\d{13}$/.test(cleaned)) {
    if (isbn13CheckDigit(cleaned.slice(0, 12)) !== cleaned[12]) {
      throw Object.assign(new Error("ISBN-13 check digit is invalid."), { status: 400, code: "invalid_isbn" });
    }
    return { isbn10: null, isbn13: cleaned };
  }
  throw Object.assign(new Error("Enter a valid ISBN-10 or ISBN-13."), { status: 400, code: "invalid_isbn" });
}

export function parseProofBody(body: string) {
  const values: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return values;
}

function isBlockedHostname(hostname: string) {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  return (
    lower === "localhost" ||
    lower === "0.0.0.0" ||
    lower === "metadata.google.internal" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  );
}

export function isBlockedIp(address: string) {
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
  if (address.toLowerCase().startsWith("fe80:")) return true;
  if (address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd")) return true;
  if (address.toLowerCase().startsWith("::ffff:")) return isBlockedIp(address.slice(7));
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  return false;
}

export async function assertSafeHttpsUrl(input: string, deps: VerificationDeps = {}) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw Object.assign(new Error("Enter a valid HTTPS URL."), { status: 400, code: "invalid_url" });
  }
  if (url.protocol !== "https:") {
    throw Object.assign(new Error("Verification URLs must use HTTPS."), { status: 400, code: "unsafe_url" });
  }
  if (isBlockedHostname(url.hostname) || isBlockedIp(url.hostname)) {
    throw Object.assign(new Error("That verification target is not allowed."), { status: 400, code: "unsafe_url" });
  }
  const resolve = deps.resolve || ((hostname: string) => dns.lookup(hostname, { all: true }));
  const addresses = await resolve(url.hostname);
  if (!addresses.length || addresses.some((entry) => isBlockedIp(entry.address))) {
    throw Object.assign(new Error("That verification target resolves to a disallowed address."), { status: 400, code: "unsafe_url" });
  }
  return url;
}

async function fetchLimitedText(url: string, deps: VerificationDeps = {}, redirects = 0) {
  await assertSafeHttpsUrl(url, deps);
  const fetchImpl = deps.fetch || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { accept: "text/plain" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects >= 2) throw Object.assign(new Error("Verification redirects exceeded the limit."), { status: 400, code: "redirect_limit" });
      const location = response.headers.get("location");
      if (!location) throw Object.assign(new Error("Verification redirect had no destination."), { status: 400, code: "bad_redirect" });
      const next = new URL(location, url).toString();
      await assertSafeHttpsUrl(next, deps);
      return fetchLimitedText(next, deps, redirects + 1);
    }
    const text = await response.text();
    if (text.length > 8192) {
      throw Object.assign(new Error("Verification proof file is too large."), { status: 400, code: "proof_too_large" });
    }
    return { response, text, url };
  } finally {
    clearTimeout(timeout);
  }
}

function assertProofMatches(body: string, record: CreatorRightsRecord, challenge: VerificationChallenge) {
  const parsed = parseProofBody(body);
  const expectedRecordId = record.record_id || record.id;
  const expectedCanonical = verificationRecordUrl(record.slug);
  if (parsed.record_id !== expectedRecordId) {
    throw Object.assign(new Error("Proof file record_id does not match this record."), { status: 400, code: "proof_record_mismatch" });
  }
  if (tokenHash(parsed.challenge || "") !== challenge.token_hash) {
    throw Object.assign(new Error("Proof file challenge token does not match."), { status: 400, code: "proof_token_mismatch" });
  }
  if (parsed.canonical_url !== expectedCanonical) {
    throw Object.assign(new Error("Proof file canonical_url does not match this record."), { status: 400, code: "proof_url_mismatch" });
  }
}

export async function verifyDomainChallenge(record: CreatorRightsRecord, challenge: VerificationChallenge, deps: VerificationDeps = {}) {
  const base = await assertSafeHttpsUrl(challenge.target, deps);
  const proofUrl = `https://${base.hostname}${domainProofPath}`;
  const { response, text, url } = await fetchLimitedText(proofUrl, deps);
  if (!response.ok) {
    throw Object.assign(new Error("Domain proof file was not reachable."), { status: 400, code: "proof_unreachable" });
  }
  assertProofMatches(text, record, challenge);
  const verifiedAt = (deps.now || (() => new Date()))().toISOString();
  return {
    method: "domain" as const,
    status: "passed" as const,
    claim: "surface_control" as const,
    target: `https://${base.hostname}`,
    verifiedAt,
    proof: {
      checkedUrl: url,
      responseStatus: response.status,
      bodySha256: sha256Hex(text),
    },
  };
}

export async function verifyGithubChallenge(record: CreatorRightsRecord, challenge: VerificationChallenge, deps: VerificationDeps = {}) {
  const repo = normalizeGithubRepoUrl(challenge.target);
  const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${verificationProofPath}`;
  const { response, text } = await fetchLimitedText(apiUrl, deps);
  if (!response.ok) {
    throw Object.assign(new Error("GitHub proof file was not reachable."), { status: 400, code: "github_proof_missing" });
  }
  const payload = JSON.parse(text) as { content?: string; encoding?: string; sha?: string; html_url?: string; download_url?: string; name?: string };
  if (payload.name !== "rights-verification.txt" || !payload.content || payload.encoding !== "base64") {
    throw Object.assign(new Error("GitHub proof file payload was not valid."), { status: 400, code: "github_proof_invalid" });
  }
  const body = Buffer.from(payload.content.replace(/\s/g, ""), "base64").toString("utf8");
  if (body.length > 8192) {
    throw Object.assign(new Error("GitHub proof file is too large."), { status: 400, code: "proof_too_large" });
  }
  assertProofMatches(body, record, challenge);
  const verifiedAt = (deps.now || (() => new Date()))().toISOString();
  return {
    method: "github" as const,
    status: "passed" as const,
    claim: "surface_control" as const,
    target: repo.normalizedUrl,
    verifiedAt,
    proof: {
      path: verificationProofPath,
      blobSha: payload.sha || null,
      bodySha256: sha256Hex(body),
      url: payload.html_url || repo.normalizedUrl,
    },
  };
}

export function effectiveVerification(record: CreatorRightsRecord, evidence: VerificationEvidence[] = []): VerificationProjection {
  const activeEvidence = evidence.filter((item) => item.status !== "revoked");
  const methods: VerificationMethod[] = [];
  if (activeEvidence.some((item) => item.status === "passed" && (item.method === "domain" || item.method === "github"))) {
    if (activeEvidence.some((item) => item.method === "domain" && item.status === "passed")) methods.push("domain");
    if (activeEvidence.some((item) => item.method === "github" && item.status === "passed")) methods.push("github");
  }
  if (record.sha256_hash) methods.push("sha256");

  const level: VerificationLevel = record.sha256_hash
    ? "artifact_verified"
    : methods.includes("domain") || methods.includes("github")
      ? "surface_verified"
      : "declared";

  return {
    level,
    methods: Array.from(new Set(methods)),
    evidence: evidence.map(publicEvidence),
  };
}

export function publicEvidence(evidence: VerificationEvidence): VerificationEvidence {
  return {
    id: evidence.id,
    method: evidence.method,
    status: evidence.status,
    claim: evidence.claim,
    target: evidence.target || null,
    verifiedAt: evidence.verifiedAt || null,
    revokedAt: evidence.revokedAt || null,
    proof: evidence.proof || undefined,
  };
}
