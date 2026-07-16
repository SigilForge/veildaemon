# RELAYDAEMON GOVERNING CONTRACT

Before editing RelayDaemon:

1. Read this file, `references/relay-architecture.md`, and `tests/fixtures/relay/ca-001.json`.
2. Invoke `$relay-reliability` and create or update `.codex/state/relay-incident.json`.
3. State the canonical reproduction, expected result, responsible layer, current hypothesis, falsifying evidence, and allowed file paths.
4. Change only the responsible layer unless the ledger explains why another layer is inseparable.
5. Run the exact reproduction after the change.
6. Do not commit, push, deploy, or claim completion until `npm run relay:acceptance` passes during the current task.
7. Report the acceptance artifact path, timestamp, retry count, first-attempt failures, and worst-case model-call count.

## Governing architecture

```text
Private Vercel review UI
├── local loopback bridge -> Ollama (default)
└── authenticated hosted API -> OpenAI (availability fallback)
```

- GitHub Pages does not serve RelayDaemon.
- The browser reaches Ollama only through the local bridge at `http://127.0.0.1:4174`; it does not call Ollama's `11434` API directly.
- The local bridge is optional private infrastructure, not a dependency of the public VeilDaemon surface.
- Human approval remains separate from generation and publication. Generation never authorizes publication.
- Preserve this architecture until the user explicitly changes it. If a requested change conflicts with security, deployment constraints, or established best practice, explain the conflict and clarify before implementing.

## Sources of truth
- UI: `studio/relay/index.html`, `studio/relay/relay.css`, `studio/relay/relay.js`
- Hosted character API: `api/character.js`
- Hosted scanner API: `api/scan-code.js`
- Local Ollama bridge: `scripts/relay-local-bridge.mjs`
- Acceptance fixture: `tests/fixtures/relay/ca-001.json`
- Acceptance runner: `scripts/run-relay-acceptance.mjs`
- Vercel template: `deploy/relay-vercel/vercel.json`
- Prepare script: `scripts/prepare-relay-vercel.sh`
- Detailed architecture: `references/relay-architecture.md`

## Generation invariants
- Character-platform outputs must be rewritten to fit. Never mechanically clip a draft, append punctuation to a cutoff, or treat a sentence boundary as proof of semantic completeness.
- Warm-up must be load-only. Track success-path and worst-case inference-call counts explicitly.
- Do not add retries, disable thinking, or add semantic re-review calls solely to mask insufficient context, output tokens, or time.
- Prompt examples must be valid if copied. Do not include placeholder values such as `"..."`.
- Log structural diagnostics without private draft content: failure class, attempt number, field, measured length, finish reason, and whether content or thinking was empty.
- Test local and hosted paths separately. Hosted fallback does not prove the local default works.

## Acceptance and completion
- `npm run relay:acceptance` must run the unchanged CA-001 fixture five times against the direct engine and five times through the actual local UI path.
- The command must reject malformed output, known fragment endings, missing central ownership/trust claims, weak character validation, wrong engine labels, stale deployment contracts, and unreported model-call limits.
- A fresh successful artifact must exist at `artifacts/relay-acceptance/latest.json` and match the current Relay-relevant file fingerprint.
- Passing mocks, isolated endpoints, service restarts, HTTP 200 responses, or successful deployments are only subsystem evidence.
- `fixed`, `working`, `live`, `shipped`, and `done` are prohibited until the exact reproduction passes and the artifact is current.

## Shipping
1. Edit source files only; `_relay-vercel/` is generated.
2. Bump Relay CSS/JS/vendor cache query strings in `studio/relay/index.html` when those assets change.
3. Run acceptance before asking to ship.
4. Shipping requires separate user approval, then:
   ```bash
   npm run relay:vercel:prepare
   cd _relay-vercel
   vercel link --yes --project veildaemon-relay --scope knoxmortis-projects
   vercel deploy --prod --yes
   ```
5. Confirm `knoxmortis-projects/veildaemon-relay` and the `https://relay.veildaemon.app` alias. Reject directory-named projects such as `_relay-vercel`.
