// Regression: the Relay bridge enforces studio/relay/platform-policy.js as writer -> editor -> ruler:
// the writer writes, the editor rewrites only failing lanes, the runtime measures. Never clips.
// Runs the real bridge against a scripted fake Ollama that routes by model (no network beyond loopback).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { symlink, unlink } from "node:fs/promises";
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
// Default concept groups (one anchor per group suffices): filler lanes say "line ... whole"; the custom texts
// below name the host, the signal, the analysts, or the syndrome. The master grounds all of them.
const MASTER = `${Array.from({ length: 40 }, (_, i) => `Record ${i + 1} holds firm.`).join(" ")} Every line stays whole. VeilCorp analysts classify this as False Steward Syndrome. Containment protocol: quarantine the host before the signal spreads.`;

function modelJson(overrides = {}) {
  return JSON.stringify({
    masterDraft: MASTER,
    whatChanges: ["line", "host", "analysts"],
    whyItMatters: ["whole", "signal", "syndrome"],
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
let bridgeLog = "";
const key = (anchor, groundedKey) => ({ anchor, groundedKey });

const isFidelity = (request) => request.messages[0].content.startsWith("You are a verifier.");
// Verifier responses that do not script `halves` get grounded ones quoted from the actual request (the opening
// words of the source and of each candidate), so every test still passes through the runtime's halves check.
const opening = (text) => text.trim().split(/\s+/).slice(0, 6).join(" ");
function withAutoHalves(request, content) {
  let parsed;
  try { parsed = JSON.parse(content); } catch { return content; }
  const prompt = request.messages.at(-1).content;
  const source = prompt.slice("SOURCE (master draft):\n".length).split("\n\n")[0];
  for (const [id, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== "object" || entry.halves) continue;
    const rewrite = (prompt.match(new RegExp(`\\(key "${id}"\\) REWRITE:\\n([\\s\\S]*?)(?:\\n\\n|$)`)) || [])[1] || "";
    const half = { sourceQuote: opening(source), rewriteQuote: opening(rewrite) };
    entry.halves = { change: half, impact: half };
  }
  return JSON.stringify(parsed);
}
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
      let content = queue.length > 1 ? queue.shift() : queue[0];
      if (request.model === EDITOR && isFidelity(request)) content = withAutoHalves(request, content);
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
  bridge.stderr.on("data", (chunk) => { bridgeLog += chunk; });
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
  assert.deepEqual(editor, { model: EDITOR, rounds: 1, calls: 2, dismissedEvidence: 0, concepts: {
    whatChanges: [key("line", "line"), key("host", "host"), key("analysts", "analyst")],
    whyItMatters: [key("whole", "whole"), key("signal", "signal"), key("syndrome", "syndrome")],
  }, lanesEdited: ["bluesky"] });
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

// CA-001 shape: the central thought is loss of ownership (what changes) and eroding trust (why it matters).
const CA_MASTER = `${MASTER} Ownership has been replaced with revocable licenses; physical media is being phased out. Executive functions optimize for resource extraction over long-term trust.`;
const caPackage = (lanes) => JSON.stringify({
  ...JSON.parse(modelJson(lanes)),
  masterDraft: CA_MASTER,
  whatChanges: ["ownership", "revocable licenses", "physical media"],
  whyItMatters: ["trust", "resource extraction"],
});

test("CA-001 concept groups: an ownership-only lane fails for lacking whyItMatters; one anchor from each group passes", async () => {
  calls = [];
  const both = (tag, n) => `${prose(n, tag)} Ownership is gone, and trust goes with it.`;
  const ownershipOnly = `${prose(POLICY.bluesky.max - 90, "Bluesky")} Ownership became a revocable license.`;
  const concise = "The host replaced ownership with revocable licenses, one quiet update at a time. What erodes now is trust.";
  assert.ok(concise.length >= POLICY.bluesky.floor && concise.length <= POLICY.bluesky.max);
  writerScript = [caPackage({ threads: both("Threads", 250), bluesky: ownershipOnly, mastodon: both("Mastodon", 250) })];
  editorScript = [JSON.stringify({ bluesky: [concise] }), evidence(["bluesky"])];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.deepEqual(body.editor.concepts, {
    whatChanges: [key("ownership", "ownership"), key("revocable licenses", "licens"), key("physical media", "media")],
    whyItMatters: [key("trust", "trust"), key("resource extraction", "extraction")],
  });
  assert.deepEqual(body.editor.lanesEdited, ["bluesky"], "lanes carrying one anchor from each group pass untouched");
  assert.equal(body.result.platformDrafts.bluesky, concise, "a concise lane with one anchor per group passes; all five are not required");
  const brief = calls[1].messages.at(-1).content;
  assert.match(brief, /Keep both halves of the central thought: at least one of \(ownership, revocable licenses, physical media\) for what changes, and at least one of \(trust, resource extraction\) for why it matters\./);
  assert.match(brief, /The previous version omitted the why-it-matters half\. Keep at least one of: trust, resource extraction\./);
  assert.ok(calls[0].format.required.includes("whatChanges") && calls[0].format.required.includes("whyItMatters"));
});

test("a lane that keeps dropping a group fails with missingGroups recorded in the 502", async () => {
  calls = [];
  const ownershipOnly = `${prose(POLICY.bluesky.max - 90, "Bluesky")} Ownership became a revocable license.`;
  writerScript = [caPackage({ threads: `${prose(250, "Threads")} Ownership and trust.`, bluesky: ownershipOnly, mastodon: `${prose(250, "Mastodon")} Ownership and trust.` })];
  editorScript = [JSON.stringify({ bluesky: [ownershipOnly] })];
  const { status, body } = await generate();
  assert.equal(status, 502);
  assert.deepEqual(body.editor.failures, [{ field: "bluesky", problem: "concept_dropped", length: ownershipOnly.length, max: POLICY.bluesky.max, missingGroups: ["whyItMatters"] }]);
});

test("anchors are grounded by the runtime; a group with no grounded anchor is a writer failure, retried by the writer", async () => {
  calls = [];
  const ungrounded = JSON.stringify({ ...JSON.parse(caPackage({})), whyItMatters: ["sovereign cloud"] });
  const grounded = JSON.stringify({ ...JSON.parse(caPackage({
    threads: `${prose(250, "Threads")} Ownership and trust.`,
    bluesky: `${prose(120, "Bluesky")} Ownership and trust.`,
    mastodon: `${prose(250, "Mastodon")} Ownership and trust.`,
  })), whyItMatters: ["trust", "sovereign cloud"] });
  writerScript = [ungrounded, grounded];
  editorScript = ["{}"];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(byModel(WRITER).length, 2, "an empty group goes back through the writer's own ladder");
  assert.equal(byModel(EDITOR).length, 0);
  assert.deepEqual(body.editor.concepts.whyItMatters, [key("trust", "trust")], "an anchor with no grounded word is dropped");
  assert.match(bridgeLog, /ungroundedGroups: 'whyItMatters'/);
  assert.match(bridgeLog, /rejectedAnchors: 'whyItMatters: sovereign cloud \(ungrounded\)'/, "rejected anchors are logged by group");
});

test("groundedKey: the head when grounded, else the nearest grounded word; lanes are checked on that same key", async () => {
  calls = [];
  // The master has "trust" and "control" but never "erosion"; "loss of control" keeps its head, control.
  writerScript = [JSON.stringify({ ...JSON.parse(caPackage({
    threads: `${prose(250, "Threads")} Ownership goes, and trust goes with it.`,
    bluesky: `${prose(POLICY.bluesky.max - 90, "Bluesky")} Ownership erodes; the erosion is total.`, // "erosion" is not the key
    mastodon: `${prose(250, "Mastodon")} Ownership goes, and with it control.`,
  })), masterDraft: `${CA_MASTER} Owners lose control.`, whatChanges: ["ownership"], whyItMatters: ["trust erosion", "loss of control"] })];
  const fixed = `${prose(POLICY.bluesky.max - 90, "Bluesky")} Ownership goes, and trust with it.`;
  editorScript = [JSON.stringify({ bluesky: [fixed] }), evidence(["bluesky"])];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.deepEqual(body.editor.concepts.whyItMatters, [key("trust erosion", "trust"), key("loss of control", "control")]);
  assert.deepEqual(body.editor.lanesEdited, ["bluesky"], "a lane saying only \"erosion\" lacks the groundedKey trust; \"control\" satisfies Mastodon");
  assert.equal(body.result.platformDrafts.bluesky, fixed);
});

test("disjoint halves: a key declared in both groups satisfies neither", async () => {
  calls = [];
  const both = (tag, n) => `${prose(n, tag)} Revocable licenses replace ownership, and trust erodes.`;
  writerScript = [JSON.stringify({ ...JSON.parse(caPackage({ threads: both("Threads", 250), bluesky: both("Bluesky", 60), mastodon: both("Mastodon", 250) })),
    whatChanges: ["ownership", "revocable licenses"], whyItMatters: ["ownership", "trust"] })];
  editorScript = ["{}"];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.deepEqual(body.editor.concepts, { whatChanges: [key("revocable licenses", "licens")], whyItMatters: [key("trust", "trust")] }, "ownership is dropped from both groups");
  assert.match(bridgeLog, /ownership \(key ownership in both groups\)/);

  // With ownership as the only anchor in one group, that group is empty: a writer failure, retried by the writer.
  calls = [];
  writerScript = [
    JSON.stringify({ ...JSON.parse(caPackage({})), whatChanges: ["ownership"], whyItMatters: ["ownership", "trust"] }),
    JSON.stringify({ ...JSON.parse(caPackage({ threads: both("Threads", 250), bluesky: both("Bluesky", 60), mastodon: both("Mastodon", 250) })), whatChanges: ["revocable licenses"], whyItMatters: ["trust"] }),
  ];
  const retried = await generate();
  assert.equal(retried.status, 200);
  assert.equal(byModel(WRITER).length, 2);
});

test("a misfiled group cannot pass: the verifier's halves evidence decides, not the writer's labels", async () => {
  calls = [];
  // The writer files "indifference" under whatChanges. A lane can satisfy both declared groups ("indifference",
  // "trust") while saying nothing about ownership changing. The verifier's halves evidence exposes it.
  const master = `${CA_MASTER} There is no hostility, only indifference.`;
  const misfiled = `${prose(POLICY.bluesky.max - 110, "Bluesky")} Indifference rules, and trust erodes.`;
  // The declared groups are still enforced alongside the halves: the fix keeps "indifference" and adds the change.
  const fixed = `${prose(POLICY.bluesky.max - 140, "Bluesky")} Indifference turned ownership into licenses; trust erodes.`;
  const other = (tag) => `${prose(250, tag)} Indifference replaced ownership with licenses, and trust erodes.`;
  writerScript = [JSON.stringify({ ...JSON.parse(caPackage({ threads: other("Threads"), mastodon: other("Mastodon"), bluesky: prose(POLICY.bluesky.max + 60, "Overlong") + " Indifference and trust." })),
    masterDraft: master, whatChanges: ["indifference"], whyItMatters: ["trust"] })];
  editorScript = [
    JSON.stringify({ bluesky: [misfiled] }),
    JSON.stringify({ bluesky_1: { differences: [], halves: {
      change: { sourceQuote: "Ownership has been replaced with revocable licenses", rewriteQuote: "" },
      impact: { sourceQuote: "resource extraction over long-term trust", rewriteQuote: "trust erodes" },
    } } }),
    JSON.stringify({ bluesky: [fixed] }),
    evidence(["bluesky"]),
  ];
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(body.result.platformDrafts.bluesky, fixed);
  assert.equal(body.editor.rounds, 2);
  assert.match(calls[3].messages.at(-1).content, /change_missing|no longer carries what changes \(source: "Ownership has been replaced with revocable licenses"\)/);
});

test("halves evidence fails closed: an ungrounded quote does not count as preserved", async () => {
  calls = [];
  const edited = prose(POLICY.bluesky.max - 30, "Edited");
  writerScript = [modelJson({ bluesky: prose(POLICY.bluesky.max + 60, "Overlong") })];
  const ungrounded = JSON.stringify({ bluesky_1: { differences: [], halves: {
    change: { sourceQuote: "a sentence the master never said", rewriteQuote: "Edited line 1 stays whole" },
    impact: { sourceQuote: "Every line stays whole", rewriteQuote: "Edited line 1 stays whole" },
  } } });
  editorScript = [JSON.stringify({ bluesky: [edited] }), ungrounded, JSON.stringify({ bluesky: [edited] }), ungrounded, JSON.stringify({ bluesky: [edited] }), ungrounded];
  const { status, body } = await generate();
  assert.equal(status, 502);
  assert.deepEqual(body.editor.failures.map((f) => f.codes), [["change_missing"]]);
});

test("final round only: the requested word ceiling is 70% of the normal budget", async () => {
  calls = [];
  const still = prose(POLICY.threads.max + 40, "Still");
  writerScript = [modelJson({ threads: prose(POLICY.threads.max + 80, "Toolong") })];
  editorScript = [JSON.stringify({ threads: [still] })];
  const { status, body } = await generate();
  assert.equal(status, 502);
  const [r1, r2, r3] = body.editor.candidates.filter((c) => c.lane === "threads").map((c) => Number(c.requestedWords.split("-")[1]));
  const round3Brief = calls[3].messages.at(-1).content;
  assert.equal(r3, Math.max(8, Math.floor(r2 * 0.7)), "round 3 asks for 70% of the round-2 ceiling");
  assert.ok(r2 <= r1, "rounds 1-2 use the ordinary (tightening) budget");
  assert.match(round3Brief, new RegExp(`Each candidate: \\d+–${r3} words`));
  assert.ok(!JSON.stringify(body).includes("Still line"), "never clipped");
});

test("an anchor phrase is satisfied by its head noun", async () => {
  calls = [];
  writerScript = [caPackage({
    threads: `${prose(250, "Threads")} The licenses remain, and the extraction continues.`,
    bluesky: `${prose(120, "Bluesky")} The licenses remain; the extraction continues.`,
    mastodon: `${prose(250, "Mastodon")} The licenses remain, and the extraction continues.`,
  })];
  editorScript = ["{}"];
  const { status } = await generate();
  assert.equal(status, 200);
  assert.equal(byModel(EDITOR).length, 0, "\"revocable licenses\" and \"resource extraction\" match on licenses / extraction");
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

// Raw request path: fetch() would normalize "../" client-side, so traversal tests must send the bytes as-is.
function rawGet(rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: bridgePort, path: rawPath, method: "GET" }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
}

test("static serving is confined to studio/: secrets, repo files, and traversal are 404", async () => {
  assert.equal(await rawGet("/studio/relay/"), 200);
  assert.equal(await rawGet("/studio/relay/relay.css"), 200, "a normal Studio asset");
  for (const path of [
    "/.env.stripe-test.local",
    "/package.json",
    "/scripts/relay-local-bridge.mjs",
    "/artifacts/relay-acceptance/latest.json",
    "/../.env.stripe-test.local",
    "/studio/../package.json",
    "/studio/relay/../../.env.stripe-test.local",
    "/studio/%2e%2e/package.json",
    "/studio/%2E%2E/.env.stripe-test.local",
    "/studio/..%2fpackage.json",
    "/studio/%2e%2e%2f.env.stripe-test.local",
    "/studio/..%5cpackage.json",
    "/%2e%2e/%2e%2e/etc/passwd",
    "/studio/%00/relay/index.html",
    "/studio/%E0%A4%A",
  ]) assert.equal(await rawGet(path), 404, path);
});

test("a symlink inside studio/ cannot lead out of it", async () => {
  const link = path.join(root, "studio", "__relay_test_link.json");
  await symlink(path.join(root, "package.json"), link);
  try {
    assert.equal(await rawGet("/studio/__relay_test_link.json"), 404);
  } finally {
    await unlink(link);
  }
});

test("the local bridge serves /studio/relay/ (directory index), so acceptance's UI stage can load the page", async () => {
  const dir = await fetch(`http://127.0.0.1:${bridgePort}/studio/relay/`);
  assert.equal(dir.status, 200);
  const html = await dir.text();
  assert.ok(html.includes('id="source-text"') && html.includes("platform-policy.js"), "the Relay page itself, with its relative assets");
  assert.equal((await fetch(`http://127.0.0.1:${bridgePort}/studio/relay/platform-policy.js`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${bridgePort}/studio/`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${bridgePort}/scripts/`)).status, 404, "a directory without an index is still not served");
});
