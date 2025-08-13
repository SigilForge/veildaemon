from __future__ import annotations

import json
import os
import re
import sqlite3
import time
from typing import Any, Dict, List, Optional


def _now() -> int:
    return int(time.time())


class TaskStoreSQL:
    def __init__(self, db_path: str = "StreamDaemon/hrm_tasks.sqlite") -> None:
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self._init_schema()

    def _init_schema(self) -> None:
        cur = self.conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                tags TEXT,
                game TEXT,
                character TEXT,
                quest TEXT,
                created INTEGER,
                completed INTEGER DEFAULT 0,
                completed_ts INTEGER
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                ts INTEGER,
                text TEXT,
                tags TEXT,
                game TEXT,
                character TEXT
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            """
        )
        self.conn.commit()

    # --- tasks ---
    def add_task(
        self,
        text: str,
        tags: Optional[List[str]] = None,
        game: Optional[str] = None,
        character: Optional[str] = None,
        quest: Optional[str] = None,
    ) -> Dict[str, Any]:
        import uuid

        if not text:
            raise ValueError("Task text required")
        tid = str(uuid.uuid4())[:8]
        payload = (
            tid,
            text.strip(),
            json.dumps(tags or []),
            game,
            character,
            quest,
            _now(),
            0,
            None,
        )
        self.conn.execute(
            "INSERT INTO tasks (id, text, tags, game, character, quest, created, completed, completed_ts) VALUES (?,?,?,?,?,?,?,?,?)",
            payload,
        )
        # set current if not set
        if not self._get_meta("current_task_id"):
            self._set_meta("current_task_id", tid)
        self.conn.commit()
        return {
            "id": tid,
            "text": text.strip(),
            "tags": tags or [],
            "game": game,
            "character": character,
            "quest": quest,
            "created": payload[6],
            "completed": False,
            "completed_ts": None,
        }

    def complete_task(self, ident: str) -> Optional[Dict[str, Any]]:
        t = self._find_task(ident)
        if not t:
            return None
        self.conn.execute(
            "UPDATE tasks SET completed=1, completed_ts=? WHERE id=?",
            (_now(), t["id"]),
        )
        # advance current if needed
        cur_id = self._get_meta("current_task_id")
        if cur_id == t["id"]:
            nxt = self._next_active_id(exclude=t["id"]) or ""
            self._set_meta("current_task_id", nxt)
        self.conn.commit()
        t["completed"] = True
        t["completed_ts"] = _now()
        return t

    def set_current(self, ident: str) -> Optional[Dict[str, Any]]:
        t = self._find_task(ident)
        if not t:
            return None
        self._set_meta("current_task_id", t["id"])
        self.conn.commit()
        return t

    def get_current(self) -> Optional[Dict[str, Any]]:
        cur_id = self._get_meta("current_task_id")
        if not cur_id:
            return None
        return self._find_task(cur_id)

    def list_tasks(
        self, active_only: bool = True, limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        q = "SELECT id, text, tags, game, character, quest, created, completed, completed_ts FROM tasks"
        params: List[Any] = []
        if active_only:
            q += " WHERE completed=0"
        q += " ORDER BY completed ASC, created ASC"
        if limit:
            q += f" LIMIT {int(limit)}"
        rows = self.conn.execute(q, params).fetchall()
        return [self._row_to_task(r) for r in rows]

    def _find_task(self, ident: str) -> Optional[Dict[str, Any]]:
        ident = (ident or "").strip().lower()
        if not ident:
            return None
        r = self.conn.execute(
            "SELECT id, text, tags, game, character, quest, created, completed, completed_ts FROM tasks WHERE id=?",
            (ident,),
        ).fetchone()
        if r:
            return self._row_to_task(r)
        # prefix
        r = self.conn.execute(
            "SELECT id, text, tags, game, character, quest, created, completed, completed_ts FROM tasks WHERE id LIKE ? LIMIT 1",
            (ident + "%",),
        ).fetchone()
        if r:
            return self._row_to_task(r)
        # substring text
        r = self.conn.execute(
            "SELECT id, text, tags, game, character, quest, created, completed, completed_ts FROM tasks WHERE LOWER(text) LIKE ? LIMIT 1",
            ("%" + ident + "%",),
        ).fetchone()
        return self._row_to_task(r) if r else None

    def _next_active_id(self, exclude: Optional[str] = None) -> Optional[str]:
        q = "SELECT id FROM tasks WHERE completed=0"
        params: List[Any] = []
        if exclude:
            q += " AND id<>?"
            params.append(exclude)
        q += " ORDER BY created ASC LIMIT 1"
        r = self.conn.execute(q, params).fetchone()
        return r[0] if r else None

    def _row_to_task(self, r: Any) -> Dict[str, Any]:
        return {
            "id": r[0],
            "text": r[1],
            "tags": json.loads(r[2] or "[]"),
            "game": r[3],
            "character": r[4],
            "quest": r[5],
            "created": r[6],
            "completed": bool(r[7]),
            "completed_ts": r[8],
        }

    # --- events ---
    def record_event(
        self,
        text: str,
        tags: Optional[List[str]] = None,
        game: Optional[str] = None,
        character: Optional[str] = None,
    ) -> Dict[str, Any]:
        rec = {
            "ts": _now(),
            "text": (text or "").strip(),
            "tags": tags or [],
            "game": game,
            "character": character,
        }
        self.conn.execute(
            "INSERT INTO events (ts, text, tags, game, character) VALUES (?,?,?,?,?)",
            (rec["ts"], rec["text"], json.dumps(rec["tags"]), game, character),
        )
        # cap events by trimming oldest if > 1000
        self.conn.execute(
            "DELETE FROM events WHERE ts IN (SELECT ts FROM events ORDER BY ts DESC LIMIT -1 OFFSET 1000)"
        )
        self.conn.commit()
        return rec

    def recent_events(self, n: int = 5) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT ts, text, tags, game, character FROM events ORDER BY ts DESC LIMIT ?",
            (int(n),),
        ).fetchall()
        out: List[Dict[str, Any]] = []
        for ts, text, tags, game, character in rows:
            out.append(
                {
                    "ts": ts,
                    "text": text,
                    "tags": json.loads(tags or "[]"),
                    "game": game,
                    "character": character,
                }
            )
        return list(reversed(out))

    # --- meta helpers ---
    def _get_meta(self, key: str) -> Optional[str]:
        r = self.conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return r[0] if r else None

    def _set_meta(self, key: str, value: str) -> None:
        self.conn.execute(
            "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

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
            for t in [x for x in tasks if not x["completed"]]:
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
            for t in [x for x in tasks if x["completed"]]:
                f.write(f"- [x] {t['text']}\n")

        # Per-quest files
        by_quest: Dict[str, List[Dict[str, Any]]] = {}
        for t in tasks:
            q = t.get("quest") or "General"
            by_quest.setdefault(q, []).append(t)
        for qname, items in by_quest.items():
            safe = re_safe(qname)
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
                    mark = "x" if t["completed"] else " "
                    f.write(f"- [{mark}] {t['text']}\n")

        # Per-(game,character) file
        by_gc: Dict[str, List[Dict[str, Any]]] = {}
        for t in tasks:
            key = f"{t.get('game') or 'Unknown'}__{t.get('character') or 'Unknown'}"
            by_gc.setdefault(key, []).append(t)
        for key, items in by_gc.items():
            game, character = key.split("__", 1)
            safe = re_safe(f"{game} - {character}")
            path = os.path.join(tasks_dir, f"{safe}.md")
            with open(path, "w", encoding="utf-8") as f:
                f.write("---\n")
                f.write(f"title: {game} - {character}\n")
                f.write(f"game: {game}\n")
                f.write(f"character: {character}\n")
                f.write("---\n\n")
                f.write("## Tasks\n\n")
                for t in items:
                    mark = "x" if t["completed"] else " "
                    quest = (" (" + t["quest"] + ")") if t.get("quest") else ""
                    f.write(f"- [{mark}] {t['text']}{quest}\n")
        return overview


def re_safe(name: str) -> str:

    safe = re.sub(r"[^\w\- ]+", "_", name.strip())
    safe = re.sub(r"\s+", "_", safe)
    return safe or "note"
