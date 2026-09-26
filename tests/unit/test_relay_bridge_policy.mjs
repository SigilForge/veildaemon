// Regression: the Relay bridge enforces studio/relay/platform-policy.js as writer -> editor -> ruler:
// the writer writes, the editor rewrites only failing lanes, the runtime measures. Never clips.
// Runs the real bridge against a scripted fake Ollama that routes by model (no network beyond loopback).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await import(new URL("../../studio/relay/platform-policy.js", import.meta.url));
const POLICY = globalThis.RelayPlatformPolicy.platforms;

// Distinct short sentences so the bridge's self-loop dedupe never removes anything.
function prose(length, tag) {
  let text = "";
  for (let i = 1; text.length < length; i += 1) text += `${text ? " " : ""}${tag} line ${i} stays whole.`;
  while (text.length > length) text = text.slice(0, text.lastIndexOf(" ")); // build-time only, whole sentences
  return text.endsWith(".") ? text : text.replace(/[^.]*$/, "").trim();
}

// The master quarantines the host (not the reader) and names a syndrome, so tests can ground evidence in it.
// Master filler shares no words with the lane filler, so no accidental "required concepts" appear.
const MASTER = `${Array.from({ length: 40 }, (_, i) => `Record ${i + 1} holds firm.`).join(" ")} VeilCorp analysts classify this as False Steward Syndrome. Containment protocol: quarantine the host before the signal spreads.`;

function modelJson(overrides = {}) {
  return JSON.stringify({
    masterDraft: MASTER,
    platformDrafts: {
      x: prose(1_200, "Xpost"),
      threads: prose(POLICY.threads.max - 20, "Threads"),
      bluesky: prose(POLICY.bluesky.max - 20, "Bluesky"),
      mastodon: prose(POLICY.mastodon.max - 20, "Mastodon"),
      ...overrides,
    },
    validation: { voiceMatch: 0.9, sourceFidelity: 0.9, canonSafe: true, knowledgeBoundarySafe: true, characterMarkers: ["dry"], warnings: [] },
  });
}

const WRITER = "hf.co/zerofata/MS3.2-PaintedFantasy-v4.1-24B-GGUF:Q5_K_M";
const EDITOR = "qwen3.5:9b";

let fake;
let fakePort;
let bridge;
let bridgePort;
let writerScript = [];
let editorScript = [];
let calls = [];

const isFidelity = (request) => request.messages[0].content.startsWith("You are a verifier.");
// Verifier evidence: coded differences only, no verdict.
// Keys are candidate ids (lane_1, lane_2, ...); a bare lane name means its first candidate.
const cid = (k) => (/_\d+$/.test(k) ? k : `${k}_1`);
const evidence = (keys, differences = {}) => JSON.stringify(Object.fromEntries(keys.map((k) => [cid(k), { differences: differences[k] || [] }])));
const faithful = (keys) => evidence(keys);

before(async () => {
  fake = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/show") return res.end(JSON.stringify({ capabilities: ["completion", "tools"] }));
    if (req.url === "/api/chat") {
      const request = JSON.parse(body);
      calls.push(request);
      const queue = request.model === EDITOR ? editorScript : writerScript;
      const content = queue.length > 1 ? queue.shift() : queue[0];
      return res.end(JSON.stringify({ message: { content }, done_reason: "stop" }));
    }
    res.statusCode = 404;
    res.end("{}");
  });
  fake.listen(0, "127.0.0.1");
  await once(fake, "listening");
  fakePort = fake.address().port;

  const probe = http.createServer().listen(0, "127.0.0.1");
  await once(probe, "listening");
  bridgePort = probe.address().port;
  probe.close();

  bridge = spawn(process.execPath, [path.join(root, "scripts/relay-local-bridge.mjs")], {
    env: { ...process.env, RELAY_PORT: String(bridgePort), RELAY_OLLAMA_URL: `http://127.0.0.1:${fakePort}/api/chat`, RELAY_OLLAMA_MODEL: WRITER, RELAY_EDITOR_MODEL: EDITOR, RELAY_OLLAMA_THINKING: "off" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  bridge.stderr.resume();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("bridge did not start")), 10_000);
    bridge.stdout.on("data", (chunk) => {
      if (String(chunk).includes("RelayDaemon local bridge")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
});

after(() => {
  bridge?.kill();
  fake?.close();
});

async function generate() {
  const response = await fetch(`http://127.0.0.1:${bridgePort}/api/character`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Relay-Request": "character-v1", Origin: `http://127.0.0.1:${bridgePort}` },
    body: JSON.stringify({ messages: [{ role: "system", content: "Test system prompt." }, { role: "user", content: "SOURCE\nTest source." }] }),
  });
  return { status: response.status, body: await response.json() };
}

const byModel = (model) => calls.filter((c) => c.model === model);

test("an over-limit lane goes to the editor with a runtime word budget, then the fidelity gate; returned verbatim", async () => {
  calls = [];
  const overLimit = prose(POLICY.bluesky.max + 60, "Overlong");
  const edited = prose(POLICY.bluesky.max - 15, "Edited");
  writerScript = [modelJson({ bluesky: overLimit })];
  editorScript = [JSON.stringify({ bluesky: edited }), faithful(["bluesky"])];

  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(byModel(WRITER).length, 1, "the writer is not asked to count characters again");
  assert.equal(byModel(EDITOR).length, 2, "one combined edit + one fidelity check");
  assert.equal(body.result.platformDrafts.bluesky, edited, "edited draft returned verbatim");
  assert.ok(!JSON.stringify(body).includes("Overlong"), "over-limit draft never reaches the output");
  const { candidates, ...editor } = body.editor;
  assert.deepEqual(editor, { model: EDITOR, rounds: 1, calls: 2, dismissedEvidence: 0, concepts: [], lanesEdited: ["bluesky"] });
  // Budget evidence per candidate: what the brief asked for vs. what came back (no draft text).
  const words = overLimit.trim().split(/\s+/).length;
  const askedMax = Math.max(8, Math.floor(words * (POLICY.bluesky.editTarget / overLimit.length) * 0.9));
  assert.deepEqual(candidates, [{
    round: 1, lane: "bluesky",
    requestedWords: `${Math.max(6, Math.floor(askedMax * 0.8))}-${askedMax}`,
    returnedWords: edited.trim().split(/\s+/).length,
    targetChars: Math.round(POLICY.bluesky.editTarget * 0.9),
    returnedChars: edited.length,
    wordRatio: Math.round((edited.trim().split(/\s+/).length / askedMax) * 100) / 100,
  }]);

  assert.ok(calls[0].messages.some((m) => m.role === "system" && m.content.includes("RELAY PLATFORM POLICY") && m.content.includes(`hard max ${POLICY.bluesky.max}`)), "policy prompt generated from the shared map");
  const edit = calls[1];
  assert.equal(edit.think, false);
  assert.deepEqual(Object.keys(edit.format.properties), ["bluesky"], "editor schema has only the failing lane");
  const brief = edit.messages.at(-1).content;
  assert.match(brief, new RegExp(`the hard limit is ${POLICY.bluesky.max}`));
  assert.match(brief, /Each candidate: \d+–\d+ words, at most 2 sentences/);
  assert.match(brief, /return 3 candidates/);
  assert.ok(brief.includes(overLimit), "the editor rewrites the writer's draft");
  assert.match(edit.messages[0].content, /actor\/object relationships and causal claims exactly/);
  assert.ok(isFidelity(calls[2]), "second editor call is the fidelity gate");
});

test("canonical case: a legal-length \"quarantine yourself\" rewrite fails on verifier evidence and is retried", async () => {
  calls = [];
  // Fits the Bluesky limit and ends cleanly; the ruler alone cannot see that the target of the quarantine moved.
  const drifted = "Containment is the only answer now. Quarantine yourself before the signal reaches you, and trust no one who says the host is safe.";
  const restored = prose(POLICY.bluesky.max - 15, "Restored");
  writerScript = [modelJson({ bluesky: prose(POLICY.bluesky.max + 60, "Overlong") })];
  editorScript = [
    JSON.stringify({ bluesky: drifted }),
    evidence(["bluesky"], { bluesky: [{ code: "object_changed", rewriteQuote: "Quarantine yourself", sourceQuote: "quarantine the host", rewriteClaim: { subject: "reader", relation: "quarantine", object: "yourself" }, sourceClaim: { subject: "containment protocol", relation: "quarantine", object: "the host" } }] }),
    JSON.stringify({ bluesky: restored }),
    faithful(["bluesky"]),
  ];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.ok(drifted.length <= POLICY.bluesky.max, "the drift is mechanically legal");
  assert.equal(body.result.platformDrafts.bluesky, restored);
  assert.ok(!JSON.stringify(body).includes("Quarantine yourself"));
  assert.equal(body.editor.rounds, 2);
  const verifier = calls[2];
  assert.equal(verifier.options.temperature, 0);
  assert.ok(!JSON.stringify(verifier.format).includes("faithful"), "verifier schema carries evidence, not a verdict");
  assert.match(calls[3].messages.at(-1).content, /changed the meaning: object_changed: "Quarantine yourself" \(source: "quarantine the host"\)/);
  assert.equal(byModel(WRITER).length, 1);
});

test("editing is not mutation: ungrounded verifier claims are dismissed by the runtime", async () => {
  calls = [];
  const edited = "VeilCorp analysts classify this as False Steward Syndrome. Containment protocol: quarantine the host before the signal spreads.";
  writerScript = [modelJson({ bluesky: prose(POLICY.bluesky.max + 60, "Overlong") })];
  editorScript = [
    JSON.stringify({ bluesky: edited }),
    evidence(["bluesky"], { bluesky: [
      // "Invented" but stated in the master (the live 2026-09-26 false positive).
      { code: "invented_conclusion", rewriteQuote: "classify this as False Steward Syndrome", sourceQuote: "" },
      // A "change" that points at no real source text.
      { code: "causal_claim_changed", rewriteQuote: "quarantine the host before the signal spreads", sourceQuote: "the CEO eroded trust by indifference", rewriteClaim: { subject: "CEO", relation: "erodes", object: "trust" }, sourceClaim: { subject: "indifference", relation: "erodes", object: "trust" } },
      // Real quotes on both sides, but the verifier's own structure shows the same claim (paraphrase, not mutation).
      { code: "object_changed", rewriteQuote: "quarantine the host", sourceQuote: "quarantine the host before the signal spreads", rewriteClaim: { subject: "protocol", relation: "quarantines", object: "the host" }, sourceClaim: { subject: "containment protocol", relation: "quarantine", object: "host" } },
      // A "change" with no structure at all.
      { code: "actor_changed", rewriteQuote: "VeilCorp analysts classify", sourceQuote: "VeilCorp analysts classify" },
      // A quote that is not in the rewrite at all.
      { code: "new_imperative", rewriteQuote: "Burn the servers tonight", sourceQuote: "" },
    ] }),
  ];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(body.result.platformDrafts.bluesky, edited);
  assert.equal(body.editor.dismissedEvidence, 5);
  assert.equal(body.editor.rounds, 1);
});

test("invented claims are judged clause by clause: a real invention inside a long faithful quote is admitted", async () => {
  calls = [];
  const edited = "VeilCorp analysts classify this as False Steward Syndrome, and the board has already fled to Geneva with the servers.";
  const restored = "VeilCorp analysts classify this as False Steward Syndrome. Containment protocol: quarantine the host before the signal spreads.";
  writerScript = [modelJson({ bluesky: prose(POLICY.bluesky.max + 60, "Overlong") })];
  editorScript = [
    JSON.stringify({ bluesky: edited }),
    // Paragraph-sized quote, mostly faithful by vocabulary; one clause is new.
    evidence(["bluesky"], { bluesky: [{ code: "invented_action", rewriteQuote: edited, sourceQuote: "" }] }),
    JSON.stringify({ bluesky: restored }),
    evidence(["bluesky"], { bluesky: [{ code: "invented_action", rewriteQuote: restored, sourceQuote: "" }] }),
  ];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(body.result.platformDrafts.bluesky, restored);
  assert.equal(body.editor.rounds, 2, "the Geneva clause was admitted; the faithful restore was dismissed");
  assert.equal(body.editor.dismissedEvidence, 1);
});

test("runtime-selected concepts: a legal rewrite that drops a concept the writer kept everywhere is retried", async () => {
  calls = [];
  const tail = " Ownership is the point.";
  const master = `${MASTER} Ownership is being replaced. Ownership was never theirs.`;
  const dropped = prose(POLICY.bluesky.max - 30, "Edited");
  const kept = `${prose(POLICY.bluesky.max - 60, "Edited")} Ownership is gone.`;
  writerScript = [JSON.stringify({ ...JSON.parse(modelJson({
    x: prose(1_200, "Xpost") + tail,
    threads: prose(POLICY.threads.max - 40, "Threads") + tail,
    bluesky: prose(POLICY.bluesky.max + 60, "Overlong") + tail,
    mastodon: prose(POLICY.mastodon.max - 40, "Mastodon") + tail,
  })), masterDraft: master })];
  editorScript = [JSON.stringify({ bluesky: dropped }), JSON.stringify({ bluesky: kept }), evidence(["bluesky"])];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.deepEqual(body.editor.concepts, ["ownership"]);
  assert.equal(body.result.platformDrafts.bluesky, kept);
  assert.equal(body.editor.rounds, 2);
  assert.match(calls[1].messages.at(-1).content, /Preserve these required concepts \(keep each word or its form\): ownership/);
  assert.match(calls[2].messages.at(-1).content, /dropped required concepts \(ownership\)/);
  assert.match(calls[2].messages.at(-1).content, /The previous version omitted the required concept ownership\. Preserve all required concepts, especially ownership\. Keep the accepted meaning and stay under 200 characters\./);
  assert.ok(!isFidelity(calls[2]), "a concept drop is caught by the runtime before any verifier call");
});

test("candidates: the runtime keeps the longest candidate that passes both the ruler and grounded evidence", async () => {
  calls = [];
  const tooLong = prose(POLICY.bluesky.max + 30, "Toolong");
  const mutated = "Quarantine yourself now. VeilCorp analysts classify this as False Steward Syndrome, and the signal spreads.";
  const clean = "VeilCorp analysts classify this as False Steward Syndrome. Containment protocol: quarantine the host before the signal spreads.";
  writerScript = [modelJson({ bluesky: prose(POLICY.bluesky.max + 60, "Overlong") })];
  editorScript = [
    JSON.stringify({ bluesky: [tooLong, mutated, clean] }),
    JSON.stringify({
      bluesky_2: { differences: [{ code: "object_changed", rewriteQuote: "Quarantine yourself now", sourceQuote: "quarantine the host", rewriteClaim: { subject: "reader", relation: "quarantine", object: "yourself" }, sourceClaim: { subject: "protocol", relation: "quarantine", object: "host" } }] },
      bluesky_3: { differences: [] },
    }),
  ];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(body.result.platformDrafts.bluesky, clean);
  assert.equal(body.editor.rounds, 1);
  assert.equal(body.editor.calls, 2, "three candidates still cost one edit call and one verify call");
  assert.deepEqual(Object.keys(calls[2].format.properties), ["bluesky_2", "bluesky_3"], "only ruler-legal candidates reach the verifier");
});

test("the policy floor rejects an implausibly short post (live 2026-09-26: a 53-character Bluesky)", async () => {
  calls = [];
  const stub = "Host compromised by extraction. Ownership is gone now.";
  const full = prose(POLICY.bluesky.floor + 40, "Fuller");
  writerScript = [modelJson({ bluesky: prose(POLICY.bluesky.max + 60, "Overlong") })];
  editorScript = [JSON.stringify({ bluesky: [stub] }), JSON.stringify({ bluesky: [full] }), evidence(["bluesky"])];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.ok(stub.length < POLICY.bluesky.floor);
  assert.equal(body.result.platformDrafts.bluesky, full);
  assert.match(calls[2].messages.at(-1).content, new RegExp(`too short \\(${stub.length} characters; the minimum is ${POLICY.bluesky.floor}\\)`));
});

test("writer-declared central concepts are grounded by the runtime and enforced on every constrained lane", async () => {
  calls = [];
  const master = `${MASTER} Ownership is being replaced. Trust erodes through indifference.`;
  const withBoth = (tag, length) => `${prose(length, tag)} Ownership is gone and trust erodes.`;
  const kept = withBoth("Edited", POLICY.bluesky.max - 80);
  writerScript = [JSON.stringify({ ...JSON.parse(modelJson({
    threads: withBoth("Threads", POLICY.threads.max - 80),
    bluesky: prose(POLICY.bluesky.max - 60, "Bluesky") + " Ownership is gone.", // legal length, but the trust half is missing
    mastodon: withBoth("Mastodon", POLICY.mastodon.max - 80),
  })), masterDraft: master, centralConcepts: ["ownership", "trust", "sovereign cloud"] })];
  editorScript = [JSON.stringify({ bluesky: [kept] }), evidence(["bluesky"])];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.deepEqual(body.editor.concepts, ["ownership", "trust"], "a declared concept absent from the master is not grounded");
  assert.deepEqual(body.editor.lanesEdited, ["bluesky"], "only the lane missing a concept is edited");
  assert.equal(body.result.platformDrafts.bluesky, kept);
  assert.match(calls[1].messages.at(-1).content, /Preserve these required concepts \(keep each word or its form\): ownership, trust/);
  assert.ok(calls[0].format.required.includes("centralConcepts"), "the writer schema asks for the central concepts");
  assert.match(calls[1].messages.at(-1).content, /Each candidate: \d+–\d+ words/, "a lane sent in for a concept still gets a word range, so it is not compressed by reflex");
});

test("a concept phrase is satisfied by its head noun", async () => {
  calls = [];
  const master = `${MASTER} Legal resource extraction continues.`;
  writerScript = [JSON.stringify({ ...JSON.parse(modelJson({
    threads: `${prose(POLICY.threads.max - 80, "Threads")} The extraction continues.`,
    bluesky: `${prose(POLICY.bluesky.max - 80, "Bluesky")} The extraction continues.`,
    mastodon: `${prose(POLICY.mastodon.max - 80, "Mastodon")} The extraction continues.`,
  })), masterDraft: master, centralConcepts: ["legal resource extraction"] })];
  editorScript = ["{}"];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(byModel(EDITOR).length, 0, "no lane is sent to the editor for lacking the phrase's modifiers");
});

test("round 1 edits all failing lanes in one call; later rounds give each failing lane its own call", async () => {
  calls = [];
  writerScript = [modelJson({ threads: prose(POLICY.threads.max + 80, "Toolong"), bluesky: prose(POLICY.bluesky.max + 60, "Overlong") })];
  const good = { threads: prose(POLICY.threads.max - 30, "Threadsfix"), bluesky: prose(POLICY.bluesky.max - 30, "Blueskyfix") };
  editorScript = [
    JSON.stringify({ threads: [prose(POLICY.threads.max + 40, "Still")], bluesky: [prose(POLICY.bluesky.max + 40, "Still")] }),
    JSON.stringify({ threads: [good.threads] }),
    JSON.stringify({ bluesky: [good.bluesky] }),
    evidence(["threads", "bluesky"]),
  ];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(calls[1].format.properties), ["threads", "bluesky"], "round 1: one combined call");
  assert.deepEqual(Object.keys(calls[2].format.properties), ["threads"], "round 2: threads alone");
  assert.deepEqual(Object.keys(calls[3].format.properties), ["bluesky"], "round 2: bluesky alone");
  assert.equal(body.editor.calls, 4, "round 1 edit (no verify: nothing legal) + two lane edits + one combined verify");
  assert.deepEqual(body.result.platformDrafts.threads, good.threads);
});

test("a surface fix that rewrites the lane is rejected as edit_scope_exceeded (X stays long-form)", async () => {
  calls = [];
  // Punctuation is deterministic code now, so the surface problem the editor still owns is an unfinished ending.
  const longX = `${prose(2_000, "Longform")} The transmission stopped at the.`;
  const compressed = prose(450, "Squeezed");
  const fixed = longX.replace("stopped at the.", "stopped at the gate.");
  writerScript = [modelJson({ x: longX })];
  editorScript = [JSON.stringify({ x: compressed }), JSON.stringify({ x: fixed }), evidence(["x"])];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(body.result.platformDrafts.x, fixed);
  assert.equal(body.editor.rounds, 2);
  const retry = calls[2].messages.at(-1).content;
  assert.match(retry, /rewrote the post instead of fixing punctuation/);
  assert.match(retry, /Fix only this: ended on an unfinished sentence/, "the original surface problem is carried forward");
  assert.ok(retry.includes(longX) && !retry.includes("Squeezed"), "the retry edits the writer's text, never the compressed one");
});

test("the runtime fails closed when verifier evidence is missing or malformed", async () => {
  calls = [];
  writerScript = [modelJson({ bluesky: prose(POLICY.bluesky.max + 60, "Overlong") })];
  const edit = JSON.stringify({ bluesky: prose(POLICY.bluesky.max - 15, "Edited") });
  editorScript = [edit, JSON.stringify({ bluesky: { differences: [{ code: "looks_fine", rewriteQuote: "", sourceQuote: "" }] } }), edit, JSON.stringify({}), edit, "{}"];
  const { status, body } = await generate();
  assert.equal(status, 502);
  assert.equal(body.result, undefined);
  assert.equal(byModel(EDITOR).length, 6, "three rounds of edit + verify, then stop");
});

test("persistent over-limit output fails after bounded editor rounds, never clipped", async () => {
  calls = [];
  writerScript = [modelJson({ threads: prose(POLICY.threads.max + 80, "Toolong") })];
  editorScript = [JSON.stringify({ threads: prose(POLICY.threads.max + 40, "Stilllong") })];
  const { status, body } = await generate();
  assert.equal(status, 502);
  assert.equal(body.error, "OLLAMA_INVALID_OUTPUT");
  assert.equal(byModel(WRITER).length, 1, "lane failures do not rerun the writer");
  assert.equal(byModel(EDITOR).length, 3, "three edit rounds; no fidelity call for a lane still over");
  assert.equal(body.result, undefined, "no clipped fallback draft");
  assert.equal(body.editor.rounds, 3, "a failed response still carries the editor's evidence");
  assert.deepEqual(body.editor.failures.map((f) => f.problem), ["over_limit"]);
  assert.ok(!JSON.stringify(body.editor).includes("Stilllong"), "evidence is structural, never draft text");
});

test("a lane that keeps dropping a concept fails with missingConcepts recorded in the 502", async () => {
  calls = [];
  const tail = " Ownership is the point.";
  writerScript = [JSON.stringify({ ...JSON.parse(modelJson({
    x: prose(1_200, "Xpost") + tail,
    threads: prose(POLICY.threads.max - 40, "Threads") + tail,
    bluesky: prose(POLICY.bluesky.max + 60, "Overlong") + tail,
    mastodon: prose(POLICY.mastodon.max - 40, "Mastodon") + tail,
  })), masterDraft: `${MASTER} Ownership is being replaced. Ownership was never theirs.` })];
  editorScript = [JSON.stringify({ bluesky: [prose(POLICY.bluesky.max - 30, "Edited")] })];
  const { status, body } = await generate();
  assert.equal(status, 502);
  assert.deepEqual(body.editor.failures, [{ field: "bluesky", problem: "concept_dropped", length: body.editor.failures[0].length, max: POLICY.bluesky.max, missingConcepts: ["ownership"] }]);
});

test("an unfinished ending is an editor fix, even on X", async () => {
  calls = [];
  const unfinished = `${prose(900, "Longform")} He waited for the.`;
  const fixed = `${prose(900, "Longform")} He waited for the signal.`;
  writerScript = [modelJson({ x: unfinished })];
  editorScript = [JSON.stringify({ x: fixed }), faithful(["x"])];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(body.result.platformDrafts.x, fixed);
});

test("quoted elisions are repaired deterministically, word for word, without an editor call", async () => {
  calls = [];
  const quoted = `${prose(900, "Longform")} The doctrine: "Ownership is deprecated... Access is sufficient..." He waited... and every copy ends "...go suck an egg."`;
  writerScript = [modelJson({ x: quoted })];
  editorScript = ["{}"];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(byModel(EDITOR).length, 0);
  assert.ok(body.result.platformDrafts.x.endsWith(`The doctrine: "Ownership is deprecated. Access is sufficient." He waited — and every copy ends "go suck an egg."`));
});

test("long-form X (X Premium) is accepted in full without editing", async () => {
  calls = [];
  const longX = prose(3_000, "Longform");
  writerScript = [modelJson({ x: longX })];
  editorScript = ["{}"];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  assert.equal(body.editor.calls, 0);
  assert.equal(body.result.platformDrafts.x, longX);
  assert.ok(longX.length > 600 && longX.length <= POLICY.x.max);
});

test("master-draft problems still use the writer's own retry ladder", async () => {
  calls = [];
  writerScript = [JSON.stringify({ ...JSON.parse(modelJson()), masterDraft: "" }), modelJson()];
  editorScript = ["{}"];
  const { status } = await generate();
  assert.equal(status, 200);
  assert.equal(byModel(WRITER).length, 2);
  assert.equal(byModel(EDITOR).length, 0);
});
