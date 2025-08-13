"""Packs integration under package namespace."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from .pack_loader import Pack, load_all_packs, require_token

try:
    from StreamDaemon.license_gate import paid_unlocked  # when imported from repo root
except Exception:
    try:
        # Try to import relative to StreamDaemon folder
        sd = Path(__file__).resolve().parents[3] / "StreamDaemon"
        if sd.exists() and str(sd) not in sys.path:
            sys.path.append(str(sd))
        from license_gate import paid_unlocked  # type: ignore
    except Exception:

        def paid_unlocked(purpose: str = "streaming") -> bool:  # type: ignore
            return False


def _select_by_type(packs: list[Pack], typ: str, prefer_id: Optional[str]) -> Optional[Pack]:
    cand = [p for p in packs if p.type == typ]
    if not cand:
        return None
    if prefer_id:
        for p in cand:
            if p.pack_id == prefer_id:
                return p
    return cand[0]


def select_packs(
    config_path: str = "StreamDaemon/veil.config",
) -> tuple[Optional[Pack], Optional[Pack], Optional[Pack]]:
    packs = load_all_packs()
    import configparser

    cfg = configparser.ConfigParser()
    try:
        cfg.read(config_path)
    except Exception:
        pass
    pref_persona = cfg.get("packs", "persona", fallback="") or None
    pref_logic = cfg.get("packs", "logic", fallback="") or None
    pref_ar = cfg.get("packs", "ar", fallback="") or None
    persona = _select_by_type(packs, "persona", pref_persona)
    logic = _select_by_type(packs, "logic", pref_logic)
    ar = _select_by_type(packs, "ar", pref_ar)
    return persona, logic, ar


def build_persona_from_pack(p: Pack) -> Dict[str, Any]:
    c = p.content or {}
    # Map pack fields to persona dict used by persona_injector
    return {
        "codename": c.get("name", p.name),
        "tone": c.get("tone", "mythpunk"),
        "quirks": [c.get("speech_style", "")] if c.get("speech_style") else [],
        "showcase_lines": c.get("showcase_lines", ["I am present."]),
        "interrupt_ack": c.get("interrupt_ack", ["Interrupt honored. We slow down now."]),
    }


def apply_logic_pack(engine: Any, p: Pack) -> None:
    c = p.content or {}
    actions = c.get("actions") or []
    # Register simple actions: ritual, glyph, voice_prompt
    for idx, act in enumerate(actions):
        ritual = (act or {}).get("ritual")
        glyph = (act or {}).get("glyph")
        vline = (act or {}).get("voice_prompt")
        if not any([ritual, glyph, vline]):
            continue

        def _make_action(text=vline, gly=glyph):
            def _fn(ctx):
                out = []
                if gly:
                    try:
                        out.append({"type": "glyph", "value": gly})
                    except Exception:
                        pass
                if text:
                    out.append(text)
                return out

            return _fn

        try:
            name = f"pack_{p.pack_id}_{idx}"
            engine.hrm.add_custom_action(name, _make_action())
        except Exception:
            pass


def resolve_ar_model_url(ar_pack: Optional[Pack]) -> Optional[str]:
    if not ar_pack:
        return None
    token_ok = paid_unlocked("ar")
    if not require_token(ar_pack, token_ok):
        return None
    c = ar_pack.content or {}
    models = (c.get("assets") or {}).get("models") or []
    if not models:
        return None
    m = os.path.basename(str(models[0]))
    return f"/assets/{m}"
