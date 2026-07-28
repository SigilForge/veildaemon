import type { VerificationLevel } from "@/lib/rights/schema";

export const VERIFICATION_BOUNDED_CLAIM =
  "This authenticated account demonstrated control of the referenced publication surface.";

export const DECLARED_CLAIM = "This record was published by an authenticated account.";
export const ARTIFACT_CLAIM = "The recorded artifact matched the listed fingerprint.";

export function verificationLevelLabel(level: VerificationLevel) {
  return {
    declared: "Declared",
    surface_verified: "Surface verified",
    artifact_verified: "Artifact verified",
    signed: "Signed",
  }[level];
}

export function verificationClaimFor(level: VerificationLevel) {
  if (level === "surface_verified") return VERIFICATION_BOUNDED_CLAIM;
  if (level === "artifact_verified") return ARTIFACT_CLAIM;
  if (level === "signed") return "The record or artifact was cryptographically signed.";
  return DECLARED_CLAIM;
}
