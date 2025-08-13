"""Smarter sanitizer for documentation whitespace hygiene.

Usage (PowerShell):
  python tools/strip_tabs.py README.md

Behavior:
    * Removes raw tab, NBSP, ZWSP, stray BOM-in-text everywhere (including code fences).
    * Normalizes line endings to LF.
    * Trims trailing whitespace.
    * Reports remaining taboo characters (should be none).
"""
from __future__ import annotations
import sys, re, codecs, io
from pathlib import Path

TABOO_MAP = {"\t": "  ", "\u00A0": " ", "\u200B": "", "\uFEFF": ""}

def cleanse_text(s: str) -> str:
    # Normalize newlines
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    out: list[str] = []
    for line in s.splitlines(True):
        for k, v in TABOO_MAP.items():
            line = line.replace(k, v)
        line = re.sub(r"[ \t]+$", "", line)
        out.append(line)
    return "".join(out)

def process_file(path: Path) -> int:
    raw = path.read_bytes()
    if raw.startswith(codecs.BOM_UTF8):
        raw = raw[len(codecs.BOM_UTF8):]
    text = raw.decode('utf-8', 'replace')
    cleaned = cleanse_text(text)
    if cleaned != text:
        path.write_text(cleaned, encoding='utf-8', newline='\n')
    # Report taboo chars still present
    bad_lines = []
    for i, ln in enumerate(cleaned.splitlines(), 1):
        if any(ch in ln for ch in ("\t", "\u00A0", "\u200B", "\uFEFF")):
            bad_lines.append(i)
    if bad_lines:
        print(f"Remaining taboo chars in {path}: lines {bad_lines}")
    return 1 if bad_lines else 0

def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python tools/strip_tabs.py <files/globs>")
        return 2
    total_bad = 0
    for pattern in argv[1:]:
        matched = list(Path().glob(pattern))
        if not matched:
            print(f"No match for pattern: {pattern}")
        for p in matched:
            if p.is_file():
                total_bad += process_file(p)
    if total_bad == 0:
        print("All clean.")
    else:
        print(f"Taboo characters remain in {total_bad} file(s).")
    return 0

if __name__ == '__main__':  # pragma: no cover
    raise SystemExit(main(sys.argv))
