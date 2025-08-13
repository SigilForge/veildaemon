import importlib as I

mods = [
  "veildaemon.apps.bus.event_bus",
  "veildaemon.apps.stage.stage_director",
  "veildaemon.apps.stage.stream_convo_engine",
  "veildaemon.apps.safety.normalize",
  "veildaemon.apps.safety.rewrite",
  "veildaemon.apps.safety.quip_bank",
  "veildaemon.apps.safety.span_map",
  "veildaemon.tts.manager",
]

ok = True
for m in mods:
    try:
        I.import_module(m)
        print("[OK]", m)
    except Exception as e:
        ok = False
        print("[FAIL]", m, "->", e)
print("RESULT:", "PASS" if ok else "FAIL")
