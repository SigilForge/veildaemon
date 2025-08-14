import os, sys, importlib, time
import pytest
from pathlib import Path

# Ensure PYTHONPATH includes the pack (VS Code .env.dev handles this; fallback hints below)
PACK_HINTS = [
    Path(__file__).resolve().parents[2] / "streamdaemon-pack",
    Path(__file__).resolve().parents[1] / "streamdaemon",
    Path(__file__).resolve().parents[2] / "StreamDaemon",
    Path(__file__).resolve().parents[1] / "StreamDaemon",
]
for p in PACK_HINTS:
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

import asyncio
import inspect
from veildaemon.apps.bus.event_bus import EventBus
from veildaemon.apps.stage.stage_director import StageDirector


def _import_pack():
    errors = []
    for name in ("streamdaemon.plugins", "StreamDaemon.plugins", "plugins"):
        try:
            return importlib.import_module(name)
        except Exception as e:
            errors.append(f"{name}: {e}")
    pytest.skip("StreamDaemon pack not found or no plugins module (" + "; ".join(errors) + ")")


def test_pack_register_and_wire():
    pack = _import_pack()
    assert hasattr(pack, "register"), "streamdaemon.plugins must define register(app)"

    class App:  # minimal app surface
        bus = EventBus()
        stage = StageDirector(bus)

    app = App()

    # Register with flexible signature support (some packs require extra args)
    reg = getattr(pack, "register")
    sig = inspect.signature(reg)
    kwargs = {}
    for name, param in list(sig.parameters.items())[1:]:  # skip first 'app'
        if param.default is inspect._empty:
            if name in ("bus", "event_bus"):
                kwargs[name] = app.bus
            elif name in ("stage", "stage_director"):
                kwargs[name] = app.stage
            elif name in ("quip_bank", "span_map", "config", "settings", "personas", "scenes"):
                kwargs[name] = {}
            else:
                kwargs[name] = None
    hooks = reg(app, **kwargs)  # type: ignore
    # Normalize shapes from legacy packs
    if "watchers" not in hooks:
        hooks["watchers"] = []
    # Some packs return lists for scenes/personas/banks; accept dict or list
    scenes = hooks.get("scenes", {})
    personas = hooks.get("personas", {})
    banks = hooks.get("banks", {})
    assert isinstance(hooks["watchers"], list) and all(callable(w) for w in hooks["watchers"])
    assert isinstance(scenes, (dict, list))
    assert isinstance(personas, (dict, list))
    assert isinstance(banks, (dict, list))
    assert isinstance(hooks, dict), "register() must return a dict"
    watchers = hooks.get("watchers", [])
    assert isinstance(watchers, list), "hooks['watchers'] must be a list"
    for w in watchers:
        assert callable(w), "each watcher must be callable"
        if inspect.iscoroutinefunction(w):
            asyncio.run(w(app.bus))
        else:
            res = w(app.bus)
            if inspect.iscoroutine(res):
                asyncio.run(res)

    # heartbeat event shouldn't crash director
    asyncio.run(app.bus.publish("beats", {"type": "raid", "value": 1, "ts": time.monotonic()}))
