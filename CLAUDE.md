# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo also has `AGENTS.md` at the root (repository guidelines / fiction and product rules) and `studio/relay/AGENTS.md` (RelayDaemon governing contract). Read those directly — this file summarizes the parts most relevant to day-to-day changes and points to them rather than duplicating everything.

## What this repo is

VeilDaemon is the public Operator interface for the Cradlepoint TTRPG universe: a diegetic intake terminal, local-first Operator/Handler play tooling, anomaly/debrief reporting, and Creator Rights infrastructure. It is three cooperating surfaces in one repo:

1. **Static public site** (`veildaemon.app`, repo root) — `index.html`, `styles.css`, `script.js`, `operator/`, `handler/`, `debrief/`, `studio/`, `admin/`, `stream/`, `rights/`, `recovered-operator-reports/`. Plain HTML/CSS/JS, no build step. Hosted on GitHub Pages.
2. **`api/`** — Vercel serverless functions (repo root, `api.veildaemon.app`) for reports, alerts, routing, Twitch EventSub, character/scan-code proxying, Book One claims.
3. **`veillink/`** — a separate Next.js 16 + Supabase app (`app.veildaemon.app`) providing authenticated identity, multi-device Table Live-Link sessions, Dynamic Links/QR, and billing. Has its own `package.json`, deploys as an isolated Vercel project.

Plus a Python package, `veildaemon/` (note: same name as the repo root, different thing — installable SDK with `event_bus`, `stage_director`, `tts`, `apps/`, `persona/`). This is unrelated stream/persona infrastructure, not the web app. See `ARCHITECTURE.md` for its package map and root-cleanliness rules (no runtime Python belongs at repo root).

### Relationship to VeilForge

VeilForge is a separate, proprietary local AI runtime (automation/orchestration) that lives outside this repo (sibling checkout `../veilforge`). VeilDaemon is the hosted/public service side; product direction (`studio/FOUNDER_DECISIONS.md`) positions VeilDaemon as the source of APIs, licensing, and MCP-style services that a local runtime like VeilForge consumes. The only concrete integration today is one-directional: `lib/forgeStreamBridge.js` pushes alert/overlay events from VeilDaemon to VeilForge's `StreamBridgeHandler` over a length-prefixed-JSON AF_UNIX socket (env: `VEIL_STREAM_BRIDGE_SOCKET`, `VEIL_STREAM_BRIDGE_TOKEN`). It is fail-open (Forge being down never blocks the alert queue) and `pending_actions` it returns are proposals only, never auto-executed. See `Docs/dev-notes/forge-stream-bridge-4f2.md` for the full contract; `npm run test:forge-bridge` / `npm run smoke:forge-bridge` to exercise it.

`studio/relay/` (RelayDaemon) is an internal AI-assisted content review tool with its own governing contract — read `studio/relay/AGENTS.md` before touching it.

## Commands

### Static site / root JS-Node surface
```bash
npm run check          # node --check syntax validation across ~40 JS entry points — run after any JS edit
npm run browser:check  # Playwright browser tests (tests/browser/*.spec.js) — starts a local static server
npm run push           # aka `npm run ship` — full pipeline: pre-flight checks, git push origin main,
                        # VeilLink Vercel deploy, Supabase migration push, Relay/API Vercel sync
```
- In WSL/Codex, `browser:check` may need `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run browser:check`.
- A single file: `node --check path/to/file.js`.
- A single Playwright spec: `npx playwright test tests/browser/operator.spec.js`.
- `npm run webp:check` validates no PNG/JPEG is used for on-page display (WebP required for web display; PNG/JPEG only as source masters/downloads). One pre-existing failure in `studio/press/index.html` is known and not a blocker.

### Python package (`veildaemon/`)
```bash
./veildaemon/.venv/bin/python -m pytest -ra   # preferred — do not use plain `pytest` or `python3 -m pytest`
```
`pytest.ini` at root covers both `tests/` and `veildaemon/tests/`.

### VeilLink (`veillink/`, separate Node project — `cd veillink` first)
```bash
npm run dev         # next dev
npm run build        # next build
npm run lint         # eslint .
npm run typecheck    # tsc --noEmit
npm run test         # TMPDIR=/tmp TEMP=/tmp TMP=/tmp vitest run
```
A single Vitest file: `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest run path/to/file.test.ts`.

### Other useful scripts (root)
- `npm run qr -- --url ... --out ...` — generate a permanent QR asset (`public/assets/qr/*.svg`); always scan-test before publishing.
- `npm run webp` — convert an image to WebP.
- `npm run relay:local` — local Ollama bridge for RelayDaemon (`http://127.0.0.1:4174`).
- `npm run relay:acceptance` — RelayDaemon's mandatory acceptance gate (see below).

## Validation checklist (do these, matching AGENTS.md)
- `node --check <file>` after any JS edit.
- `git diff --check` before handing back changes (whitespace).
- Bump the cache-busting `?v=` query string in the relevant HTML when CSS/JS it references changes.
- External links: `target="_blank" rel="noopener noreferrer"`.
- For copy changes, grep for forbidden meta/breaking-the-fourth-wall terms before finishing: `in-world`, `ARG`, `fiction`, `lore`, `canon`, `continuity`, `game`, `leaked`, `hacker`.

## Deploy surfaces (do not conflate these)

| Surface | Host | Source | How it ships |
|---|---|---|---|
| Public static site | GitHub Pages, `veildaemon.app` | repo root static files | `git push origin main` (legacy branch build, 10–15 min; **not** GitHub Actions Pages — see `README_DEPLOY.md`) |
| Root API | Vercel project, `api.veildaemon.app` | `api/*`, root `vercel.json` | via `npm run push` / manual Vercel deploy |
| VeilLink | Vercel project, `app.veildaemon.app` | `veillink/` (isolated) | via `npm run push` |
| RelayDaemon | Vercel project `veildaemon-relay`, `relay.veildaemon.app` | `studio/relay/*` | **not** included in a plain git push or `npm run push` — needs explicit `npm run relay:vercel:prepare && cd _relay-vercel && vercel deploy --prod` after `npm run relay:acceptance` passes |

Client-side JS on the GitHub Pages static host must call `https://api.veildaemon.app` for `/api/*` (not relative paths) unless `window.location.hostname` is `localhost`/`127.0.0.1`/a non-production preview. Supabase migrations live only in root `supabase/migrations/`; `veillink/supabase/migrations/` is a stale, unmaintained duplicate — never add new migrations there.

## RelayDaemon (`studio/relay/`)

Governed separately by `studio/relay/AGENTS.md` — read it, `references/relay-architecture.md`, and `tests/fixtures/relay/ca-001.json` before editing. Key points:
- Architecture: private Vercel UI → local loopback bridge (`127.0.0.1:4174`) → Ollama by default, with an authenticated hosted API (OpenAI) as availability fallback. Generation never authorizes publication.
- Before claiming anything "fixed"/"working"/"shipped", `npm run relay:acceptance` must pass with a fresh artifact at `artifacts/relay-acceptance/latest.json`.
- `_relay-vercel/` is a generated snapshot, never edit it directly.

## UI / design constraints

Before touching Operator, Handler, or tracker UI, read `Docs/DESIGN_CONSTRAINTS.md` in full — it governs the shared visual token system (dark monospace, cyan/purple/danger palette), the canonical `line-tracker` pattern for Harm/Stability/Presentation pressure, and strict rules against adding new full-width cards for what should be a tracker row. Highlights:
- Tracker board columns are always `1fr` (single column) — never introduce a 2–3 column auto-fit for tracker rows.
- Table-facing prose (cues, risks, conditions) goes in a collapsed `<details>` drawer, not always-visible paragraphs.
- New pressure mechanics slot into layer 2–3 of the Operator hierarchy (Harm & Stability / Presentation), not a new card above the roll dock.
- Reference implementation: `operator/operator.js` → `renderTrackerBoard()`; styles in `operator/operator.css`.

Handler runtime templates (`handler/cases/`, `handler/templates.json`, etc.) are scaffolds, not one-off pages — a new runtime feature on one template should generally exist across the other shipped scaffolds (`Custom Campaign`, `VeilCorp Intake`, `Viridian House`) unless explicitly case-specific. Don't copy case *text* between templates; share runtime shape/behavior and author case-specific content separately.

## Fiction/voice rules (public copy)

The public site is in-universe and must never break frame. VeilDaemon (Shade's interface) genuinely believes it's running necessary infrastructure, not leaking anything. Avoid meta words (`in-world`, `ARG`, `lore`, `canon`, `fiction`, `game`, `website`, `landing page`, `questionnaire`) in any copy shown to visitors — see AGENTS.md's "Canon Framing" and "Public Copy Rules" sections for full tone guidance and preserved phrases (e.g. "We noticed you noticing.", "Infrastructure before permission.").

## Paid digital delivery / Creator Rights

Paid file bytes never live in a browser-addressable path (no GitHub Pages, no `public/`, no `studio/downloads/`). They live in a private Supabase Storage bucket, gated by: Stripe Checkout → server-side claim endpoint verifying `payment_status === "paid"` and price/product → durable Supabase entitlement → short-lived signed URL. Creator Rights publication authority (records, licensing, verification) stays inside this repo's surfaces only — other services (Forge, Relay, StreamDaemon) may emit integration events but never get publish/license/waive authority.

## Auth & local-first invariants

- Supabase Auth on the browser must use `persistSession: true` and `autoRefreshToken: true`.
- Signing in/out must never mutate or wipe local saves (Operator/Handler `localStorage` state). Operator and Handler must work fully unauthenticated; VeilLink adds optional multi-device sync on top via deliberate sync actions (Send to Cell / End Pressure Round / Sync Cell / Archive Session — see `veillink/README.md`), not polling.

## Images

Anything painted in a browser (`<img>`, CSS `background-image`, OG previews where supported) must be WebP. PNG/JPEG are source masters or press-kit download originals only. Convert with `npm run webp` / `node scripts/ensure-webp.mjs`; check with `npm run webp:check`.
