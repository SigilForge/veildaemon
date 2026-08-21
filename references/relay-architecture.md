# RelayDaemon architecture contract

```text
Private Vercel review UI
├── http://127.0.0.1:4174/api/character -> local bridge -> Ollama (default, desktop)
├── /api/relay-remote/* -> authenticated outbound poll queue -> paired home VeilDaemon
│     └── VeilForge remote_turn (forced remote profile) or local Ollama
└── /api/character -> authenticated hosted API -> OpenAI (availability fallback)
```

GitHub Pages does not serve RelayDaemon. `_relay-vercel` is generated and must link to `knoxmortis-projects/veildaemon-relay`; production is `https://relay.veildaemon.app`.

The home daemon initiates the remote relationship. Hosted RelayDaemon never opens a public path to Ollama, VeilForge, or port 4174. Pairing uses a shared operator secret and a revocable device token. Pending remote requests use cryptographically strong IDs, a 240-second TTL, a queue depth of 4, replay nonces, and fail closed on missing credentials. Prompt text is dropped after completion and is not logged.

Cross-repo dependency: local fulfillment prefers VeilForge PR #23 `remote_turn` when `VEILFORGE_SOCKET` and `VEILFORGE_REMOTE_SESSION_ID` are set. The adapter never sends `profile_name`; Forge forces `remote`. If that contract is unmerged or unconfigured, the local bridge fulfills with the existing Ollama character path.

Generation, review, approval, and publication are distinct. Warm-up is load-only. The browser can make two package attempts and the bridge has three bounded Ollama attempts, so one UI generation has a declared six-inference worst case. The remote path is one correlated request; local fulfillment uses those same three Ollama attempts or one Forge `remote_turn`. Hosted OpenAI remains a fallback when the home daemon is offline or times out, not an extra local retry.

CA-001's central thought is that revocable licenses and disappearing physical media sacrifice ownership and control to legal resource extraction, eroding long-term trust. Every short copy must resolve that whole thought in character; punctuation is not completeness.
