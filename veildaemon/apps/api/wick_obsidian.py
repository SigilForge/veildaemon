import datetime
import os
from pathlib import Path

VAULT_PATH = os.environ.get("VEIL_VAULT_PATH", str(Path.home() / "VeilVault" / "Wick Logs"))


__all__ = [
	"append_to_obsidian_log",
	"append_chat_to_obsidian",
	"append_journal_to_obsidian",
]


def append_to_obsidian_log(wicks, delta, reason, context=""):
	now = datetime.datetime.now()
	date_str = now.strftime("%Y-%m-%d")
	time_str = now.strftime("%H:%M")
	filename = f"{VAULT_PATH}/{date_str}.md"
	Path(VAULT_PATH).mkdir(parents=True, exist_ok=True)
	line = f"- {time_str} — Wicks: {wicks} ({'+' if delta>=0 else ''}{delta}) — {reason}"
	if context:
		line += f" — {context}"
	with open(filename, "a", encoding="utf-8") as f:
		f.write(line + "\n")


def append_chat_to_obsidian(speaker, message):
	now = datetime.datetime.now()
	date_str = now.strftime("%Y-%m-%d")
	time_str = now.strftime("%H:%M")
	filename = f"{VAULT_PATH}/{date_str}.md"
	Path(VAULT_PATH).mkdir(parents=True, exist_ok=True)
	line = f"{time_str} — {speaker.title()}: {message}"
	with open(filename, "a", encoding="utf-8") as f:
		f.write(line + "\n")


def append_journal_to_obsidian(text, mood="", tags="="):
	now = datetime.datetime.now()
	date_str = now.strftime("%Y-%m-%d")
	time_str = now.strftime("%H:%M")
	filename = f"{VAULT_PATH}/{date_str}.md"
	Path(VAULT_PATH).mkdir(parents=True, exist_ok=True)
	line = f"### {time_str} — Journal\n> {text}\nMood: {mood}\nTags: {tags}\n"
	with open(filename, "a", encoding="utf-8") as f:
		f.write(line + "\n")
