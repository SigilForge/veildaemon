from __future__ import annotations

import json
import os
import re
import time
import uuid
from typing import Any, Dict, List, Optional


class TaskStore:
    def __init__(self, path: str = "StreamDaemon/hrm_tasks.json", auto_save: bool = True) -> None:
        self.path = path
        self.auto_save = auto_save
        self.tasks = (
            []
        )  # {id, text, tags[], game, character, quest, created, completed, completed_ts}
        self.events = []  # {ts, text, tags[], game, character}
        self.current_task_id = None
        self._load()

    # --- persistence ---
    def _load(self) -> None:
        try:
            if os.path.exists(self.path):
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.tasks = list(data.get("tasks", []))
                    self.events = list(data.get("events", []))
                    self.current_task_id = data.get("current_task_id")
        except Exception:
            self.tasks = []
            self.events = []
            self.current_task_id = None

    def _save(self) -> None:
        if not self.auto_save:
            return
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "tasks": self.tasks,
                        "events": self.events,
                        "current_task_id": self.current_task_id,
                    },
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
        except Exception:
            pass

    # --- tasks ---
    def add_task(
        self,
        text: str,
        tags: Optional[List[str]] = None,
        game: Optional[str] = None,
        character: Optional[str] = None,
        quest: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not text:
            raise ValueError("Task text required")
        rec = {
            "id": str(uuid.uuid4())[:8],
            "text": text.strip(),
            "tags": tags or [],
            "game": game,
            "character": character,
            "quest": quest,
            "created": int(time.time()),
            "completed": False,
            "completed_ts": None,
        }
        self.tasks.append(rec)
        # if no current task, set this one
        if not self.current_task_id:
            self.current_task_id = rec["id"]
        self._save()
        return rec

    def complete_task(self, ident: str) -> Optional[Dict[str, Any]]:
        t = self._find_task(ident)
        if not t:
            return None
        t["completed"] = True
        t["completed_ts"] = int(time.time())
        # advance current task if this was current
        if self.current_task_id == t["id"]:
            self.current_task_id = self._next_active_id(exclude=t["id"]) or None
        self._save()
        return t

    def set_current(self, ident: str) -> Optional[Dict[str, Any]]:
        t = self._find_task(ident)
        if not t:
            return None
        self.current_task_id = t["id"]
        self._save()
        return t

    def get_current(self) -> Optional[Dict[str, Any]]:
        if not self.current_task_id:
            return None
        return self._find_task(self.current_task_id)

    def list_tasks(
        self, active_only: bool = True, limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        items = [t for t in self.tasks if (not active_only or not t.get("completed"))]
        items.sort(key=lambda x: (x.get("completed", False), x.get("created", 0)))
        if limit is not None:
            items = items[:limit]
        return items

    def _find_task(self, ident: str) -> Optional[Dict[str, Any]]:
        ident = (ident or "").strip().lower()
        if not ident:
            return None
        for t in self.tasks:
            if t.get("id") == ident:
                return t
        # fallback: by prefix match or substring on text
        for t in self.tasks:
            if str(t.get("id", "")).lower().startswith(ident):
                return t
        for t in self.tasks:
            if ident in str(t.get("text", "")).lower():
                return t
        return None

    def _next_active_id(self, exclude: Optional[str] = None) -> Optional[str]:
        for t in self.tasks:
            if t.get("completed"):
                continue
            if exclude and t.get("id") == exclude:
                continue
            return t.get("id")
        return None

    # --- events ---
    def record_event(
        self,
        text: str,
        tags: Optional[List[str]] = None,
        game: Optional[str] = None,
        character: Optional[str] = None,
    ) -> Dict[str, Any]:
        rec = {
            "ts": int(time.time()),
            "text": (text or "").strip(),
            "tags": tags or [],
            "game": game,
            "character": character,
        }
        self.events.append(rec)
        # cap list to last 500 events
        if len(self.events) > 500:
            self.events = self.events[-500:]
        self._save()
        return rec

    def recent_events(self, n: int = 5) -> List[Dict[str, Any]]:
        return list(self.events[-n:])

    # --- export ---
    def export_obsidian(self, vault_path: str) -> str:
        vault_path = os.path.abspath(vault_path)
        root = os.path.join(vault_path, "HRM")
        tasks_dir = os.path.join(root, "Tasks")
        quests_dir = os.path.join(root, "Quests")
        os.makedirs(tasks_dir, exist_ok=True)
        os.makedirs(quests_dir, exist_ok=True)

        # Overview file
        tasks = self.list_tasks(active_only=False)
        overview = os.path.join(root, "overview.md")
        with open(overview, "w", encoding="utf-8") as f:
            f.write("---\n")
            f.write("title: HRM Overview\n")
            f.write("---\n\n")
            f.write("## Active Tasks\n\n")
            for t in [x for x in tasks if not x.get("completed")]:
                meta = []
                if t.get("game"):
                    meta.append(f"game: {t['game']}")
                if t.get("character"):
                    meta.append(f"character: {t['character']}")
                if t.get("quest"):
                    meta.append(f"quest: {t['quest']}")
                meta_str = (" (" + ", ".join(meta) + ")") if meta else ""
                f.write(f"- [ ] {t['text']}{meta_str}\n")
            f.write("\n## Completed\n\n")
            for t in [x for x in tasks if x.get("completed")]:
                f.write(f"- [x] {t['text']}\n")

        # Per-quest files
        by_quest: Dict[str, List[Dict[str, Any]]] = {}
        for t in tasks:
            q = t.get("quest") or "General"
            by_quest.setdefault(q, []).append(t)
        for qname, items in by_quest.items():
            safe = _re_safe(qname)
            path = os.path.join(quests_dir, f"{safe}.md")
            with open(path, "w", encoding="utf-8") as f:
                f.write("---\n")
                f.write(f"title: {qname}\n")
                # frontmatter with common values if any
                games = sorted([str(i.get("game")) for i in items if i.get("game")])
                chars = sorted([str(i.get("character")) for i in items if i.get("character")])
                if games:
                    f.write(f"game: {games[0]}\n")
                if chars:
                    f.write(f"character: {chars[0]}\n")
                f.write("---\n\n")
                f.write("## Tasks\n\n")
                for t in items:
                    mark = "x" if t.get("completed") else " "
                    f.write(f"- [{mark}] {t['text']}\n")

        # Per-(game,character) file
        by_gc: Dict[str, List[Dict[str, Any]]] = {}
        for t in tasks:
            key = f"{t.get('game') or 'Unknown'}__{t.get('character') or 'Unknown'}"
            by_gc.setdefault(key, []).append(t)
        for key, items in by_gc.items():
            game, character = key.split("__", 1)
            safe = _re_safe(f"{game} - {character}")
            path = os.path.join(tasks_dir, f"{safe}.md")
            with open(path, "w", encoding="utf-8") as f:
                f.write("---\n")
                f.write(f"title: {game} - {character}\n")
                f.write(f"game: {game}\n")
                f.write(f"character: {character}\n")
                f.write("---\n\n")
                f.write("## Tasks\n\n")
                for t in items:
                    mark = "x" if t.get("completed") else " "
                    quest = (" (" + t["quest"] + ")") if t.get("quest") else ""
                    f.write(f"- [{mark}] {t['text']}{quest}\n")
        return overview


def _re_safe(name: str) -> str:
    safe = re.sub(r"[^\w\- ]+", "_", (name or "").strip())
    safe = re.sub(r"\s+", "_", safe)
    return safe or "note"
