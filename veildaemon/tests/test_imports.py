"""Minimal import surface smoke test for public modules & entrypoints."""

import importlib

PUBLIC_MODS = [
    "veildaemon",
    "veildaemon.event_bus",
    "veildaemon.stage_director",
    "veildaemon.tts",
    "veildaemon.apps.orchestrator.shell",
    "veildaemon.apps.orchestrator.chat_bound",
    "veildaemon.apps.stage",
    "veildaemon.apps.safety",
]


def test_public_imports():
    for m in PUBLIC_MODS:
        importlib.import_module(m)
