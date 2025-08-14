"""
Minimal LoRA SFT trainer for HRM mined examples.

- Input: hrm_training_examples.yaml ({"training_examples": [{"input": str, "desired_reply": str, ...}]})
- Base model (default): gpt2 (CPU-friendly). You can pass a HF model id via --base.
- Output: PEFT LoRA adapter in --out directory (default: adapters/hrm-lora)

Usage:
  python tools/sft_lora_train.py --data data/hrm/hrm_training_examples.yaml --base gpt2 --out adapters/hrm-lora --epochs 1 --batch 2

Note: Keep this as a dev-only tool (see docs/dev-tools.md).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig, get_peft_model


def load_yaml_examples(path: str) -> list[dict]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"data file not found: {p}")
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    ex = data.get("training_examples") or []
    # Filter to entries with input+desired_reply
    cleaned = []
    for e in ex:
        inp = (e.get("input") or "").strip()
        out = (e.get("desired_reply") or "").strip()
        if inp and out:
            cleaned.append({"input": inp, "output": out})
    if not cleaned:
        raise ValueError("no usable training examples found")
    return cleaned


def build_sequences(examples: list[dict], sys_prefix: str = "") -> list[str]:
    seqs: list[str] = []
    for e in examples:
        prompt = e["input"].strip()
        reply = e["output"].strip()
        text = f"{sys_prefix}{prompt}\nAssistant: {reply}\n"
        seqs.append(text)
    return seqs


def tokenize(seqs: list[str], tokenizer, max_length: int = 512):
    # Simple causal LM objective on full sequence (labels == input_ids)
    enc = tokenizer(
        seqs,
        truncation=True,
        max_length=max_length,
        padding=False,
        return_tensors=None,
    )
    enc["labels"] = [ids[:] for ids in enc["input_ids"]]
    return enc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=str, default="data/hrm/hrm_training_examples.yaml")
    ap.add_argument("--base", type=str, default="gpt2")
    ap.add_argument("--out", type=str, default="adapters/hrm-lora")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--batch", type=int, default=2)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--max-length", type=int, default=512)
    ap.add_argument("--lora-r", type=int, default=8)
    ap.add_argument("--lora-alpha", type=int, default=16)
    ap.add_argument("--lora-dropout", type=float, default=0.05)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    examples = load_yaml_examples(args.data)
    seqs = build_sequences(examples)

    print(f"Loaded {len(seqs)} examples. Base={args.base}")

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(args.base)

    lora_cfg = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        task_type="CAUSAL_LM",
        target_modules=["c_attn", "c_proj", "c_fc"],  # GPT2 family
    )
    model = get_peft_model(model, lora_cfg)

    tokenized = tokenize(seqs, tokenizer, max_length=args.max_length)
    ds = Dataset.from_dict(tokenized)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    training_args = TrainingArguments(
        output_dir=str(out_dir),
        per_device_train_batch_size=args.batch,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        logging_steps=10,
        save_steps=1000,
        evaluation_strategy="no",
        seed=args.seed,
        remove_unused_columns=False,
        report_to=[],
        fp16=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=ds,
        data_collator=collator,
    )

    trainer.train()

    # Save adapter + tokenizer config for reuse
    model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    (out_dir / "meta.json").write_text(
        json.dumps({"base": args.base, "examples": len(seqs)}, indent=2),
        encoding="utf-8",
    )
    print(f"Saved LoRA adapter to {out_dir}")


if __name__ == "__main__":
    main()
