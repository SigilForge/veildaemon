---
name: relay-reliability
description: Diagnose or change RelayDaemon generation, local Ollama, hosted fallback, review UI, deployment, or publication behavior while preserving its architecture and enforcing the CA-001 acceptance gate. Use for Relay defects, retries, model changes, truncation, malformed structured output, engine routing, or shipping claims.
---

# Relay Reliability

Keep one defect, one hypothesis, and one responsible layer at a time.

## Required workflow

1. Read `studio/relay/AGENTS.md`, `references/relay-architecture.md`, and `tests/fixtures/relay/ca-001.json`.
2. Create `.codex/state/relay-incident.json` from `.codex/state/relay-incident.example.json`. Record the exact reproduction, expected result, responsible layer, hypothesis, falsifier, and allowed paths before editing.
3. Reproduce before changing code. Record the observed failure without calling it a root cause.
4. Change only allowed paths. If evidence moves the defect to another layer, update the ledger first.
5. Run the exact reproduction, then `npm run relay:acceptance`.
6. Treat only a successful, current `artifacts/relay-acceptance/latest.json` as completion evidence. Report retries, first-attempt failures, and worst-case model calls.
7. Ask before commit, push, deploy, service changes, model pulls, or dependency installation.

After three failed edit-test cycles, compaction, ten patches, or twenty-five tool calls, stop editing and rewrite the ledger from fresh evidence.

## Non-negotiable checks

- A platform draft must contain the whole central thought, not merely end with punctuation.
- Never clip a model draft or replace a cutoff with punctuation.
- Test local direct-engine and actual browser paths independently. Hosted success is not local success.
- Warm-up loads the model only. Count successful and worst-case inference calls.
- Do not add retries or review calls until context size, output budget, timeout, finish reason, and malformed fields are measured.
- Publication always remains a separate human action.

Read [references/architecture.md](references/architecture.md) for layer ownership and [references/acceptance-rubric.md](references/acceptance-rubric.md) before changing the runner.

