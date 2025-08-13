import unicodedata as ud
try:
    import regex as re  # type: ignore
except Exception:  # pragma: no cover - fallback when 'regex' not installed
    import re  # type: ignore

ZW = r"[\u200b\u200c\u200d\u2060]"  # ZWJ, ZWNJ, etc.
CONFUSABLES = str.maketrans({"0": "o", "1": "i", "3": "e", "$": "s", "@": "a"})


def normalize(s: str) -> str:
    s = ud.normalize("NFKC", s or "")
    s = re.sub(ZW, "", s)
    s = s.translate(CONFUSABLES)
    s = re.sub(r"\p{P}+", " ", s.lower())
    s = re.sub(r"\s+", " ", s).strip()
    return s
