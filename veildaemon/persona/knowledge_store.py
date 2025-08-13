from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional


class KnowledgeStore:
    def __init__(
        self, path: str = "StreamDaemon/hrm_knowledge.json", auto_save: bool = True
    ) -> None:
        self.path = path
        self.auto_save = auto_save
        self.facts: Dict[str, Dict[str, Any]] = {}
        self.threshold_votes = 3  # chat suggestions needed to promote
        self._load()

    def _load(self) -> None:
        try:
            if os.path.exists(self.path):
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self.facts = data
        except Exception:
            self.facts = {}

    def _save(self) -> None:
        if not self.auto_save:
            return
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.facts, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        return self.facts.get(key)

    def set_fact(
        self, key: str, value: Any, source: str = "owner", confidence: Optional[float] = None
    ) -> Dict[str, Any]:
        base = {
            "owner": 0.95,
            "mod": 0.85,
            "observed": 0.80,
            "gpt": 0.75,
            "chat": 0.55,
        }
        conf = float(confidence) if confidence is not None else base.get(source, 0.6)
        prev = self.facts.get(key)
        if prev:
            # Replace if higher confidence or different value from a high-trust source
            if conf >= (prev.get("confidence") or 0) or source in ("owner", "mod"):
                prev.update(
                    {
                        "value": value,
                        "source": source,
                        "confidence": conf,
                        "votes": 0,
                        "ts": int(time.time()),
                    }
                )
                self._save()
                return prev
            return prev
        rec = {
            "value": value,
            "source": source,
            "confidence": conf,
            "votes": 0,
            "ts": int(time.time()),
        }
        self.facts[key] = rec
        self._save()
        return rec

    def suggest_fact(self, key: str, value: Any, source: str = "chat") -> Dict[str, Any]:
        rec = self.facts.get(key)
        if not rec:
            # Create low-confidence entry that requires votes
            rec = self.set_fact(key, value, source=source, confidence=0.5)
        # If value matches, just increase votes slightly
        if rec.get("value") == value:
            rec["votes"] = int(rec.get("votes") or 0) + 1
        else:
            # Different suggestion: reduce confidence if conflicting, then count vote
            rec["confidence"] = max(0.45, float(rec.get("confidence") or 0.5) - 0.05)
            rec["votes"] = int(rec.get("votes") or 0) + 1
            rec["value"] = value if rec["votes"] >= self.threshold_votes else rec["value"]
        rec["ts"] = int(time.time())
        # Auto-promote if enough votes
        if rec["votes"] >= self.threshold_votes:
            rec["confidence"] = max(0.6, float(rec.get("confidence") or 0.5))
        self.facts[key] = rec
        self._save()
        return rec
