"""Simple JSONL journal manager.
Each entry appended as one JSON line for easy streaming & tailing.
"""
from __future__ import annotations
import os, json, time, threading
from typing import Any, Iterable, Optional, List

class JournalManager:
    def __init__(self, directory: Optional[str] = None, filename: str = "session.journal.jsonl") -> None:
        self.directory = directory or os.environ.get('VEIL_JOURNAL_DIR', 'logs/journal')
        self.filename = filename
        self._lock = threading.RLock()
        try:
            os.makedirs(self.directory, exist_ok=True)
        except Exception:
            pass
        self.path = os.path.join(self.directory, self.filename)

    def append(self, obj: Any) -> None:
        try:
            line = json.dumps(obj, ensure_ascii=False)
        except Exception:
            # fallback minimal
            line = json.dumps({"error": "serialize", "repr": str(obj)})
        with self._lock:
            try:
                with open(self.path, 'a', encoding='utf-8') as f:
                    f.write(line + "\n")
            except Exception:
                pass

    def tail(self, n: int = 50) -> List[dict]:
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                lines = f.readlines()[-n:]
            out = []
            for ln in lines:
                try:
                    out.append(json.loads(ln))
                except Exception:
                    pass
            return out
        except FileNotFoundError:
            return []
        except Exception:
            return []

    def find_since(self, ts: float) -> List[dict]:
        results: List[dict] = []
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                for ln in f:
                    try:
                        obj = json.loads(ln)
                        if obj.get('ts') and obj['ts'] >= ts:
                            results.append(obj)
                    except Exception:
                        pass
        except Exception:
            pass
        return results
