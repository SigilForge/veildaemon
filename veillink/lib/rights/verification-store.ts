import { getSupabaseAdminClient } from "@/lib/supabase";
import { publicError } from "@/lib/store";
import { getOwnedRightsRecord } from "@/lib/rights/records";
import type { CreatorRightsRecord } from "@/lib/rights/schema";
import {
  createChallengeSchema,
  effectiveVerification,
  generateChallengeToken,
  isbnEvidenceSchema,
  normalizeDomainTarget,
  normalizeGithubRepoUrl,
  normalizeIsbn,
  proofContents,
  tokenHash,
  verifyDomainChallenge,
  verifyGithubChallenge,
  type VerificationChallenge,
  type VerificationEvidence,
} from "@/lib/rights/verification";

const CHALLENGE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function admin() {
  return getSupabaseAdminClient() as any;
}

function toEvidence(row: any): VerificationEvidence {
  return {
    id: row.id,
    method: row.method,
    status: row.status,
    claim: row.claim,
    target: row.target,
    verifiedAt: row.verified_at,
    revokedAt: row.revoked_at,
    proof: row.proof || undefined,
  };
}

async function logVerificationEvent(
  userId: string | null,
  action: string,
  recordId: string,
  metadata: Record<string, unknown>,
  challengeId?: string | null,
  evidenceId?: string | null
) {
  await admin().from("creator_rights_verification_events").insert({
    record_id: recordId,
    user_id: userId,
    challenge_id: challengeId || null,
    evidence_id: evidenceId || null,
    event_type: action,
    metadata,
  });
}

export async function listVerificationState(record: CreatorRightsRecord, ownerView = false) {
  const [{ data: evidenceRows, error: evidenceError }, { data: challengeRows, error: challengeError }] = await Promise.all([
    admin()
      .from("creator_rights_verification_evidence")
      .select("*")
      .eq("record_id", record.id)
      .order("created_at", { ascending: false }),
    ownerView
      ? admin()
          .from("creator_rights_verification_challenges")
          .select("id,record_id,user_id,method,target,created_at,expires_at,attempt_count,max_attempts,status,result,verified_at,evidence_snapshot")
          .eq("record_id", record.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (evidenceError) throw evidenceError;
  if (challengeError) throw challengeError;
  const evidence = (evidenceRows || []).map(toEvidence);
  return {
    projection: effectiveVerification(record, evidence),
    evidence,
    challenges: challengeRows || [],
  };
}

export async function publicVerificationForRecord(record: CreatorRightsRecord) {
  return (await listVerificationState(record, false)).projection;
}

export async function createVerificationChallenge(userId: string, recordId: string, input: unknown) {
  const record = await getOwnedRightsRecord(userId, recordId);
  const parsed = createChallengeSchema.parse(input);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const token = generateChallengeToken();
  const target = parsed.method === "github"
    ? normalizeGithubRepoUrl(parsed.target).normalizedUrl
    : normalizeDomainTarget(parsed.target);

  const { data, error } = await admin()
    .from("creator_rights_verification_challenges")
    .insert({
      record_id: record.id,
      user_id: userId,
      method: parsed.method,
      target,
      token_hash: tokenHash(token),
      expires_at: expiresAt.toISOString(),
      max_attempts: MAX_ATTEMPTS,
      status: "pending",
      result: { target },
    })
    .select("id,record_id,user_id,method,target,created_at,expires_at,attempt_count,max_attempts,status,result,verified_at,evidence_snapshot")
    .single();
  if (error || !data) throw publicError("Verification challenge could not be created.", 500);
  await logVerificationEvent(userId, "verification.challenge.created", record.id, { method: parsed.method, target }, data.id);

  return {
    challenge: data,
    token,
    proof: {
      location: parsed.method === "domain"
        ? `${target}/.well-known/sigilforge-rights-verification.txt`
        : `${target}/blob/HEAD/.sigilforge/rights-verification.txt`,
      path: parsed.method === "domain" ? "/.well-known/sigilforge-rights-verification.txt" : ".sigilforge/rights-verification.txt",
      contents: proofContents(record, token),
    },
  };
}

async function getOwnedChallenge(userId: string, recordId: string, challengeId: string) {
  await getOwnedRightsRecord(userId, recordId);
  const { data, error } = await admin()
    .from("creator_rights_verification_challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("record_id", recordId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw publicError("Verification challenge not found.", 404);
  return data as VerificationChallenge;
}

export async function verifyOwnedChallenge(userId: string, recordId: string, challengeId: string) {
  const record = await getOwnedRightsRecord(userId, recordId);
  const challenge = await getOwnedChallenge(userId, record.id, challengeId);
  const now = new Date();

  if (challenge.status !== "pending") throw publicError("This challenge is no longer pending.", 409);
  if (new Date(challenge.expires_at).getTime() <= now.getTime()) {
    await admin().from("creator_rights_verification_challenges").update({ status: "expired", result: { code: "expired" } }).eq("id", challenge.id);
    await logVerificationEvent(userId, "verification.challenge.expired", record.id, { method: challenge.method, target: challenge.target }, challenge.id);
    throw publicError("This challenge has expired.", 410);
  }
  if (challenge.attempt_count >= challenge.max_attempts) {
    throw publicError("This challenge has reached its verification attempt limit.", 429);
  }

  const attemptCount = challenge.attempt_count + 1;
  await admin().from("creator_rights_verification_challenges").update({ attempt_count: attemptCount }).eq("id", challenge.id);

  try {
    const evidence = challenge.method === "domain"
      ? await verifyDomainChallenge(record, challenge)
      : await verifyGithubChallenge(record, challenge);
    const { data: evidenceRow, error: evidenceError } = await admin()
      .from("creator_rights_verification_evidence")
      .insert({
        record_id: record.id,
        user_id: userId,
        challenge_id: challenge.id,
        method: evidence.method,
        status: evidence.status,
        claim: evidence.claim,
        target: evidence.target,
        verified_at: evidence.verifiedAt,
        proof: evidence.proof,
      })
      .select("*")
      .single();
    if (evidenceError || !evidenceRow) throw evidenceError || new Error("Evidence row missing.");
    await admin()
      .from("creator_rights_verification_challenges")
      .update({ status: "passed", result: { code: "passed" }, verified_at: evidence.verifiedAt, evidence_snapshot: evidence })
      .eq("id", challenge.id);
    await logVerificationEvent(userId, "verification.challenge.passed", record.id, { method: challenge.method, target: challenge.target }, challenge.id, evidenceRow.id);
    return { evidence: toEvidence(evidenceRow), projection: effectiveVerification(record, [toEvidence(evidenceRow)]) };
  } catch (error) {
    const status = attemptCount >= challenge.max_attempts ? "failed" : "pending";
    const code = typeof error === "object" && error && "code" in error ? String((error as { code: string }).code) : "verification_failed";
    await admin()
      .from("creator_rights_verification_challenges")
      .update({ status, result: { code, message: error instanceof Error ? error.message : "Verification failed." } })
      .eq("id", challenge.id);
    await logVerificationEvent(userId, "verification.challenge.failed", record.id, { method: challenge.method, target: challenge.target, code }, challenge.id);
    throw error;
  }
}

export async function attachIsbnEvidence(userId: string, recordId: string, input: unknown) {
  const record = await getOwnedRightsRecord(userId, recordId);
  const { isbn } = isbnEvidenceSchema.parse(input);
  const normalized = normalizeIsbn(isbn);
  const { data, error } = await admin()
    .from("creator_rights_verification_evidence")
    .insert({
      record_id: record.id,
      user_id: userId,
      method: "isbn",
      status: "attached",
      claim: "linked_publication_evidence",
      target: normalized.isbn13,
      verified_at: null,
      proof: normalized,
    })
    .select("*")
    .single();
  if (error || !data) throw publicError("ISBN evidence could not be attached.", 500);
  await logVerificationEvent(userId, "verification.evidence.isbn_attached", record.id, { isbn13: normalized.isbn13 }, null, data.id);
  return { evidence: toEvidence(data), projection: effectiveVerification(record, [toEvidence(data)]) };
}

export async function revokeVerificationEvidence(userId: string, recordId: string, evidenceId: string) {
  const record = await getOwnedRightsRecord(userId, recordId);
  const revokedAt = new Date().toISOString();
  const { data, error } = await admin()
    .from("creator_rights_verification_evidence")
    .update({ status: "revoked", revoked_at: revokedAt })
    .eq("id", evidenceId)
    .eq("record_id", record.id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error || !data) throw publicError("Verification evidence not found.", 404);
  await logVerificationEvent(userId, "verification.evidence.revoked", record.id, { method: data.method, target: data.target }, null, evidenceId);
  return { evidence: toEvidence(data), projection: effectiveVerification(record, [toEvidence(data)]) };
}
