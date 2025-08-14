# VeilDaemon

VeilDaemon is a daemon core for cognition and presence—mythpunk on the surface, strict ops underneath. It runs locally, watches you and your world, and helps you steer without burning out.

> See the guardrails in [ARCHITECTURE.md ▸ Operational Guards](ARCHITECTURE.md#operational-guards-a-quick-map-for-humans)

## Core features

- Meltdown detection and dampers (WARDEN/SCP‑27 gating)
- Spoon counter and talk-budget pacing (WPS EMA + hysteresis)
- Glyph language for compact routines and rituals
- Local-first with encrypted journaling and shadow logs
- Consent-first interfaces and safety filters

## Variants & extensions

- StreamDaemon — co‑host layer for livestreams; reactive media and watcher orchestration on top of the daemon core.
- VeilDaemon Desktop — full‑fat PC build.
- VeilDaemon Mobile (planned) — Android/iOS with sensor‑aware features.

## Core philosophy

- Always consent‑first.
- Local‑first, encrypted logs.
- Every feature is a ritual, not just a toggle.

## Quickstart

```bash
python -m pip install -e ./veildaemon
veildaemon-shell   # CLI entrypoint
veildaemon-chat    # Chat-bound entrypoint
```

> Planning a release? See the checklist: [docs/release-v0.0.4.md](docs/release-v0.0.4.md)

## For developers

Repo structure and key modules:

- Runtime brain: `veildaemon/apps/stage/` (StageDirector, stream engine)
- Safety: `veildaemon/apps/safety/` (normalize, rewrite, quip bank)
- TTS: `veildaemon/tts/` (manager, WPS EMA)
- Orchestrator: `veildaemon/apps/orchestrator/` (shell, chat)
- Watchers/API/Memory: `veildaemon/apps/{watchers,api,memory}/`
- HRM: `veildaemon/hrm/` (engine, core context)

Shims at repo root were removed; use canonical imports only. Root cleanliness is enforced by tests.

### Scene caps & talk budgets

Tune without touching code via `personas/<name>/scene_limits.yaml`.

Example:

```yaml
Gaming:
  cap_ms: { default: 1200, high_risk: 500, dead_air: 2000 }
  deflect_max_words: 5
```

### Obsidian exports

SQLite + journal are the source of truth. Obsidian `.md` files are generated on demand. Set `VEIL_VAULT_PATH` to select the vault.

### Dev sanity

```bash
python veildaemon/tests/test_imports.py
pytest -q tests/test_root_clean.py
python tools/gen_nav.py && git status    # NAV.md stays in sync
```

## Docs

- Extended docs and specs: `docs/`
- StreamDaemon specifics: see the StreamDaemon pack README (private), or the integration test `tests/integration/test_streamdaemon_plugin.py` for the plugin contract.

