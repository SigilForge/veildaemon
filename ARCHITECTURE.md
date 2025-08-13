# VeilDaemon Architecture

This repository separates runtime code (under `veildaemon/`) from meta/ops at the repo root.

Root is intentionally clean: docs, config, CI, hooks, tools, scripts, and tests. No real runtime code at root—only temporary shims that warn once and will be removed on schedule.

## Package map

- `veildaemon/` — installable package with stable APIs
  - `event_bus/` — async pub/sub EventBus
  - `stage_director/` — arbitration and barge-in logic
  - `tts/` — TTS manager, handles, WPS meter
  - `apps/`
    - `bus/` — public SDK re-exports for EventBus
    - `stage/` — public SDK re-exports for StageDirector
    - `api/` — Wick DB/Obsidian/tracker APIs
    - `watchers/` — Twitch watchers and helpers
    - `packs/` — pack loader + integration helpers
    - `hrm/` — HRM context facade (CoreContext)
  - `persona/` — memory stores and journal

## Root cleanliness charter

Root is for meta and ops. Target root tree:

```
/
├─ README.md
├─ ARCHITECTURE.md
├─ NAV.md
├─ CONTRIBUTING.md
├─ LICENSE
├─ .gitignore
├─ .gitattributes
├─ .editorconfig
├─ .vscode/
│  └─ settings.json
├─ .github/
│  └─ workflows/
│     ├─ ci_smoke.yml
│     └─ quality.yml
├─ .githooks/
│  └─ pre-commit
├─ tools/
│  └─ gen_nav.py
├─ scripts/
│  ├─ tree.ps1
│  └─ tree.sh
├─ tests/
│  ├─ chaos_harness.py
│  └─ test_smoke.py
├─ config/
│  └─ app.example.yaml
├─ .env.example
├─ streamdaemon/
│  └─ .gitmodules
├─ event_bus.py           # TEMP shim → veildaemon.event_bus
├─ stage_director.py      # TEMP shim → veildaemon.stage_director
├─ daemon_tts.py          # TEMP shim → veildaemon.tts.manager
├─ journal_manager.py     # TEMP shim → veildaemon.persona.journal_manager
├─ knowledge_store.py     # TEMP shim → veildaemon.persona.knowledge_store
├─ task_store.py          # TEMP shim → veildaemon.persona.task_store
└─ task_store_sqlite.py   # TEMP shim → veildaemon.persona.task_store_sqlite
```

## Deprecation schedule

Root shims warn once and will be removed after one release cycle. Track removal dates here.

Root shims removal date: 2025-09-30 (event_bus.py, stage_director.py, daemon_tts.py, journal_manager.py, knowledge_store.py, task_store.py, task_store_sqlite.py)

