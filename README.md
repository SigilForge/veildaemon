# VeilDaemon

Moderation-first HRM assistant with Twitch ingestion, captions, shadow logging, and optional self-tuning.


## Quick start (workday unattended)

Run the unattended loop that discovers channels, captures chat, merges captions (optional), seeds shadow, and mines training examples.

Optional: end-of-rotation HRM fine-tune

You can append HRM flags to the PowerShell runner to automatically:

- Convert mined `hrm_training_examples.yaml` → HRM dataset (byte-level), and
- Launch a short HRM pretrain on that dataset in WANDB offline mode.

Example (PowerShell):

```powershell
.\workday_runner.ps1 -HrmTrain -HrmProfile 3060ti -HrmSeqLen 384 -HrmBatch 24 -HrmEpochs 200 -HrmDataOut "data/text-sft-384"
```

Notes:

- Requires a CUDA GPU. Start with small batch/epochs. Outputs under `hrm_core/checkpoints/`.
- This is optional; the bot runs fine without it.

### Enable self-tuning (optional)

- Install dev deps (once): `pip install -r requirements.txt`
- Run with training after each mining step:
	- Example command to pass: `python sft_lora_train.py --data hrm_training_examples.yaml --base gpt2 --out adapters/hrm-lora --epochs 1 --batch 2`
	- Use `--train-cmd "python sft_lora_train.py --data hrm_training_examples.yaml --base gpt2 --out adapters/hrm-lora --epochs 1 --batch 2"` with `auto_train_loop.py`.

