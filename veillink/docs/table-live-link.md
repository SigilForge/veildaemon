# Table live-link (vertical slice)

Smallest demo of living Operator state between Operator phone and Handler console.

## Model

```
ACCOUNT
  owns operator_profiles

operator_profiles.persistent_state
  ↓ snapshot on join
session_operator_state.live_state
  ↕ realtime + API patch
handler_sessions (join code)

on close → reconcile allowed fields back into persistent_state
```

## Capacity (V1)

- **No product hard cap** on Operators per session.
- Handler may set optional **lobby seat cap** (`max_operators`) when creating a session.
- Empty / null = uncapped. Absolute safety bound only: 32 (abuse ceiling, not design intent).
- Join returns HTTP 409 only when the Handler-set lobby is full.

## Sync surface (V1)

- Harm, Stability, Lotus, Frequency pips
- Breach, Void (separate currencies per Operator Guide: Void = capacity/gates, Breach = growth/pips; no auto-conversion)
- Unlocks: frequencies, myth-tech, traits, flags
- Needlepoint / mission / Handler note

## Routes

| Path | Role |
|------|------|
| `/table` | Hub: create Operator file, open Handler session, join by code |
| `/table/join?code=XXXXXX` | Prefill join |
| `/table/session/[id]` | Live dual view |

## API

- `GET/POST /api/table/operators`
- `POST /api/table/sessions`
- `POST /api/table/sessions/join`
- `GET/DELETE /api/table/sessions/[id]`
- `PATCH /api/table/sessions/[id]/state`
- `POST /api/table/sessions/[id]/leave`

## Permissions

- Operator owns the file and must explicitly join.
- Handler may alter session-authorized gameplay fields while session is open.
- Every mutation is logged in `session_mutations` (who, field, old, new).
- Operator can leave / revoke; Handler close reconciles and ends session.

## Deploy

1. Apply migration `004_table_live_link.sql` (also root `supabase/migrations/20260723120000_table_live_link.sql`).
2. Ensure Supabase Realtime includes `session_operator_state` (migration attempts to add it).
3. Deploy VeilLink Vercel project.

## Not in V1

NFC, offline mesh, inventory trees, campaign archives, multi-tier RBAC, product ownership.
