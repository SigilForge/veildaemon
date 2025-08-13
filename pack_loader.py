"""VeilDaemon Pack Loader

Loads and validates Logic/Persona/AR packs from the packs/ folder.
- Validates required fields and types
- Enforces AR token gating
- Provides a simple API to query loaded packs
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import json
try:
    import yaml  # type: ignore
except Exception as e:
    yaml = None  # type: ignore

PACKS_DIR = Path(__file__).parent / "packs"
PERSONA_DIR = Path(__file__).parent / "plugins" / "personas"

REQUIRED_FIELDS = ["pack_id", "name", "type", "version", "author", "description"]
ALLOWED_TYPES = {"logic", "persona", "ar"}

@dataclass
class Pack:
    pack_id: str
    name: str
    type: str
    version: str | float
    author: str
    description: str
    requires_token: bool = False
    token_scope: Optional[str] = None
    content: Dict[str, Any] | None = None  # raw YAML content


def _validate_base(doc: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errs: List[str] = []
    for f in REQUIRED_FIELDS:
        if f not in doc:
            errs.append(f"Missing required field: {f}")
    if "type" in doc and doc["type"] not in ALLOWED_TYPES:
        errs.append(f"Invalid type: {doc.get('type')} (must be one of {sorted(ALLOWED_TYPES)})")
    if doc.get("type") == "ar":
        if not doc.get("requires_token", False):
            errs.append("AR packs must set requires_token: true")
    return (len(errs) == 0, errs)


def load_pack_file(path: Path) -> Pack:
    if yaml is None:
        raise RuntimeError("PyYAML not installed. Please install pyyaml to load packs.")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    ok, errs = _validate_base(data)
    if not ok:
        raise ValueError(f"Invalid pack '{path.name}':\n - " + "\n - ".join(errs))

    pack = Pack(
        pack_id=str(data["pack_id"]),
        name=str(data["name"]),
        type=str(data["type"]),
        version=data["version"],
        author=str(data["author"]),
        description=str(data["description"]),
        requires_token=bool(data.get("requires_token", False)),
        token_scope=data.get("token_scope"),
        content=data,
    )
    return pack


def load_all_packs() -> List[Pack]:
    packs: List[Pack] = []
    if not PACKS_DIR.exists():
        return packs
    for p in sorted(PACKS_DIR.glob("*.yaml")):
        try:
            packs.append(load_pack_file(p))
        except Exception as e:
            print(f"⚠️ Skipping pack {p.name}: {e}")
    return packs


def list_persona_files() -> List[Path]:
    """Discover persona text files in plugins/personas for selector UIs."""
    if not PERSONA_DIR.exists():
        return []
    return sorted(PERSONA_DIR.glob("*.txt"))


def list_persona_profiles() -> Dict[str, Path]:
    """Map persona name -> profile.json path if present in plugins/personas."""
    profiles: Dict[str, Path] = {}
    if PERSONA_DIR.exists():
        for p in PERSONA_DIR.glob("*_profile.json"):
            name = p.name.replace("_profile.json", "")
            profiles[name] = p
    return profiles


def require_token(pack: Pack, token_ok: bool) -> bool:
    """Return True if access is allowed given the token state."""
    if not pack.requires_token:
        return True
    return token_ok


# CLI for quick validate/debug
if __name__ == "__main__":
    found = load_all_packs()
    print(f"Loaded {len(found)} packs from {PACKS_DIR}")
    for p in found:
        gated = " (token-gated)" if p.requires_token else ""
        print(f"- {p.pack_id} [{p.type}] v{p.version}{gated}")
