
import tkinter as tk
from pathlib import Path
import subprocess

PERSONA_DIR = Path("plugins/personas")

def discover_personas():
    mapping = {}
    if PERSONA_DIR.exists():
        for p in sorted(PERSONA_DIR.glob("*.txt")):
            mapping[p.stem] = p
    # Fallback to legacy files if present
    for legacy in (Path("Wednesday.txt"), Path("Mira.txt")):
        if legacy.exists():
            mapping.setdefault(legacy.stem, legacy)
    return mapping

PERSONAS = discover_personas()


def launch_daemon(persona_name):
    persona_file = Path(PERSONAS[persona_name])
    active_path = Path("current_persona.txt")
    if persona_file.exists():
        active_path.write_text(persona_file.read_text(encoding="utf-8"), encoding="utf-8")
        # Optional: copy profile JSON if present (case-insensitive)
        for profile in [
            persona_file.with_name(f"{persona_file.stem}_profile.json"),
            persona_file.with_name(f"{persona_file.stem.lower()}_profile.json"),
        ]:
            if profile.exists():
                Path("current_persona_profile.json").write_text(profile.read_text(encoding="utf-8"), encoding="utf-8")
                break
        print(f"🌏 {persona_name} selected. Persona loaded.")
        subprocess.Popen(["python", "veil_daemon_chat_bound.py"])
        return
    else:
        print(f"[Error] Persona file {persona_file} not found.")
        return


# GUI Setup
root = tk.Tk()
root.title("🌏 VeilDaemon Persona Selector")
root.geometry("300x150")
root.configure(bg='black')

tk.Label(root, text="Choose your daemon:", font=(
    "Consolas", 14), fg="white", bg="black").pack(pady=10)

if not PERSONAS:
    tk.Label(root, text="No personas found in plugins/personas",
             font=("Consolas", 11), fg="tomato", bg="black").pack(pady=10)
else:
    for persona in PERSONAS:
        tk.Button(root, text=persona, width=20, font=("Consolas", 12),
                  command=lambda p=persona: launch_daemon(p)).pack(pady=5)

root.mainloop()
