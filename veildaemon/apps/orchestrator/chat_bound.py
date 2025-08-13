"""Chat-bound UI (migrated from root veil_daemon_chat_bound.py).

Lightweight Tk chat window that talks to the orchestrator brain and optional TTS.
"""
from __future__ import annotations

import asyncio
import threading
import tkinter as tk
import tkinter.scrolledtext as scrolledtext
from dataclasses import dataclass
from typing import List, Dict

from .brain import ask_daemon


@dataclass
class Message:
	role: str
	message: str


class ChatBoundUI:
	def __init__(self, root: tk.Tk, role: str = "whisper") -> None:
		self.root = root
		self.role = role
		self.root.title("🜏 VeilDaemon — Chat")
		self.root.geometry("720x560")
		self.root.configure(bg="black")

		self.conversation: List[Message] = []

		self.chat_log = scrolledtext.ScrolledText(
			root, wrap=tk.WORD, font=("Consolas", 13),
			bg="#1a1a1a", fg="#6be8fa", insertbackground="lime",
			state='disabled', height=22
		)
		self.chat_log.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

		self.entry_var = tk.StringVar()
		self.entry_box = tk.Entry(
			root, font=("Consolas", 13), textvariable=self.entry_var,
			bg="#222", fg="white", insertbackground="lime"
		)
		self.entry_box.pack(fill=tk.X, padx=10, pady=(0, 6))
		self.entry_box.bind("<Return>", self.send_message)

		btn = tk.Button(
			root, text="Send", font=("Consolas", 12), bg="#444", fg="white",
			command=self.send_message
		)
		btn.pack(pady=(0, 10))

		self._insert("daemon", "🜏 Chat online. Type your message below.")

	def _insert(self, role: str, msg: str) -> None:
		self.chat_log.configure(state='normal')
		prefix = "You: " if role == "user" else "Daemon: "
		self.chat_log.insert(tk.END, prefix + msg + "\n")
		self.chat_log.configure(state='disabled')
		self.chat_log.see(tk.END)

	def send_message(self, event=None) -> None:
		text = self.entry_var.get().strip()
		if not text:
			return
		self.entry_var.set("")
		self._insert("user", text)
		self.conversation.append(Message("user", text))
		threading.Thread(target=self._respond, args=(text,), daemon=True).start()

	def _respond(self, prompt: str) -> None:
		self.root.after(0, lambda: self._insert("daemon", "…"))
		reply = ask_daemon(self.role, prompt)
		self.conversation.append(Message("assistant", reply))
		self.root.after(0, lambda: self._insert("daemon", reply))


def main() -> None:
	root = tk.Tk()
	app = ChatBoundUI(root)
	root.mainloop()


if __name__ == "__main__":
	main()
