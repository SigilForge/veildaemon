# Creator Rights Record Specification

**Version:** 1.1
**Status:** Implemented Draft
**Maintainer:** SigilForge Studios
**Canonical Schema:**
https://veildaemon.app/rights/creator-rights-record.schema.json

## 1. Abstract

A Creator Rights Record is a machine-readable public declaration describing the rights, licensing terms, AI-use permissions, verification state, provenance evidence, and technical fingerprints associated with a creative or technical work.

The format is intended to complement copyright registration, content provenance systems, software licensing standards, and publication platforms. It does not replace those systems and does not independently adjudicate authorship or legal ownership.

A record can document:

- the work and publishing entity;
- the selected copyright or content license;
- supplemental rights declarations;
- permissions for AI training, fine-tuning, retrieval, generation, and dataset redistribution;
- commercial licensing availability;
- publication-surface verification;
- artifact hashes and cryptographic signatures;
- supporting identifiers and evidence;
- canonical public URLs and version history.

## 2. Design Goals

The Creator Rights Record format is designed to provide:

1. A canonical machine-readable rights declaration.
2. Clear separation between copyright licenses and supplemental AI-use terms.
3. Structured permissions suitable for automated policy evaluation.
4. Explicit verification claims with constrained meanings.
5. Artifact-level association using cryptographic fingerprints.
6. Human-readable public records backed by equivalent JSON.
7. Compatibility with existing standards rather than replacement of them.
8. Durable versioned records that preserve who declared what and when.

## 3. Non-Goals

A Creator Rights Record does not:

- constitute government copyright registration;
- prove authorship by itself;
- prove legal ownership by itself;
- resolve disputed claims;
- determine whether a use is legally fair use;
- modify the terms of an underlying SPDX or Creative Commons license;
- certify the accuracy of evidence submitted by a claimant;
- replace C2PA manifests, software attestations, DOI records, ISBN records, or platform-specific ownership systems.

## 4. Record Identity

Every published record should include:

- `recordType`
- `schemaVersion`
- `recordId`
- `status`
- `title`
- `rightsHolder`
- `publicRecordUrl`
- `recordedAt`
- `disclaimer`

The canonical record type is:

```json
{
  "recordType": "CreatorRightsRecord",
  "schemaVersion": "1.1"
}
```
