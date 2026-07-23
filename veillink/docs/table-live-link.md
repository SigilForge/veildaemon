# Table live-link (vertical slice)

Shared Operator sheets for a Handler lobby. **No polling. No WebSockets.** Deliberate sync only.

## Terminology

- **Pressure Round** — full tactical danger cycle (not “Pressure Cycle”).
- **Turn** — one actor’s activation *inside* a Pressure Round.
- Sync at mechanical boundaries, not continuously.

## Model

```
ACCOUNT
  owns operator_profiles

operator_profiles.persistent_state
  ↓ snapshot on join
session_operator_state.live_state
  ↑ local drafts on each phone
  ↓ deliberate push only (whitelisted fields)

handler_sessions (join code + optional lobby seat cap)
```

## Deliberate sync moments

| Button | When | Payload whitelist | Side effect |
|--------|------|-------------------|-------------|
| **Send to Cell** (Operator) | Before Handler syncs | `harm`, `stability`, `conditions` (recovery notes) | Upload only |
| **End Pressure Round** (Handler) | End of tactical Pressure Round | `harm`, `stability`, `conditions` | Advances local Pressure Round counter |
| **Sync Cell** (Handler) | Investigation / social | above **+** `handlerNote` | Does **not** advance Pressure Round |
| **Archive Session** (Handler) | Mission end | `harm`, `stability`, `breach`, `voidMarks`, `unlocks`, `handlerNote`, `conditions` | Reconcile once, close session |

Edits during a round stay **local** until those buttons fire. That is intentional.

## Structural payload boundary

LiveState still *stores* Lotus (snapshot on join / display). Sync **writes** do not:

```
PRESSURE ROUND / OPERATOR SEND
├─ Harm
├─ Stability
└─ conditions (recovery notes / declared recovery)

SYNC CELL
├─ Harm
├─ Stability
├─ conditions
└─ handlerNote

ARCHIVE SESSION
├─ Harm / Stability (final snapshot)
├─ Breach
├─ Void
└─ earned unlocks

BETWEEN SESSIONS (not live PATCH)
├─ Lotus purchases
└─ advancement choices
```

Enforced in:

1. `filterPatchForSyncKind()` — client and server
2. `mergeLiveState()` — **ignores** `lotus` / `blindPetal` / `frequencyPips` on every live merge
3. `mergePersistentState()` — Lotus only on between-sessions profile tooling
4. UI — Lotus read-only; Breach/Void Handler-editable for Archive only

Sending a full draft blob still cannot cultivate petals or smuggle mid-round banks through a Pressure Round sync.

## Authority

- **Operator-submitted Harm and Stability remain authoritative during reconciliation when present.**
- Recovery resolves on the Operator sheet. Handler never re-runs heal rules.
- Archive is **idempotent** (closed session → reconcile 0).

## Capacity

- No product hard cap.
- Handler may set optional **lobby seat cap** on create (`max_operators`).
- Absolute abuse ceiling: 32.

## Routes

| Path | Role |
|------|------|
| `/table` | Hub |
| `/table/join?code=XXXXXX` | Operator join |
| `/table/session/[id]` | Lobby + sheets |

## API

- `GET/POST /api/table/operators`
- `POST /api/table/sessions`
- `POST /api/table/sessions/join`
- `GET/DELETE /api/table/sessions/[id]` — GET lobby; DELETE = Archive Session
- `PATCH /api/table/sessions/[id]/state` — body: `{ sessionOperatorStateId, patch, syncKind }`
- `POST /api/table/sessions/[id]/leave`

`syncKind`: `pressure_round` | `cell` | `operator_send` | `archive`

## Handler Live (same-origin)

`/handler/live/` mirrors deliberate buttons via `cell-sync.js` (localStorage + BroadcastChannel). Multi-device lobbies use this VeilLink session API.

## Deploy

1. Apply migration `004_table_live_link.sql` (or root `20260723120000_table_live_link.sql`).
2. Redeploy VeilLink Vercel project.

## Not in V1

Realtime, background poll, NFC, offline mesh, full Operator console merge, in-session Lotus purchases.
