"""
Automated workday loop: discover Twitch channels, capture chat, seed shadow, mine examples,
and optionally run a user-defined training command.

Notes:
- This does NOT train hrm_core on chat by default (that pipeline expects ARC-style datasets).
- You can provide --train-cmd to run any trainer (script or batch) after each mining step.
- Optional captions: you can pass a channel->VTT URL mapping JSON to capture streamer captions.
"""

from __future__ import annotations

import argparse
import os
import json
import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime


def run_py(module: str, args: list[str] | None = None, check: bool = True):
    cmd = [sys.executable, module]
    if args:
        cmd += args
    return subprocess.run(cmd, check=check)


def spawn_py_background(module: str, args: list[str]):
    # Detached background process (Windows-friendly)
    creationflags = 0
    if sys.platform.startswith("win"):
        creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
    return subprocess.Popen([sys.executable, module] + args, creationflags=creationflags)


def load_vtt_map(path: str | None) -> dict[str, str]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        print(f"[warn] vtt-map file not found: {p}")
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[warn] failed to parse vtt-map JSON: {e}")
        return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-viewers", type=int, default=75)
    ap.add_argument("--limit", type=int, default=10, help="Max discovered channels per rotation")
    ap.add_argument("--language", type=str, default=None)
    ap.add_argument("--max-viewers", type=int, default=250, help="Upper bound on viewer count; 0 disables upper bound")
    ap.add_argument("--rotation-seconds", type=int, default=600, help="Seconds per channel batch")
    ap.add_argument("--workday-seconds", type=int, default=7*60*60, help="How long to run before exit")
    ap.add_argument("--debug", action="store_true")
    ap.add_argument("--train-cmd", type=str, default=None, help="Optional command to run after mining (e.g., a finetune script)")
    ap.add_argument("--vtt-map", type=str, default=None, help="Optional JSON mapping: {\"#channel\": \"https://.../captions.vtt\"}")
    # Optional: HRM fine-tune on mined data (byte-level text dataset)
    ap.add_argument("--hrm-train", action="store_true", help="After mining, build text dataset and run a short HRM fine-tune")
    ap.add_argument("--hrm-data-out", type=str, default="data/text-sft-384", help="Output dir for HRM text dataset")
    ap.add_argument("--hrm-seq-len", type=int, default=384, help="Sequence length for HRM text dataset")
    ap.add_argument("--hrm-batch", type=int, default=24, help="HRM global batch size override for quick runs")
    ap.add_argument("--hrm-epochs", type=int, default=200, help="HRM epochs override for quick runs")
    ap.add_argument("--hrm-profile", type=str, default=None, help="Preset for HRM overrides (e.g., '3060ti')")
    args = ap.parse_args()

    start = time.time()
    loops = 0
    vtt_map = load_vtt_map(args.vtt_map)

    while time.time() - start < args.workday_seconds:
        loops += 1
        print(f"\n=== rotation {loops} ===")

        # Build watcher args
        watcher_args = ["--seconds", str(args.rotation_seconds)]
        if args.debug:
            watcher_args.append("--debug")
        if args.language:
            watcher_args += ["--language", args.language]
        watcher_args += [
            "--min-viewers", str(args.min_viewers),
            "--limit", str(args.limit),
            "--max-viewers", str(args.max_viewers or 0),
        ]

        # Optionally start VTT watchers for known channels (if present in map)
        vtt_procs: list[subprocess.Popen] = []
        if vtt_map:
            try:
                # Discover first to get the actual channel list
                from twitch_multi_watcher import discover_channels
                channels = discover_channels(
                    min_viewers=args.min_viewers,
                    limit=args.limit,
                    language=args.language,
                    max_viewers=(None if (args.max_viewers or 0) == 0 else args.max_viewers),
                )
            except Exception:
                channels = []
            for ch in channels:
                url = vtt_map.get(ch)
                if not url:
                    continue
                print(f"[vtt] spawning watcher for {ch} -> {url}")
                vtt_procs.append(spawn_py_background("twitch_vtt_watcher.py", ["--url", url, "--channel", ch, "--seconds", str(args.rotation_seconds + 5)]))

        # Run chat watcher in the foreground
        run_py("twitch_multi_watcher.py", watcher_args, check=False)

        # Stop any vtt processes after rotation
        for p in vtt_procs:
            try:
                p.terminate()
            except Exception:
                pass

        # Seed + mine
        run_py("twitch_to_shadow.py")
        run_py("hrm_shadow_miner.py")

        # Optional: user-specified training command
        if args.train_cmd:
            print(f"[train] running: {args.train_cmd}")
            try:
                subprocess.run(args.train_cmd, shell=True, check=False)
            except Exception as e:
                print(f"[train] error: {e}")

        # Optional: HRM fine-tune using mined examples
        if args.hrm_train:
            try:
                examples = Path("hrm_training_examples.yaml")
                if not examples.exists():
                    print("[hrm-train] no hrm_training_examples.yaml yet; skipping this rotation")
                else:
                    # Build dataset
                    print("[hrm-train] building text dataset for HRM…")
                    ds_args = [
                        "hrm_core/dataset/build_text_dataset.py",
                        "--source", str(examples),
                        "--output-dir", args.hrm_data_out,
                        "--seq-len", str(args.hrm_seq_len),
                    ]
                    subprocess.run([sys.executable] + ds_args, check=False)

                    # Kick a short HRM train in offline wandb mode
                    print("[hrm-train] launching short HRM fine-tune… (WANDB offline)")
                    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                    hydra_overrides = [
                        f"data_path={args.hrm_data_out}",
                        f"global_batch_size={args.hrm_batch}",
                        f"epochs={args.hrm_epochs}",
                        f"eval_interval={args.hrm_epochs}",
                        "checkpoint_every_eval=True",
                        "lr_warmup_steps=10",
                        "arch.halt_max_steps=4",
                        "project_name=TextSFT",
                        f"run_name=workday_{timestamp}",
                    ]
                    # Apply lightweight profile overrides for limited VRAM
                    if args.hrm_profile and args.hrm_profile.lower() == "3060ti":
                        hydra_overrides += [
                            "arch.forward_dtype=float16",
                            "arch.hidden_size=384",
                            "arch.num_heads=6",
                            "arch.H_layers=2",
                            "arch.L_layers=2",
                            "arch.H_cycles=1",
                            "arch.L_cycles=1",
                        ]
                    env = os.environ.copy()
                    env.setdefault("WANDB_MODE", "offline")
                    if args.hrm_profile and args.hrm_profile.lower() == "3060ti":
                        # Avoid extra compile memory/time on small GPUs
                        env.setdefault("DISABLE_COMPILE", "1")

                    # Run from repo root using script path
                    subprocess.run([sys.executable, "hrm_core/pretrain.py", *hydra_overrides], check=False, env=env)
            except Exception as e:
                print(f"[hrm-train] error: {e}")

    print("Done: workday loop finished.")


if __name__ == "__main__":
    main()
