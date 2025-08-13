"""Daemon shell (migrated from root daemon_shell.py).

Simple console chat loop wired to the orchestrator brain. Keeps behavior minimal.
"""
from __future__ import annotations

import sys
from .brain import ask_daemon


def run(role: str = "whisper") -> int:
	print("🜏 VeilDaemon shell. Type 'exit' to quit.")
	try:
		while True:
			try:
				prompt = input("You: ").strip()
			except EOFError:
				break
			if not prompt:
				continue
			if prompt.lower() in {"exit", "quit"}:
				break
			reply = ask_daemon(role, prompt)
			print("Daemon:", reply)
	except KeyboardInterrupt:
		pass
	return 0


def main(argv: list[str] | None = None) -> int:
	argv = list(sys.argv[1:] if argv is None else argv)
	role = argv[0] if argv else "whisper"
	return run(role)


if __name__ == "__main__":
	raise SystemExit(main())
