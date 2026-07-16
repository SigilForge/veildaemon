# Relay layer ownership

- `studio/relay/relay.js`: browser workflow, local-first routing, deterministic platform assembly, visible engine state.
- `scripts/relay-local-bridge.mjs`: loopback-only Ollama transport, schema validation, bounded model attempts.
- `api/character.js`: authenticated hosted OpenAI availability fallback.
- `deploy/relay-vercel/`: private Vercel review deployment contract.
- `scripts/run-relay-acceptance.mjs`: evidence gate; it must not repair generated text.

The browser must not call Ollama on port 11434 directly. GitHub Pages does not host Relay. A successful generation never grants publication authority.

