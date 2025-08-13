import os
import sys
import json
import urllib.request
import urllib.parse

from secrets_store import get_secret, set_secret

TOKEN_URL = "https://id.twitch.tv/oauth2/token"


def exchange_refresh_for_access(client_id: str, client_secret: str, refresh_token: str) -> dict:
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(TOKEN_URL, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    client_id = get_secret("twitch.client.id") or os.getenv("TWITCH_CLIENT_ID")
    client_secret = get_secret("twitch.client.secret") or os.getenv("TWITCH_CLIENT_SECRET")
    refresh_token = get_secret("twitch.refresh.token") or os.getenv("TWITCH_REFRESH_TOKEN")
    if not (client_id and client_secret and refresh_token):
        print("Missing twitch.client.id/client.secret/refresh.token")
        sys.exit(2)
    try:
        tokens = exchange_refresh_for_access(client_id, client_secret, refresh_token)
    except Exception as e:
        print(f"Exchange failed: {e}")
        sys.exit(3)
    access = tokens.get("access_token")
    new_refresh = tokens.get("refresh_token") or refresh_token
    if access:
        set_secret("twitch.access.token", f"oauth:{access}")
        set_secret("twitch.refresh.token", new_refresh)
        print("Updated twitch.access.token and twitch.refresh.token ✓")
    else:
        print("No access_token in response")
        sys.exit(4)


if __name__ == "__main__":
    main()
