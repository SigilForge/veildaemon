def test_smoke_imports():
    import importlib

    for mod in [
        "veildaemon.event_bus",
        "veildaemon.stage_director",
        "veildaemon.safety",
        "veildaemon.tts",
        "veildaemon.hrm",
        "veildaemon.persona",
        "veildaemon.scenes",
    ]:
        importlib.import_module(mod)
