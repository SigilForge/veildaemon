from typing import Any, List


def build_char_map(raw: str, normalized: str) -> List[int]:
    """Crude raw_idx -> norm_idx map by walking both strings.
    Keeps indexes monotonic; pads to len(raw).
    """
    m: List[int] = []
    i = j = 0
    Lr, Ln = len(raw), len(normalized)
    while i < Lr and j < Ln:
        m.append(j)
        i += 1
        j += 1
    while i < Lr:
        m.append(j)
        i += 1
    return m


def remap_spans(spans: List[Any], char_map: List[int]) -> List[Any]:
    out = []
    if not spans:
        return out
    n = len(char_map)
    for s in spans:
        try:
            s_start = int(getattr(s, "start", s.get("start")))  # type: ignore[attr-defined]
            s_end = int(getattr(s, "end", s.get("end")))  # type: ignore[attr-defined]
        except Exception:
            continue
        start_idx = char_map[min(max(0, s_start), n - 1)] if n else 0
        end_idx = char_map[min(max(0, s_end - 1), n - 1)] + 1 if n else 0
        out.append(type("S", (), {"start": start_idx, "end": end_idx})())
    return out
