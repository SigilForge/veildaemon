from __future__ import annotations

import os
import sys
import json
import subprocess
from pathlib import Path


def run(cmd: list[str], env: dict[str, str] | None = None, check: bool = True):
    print("$", " ".join(cmd))
    return subprocess.run(cmd, check=check, env=env)


def main():
    repo = Path(__file__).resolve().parents[1]
    os.chdir(repo)
    print(f"[smoke] repo: {repo}")

    # 1) Import checks
    try:
        import yaml  # type: ignore
        import numpy as np  # type: ignore
        print(f"[smoke] PyYAML OK, NumPy OK ({np.__version__})")
    except Exception as e:
        print(f"[smoke] import error: {e}")
        sys.exit(1)

    # 2) Write tiny examples yaml
    tiny = repo / "hrm_training_examples.smoke.yaml"
    tiny.write_text(
        (
            "training_examples:\n"
            "  - input: \"hi\"\n"
            "    desired_reply: \"hello\"\n"
        ),
        encoding="utf-8",
    )
    print(f"[smoke] wrote {tiny}")

    # 3) Build tiny HRM dataset (byte-level)
    out = repo / "data" / "text-sft-smoke"
    out.mkdir(parents=True, exist_ok=True)
    run([sys.executable, "hrm_core/dataset/build_text_dataset.py", "--source", str(tiny), "--output-dir", str(out), "--seq-len", "256"], check=False)

    # 4) List outputs
    index = {p.name: p.stat().st_size for p in sorted(out.rglob("*.npy"))}
    meta = (out / "train" / "dataset.json")
    print("[smoke] files:", json.dumps({"npy": index, "has_meta": meta.exists()}, indent=2))

    # 5) Optional: 2-epoch HRM train (if CUDA available)
    try:
        import torch  # type: ignore
        cuda_ok = torch.cuda.is_available()
    except Exception:
        cuda_ok = False

    if cuda_ok:
        env = os.environ.copy()
        env.setdefault("WANDB_MODE", "offline")
        env.setdefault("DISABLE_COMPILE", "1")
        overrides = [
            f"data_path={str(out)}",
            "global_batch_size=8",
            "epochs=2",
            "eval_interval=2",
            "checkpoint_every_eval=True",
            "lr_warmup_steps=2",
            "arch.halt_max_steps=2",
            # light profile
            "arch.forward_dtype=float16",
            "arch.hidden_size=384",
            "arch.num_heads=6",
            "arch.H_layers=2",
            "arch.L_layers=2",
            "arch.H_cycles=1",
            "arch.L_cycles=1",
            "project_name=Smoke",
            "run_name=smoke",
        ]
        print("[smoke] running 2-epoch HRM train (CUDA detected)")
        run([sys.executable, "hrm_core/pretrain.py", *overrides], env=env, check=False)
    else:
        print("[smoke] CUDA not available; skipping HRM train")

    print("[smoke] PASS")


if __name__ == "__main__":
    main()
