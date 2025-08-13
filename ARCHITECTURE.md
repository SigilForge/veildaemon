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


# Operational Guards (a quick map for humans)

_Policy version: v0.0.3 • Last updated: 2025-08-13_

This SDK is intentionally dull. The rules below keep it that way so add-ons (StreamDaemon, mobile VA, etc.) can plug in without the codebase turning into a garage sale.

## 1) Dumpster policy

* `.trash/` is where quarantined junk goes. It is ignored and excluded from source dists.
* Pre-commit blocks any attempt to commit `.trash/**`.
* If you actually need an asset, move it to one of:

  * `models/` model weights, `.onnx .pt .gguf .bin`
  * `data/` databases, `.sqlite .db`
  * `outputs/` generated media, `.png .jpg .wav .mp3 .mp4`

## 2) Pre-commit autoformat

* On commit, staged Python under `veildaemon/**` is auto-fixed (Ruff + isort + Black) and re-added.
* Hooks are enabled via `git config core.hooksPath .githooks`.
* If your commit “mysteriously” changes more files, that’s the formatter saving you from yourself.

## 3) CI quality gates

* **Lint/format check:** `ruff`, `black --check`, `isort --check-only` on `veildaemon/`.
* **Root cleanliness:** no stray code at repo root; enforced by `tests/test_root_clean.py` with `VD_ENFORCE_ROOT_CLEAN=1`.
* **Whitespace guard:** fails on tabs/nbsp/zwsp/BOM in `*.md|*.yml|*.yaml`.
* **Private pack leak guard:** `packs/` and `streamdaemon/` are ignored/export-ignored. CI treats any tracked content as a mistake.

## 4) Canonical imports only

Use the SDK surfaces:

* `veildaemon.apps.bus.event_bus`
* `veildaemon.apps.stage.stage_director` and `...stream_convo_engine`
* `veildaemon.apps.safety.{normalize,rewrite,quip_bank,span_map}`
* `veildaemon.tts.manager`
  Never import `event_bus`, `stage_director`, or `daemon_tts` from the repo root. Shims are gone on purpose.

## 5) StreamDaemon (paid pack) integration

* StreamDaemon lives outside this repo. The SDK loads it dynamically via `plugins.register(...)`.
* Local dev convenience: lightweight shims may exist under `streamdaemon/` to satisfy imports during local smoke tests. These paths are **not** tracked by git.

## 6) Local pack smoke (optional, not in CI)

Quick local check without polluting CI:

```bash
# PowerShell
$env:PYTHONPATH=".;$env:PYTHONPATH"
python tools/pack_smoke.py
```

Expected: `ModuleNotFoundError` unless your private pack is on `PYTHONPATH`. With the pack present, the shimmed modules should import.

## 7) Scene caps & budgets (knobs for producers)

* Per-persona caps live in `personas/<name>/scene_limits.yaml`:

  * `cap_ms: { default: 1200, high_risk: 500, dead_air: 2000 }`
  * `deflect_max_words: 5`
* WPS EMA and StageDirector hysteresis (0.45/0.35) govern live talk timing and barge-ins.

## 8) Entry points

* `veildaemon-shell` and `veildaemon-chat` (console scripts)
* Or run the package: `python -m veildaemon`

## 9) What never belongs at repo root

Anything runtime. Root is meta only: docs, CI, hooks, tools, scripts, tests, config, `.env.example`. If you drop a Python file at root, the root-clean test will snitch.

---

If someone ignores this and tries to smuggle binaries into root again, pre-commit will slam the door and CI will heckle them. That’s intentional. You’ve got a stable SDK node, a quarantined paid pack, and a repo that doesn’t look like a crime scene. Go ship.

