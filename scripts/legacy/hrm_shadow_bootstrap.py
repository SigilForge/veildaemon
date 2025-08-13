import json
from pathlib import Path
from datetime import datetime, timedelta

# Example synthetic data
examples = [
    {
        "input": "I'm overwhelmed.",
        "hrm_reply": "Take a breath. I'm here.",
        "llm_reply": "Candlelight, silence, one breath at a time.",
        "feedback": "good"
    },
    {
        "input": "Tell me a story.",
        "hrm_reply": "Let me share a myth.",
        "llm_reply": "Once, in the mythic dusk, a wick burned for every hope...",
        "feedback": "good"
    },
    {
        "input": "What is 5x5?",
        "hrm_reply": "25.",
        "llm_reply": "Clear skies, strong signal. I’m still here if you need me.",
        "feedback": "good"
    },
    {
        "input": "I need grounding.",
        "hrm_reply": "Grounding activated. Breathe with me.",
        "llm_reply": "Let’s anchor together. Feel the floor, the air, the light.",
        "feedback": "good"
    }
]

now = datetime.now()
log = []
for i, ex in enumerate(examples):
    entry = {
        "time": (now + timedelta(seconds=i)).isoformat(),
        "input": ex["input"],
        "hrm_reply": ex["hrm_reply"],
        "hrm_origin": "synthetic",
        "llm_reply": ex["llm_reply"],
        "llm_origin": "synthetic",
        "final_reply": ex["llm_reply"],
        "final_origin": "llm",
        "feedback": ex["feedback"]
    }
    log.append(entry)

Path("hrm_shadow_log.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Populated hrm_shadow_log.json with {len(log)} synthetic examples.")
