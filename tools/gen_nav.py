"""Generate NAV.md with a clickable tree of the veildaemon package."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PKG = ROOT / "veildaemon"
OUT = ROOT / "NAV.md"


def rel(path: Path) -> str:
	return path.relative_to(ROOT).as_posix()


def gather() -> list[str]:
	lines: list[str] = []
	for dirpath, dirnames, filenames in os.walk(PKG):
		p = Path(dirpath)
		# Skip caches
		dirnames[:] = [d for d in dirnames if d != "__pycache__" and not d.startswith('.')]
		indent = len(p.relative_to(PKG).parts)
		if p != PKG:
			lines.append(f"{'  ' * indent}- `{p.name}/`")
		for f in sorted(filenames):
			if f.endswith('.py'):
				fp = p / f
				depth = len(p.relative_to(PKG).parts) + (0 if p == PKG else 1)
				lines.append(f"{'  ' * depth}- [{f}]({rel(fp)})")
	return lines


def main() -> None:
	body = ["# Navigation", "", "Package file map (auto-generated).", "", "```",]
	body.extend(gather())
	body.append("```")
	OUT.write_text("\n".join(body), encoding="utf-8")
	print(f"Wrote {OUT}")


if __name__ == "__main__":
	main()
