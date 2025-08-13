# Security and Secrets Handling

- Secrets are stored locally in secrets.json.enc encrypted with Fernet.
- The encryption key is glyphkey.key (auto-generated); both are git-ignored.
- Code reads secrets via secrets_store.get_secret(...).

## Setup

- Set secrets locally (examples):
  - python secrets_store.py set openai.api.key sk-...
  - python secrets_store.py set twitch.token oauth:...
  - python secrets_store.py set google.oauth.client_config { ...client JSON... }
- Verify without printing values:
  - python secrets_check.py

## Do

- Keep client_secret.json local only, then import with migrate_secrets.py.
- Rotate keys if they were ever exposed.

## Don’t

- Don’t commit glyphkey.key, secrets.json.enc, or plaintext keys.
