# RELAYDAEMON GOVERNING CONTRACT

Before editing RelayDaemon:

1. Read this file and `tests/fixtures/relay/ca-001.json`.
2. Invoke `$relay-reliability` and create or update `.codex/state/relay-incident.json`.
3. State the canonical reproduction, expected result, responsible layer, current hypothesis, falsifying evidence, and allowed file paths.
4. Change only the responsible layer unless the ledger explains why another layer is inseparable.
5. Run the exact reproduction after the change.
6. Acceptance gates promotion, not version control. Feature-branch commits and a draft PR for review are allowed before acceptance; the PR must be marked **acceptance pending / do not merge**. Merge, deploy, release, or any promotion to `main` is forbidden until `npm run relay:acceptance` passes during the current task, and the passing artifact must be for the exact head being promoted (`gitHead` and file fingerprint in `artifacts/relay-acceptance/latest.json`). If review changes the code, rerun acceptance on the new head before merge or deploy. Never claim completion before that.
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
- Production host: `https://relay.veildaemon.app`
- Production Vercel project: `knoxmortis-projects/veildaemon-relay`
- Worst-case inference count: fifty-four-inference worst case (per bridge request: 3 writer + up to 2 editor cycles x (round 1: 1 combined edit + 1 verify; rounds 2-3: up to 4 per-lane edits + 1 verify each) = 3 + 2 x 12 = 27; the browser makes a second bridge request only when it rejects a successful master draft). Ordinary path: 1 writer + 1 edit + 1 verify = 3. `editor.cycles` in the artifact shows how often the recovery cycle is used; if it becomes routine, the editor contract needs work.

## Local engine
- Model: `hf.co/zerofata/MS3.2-PaintedFantasy-v4.1-24B-GGUF:Q5_K_M`, VeilForge's heavy prose/RP model (its `xlarge_model_id` slot) and the role match for character-voice generation. `hermes4:14b` is retired.
- Thinking is explicit (`RELAY_OLLAMA_THINKING`): `off` for PaintedFantasy, whose Ollama capabilities are `completion` and `tools` only (Ollama rejects a thinking request for it); `low`/`medium`/`high` only for a future model whose capabilities include `thinking`; `auto` (omit the field, take Ollama/model defaults) only when deliberately chosen. The bridge reads the model's capabilities at startup and refuses to start on a mismatch or a missing model. `off` here reflects the model's capability; it is not a way around the generation invariant below.
- Acceptance asserts the exact model tag and `thinking: "off"`. Changing the engine means changing those assertions deliberately and rerunning the unchanged CA-001 suite. Never substitute another installed model to make acceptance pass; install the intended one.
- The bridge runs as the user service `relaydaemon-local` (no model environment overrides in the unit).
- The bridge's static server is confined to `studio/` (resolved and realpath-checked; traversal, encoded traversal, and symlinks out of the tree are 404). Never widen it: the repo root holds local secrets such as `.env.stripe-test.local`.
- Editor: `qwen3.5:9b` (`RELAY_EDITOR_MODEL`), VeilForge's medium agent, called with `think: false` and a constant `num_ctx` of 8192 so it loads once. The bridge refuses to start if it is missing. Acceptance asserts it.
- Residency: `RELAY_OLLAMA_KEEP_ALIVE` (default `5m`) applies to both preload (`?warm=1`) and generation, so the model does not hold memory long after Relay is idle.
- Stage residency (`RELAY_MODEL_RESIDENCY`, default `release`), following VeilForge's heavy-role pattern: PaintedFantasy is released (best-effort `keep_alive: 0`) once its package is accepted, before the editor loads, and the editor is released when its stage ends. Relay's two heavy models never compete with each other or with a running VeilForge (whose lightweight router stays pinned) for VRAM. The cost is a cold writer load per request; `keep` restores both-resident behaviour when the GPU is Relay's alone.

## Platform policy
- `studio/relay/platform-policy.js` is the single source of truth for character-package limits. The bridge enforces it in structured-output validation and adds it as an authoritative prompt; the browser prompt's platform lines are generated from it; the hosted fallback takes X's limit from it. Never hardcode platform limits elsewhere.
- X is a long-form lane (X Premium, 25,000 characters; the first 280 show before "Show more"). Standing rule: cradlepoint-ttrpg `Marketing/Social/PUBLISHING_CONSTRAINTS.md`. X gets the full long copy when appropriate; there is no short-form X target.
- X is writer-owned: it must not be accidentally compressed relative to the master it performs (under `minMasterRatio` 0.6 of the master's length is a writer violation, retried through the writer's own ladder with the measured reason; never an editor job). The rule is relative, never an absolute platform floor: a short master may have a short X. CA-001's `longFormMinimums.x` (601) is that fixture's assertion only and must not become a platform minimum.
- Constrained lanes keep hashtag-buffered generation maxima: Threads 400, Bluesky 200, Mastodon 400.
- Constrained lanes also have hard floors as stub protection only (Threads 120, Bluesky 100, Mastodon 120), not fill targets. Filling toward the target is polish, not correctness.
- Never clip or truncate generated prose to fit.
- Writer -> editor -> ruler. The story model writes; the editor model reshapes without changing meaning; the runtime judges. No model is trusted to count characters or to grade its own work.
  - Writer (PaintedFantasy) owns the master draft, X, and voice. Structural or master-draft failures use its three-attempt ladder.
  - Platform lanes that fail the runtime's mechanical checks (over limit, too short, missing, unfinished ending, any ellipsis) go to the editor in one combined call per round, with a schema of only the failing lanes. The editor brief is: preserve required concepts; preserve actor/object relationships and causal claims exactly; invent no new actions, conclusions, or imperatives; aim for N-M words. The word range is a runtime steering heuristic (`words x editTarget / chars x 0.9`); the measured character count is the only authority.
  - Required concepts are two writer-declared groups, the two halves of the central thought: `whatChanges` and `whyItMatters`, each 1-3 short anchors. The runtime resolves each anchor once to a `groundedKey`: its head (last content word) when the master contains it, otherwise the nearest grounded content word ("trust erosion" -> trust); an anchor with no grounded word is rejected and logged by group, and a group left empty is a writer failure retried by the writer's ladder. A key that resolves in both groups is removed from both (the halves are disjoint; one word never satisfies both), and each group must keep at least one unique key. Every constrained lane must contain the `groundedKey` of at least one anchor from each group; the same key drives enforcement and retry reporting; a lane missing a group goes to the editor as `concept_dropped` with `missingGroups`, and the retry names the missing half and its anchors. No model call classifies concepts; never read from a fixture.
  - Punctuation is deterministic code, not an editor job: quoted elisions ("deprecated... Access") become periods and a pause between words becomes an em dash, word for word (only a trailing ellipsis remains, as an unfinished ending); a lane sent to the editor only for punctuation must keep its length within 15% (`edit_scope_exceeded`), so a long-form X is never compressed to fix three dots.
  - The final editor round steers to 70% of the normal word ceiling (the editor has returned up to 1.4x its requested words, and there is no later round). Hard limits and floors are unchanged; this is steering only.
  - Semantic gates only for concrete, grounded violations (actor/object/causal mutation, invented claims, a missing declared concept key). Do not ask a model to decide which of several legitimate themes is "the central one": a source can support more than one "why it matters", and no layer can pin it without an external definition. The 2026-09-26 change/impact halves verifier (per-candidate, then frozen master and source references) was built, measured, and removed for this reason; its harness lives only in `~/relay-diag-2026-09-26/`.
  - Character legality and meaning fidelity are separate gates. Lanes that pass mechanically go to a distinct verifier role (its own prompt and schema, temperature 0) that returns coded evidence only (`actor_changed`, `object_changed`, `causal_claim_changed`, `invented_action`, `invented_conclusion`, `new_imperative`, each with a quote), never a verdict. The runtime owns pass/fail: any coded difference fails the lane, and missing or malformed evidence fails closed. Admission is the runtime's: each quote must appear in the rewrite; a "changed" claim needs a source quote that appears in the master and structured `{subject, relation, object}` claims on both sides that differ in subject or object; an "invented" claim is judged clause by clause and dismissed when every clause is already in the master. Canonical case (regression-tested, synthetic source): a legal-length "quarantine yourself" where the source quarantines the host. Failed lanes are retried with the evidence.
  - Every editor round rewrites from the writer's draft, never from a failed edit; rejection reasons accumulate in the brief instead, so rounds do not oscillate. The editor proposes three candidates per failing lane in its one call (one for a punctuation-only fix); the runtime measures each, the verifier reports evidence on every ruler-legal candidate in its one call, and the runtime keeps the longest clean candidate.
  - Stage-local recovery (VeilForge: retry at the stage that failed, never restart successful cognition): if the editor exhausts its rounds, one fresh editor cycle runs against the same immutable writer package, for the still-failing lanes only, from the writer's original lanes with round state reset and concept groups kept. PaintedFantasy is never called again for a lane failure. A second exhaustion is the clean 502.
  - Round 1 edits every failing lane in one combined call; rounds 2-3 give each still-failing lane its own focused call (a combined call trades one lane's length against another's concepts). Only failing lanes are retried, for at most three rounds. Exhaustion is a 502 `OLLAMA_INVALID_OUTPUT` and never reruns the writer.
- CA-001 keeps independent acceptance ceilings; acceptance fails if any policy maximum exceeds them.

## CA-001 contract history
- 2026-09-26: X ceiling 600 -> 25,000 and a new X long-form minimum (601), because the product requirement changed (X Premium long posts), not to relax the gate. The source text, the other platform ceilings, required concepts, bad endings, and voice/fidelity thresholds are unchanged; short-form-compressed X now fails. Details are recorded in the fixture's `contractHistory`.

- Knowledge boundary: a fixture may declare what its own source means (CA-001 `semanticGroups`); the production bridge must stay generic and never see fixture vocabulary. The writer's declared `whatChanges` / `whyItMatters` groups play no part in the acceptance check, so they cannot make CA-001 pass (see the contract history entry).

## Generation invariants
- Character-platform outputs must be rewritten to fit. Never mechanically clip a draft, append punctuation to a cutoff, or treat a sentence boundary as proof of semantic completeness.
- Warm-up must be load-only. Track success-path and worst-case inference-call counts explicitly.
- Do not add retries, disable thinking, or add semantic re-review calls solely to mask insufficient context, output tokens, or time. (The editor fidelity gate exists because legal length and faithful meaning are different properties, not to cover for resources.)
- Prompt examples must be valid if copied. Do not include placeholder values such as `"..."`.
- Log structural diagnostics without private draft content: failure class, attempt number, field, measured length, finish reason, and whether content or thinking was empty.
- Test local and hosted paths separately. Hosted fallback does not prove the local default works.

## Acceptance and completion
- `npm run relay:acceptance` must run the unchanged CA-001 fixture five times against the direct engine and five times through the actual local UI path.
- The command must reject malformed output, known fragment endings, lanes missing either fixture-owned half of the central thought (CA-001 `semanticGroups`, matched as explicit whole words by `scripts/lib/relay-fixture-semantics.mjs`), weak character validation, wrong engine labels, stale deployment contracts, and unreported model-call limits.
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
