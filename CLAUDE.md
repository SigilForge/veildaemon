# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` and `ARCHITECTURE.md` first.** They are the load-bearing rules for this repo (canon/tone rules for the public site, deploy topology, root-cleanliness charter, canonical import paths, validation gates) and this file does not repeat them — it orients you across the monorepo and fills in what those two files don't cover (commands, per-project layout, backend wiring). If anything here conflicts with `AGENTS.md`/`ARCHITECTURE.md`, those files win.

## What this repo actually contains

This one repo bundles several independently-deployed things — do not assume a single build/test/deploy story:

1. **`veildaemon.app` public site** (repo root: `index.html`, `script.js`, `styles.css`, `handler/`, `operator/`, `play/`, `studio/`, `stream/`, `admin/`, `registry/`, `rights/`, `debrief/`, `terms/`, `privacy/`, `support/`) — a diegetic ARG/TTRPG intake site. Hand-authored static HTML/CSS/JS, no bundler. `handler/` and `operator/` are `noindex` local-first tools (localStorage-backed); `play/` and `studio/` are the indexed public surfaces.
2. **`api/` + `lib/`** — Vercel serverless functions (plain Node, no build step) backing the site: routing (`api/route.js`), reports/alerts (`lib/reportsStore.js`, `lib/alertQueue.js` — Upstash Redis if configured, else in-memory fallback), a Unix-socket bridge to an external VeilForge process (`lib/forgeStreamBridge.js`, fail-open). Durable state (purchases, creator-rights records, table-live-link, Stripe webhook events) lives in **Supabase** (`supabase/migrations/`).
3. **`veildaemon/`** — an installable Python package (`veildaemon/pyproject.toml`, own venv), the actual livestream co-host AI SDK. Explicitly **excluded** from the GitHub Pages deploy (see `scripts/prepare-pages-site.sh`) — it's a standalone SDK with its own CI gates, not part of the live site's runtime.
4. **`veillink/`** — a separate Next.js 16 / React 19 / TypeScript app (own `package.json`, its own git history of decisions) for Supabase-auth account/dashboard/billing/rights features, deployed independently to Vercel.
5. **`studio/relay/`** — governed by its own `studio/relay/AGENTS.md`; has its own deploy path (`npm run relay:vercel:prepare`), not shipped by GitHub Pages or a plain `git push`.
6. **`StreamDaemon/`** — a stub; the real (paid) content lives outside this repo and is guarded against leaking in via CI (`.github/workflows/guard_streamdaemon.yml`). Never add real content here.

When you're asked to "fix the site" or "add a feature," first work out *which* of these five deploy surfaces the request actually touches — a fix in `veildaemon/` does not ship to `veildaemon.app`, and a fix at repo root does not ship to `app.veildaemon.app`.

## Commands

**Static site + api/ (root, Node ≥20):**
```bash
npm ci
npm run check              # node --check over every site/api/lib/script JS file (fast syntax gate)
npm run browser:check      # Playwright tests in tests/browser (in WSL/Codex: TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run browser:check)
npm run test:forge-bridge  # node --test tests/unit/test_forge_stream_bridge.js
npm run test:rights-verification-projection
npm run webp:check         # enforce the WebP-for-web-images rule; one known pre-existing failure in studio/press/index.html, not a blocker
node --check <file.js>     # run after any single-file JS edit, per AGENTS.md
```
Deploy: `npm run push` (alias `npm run ship`) → `scripts/unified-push.mjs` — the one canonical command that validates, pushes to GitHub, deploys VeilLink + Relay to Vercel, and syncs Supabase. Don't hand-roll a subset of this.

**`veildaemon/` Python package:**
```bash
python -m pip install -e ./veildaemon[dev]
./veildaemon/.venv/bin/python -m pytest      # AGENTS.md requires the repo venv, not bare pytest/python3
ruff check veildaemon && black --check veildaemon && isort --check-only veildaemon
python -m veildaemon        # or the console scripts: veildaemon-shell / veildaemon-chat
```
`pytest.ini` (root) sets `testpaths = tests, veildaemon/tests`; single test: `./veildaemon/.venv/bin/python -m pytest veildaemon/tests/path/test_x.py::test_name`. Staged `veildaemon/**` Python is auto-formatted (ruff+isort+black) on commit via `.githooks` (`git config core.hooksPath .githooks`).

**`veillink/` (Next.js):**
```bash
cd veillink && npm ci
npm run dev            # next dev
npm run build && npm run start
npm run lint           # eslint .
npm run typecheck      # tsc --noEmit
npm run test           # TMPDIR=/tmp TEMP=/tmp TMP=/tmp vitest run
```

## `veildaemon/` package architecture

`veildaemon/__init__.py` re-exports `apps, event_bus, hrm, persona, safety, scenes, stage_director, tts` as the public namespace. **Always import from `veildaemon.apps.*` (or the other top-level subpackages), never from repo-root shim modules** — `tests/test_no_legacy_imports.py` enforces that `event_bus.py`, `stage_director.py`, `daemon_tts.py` don't exist at repo root.

- `event_bus/` — async pub/sub `EventBus`: per-channel `publish`/`subscribe`/`latest`, one `asyncio.Queue` per subscriber, drops oldest on overflow.
- `stage_director/` — the barge-in / turn-taking arbiter. Consumes `"utterance"` plans off the bus, validates via `schema_guard.validate_utterance_plan`, dedupes by `(utterance_id, seq)`, drops expired plans, gates on risk hysteresis (`RISK_ON=0.45` / `RISK_OFF=0.35`, read from the `"beats"` channel) and a priority table (`PRIO`: raid=5 … banter=1, with a "boss phase" gate requiring priority ≥3), then emits on `"speak"`.
- `hrm/` — a facade re-exporting `HRMEngine`/`CoreContext`/`bootstrap_core` from legacy modules; treat "HRM" as an internal name, not a documented abbreviation.
- `persona/` — memory stores: `journal_manager.py`, `knowledge_store.py`, `task_store*.py`.
- `safety/` — content-safety pipeline for generated speech: `normalize`, `rewrite.rewrite_safe`, `quip_bank.QuipBank`, `span_map`.
- `tts/` — `manager.py`, `handles.py`, `wps_meter.py` (feeds StageDirector's timing).
- `apps/` — the real subsystems beyond the SDK re-export layer: `apps/api/` (Wick DB/Obsidian/tracker), `apps/watchers/` (Twitch chat/EventSub), `apps/packs/` (loader for the paid StreamDaemon pack, opt-in only), `apps/orchestrator/` (`brain.py`, `shell.py`, `chat_bound.py` — the actual daemon entry points behind the console scripts), `apps/memory/`, `apps/voice/`.

Per-persona tuning lives outside the package, at `personas/<name>/scene_limits.yaml` (`cap_ms`, `deflect_max_words`) — that's the producer-facing knob for `stage_director`'s pacing, not a code change.

## Conventions not already in AGENTS.md/ARCHITECTURE.md

- Root-cleanliness is enforced by `tests/test_root_clean.py` but only under `VD_ENFORCE_ROOT_CLEAN=1` (set in CI) — it will pass locally even if you drop a stray file at root, so don't rely on a local green run to catch that.
- `veillink/` has its own conventions (ESLint + TS strictness) independent of the root JS style; don't assume root's `node --check`-only gate applies there.
- Licensing is dual-layer per `LICENSE_SCOPE.md`: Apache-2.0 covers core software/scripts only. Everything else — `rights/` records, trademarks, narrative/creative assets (Book One, game text, art, audio) — is All Rights Reserved under the SigilForge Rights Framework and fail-closed by default. Don't regenerate or freely edit `rights/*.json` / `registry/records.json` by hand; they're maintained through the `rights:*` npm scripts.
