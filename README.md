# VeilDaemon

Moderation-first HRM assistant with Twitch ingestion, captions, shadow logging, and optional self-tuning.

> **Operational Guards:** see [ARCHITECTURE.md ▸ Operational Guards](ARCHITECTURE.md#operational-guards-a-quick-map-for-humans)

## Quick start (workday unattended)

Run the unattended loop that discovers channels, captures chat, merges captions (optional), seeds shadow, and mines training examples.

Optional: end-of-rotation HRM fine-tune

You can append HRM flags to the PowerShell runner to automatically:

- Convert mined `hrm_training_examples.yaml` → HRM dataset (byte-level), and
- Launch a short HRM pretrain on that dataset in WANDB offline mode.

Example (PowerShell):

```powershell
./workday_runner.ps1 -HrmTrain -HrmProfile 3060ti -HrmSeqLen 384 -HrmBatch 24 -HrmEpochs 200 -HrmDataOut "data/text-sft-384"
```

Notes:

- Requires a CUDA GPU. Start with small batch/epochs. Outputs under `hrm_core/checkpoints/`.
- This is optional; the bot runs fine without it.

### Configure Obsidian vault path

Set VEIL_VAULT_PATH to control where Wick logs and journal/chat entries are written (defaults to `~/VeilVault/Wick Logs`). Example (PowerShell):

```powershell
$env:VEIL_VAULT_PATH = "$HOME/VeilVault/Wick Logs"; python your_script.py
```

### Enable self-tuning (optional)

- Install dev deps (once): `pip install -r requirements.txt`
- Run with training after each mining step.

Example command to pass:

```bash
python sft_lora_train.py --data hrm_training_examples.yaml --base gpt2 --out adapters/hrm-lora --epochs 1 --batch 2
```

Use with the auto loop via:

```bash
--train-cmd "python sft_lora_train.py --data hrm_training_examples.yaml --base gpt2 --out adapters/hrm-lora --epochs 1 --batch 2"
```

## Quickstart

```bash
python -m pip install -e ./veildaemon
veildaemon-shell   # CLI entrypoint
veildaemon-chat    # Chat-bound entrypoint
```

> Planning a release? See the checklist: [docs/release-v0.0.4.md](docs/release-v0.0.4.md)

## Package map

- Runtime brain: `veildaemon/apps/stage/` (StageDirector, stream engine)
- Safety: `veildaemon/apps/safety/` (normalize, rewrite, quip bank)
- TTS: `veildaemon/tts/` (manager, WPS EMA)
- Orchestrator: `veildaemon/apps/orchestrator/` (shell, chat)
- Watchers/API/Memory: `veildaemon/apps/{watchers,api,memory}/`
- HRM: `veildaemon/hrm/` (engine, core context)

Shims at repo root exist for one release and warn once. Removal date: **2025-09-30**.

## Scene caps & talk budgets

Tune without touching code:

```text
personas/<name>/scene_limits.yaml
```

Example:

```yaml
Gaming:
  cap_ms: { default: 1200, high_risk: 500, dead_air: 2000 }
  deflect_max_words: 5
```

## Obsidian exports

SQLite + journal are the source of truth. Obsidian `.md` files are generated **on-demand**. Set `VEIL_VAULT_PATH` to choose the vault.

## Guards

- Private packs are not tracked (`packs/`, `streamdaemon/` fenced by .gitignore/.gitattributes and CI).
- Root cleanliness is enforced in CI (`tests/test_root_clean.py`; `VD_ENFORCE_ROOT_CLEAN=1`).
- Import hygiene: use `veildaemon.apps.*` and `veildaemon.tts.*` paths only.

## Dev sanity

```bash
python veildaemon/tests/test_imports.py
pytest -q tests/test_root_clean.py
python tools/gen_nav.py && git status    # NAV.md stays in sync
```

