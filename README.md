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

### ▶ What StreamDaemon Does (SDK + Pack Hooks)

```text
StreamDaemon = Twitch IO + Orchestration + HRM learning + Voice/TTS + Safety + State + Packs
```

#### Twitch IO

- Discover captioned channels
  Finds live streams by language/viewers/tags; writes:

  - data/captioned_channels.json
  - config/vtt_map.candidates.json  (seed map: #channel → VTT URL)
  Run:
  - python -m veildaemon.apps.watchers.discover_captioned_channels --language en --min-viewers 50

- Chat watchers
  Single‑channel or rotating multi‑channel (min/max viewers, language, debug).
  Writes rotating chat logs for downstream processing.
  See: veildaemon/apps/watchers/twitch_chat_watcher.py, veildaemon/apps/watchers/twitch_multi_watcher.py

- Captions watcher
  Polls WebVTT per channel (from a vtt_map) in parallel with chat.
  See: veildaemon/apps/watchers/twitch_vtt_watcher.py

#### Orchestration

- Workday loop
  tools/auto_train_loop.py + workday_runner.ps1
  Repeats: discover → watch (chat + optional VTT) → seed shadow → mine examples → optional train.
  Tunable rotation/workday timings; Windows‑friendly background processes.

#### Learning pipeline (HRM)

- Shadow mining
  Compares hrm_reply vs llm_reply from shadow logs; extracts “good” examples.
  Output: data/hrm/hrm_training_examples.yaml
  Run:
  - python -m veildaemon.hrm.shadow_miner

- Text dataset builder
  Converts YAML to byte‑level HRM datasets (configurable seq‑len).
  Run:
  - python -m hrm_core.dataset.build_text_dataset --source data/hrm/hrm_training_examples.yaml --output-dir data/text-sft-512 --seq-len 1024

- Optional short fine‑tune
  Hydra‑style overrides; WANDB offline by default.
  Example:
  - set WANDB_MODE=offline; python hrm_core/pretrain.py data_path=data/text-sft-512 global_batch_size=24 epochs=200 arch.forward_dtype=float16

#### Voice / TTS

- Piper voice assets
  Fetch + audition + throughput budgeting.
  Script: tools/piper_fetch_voice.py

- TTS manager
  Safety/latency controls; packs can supply voices/configs.
  Module: veildaemon/tts/manager.py

#### Safety & Moderation

- Normalization, text rewriting, span mapping, cooldowns, quip banks.
- Hook points for pack‑level moderation (HRM rules).
  Modules: veildaemon/apps/safety/*

#### Memory & State

- Journal manager, knowledge store, SQLite‑backed task store.
  Modules: veildaemon/apps/memory/*

#### Packs plugin integration

- Dynamic contract:

  ```python
  from streamdaemon.plugins import register
  register(app)  # attach scenes, personas, overlays, voice configs, watchers
  ```
- Event‑driven wiring via SDK EventBus and Stage Director shims.
- Core stays “boring”; private pack content lives outside public repo.

#### Outputs & Conventions

- data/ for runtime artifacts (captioned channels, HRM datasets, mined examples)
- config/ for VTT maps and related JSON
- One‑button smokes and guard tests keep the root clean; SDK stays stable for packs
  See: tools/full_smoke.py, tools/smoke_report.py, tests/

#### StreamDaemon quickstart


```powershell
# 1) Discover captioned streams and seed VTT map
python -m veildaemon.apps.watchers.discover_captioned_channels --language en --min-viewers 50

# 2) Run a rotating watch (chat + captions) with defaults
python tools/auto_train_loop.py --workday-seconds 7200 --rotation-seconds 900 --vtt-map config\vtt_map.candidates.json

# 3) Mine examples + build HRM dataset
python -m veildaemon.hrm.shadow_miner
python -m hrm_core.dataset.build_text_dataset --source data/hrm/hrm_training_examples.yaml --output-dir data/text-sft-1024 --seq-len 1024

# 4) Optional: quick HRM fine‑tune (Hydra overrides; offline logging)
$env:WANDB_MODE = "offline"; python hrm_core/pretrain.py data_path=data/text-sft-1024 global_batch_size=24 epochs=50 arch.forward_dtype=float16
```


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

