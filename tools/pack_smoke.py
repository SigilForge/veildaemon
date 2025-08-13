import importlib, json


def try_import(name: str):
    try:
        importlib.import_module(name)
        return {"name": name, "ok": True}
    except Exception as e:
        return {"name": name, "ok": False, "err": f"{type(e).__name__}: {e}"}


checks = [
    "streamdaemon.streamdaemon_twitch",
    "streamdaemon.watchers",
    "streamdaemon.plugins",
]

if __name__ == "__main__":
    print(json.dumps([try_import(c) for c in checks], indent=2))
