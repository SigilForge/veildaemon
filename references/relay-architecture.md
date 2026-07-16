# RelayDaemon architecture contract

```text
Private Vercel review UI
├── http://127.0.0.1:4174/api/character -> local bridge -> Ollama (default)
└── /api/character -> authenticated hosted API -> OpenAI (availability fallback)
```

GitHub Pages does not serve RelayDaemon. `_relay-vercel` is generated and must link to `knoxmortis-projects/veildaemon-relay`; production is `https://relay.veildaemon.app`.

Generation, review, approval, and publication are distinct. Warm-up is load-only. The browser can make two package attempts and the bridge has three bounded Ollama attempts, so one UI generation has a declared six-inference worst case.

CA-001's central thought is that revocable licenses and disappearing physical media sacrifice ownership and control to legal resource extraction, eroding long-term trust. Every short copy must resolve that whole thought in character; punctuation is not completeness.

