# Creator Rights Verification Roadmap

Scope: `/creator-rights/` and VeilLink Creator Rights implementation.

## Product Surface Roadmap

Current public surface:

- Studio overview page at `/studio/creator-rights/`.
- Rights library section at `/studio/creator-rights/#rights-library`.
- Static record pages under `/rights/<record-slug>/`.
- Machine-readable records under `/rights/<record-slug>.json`.
- License inquiry placeholders under `/rights/<record-slug>/license`.

Near-term product-navigation work:

- Keep the Data Room executive overview, Publishing, Shelf, Technology, Press, copyright/legal pages, and individual record pages linked into the rights library.
- Keep the public library searchable by title, category, work type, availability, license, and AI-use terms.
- Add category selection to creator-owned draft creation in VeilLink before expanding public filters beyond search.
- Preserve the distinction between publication status and availability as a first-class UI concept.
- Promote a dedicated library route only when the card list outgrows the Studio overview page.

Do not make the rights library depend on private drafts, payment metadata, owner email, or dashboard-only fields.

## Claim Boundary

Creator Rights Records should distinguish themselves through verification, but the system must not promise to prove authorship, legal ownership, or the truth of a disputed rights claim.

The durable product claim is:

> This record documents a creator declaration, the authenticated account that made it, immutable versions, timestamps, artifact fingerprints, licensing preferences, and attached evidence.

The future verification claim should be:

> This account controls the referenced publisher profile, repository, domain, package, or publication surface.

Avoid wording such as:

> Confirm they are the actual publisher.

That implies ownership adjudication. The objective, automatable claim is control of a publishing surface.

## Level 0: Declared Record

Current baseline:

- User creates a record.
- Identity is the authenticated account.
- The record clearly states that it is a creator declaration.
- Immutable versions and timestamps provide the audit trail.
- The record does not replace government copyright registration or independently prove legal ownership.

## Level 1: Publisher Surface Control

Verify control over the thing being claimed, not authorship itself.

Potential control checks:

- GitHub: temporary verification token in a repository, README, release, or profile.
- Personal website: challenge token at a known URL.
- Domain: DNS TXT record.
- Steam: publisher mechanism if Steam exposes a suitable route.
- itch.io: verification file, page token, or profile link if feasible.
- NPM or PyPI: signed package, package metadata, or release metadata containing a challenge.

Each check should produce a deterministic pass/fail result and preserve the method used.

## Level 2: Cryptographic Artifact Verification

Artifact verification should allow independent file matching without human review.

Planned or future components:

- SHA-256 fingerprints.
- Signed manifests.
- Public/private key signing.
- Multiple fingerprints for different release artifacts.

Expected user-facing result:

> This exact ZIP was the file associated with Record SFR-2026-000001.

That verifies artifact association with the record, not authorship by itself.

## Level 3: Linked Evidence

Records should preserve evidence as an evidence hub without adjudicating it.

Supported evidence candidates:

- GitHub release.
- ISBN.
- DOI.
- Steam App ID.
- itch.io page.
- Copyright registration number.
- Publisher page.
- Archive.org snapshot.

The system can preserve and display this evidence while leaving disputes, abuse review, and legal interpretation outside the automated product claim.

## Level 4: Relationship Badges

Future badges should verify the relationship between the account and an organization or publishing surface:

- Verified Publisher.
- Verified Organization.
- Verified Studio.
- Verified Maintainer.

These badges should not declare legal ownership of every work published by that account or organization.

## Automation Preference

Prefer automated verification of objective facts. Human review should be reserved for appeals, abuse cases, edge cases, and trust/safety escalation.

Human ownership adjudication is expensive, inconsistent, and a long-term bottleneck. The stronger product position is to preserve who claimed what, when, under which authenticated identity, with which artifact fingerprints and linked evidence.
