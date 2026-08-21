# Relay layer ownership

- `studio/relay/relay.js`: browser workflow, local-first routing, remote transport probe/submit/result, deterministic platform assembly, visible engine state.
- `scripts/relay-local-bridge.mjs`: loopback-only Ollama transport, schema validation, bounded model attempts, outbound remote worker.
- `api/character.js`: authenticated hosted OpenAI availability fallback.
- `api/relay-remote/[action].js` + `lib/relayRemoteTransport.js`: pairing, revocable device tokens, bounded poll queue, request/result correlation.
- `lib/veilforgeRemoteTurn.js`: isolated VeilForge PR #23 adapter. Never chooses a profile.
- `deploy/relay-vercel/`: private Vercel review deployment contract.
- `scripts/run-relay-acceptance.mjs`: evidence gate; it must not repair generated text.

The browser must not call Ollama on port 11434 directly. GitHub Pages does not host Relay. A successful generation never grants publication authority. Remote browsers talk only to hosted RelayDaemon; the home daemon initiates the outbound poll.
