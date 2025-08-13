from enum import Enum, auto
from typing import Any, Dict, List


class Flag(Enum):
    SLUR = auto()
    SEXUAL = auto()
    HATE = auto()
    TRAP = auto()
    SELF_HARM = auto()


def sanitize_span(text: str, spans: List[Any]) -> str:
    """Redact flagged substrings; keep rhythm. Expects spans with .start/.end or dicts {'start','end'}."""
    if not text or not spans:
        return text
    # Normalize spans and avoid overlaps
    norm: List[Dict[str, int]] = []
    for s in spans:
        try:
            start = int(getattr(s, "start", s.get("start")))  # type: ignore[attr-defined]
            end = int(getattr(s, "end", s.get("end")))  # type: ignore[attr-defined]
            if 0 <= start < end <= len(text):
                norm.append({"start": start, "end": end})
        except Exception:
            continue
    norm.sort(key=lambda x: x["start"])
    out = []
    last = 0
    for s in norm:
        if s["start"] > last:
            out.append(text[last : s["start"]])
        out.append("[beep]")
        last = s["end"]
    if last < len(text):
        out.append(text[last:])
    return "".join(out)


def rewrite_safe(text: str, flags: Dict[str, Any], pick_quip) -> Dict[str, Any]:
    """Attempt a light salvage of unsafe text before falling back to a quip.

    Returns a dict: { 'text': str, 'mode': 'salvaged'|'quip'|'clean' }
    """
    try:
        fset = set(flags.get("flags") or [])
    except Exception:
        fset = set()
    if Flag.SELF_HARM in fset:
        return {"text": "nope, not touching that. drink water.", "mode": "quip"}
    spans = flags.get("spans") or []
    # Light rewrite first
    if spans:
        rewritten = sanitize_span(text, spans)
        if rewritten and rewritten.strip() and rewritten != text and len(rewritten.split()) >= 3:
            return {"text": rewritten, "mode": "salvaged"}
    # Fallback to quip bank
    quip = pick_quip(scene=flags.get("scene") or "Gaming", tone="deflect")
    return {"text": quip or "Not that one.", "mode": "quip"}
