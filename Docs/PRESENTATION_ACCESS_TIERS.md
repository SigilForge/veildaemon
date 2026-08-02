# Presentation Access Tiers — Operator / Handler Context

This document is the **source of truth** for how presentations are gated in VeilDaemon UI.
Later decisions do not override this unless explicitly revised.

## Three tiers

| Tier | Rule | Operator UI label |
|------|------|-------------------|
| **Open** | Safe for most tables. Available in character gen without a Handler packet. | `Open Core` |
| **Handler Approval** | Core-legal mechanics exist, but the table should consent before play. Requires `ONTOLOGY_UNLOCK:<KEY>` (or Handler grant). | `Handler Approval Recommended` or `Handler Approval Required` |
| **Expansion Locked** | Not in the free/core rules package. Index card only until an archive key clears the file. | `Archive Locked: <Archive Name>` |

```text
Open = safe for most tables.
Handler Approval = core-legal but needs campaign consent.
Expansion Locked = not in the free/core rules package.
```

## Open Core Picks

| Presentation | Catalog key |
|--------------|-------------|
| Resonant Sensitive | `RESONANT_SENSITIVE` |
| Echo-Altered | `ECHO_ALTERED` |
| Hollow / Silence-Altered | `HOLLOW_SILENCE_ALTERED` |
| Technomancer / Daemon-Aligned | `TECHNOMANCER_DAEMON_ALIGNED` |
| Therian Adaptation | `THERIAN_ADAPTATION` |

## Handler Approval Core Picks

| Presentation | Catalog key | Approval level |
|--------------|-------------|----------------|
| Sanguine | `SANGUINE` | Recommended |
| Wraith-Touched / Anchor-Bound | `WRAITH_TOUCHED_ANCHOR_BOUND` | Required |
| Void-Shard | `VOID_SHARD` | Required |
| Construct | `CONSTRUCT` | Required |
| Vessel | `VESSEL` | Required |

Legacy combined unlock `CONSTRUCT_VESSEL` still resolves for older packets.

## Expansion Locked (vault stubs only)

Expansion presentations live in `catalogs.js` with `access: "archive"`.
They appear in the **Presentation Vault** index without rules text.
Clear with `ARCHIVE_UNLOCK:<ARCHIVE_ID>`.

| Archive ID | Label |
|------------|-------|
| `PREDATORY_ARCHIVE` | Predatory Archive |
| `DEATH_ARCHIVE` | Death Archive |
| `COVENANT_ARCHIVE` | Covenant Archive |
| `RADIANCE_ARCHIVE` | Radiance Archive |
| `MACHINE_ARCHIVE` | Machine Archive |
| `DEEP_VOID_ARCHIVE` | Deep Void Archive |

## What is NOT vaulted

Open and Handler Approval core picks are **not** expansion vault entries.
They do not appear in the sealed archive grid.

## Operator UI rules

| Surface | What appears |
|---------|----------------|
| **Sheet → Presentation dropdown** | Open core picks only, plus anything the Handler already unlocked via `ONTOLOGY_UNLOCK` or `ARCHIVE_UNLOCK` |
| **Authorized Unlocks** | Imported unlock list + expansion vault index (locked cards, no rules) |
| **Handler → Operators** | Full catalog for granting packets; Handler Approval labels visible to Handler only |

Do **not** list Handler Approval or Expansion Locked presentations on the Sheet until unlocked.

## Implementation map

| File | Responsibility |
|------|----------------|
| `Veildaemon/catalogs.js` | Tier definitions, vault stubs, access labels |
| `Veildaemon/operator/operator.js` | Sheet dropdown gating; vault index only on Authorized Unlocks |
| `Veildaemon/handler/handler-modules.js` | Handler grant UI with approval labels |
| `Veildaemon/presentation-pressure.js` | Load mechanics, tracks, and band thresholds |
| `Veildaemon/presentation-abilities.js` | Passive permissions, active abilities, headline roll surge triggers |
| `Veildaemon/presentation-drift.js` | Surface tells, persistent scars, deep drift, archive evolution markers |

> For the generated codebase implementation reference matching executable presentation modules, see [CRADLEPOINT_PRESENTATIONS_SPEC.md](file:///home/nox/projects/veildaemon/Docs/CRADLEPOINT_PRESENTATIONS_SPEC.md). Canon and release authority remain in the Cradlepoint Core System books.

## Decision log

- **Decision A (archive vault):** Expansion-only locked index cards + `ARCHIVE_UNLOCK` keys.
- **Decision F (this doc):** Core split into Open vs Handler Approval; do not treat all nine load playables as open.
- **Decision G (executable alignment):** Presentation abilities, active surge triggers, passive permissions, and drift scars in code modules (`presentation-abilities.js`, `presentation-drift.js`, `presentation-pressure.js`) provide the executable implementation matching the canonical rules in Cradlepoint Core System books.