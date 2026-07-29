# VeilDaemon Licensing Model & Architecture

This document describes the dual-layer licensing architecture implemented in VeilDaemon, harmonized with the **SigilForge Rights Framework (SFR)** and mirrored from the VeilForge reference implementation.

## Overview

VeilDaemon uses a dual-layer licensing architecture that decouples open core software logic from proprietary rights infrastructure, brand marks, and creative assets.

- **Core Source Code**: Apache License, Version 2.0
- **Rights Infrastructure & Creative Assets**: SigilForge Rights Framework (SFR)

## Dual-Layer Architecture

```
VeilDaemon Repository
├── Core Source Code (Apache 2.0)
│   ├── Operator intake UI & client scripts
│   ├── Core interface controllers & utilities
│   └── Local-first state management
└── SigilForge Rights Framework (SFR - Governed Assets & Infrastructure)
    ├── Creator Rights Registry & published CRRs
    ├── Verification data & cryptographic SHA-256 proofs
    ├── Trademarks, logos, and brand identity
    ├── Hosted APIs, Vercel serverless routes, & Relay integrations
    └── CradlePoint fiction, manuscripts, artwork, & media downloads
```

## Layer 1: VeilDaemon Core (Apache 2.0)

The core software implementation of VeilDaemon is licensed under the **Apache License, Version 2.0**. This permits inspection, modification, and reuse of core software logic under standard Apache 2.0 terms.

> **License Replacement Note**: Apache License 2.0 governs VeilDaemon Core software. Where Mozilla Public License (MPL) or legacy proprietary placeholder wording was previously referenced in historical notes, Apache License 2.0 governs core source files.

## Layer 2: SigilForge Rights Framework (SFR)

The **SigilForge Rights Framework (SFR)** governs all non-core assets, rights infrastructure, and brand identity within this repository:

1. **Creator Rights Records (CRRs)**: Individual machine-readable posture declarations defining copyright notices, AI-use terms, and licensing positions.
2. **Creator Rights Registry**: The published collection, indexing, and lookup services for CRRs.
3. **Verification Data**: Cryptographic SHA-256 hashes, proof chains, and audit manifests.
4. **Trademarks & Logos**: Reserved studio names (*SigilForge Studios*, *CradlePoint*, *VeilDaemon*, *VeilCorp*, *RelayDaemon*, *VeilLink*), logos, and visual trade dress.
5. **Hosted Services & APIs**: Production serverless endpoints (`/api/*`), Vercel deployment infrastructure, and backend integrations.
6. **Creative Assets**: Manuscripts, fiction, game publications, artwork, UI plates, and audio downloads.

## Governing Principles

1. **Fail-Closed Boundary**: Unless a file, Creator Rights Record (CRR), or explicit written agreement states otherwise, non-core assets default to All Rights Reserved under the SigilForge Rights Framework (SFR).
2. **No Trademark Grant**: Licensing core code under Apache 2.0 does not grant rights to use SigilForge Studios trademarks, logos, or brand marks.
3. **Canonical Terminology**: All licensing documents, schemas, and public surfaces strictly adhere to canonical SFR terminology (SFR, CRR, Creator Rights Registry).

For component boundaries and complete matrix, see [LICENSE_SCOPE.md](../LICENSE_SCOPE.md).
