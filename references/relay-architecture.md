# RelayDaemon architecture contract

```text
Private Vercel review UI
├── VeilLink operator identity (Knoxmortis only) sits above hosted engine selection
├── http://127.0.0.1:4174/api/character -> local bridge -> Ollama (default, desktop)
├── /api/relay-remote/* -> authenticated outbound poll queue -> paired home VeilDaemon
│     └── VeilForge remote_turn (forced remote profile) or local Ollama
└── /api/character -> authenticated hosted API -> OpenAI (availability fallback)
```

GitHub Pages does not serve RelayDaemon. `_relay-vercel` is generated and must link to `knoxmortis-projects/veildaemon-relay`; production is `https://relay.veildaemon.app`.

The hosted page may stay publicly loadable. Pressing Generate, probing remote status, enqueueing a job, reading a result, or calling hosted OpenAI requires a VeilLink JWT for the Knoxmortis allowlist **before** any engine is chosen. Invariant: no authorized operator identity → no inference spend, local or cloud. Same-origin `x-relay-request` remains CSRF protection, not login. Device poll/complete/heartbeat/pair/revoke stay on pairing-secret and device-token credentials because the home daemon is not a browser. Desktop `npm run relay:local` stays ungated.

The home daemon initiates the remote relationship. Hosted RelayDaemon never opens a public path to Ollama, VeilForge, or port 4174. Pairing uses a shared operator secret and a revocable device token. Pending remote requests use cryptographically strong IDs, a 240-second TTL, a queue depth of 4, replay nonces, and fail closed on missing credentials. Prompt text is dropped after completion and is not logged.

Cross-repo dependency: local fulfillment prefers VeilForge PR #23 `remote_turn` when `VEILFORGE_SOCKET` and `VEILFORGE_REMOTE_SESSION_ID` are set. The adapter never sends `profile_name`; Forge forces `remote`. If that contract is unmerged or unconfigured, the local bridge fulfills with the existing Ollama character path.

Generation, review, approval, and publication are distinct. Warm-up is load-only. Hosted warm-up waits until the operator is admitted. The browser can make two package attempts and the bridge has three bounded Ollama attempts, so one UI generation has a declared six-inference worst case. The remote path is one correlated request; local fulfillment uses those same three Ollama attempts or one Forge `remote_turn`. Hosted OpenAI remains a fallback when the home daemon is offline or times out, not an extra local retry. Unauthenticated hosted Generate is not an inference attempt.

CA-001's central thought is that revocable licenses and disappearing physical media sacrifice ownership and control to legal resource extraction, eroding long-term trust. Every short copy must resolve that whole thought in character; punctuation is not completeness.
