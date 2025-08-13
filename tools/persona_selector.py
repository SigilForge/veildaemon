"""
GUI persona selector that discovers personas in plugins/personas and launches the bound voice daemon.
Copies persona text into current_persona.txt and, if present, copies a matching *_profile.json to current_persona_profile.json.
"""
import tkinter as tk
import subprocess
import sys
from pathlib import Path

PERSONA_DIR = Path("plugins/personas")


def discover_personas():
    mapping: dict[str, Path] = {}
    if PERSONA_DIR.exists():
        for p in sorted(PERSONA_DIR.glob("*.txt")):
            mapping[p.stem] = p
    # Fallback: legacy root files
    for legacy in (Path("Wednesday.txt"), Path("Mira.txt")):
        if legacy.exists():
            mapping.setdefault(legacy.stem, legacy)
    return mapping


PERSONAS = discover_personas()


def launch_daemon(name: str):
    persona_file = PERSONAS.get(name)
    if not persona_file or not persona_file.exists():
        print(f"[ERROR] Persona file missing: {persona_file}")
        return

    # Copy persona text
    try:
        Path("current_persona.txt").write_text(persona_file.read_text(encoding="utf-8"), encoding="utf-8")
        # Copy optional profile json (case-insensitive filename)
        candidates = [
            persona_file.with_name(f"{persona_file.stem}_profile.json"),
            persona_file.with_name(f"{persona_file.stem.lower()}_profile.json"),
        ]
        for profile in candidates:
            if profile.exists():
                Path("current_persona_profile.json").write_text(profile.read_text(encoding="utf-8"), encoding="utf-8")
                break
        print(f"🌏 {name} selected. Persona loaded.")
    except Exception as e:
        print(f"[ERROR] Failed to load persona '{name}': {e}")
        return

    # Launch the daemon shell
    try:
        subprocess.Popen([sys.executable, "veil_daemon_chat_bound.py"])
    except Exception as e:
        print(f"[ERROR] Failed to launch daemon shell: {e}")
        return

    root.destroy()


root = tk.Tk()
root.title("🌏 Choose Your Daemon")
root.geometry("360x240")
root.configure(bg="black")

title = tk.Label(root, text="Choose your daemon:", font=("Consolas", 15), bg="black", fg="white")
itle.pack(pady=16)

if not PERSONAS:
    tk.Label(root, text="No personas found in plugins/personas", font=("Consolas", 12), bg="black", fg="tomato").pack(pady=10)
else:
    for name in PERSONAS:
        tk.Button(
            root,
            text=name,
            font=("Consolas", 14),
            bg="#1a1a1a",
            fg=("cyan" if name.lower()=="wednesday" else "hot pink"),
            width=22,
            command=lambda n=name: launch_daemon(n),
        ).pack(pady=6)

root.mainloop()
