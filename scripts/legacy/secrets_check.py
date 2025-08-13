from __future__ import annotations

import json
from secrets_store import get_secret, load_all


def mask(s: str) -> str:
    if not s:
        return "(missing)"
    if len(s) <= 6:
        return "*" * len(s)
    return s[:3] + "*" * (len(s) - 6) + s[-3:]


def main():
    print("Checking encrypted secrets availability (no values will be printed)...\n")

    openai_key = get_secret("openai.api.key")
    print(f"OPENAI: {'OK' if openai_key else 'MISSING'}  -> {mask(openai_key or '')}")

    twitch_token = get_secret("twitch.token")
    print(f"TWITCH TOKEN: {'OK' if twitch_token else 'MISSING'}  -> {mask(twitch_token or '')}")

    gcfg = get_secret("google.oauth.client_config")
    try:
        if isinstance(gcfg, str):
            json.loads(gcfg)  # validate it's JSON-ish
        elif gcfg is not None:
            json.dumps(gcfg)
        g_ok = gcfg is not None
    except Exception:
        g_ok = False
    print(f"GOOGLE OAUTH CLIENT CONFIG: {'OK' if g_ok else 'MISSING/INVALID'}")

    # Optional: show keys present at top level
    all_data = load_all()
    print("\nPresent secret namespaces:", ", ".join(sorted(all_data.keys())) or "(none)")


if __name__ == "__main__":
    main()
