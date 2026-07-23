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
  ↓ deliberate push only

handler_sessions (join code + optional lobby seat cap)
```

## Deliberate sync moments

| Button | When | What |
|--------|------|------|
| **Send to Cell** (Operator) | Before Handler syncs | Uploads that Operator’s local draft to the session row |
| **End Pressure Round** (Handler) | End of tactical Pressure Round | Pushes Handler drafts, reloads authoritative snapshot; reactions refresh next round |
| **Sync Cell** (Handler) | Investigation / social | Same push+pull without tactical framing |
| **Archive Session** (Handler) | Mission end | Push drafts, reconcile into Operator files, close session |

Edits during a round stay **local** until those buttons fire. That is intentional.

## Sync surface (V1)

Page layer enforces rules (Operator/Handler runtime). Sync only moves values:

- Harm stages 0–5, Stability 0–10
- Lotus pips 0–6 × six Frequencies; **Blind Petal** locked at 0 (five cultivable)
- Void bank (starts 1) and Breach bank — separate currencies
- Handler note, Needlepoint / mission labels
- Optional free-text flags

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
- `PATCH /api/table/sessions/[id]/state` — upload draft (Send to Cell / Handler push)
- `POST /api/table/sessions/[id]/leave`

## Deploy

1. Apply migration `004_table_live_link.sql` (or root `20260723120000_table_live_link.sql`).
2. Redeploy VeilLink Vercel project.

## Not in V1

Realtime, background poll, NFC, offline mesh, full Operator console merge.
