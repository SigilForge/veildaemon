import json
from pathlib import Path
import yaml

SHADOW_LOG = Path("hrm_shadow_log.json")
OUTPUT_YAML = Path("hrm_training_examples.yaml")

def mine_shadow_log():
    if not SHADOW_LOG.exists():
        print("No hrm_shadow_log.json found.")
        return
    with SHADOW_LOG.open(encoding="utf-8") as f:
        logs = json.load(f)
    examples = []
    for entry in logs:
        # Only consider entries with feedback
        feedback = entry.get("feedback")
        if feedback != "good":
            continue
        hrm = (entry.get("hrm_reply") or "").strip()
        llm = (entry.get("llm_reply") or "").strip()
        # Only suggest if LLM reply is different and better
        if llm and llm != hrm:
            examples.append({
                "input": entry.get("input"),
                "desired_reply": llm,
                "hrm_reply": hrm,
                "context": {
                    "llm_origin": entry.get("llm_origin"),
                    "hrm_origin": entry.get("hrm_origin"),
                    "time": entry.get("time")
                }
            })
    if not examples:
        print("No new training examples found.")
        return
    # Output as YAML for easy import
    with OUTPUT_YAML.open("w", encoding="utf-8") as f:
        yaml.dump({"training_examples": examples}, f, allow_unicode=True, sort_keys=False)
    print(f"Wrote {len(examples)} training examples to {OUTPUT_YAML}")

if __name__ == "__main__":
    mine_shadow_log()
