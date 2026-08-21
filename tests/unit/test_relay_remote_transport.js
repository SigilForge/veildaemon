const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("stream");
const path = require("path");
const fs = require("fs");

const { createTransport, newSecretBytes } = require("../../lib/relayRemoteTransport");
const handler = require("../../api/relay-remote/[action].js");

const PAIRING = "test-pairing-secret";
const DEVICE = "home-primary";

function sampleMessages() {
  return [
    { role: "system", content: "You are Shade. Return only the required JSON character package." },
    { role: "user", content: "SOURCE\nOwnership became a license. Physical media disappeared. Trust was extracted legally.\nWrite a complete in-character master plus platform drafts." },
  ];
}

function sampleResult() {
  return {
    masterDraft: "They sold ownership back to you as a license and called it progress. Physical media vanished so the shelf could no longer argue. Legal extraction does not look like theft; it looks like terms of service, and that is why the trust rot is worse.",
    platformDrafts: {
      x: "They replaced ownership with a license and retired the shelf. Perfectly legal extraction still ends trust, because you cannot keep what they can revoke.",
      threads: "Ownership became a license and physical media disappeared. The extraction is legal, which is exactly why the trust does not recover.",
      bluesky: "Ownership is now a license. The discs are gone. Legal extraction still spends trust you cannot buy back.",
      mastodon: "They retired physical media and recast ownership as permission. The extraction is lawful, and that is why the long-term trust is already gone.",
    },
    validation: {
      voiceMatch: 0.9,
      sourceFidelity: 0.91,
      canonSafe: true,
      knowledgeBoundarySafe: true,
      characterMarkers: ["procedural"],
      warnings: [],
    },
  };
}

function makeTransport(overrides = {}) {
  let t = overrides.t ?? Date.now();
  const now = overrides.now || (() => t);
  const transport = createTransport({
    backend: "memory",
    pairingSecret: PAIRING,
    now,
    requestTtlSec: overrides.requestTtlSec || 90,
    onlineWindowMs: overrides.onlineWindowMs || 20_000,
    maxQueueDepth: overrides.maxQueueDepth || 4,
    durableRequired: overrides.durableRequired === true,
  });
  transport.advance = (ms) => {
    t += ms;
  };
  transport.nowValue = () => t;
  return transport;
}

async function pairDevice(transport) {
  return transport.pair({ pairingSecret: PAIRING, deviceId: DEVICE });
}

describe("relay remote transport", () => {
  it("authorized remote request succeeds and returns the character schema", async () => {
    const transport = makeTransport();
    const paired = await pairDevice(transport);
    const requestId = newSecretBytes(16);
    const submitted = await transport.submit({ messages: sampleMessages(), requestId, deviceId: DEVICE });
    assert.equal(submitted.status, "pending");
    const polled = await transport.poll({
      deviceId: DEVICE,
      deviceToken: paired.deviceToken,
      pollNonce: newSecretBytes(16),
    });
    assert.equal(polled.empty, false);
    assert.equal(polled.request.requestId, requestId);
    await transport.complete({
      deviceId: DEVICE,
      deviceToken: paired.deviceToken,
      requestId,
      result: sampleResult(),
      completeNonce: newSecretBytes(16),
    });
    const out = await transport.result({ requestId });
    assert.equal(out.status, "complete");
    assert.equal(out.correlation, requestId);
    assert.equal(out.result.platformDrafts.x.includes("license"), true);
    assert.equal(out.result.validation.warnings.length, 0);
  });

  it("unauthorized request rejected", async () => {
    const transport = makeTransport();
    await pairDevice(transport);
    await assert.rejects(
      () => transport.poll({ deviceId: DEVICE, deviceToken: "deadbeef".repeat(8), pollNonce: newSecretBytes(16) }),
      /UNAUTHORIZED/,
    );
    await assert.rejects(
      () => transport.pair({ pairingSecret: "wrong-secret", deviceId: DEVICE }),
      /UNAUTHORIZED/,
    );
  });

  it("expired and replayed requests are rejected", async () => {
    const transport = makeTransport({ requestTtlSec: 1, onlineWindowMs: 5_000 });
    const paired = await pairDevice(transport);
    const requestId = newSecretBytes(16);
    await transport.submit({ messages: sampleMessages(), requestId, deviceId: DEVICE });
    await assert.rejects(
      () => transport.submit({ messages: sampleMessages(), requestId, deviceId: DEVICE }),
      /REQUEST_REPLAY/,
    );
    transport.advance(2_000);
    const polled = await transport.poll({
      deviceId: DEVICE,
      deviceToken: paired.deviceToken,
      pollNonce: newSecretBytes(16),
    });
    assert.equal(polled.empty, true);
    const timed = await transport.result({ requestId });
    assert.equal(timed.status, "timeout");
    const nonce = newSecretBytes(16);
    await transport.submit({ messages: sampleMessages(), requestId: newSecretBytes(16), deviceId: DEVICE });
    const next = await transport.poll({ deviceId: DEVICE, deviceToken: paired.deviceToken, pollNonce: nonce });
    assert.equal(next.empty, false);
    await assert.rejects(
      () => transport.poll({ deviceId: DEVICE, deviceToken: paired.deviceToken, pollNonce: nonce }),
      /REQUEST_REPLAY/,
    );
  });

  it("malformed request rejected", async () => {
    const transport = makeTransport();
    await pairDevice(transport);
    await assert.rejects(
      () => transport.submit({ messages: [{ role: "assistant", content: "nope" }], requestId: newSecretBytes(16), deviceId: DEVICE }),
      /MALFORMED_REQUEST/,
    );
    await assert.rejects(
      () => transport.submit({ messages: sampleMessages(), requestId: "not-hex", deviceId: DEVICE }),
      /MALFORMED_REQUEST/,
    );
  });

  it("local daemon offline path", async () => {
    const transport = makeTransport({ onlineWindowMs: 1_000 });
    await pairDevice(transport);
    transport.advance(2_000);
    await assert.rejects(
      () => transport.submit({ messages: sampleMessages(), requestId: newSecretBytes(16), deviceId: DEVICE }),
      /LOCAL_DAEMON_OFFLINE/,
    );
    const snapshot = await transport.status({ deviceId: DEVICE });
    assert.equal(snapshot.localBridge, "offline");
  });

  it("timeout path is distinguishable from offline", async () => {
    const transport = makeTransport({ requestTtlSec: 1, onlineWindowMs: 30_000 });
    const paired = await pairDevice(transport);
    const requestId = newSecretBytes(16);
    await transport.submit({ messages: sampleMessages(), requestId, deviceId: DEVICE });
    transport.advance(1500);
    const out = await transport.result({ requestId });
    assert.equal(out.status, "timeout");
    assert.equal(out.error, "REMOTE_TIMEOUT");
    const snapshot = await transport.status({ deviceId: DEVICE });
    assert.equal(snapshot.localBridge, "online");
    assert.ok(paired.deviceToken);
  });

  it("response correlation cannot cross requests", async () => {
    const transport = makeTransport();
    const paired = await pairDevice(transport);
    const a = newSecretBytes(16);
    const b = newSecretBytes(16);
    await transport.submit({ messages: sampleMessages(), requestId: a, deviceId: DEVICE });
    await transport.submit({ messages: sampleMessages(), requestId: b, deviceId: DEVICE });
    const first = await transport.poll({ deviceId: DEVICE, deviceToken: paired.deviceToken, pollNonce: newSecretBytes(16) });
    const second = await transport.poll({ deviceId: DEVICE, deviceToken: paired.deviceToken, pollNonce: newSecretBytes(16) });
    const firstResult = sampleResult();
    firstResult.masterDraft = `${firstResult.masterDraft} Request A marker.`;
    const secondResult = sampleResult();
    secondResult.masterDraft = `${secondResult.masterDraft} Request B marker.`;
    await transport.complete({
      deviceId: DEVICE,
      deviceToken: paired.deviceToken,
      requestId: first.request.requestId,
      result: firstResult,
      completeNonce: newSecretBytes(16),
    });
    await transport.complete({
      deviceId: DEVICE,
      deviceToken: paired.deviceToken,
      requestId: second.request.requestId,
      result: secondResult,
      completeNonce: newSecretBytes(16),
    });
    const aOut = await transport.result({ requestId: a });
    const bOut = await transport.result({ requestId: b });
    assert.equal(aOut.correlation, a);
    assert.equal(bOut.correlation, b);
    assert.notEqual(aOut.result.masterDraft, bOut.result.masterDraft);
    assert.match(aOut.result.masterDraft, /Request A marker|Request B marker/);
    assert.equal(aOut.result.masterDraft.includes("Request A marker") !== bOut.result.masterDraft.includes("Request A marker"), true);
  });

  it("revoked credentials fail closed", async () => {
    const transport = makeTransport();
    const paired = await pairDevice(transport);
    await transport.revoke({ pairingSecret: PAIRING, deviceId: DEVICE });
    await assert.rejects(
      () => transport.poll({ deviceId: DEVICE, deviceToken: paired.deviceToken, pollNonce: newSecretBytes(16) }),
      /UNAUTHORIZED/,
    );
  });

  it("pairing secret can re-enroll a revoked device with a new token", async () => {
    const transport = makeTransport();
    const first = await pairDevice(transport);
    await transport.revoke({ pairingSecret: PAIRING, deviceId: DEVICE });
    const second = await pairDevice(transport);
    assert.notEqual(second.deviceToken, first.deviceToken);
    await assert.rejects(
      () => transport.poll({ deviceId: DEVICE, deviceToken: first.deviceToken, pollNonce: newSecretBytes(16) }),
      /UNAUTHORIZED/,
    );
    const polled = await transport.poll({
      deviceId: DEVICE,
      deviceToken: second.deviceToken,
      pollNonce: newSecretBytes(16),
    });
    assert.equal(polled.empty, true);
  });

  it("bounded queue rejects overflow", async () => {
    const transport = makeTransport({ maxQueueDepth: 1 });
    await pairDevice(transport);
    await transport.submit({ messages: sampleMessages(), requestId: newSecretBytes(16), deviceId: DEVICE });
    await assert.rejects(
      () => transport.submit({ messages: sampleMessages(), requestId: newSecretBytes(16), deviceId: DEVICE }),
      /QUEUE_FULL/,
    );
  });
});

describe("relay remote HTTP surface", () => {
  function fakeRes() {
    return {
      headers: {},
      statusCode: 0,
      setHeader(key, value) { this.headers[key] = value; },
      end(body) { this.body = body; },
    };
  }

  function browserHeaders() {
    return {
      host: "relay.veildaemon.app",
      origin: "https://relay.veildaemon.app",
      "sec-fetch-site": "same-origin",
      "x-relay-request": "character-v1",
    };
  }

  const KNOX = { id: "knox-id", email: "j.donavon.love@gmail.com" };

  it("browser status/submit/result reject missing credentials before queueing", async () => {
    const transport = makeTransport();
    const response = fakeRes();
    await handler({ method: "POST", url: "/api/relay-remote/submit", headers: {}, relayTransport: transport }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(JSON.parse(response.body).error, "UNAUTHORIZED");
  });

  it("authorized browser submit + device poll/complete round trip", async () => {
    const transport = makeTransport();
    const paired = await pairDevice(transport);
    const requestId = newSecretBytes(16);
    const submitReq = Readable.from([Buffer.from(JSON.stringify({ messages: sampleMessages(), requestId }))]);
    Object.assign(submitReq, { method: "POST", url: "/api/relay-remote/submit", headers: browserHeaders(), relayTransport: transport, relayOperator: KNOX });
    const submitRes = fakeRes();
    await handler(submitReq, submitRes);
    assert.equal(submitRes.statusCode, 202);

    const pollReq = Readable.from([Buffer.from(JSON.stringify({ deviceId: DEVICE, pollNonce: newSecretBytes(16) }))]);
    Object.assign(pollReq, {
      method: "POST",
      url: "/api/relay-remote/poll",
      headers: { authorization: `Bearer ${paired.deviceToken}`, "x-relay-device-id": DEVICE },
      relayTransport: transport,
    });
    const pollRes = fakeRes();
    await handler(pollReq, pollRes);
    assert.equal(pollRes.statusCode, 200);
    assert.equal(JSON.parse(pollRes.body).request.requestId, requestId);

    const completeReq = Readable.from([Buffer.from(JSON.stringify({
      deviceId: DEVICE,
      requestId,
      result: sampleResult(),
      completeNonce: newSecretBytes(16),
    }))]);
    Object.assign(completeReq, {
      method: "POST",
      url: "/api/relay-remote/complete",
      headers: { authorization: `Bearer ${paired.deviceToken}`, "x-relay-device-id": DEVICE },
      relayTransport: transport,
    });
    const completeRes = fakeRes();
    await handler(completeReq, completeRes);
    assert.equal(completeRes.statusCode, 200);

    const resultRes = fakeRes();
    await handler({
      method: "GET",
      url: `/api/relay-remote/result?requestId=${requestId}`,
      query: { requestId },
      headers: browserHeaders(),
      relayTransport: transport,
      relayOperator: KNOX,
    }, resultRes);
    const body = JSON.parse(resultRes.body);
    assert.equal(resultRes.statusCode, 200);
    assert.equal(body.status, "complete");
    assert.equal(body.result.validation.canonSafe, true);
  });

  it("submit ignores caller profile_name and rejects missing browser credentials", async () => {
    const transport = makeTransport();
    await pairDevice(transport);
    const requestId = newSecretBytes(16);
    const submitReq = Readable.from([Buffer.from(JSON.stringify({
      messages: sampleMessages(),
      requestId,
      profile_name: "dev",
      allowed_tools: ["shell"],
    }))]);
    Object.assign(submitReq, { method: "POST", url: "/api/relay-remote/submit", headers: browserHeaders(), relayTransport: transport, relayOperator: KNOX });
    const submitRes = fakeRes();
    await handler(submitReq, submitRes);
    assert.equal(submitRes.statusCode, 202);
    const stored = await transport.result({ requestId });
    assert.equal(stored.status, "pending");
    assert.equal(JSON.stringify(stored).includes("profile_name"), false);
  });

  it("same-origin without a VeilLink operator is rejected before queueing", async () => {
    const transport = makeTransport();
    await pairDevice(transport);
    const requestId = newSecretBytes(16);
    const submitReq = Readable.from([Buffer.from(JSON.stringify({ messages: sampleMessages(), requestId }))]);
    Object.assign(submitReq, { method: "POST", url: "/api/relay-remote/submit", headers: browserHeaders(), relayTransport: transport });
    const submitRes = fakeRes();
    await handler(submitReq, submitRes);
    assert.equal(submitRes.statusCode, 401);
    assert.equal(JSON.parse(submitRes.body).error, "UNAUTHORIZED");
  });

  it("a different VeilLink user cannot submit remote jobs", async () => {
    const transport = makeTransport();
    await pairDevice(transport);
    const requestId = newSecretBytes(16);
    const submitReq = Readable.from([Buffer.from(JSON.stringify({ messages: sampleMessages(), requestId }))]);
    Object.assign(submitReq, {
      method: "POST",
      url: "/api/relay-remote/submit",
      headers: browserHeaders(),
      relayTransport: transport,
      relayOperator: { id: "fan", email: "fan@example.com" },
    });
    const submitRes = fakeRes();
    await handler(submitReq, submitRes);
    assert.equal(submitRes.statusCode, 403);
    assert.equal(JSON.parse(submitRes.body).error, "OPERATOR_FORBIDDEN");
  });

  it("whoami admits Knoxmortis and device poll still works without VeilLink", async () => {
    const transport = makeTransport();
    const paired = await pairDevice(transport);
    const whoRes = fakeRes();
    await handler({
      method: "GET",
      url: "/api/relay-remote/whoami",
      headers: browserHeaders(),
      relayTransport: transport,
      relayOperator: KNOX,
    }, whoRes);
    assert.equal(whoRes.statusCode, 200);
    assert.equal(JSON.parse(whoRes.body).operator, true);

    const pollReq = Readable.from([Buffer.from(JSON.stringify({ deviceId: DEVICE, pollNonce: newSecretBytes(16) }))]);
    Object.assign(pollReq, {
      method: "POST",
      url: "/api/relay-remote/poll",
      headers: { authorization: `Bearer ${paired.deviceToken}`, "x-relay-device-id": DEVICE },
      relayTransport: transport,
    });
    const pollRes = fakeRes();
    await handler(pollReq, pollRes);
    assert.equal(pollRes.statusCode, 200);
    assert.equal(JSON.parse(pollRes.body).empty, true);
  });
});

describe("relay remote invariants", () => {
  it("publication remains a separate human action", () => {
    const relay = fs.readFileSync(path.join(process.cwd(), "studio/relay/relay.js"), "utf8");
    const api = fs.readFileSync(path.join(process.cwd(), "api/relay-remote/[action].js"), "utf8");
    assert.match(relay, /publishedAt: null/);
    assert.match(relay, /Copy<\/button>/);
    assert.doesNotMatch(api, /publish/i);
    assert.doesNotMatch(api, /mastodon\.social|api\.twitter|bsky\.social/);
  });

  it("desktop loopback contract remains and remote transport is outbound-only", () => {
    const bridge = fs.readFileSync(path.join(process.cwd(), "scripts/relay-local-bridge.mjs"), "utf8");
    const relay = fs.readFileSync(path.join(process.cwd(), "studio/relay/relay.js"), "utf8");
    assert.match(bridge, /const HOST = "127\.0\.0\.1"/);
    assert.match(bridge, /server.listen\(PORT, HOST/);
    assert.match(bridge, /RELAY_REMOTE_URL/);
    assert.match(relay, /http:\/\/127\.0\.0\.1:4174\/api\/character/);
    assert.match(relay, /\/api\/relay-remote\/submit/);
    assert.match(relay, /hostedAuthHeaders/);
    assert.match(relay, /app\.veildaemon\.app\/login\?next=\/relay-access/);
    assert.match(relay, /ensureHostedOperator/);
    assert.match(relay, /No engine work runs until then/);
    assert.doesNotMatch(bridge, /WebSocket/);
    assert.doesNotMatch(relay, /new WebSocket/);
  });

  it("hosted OpenAI fallback module is unchanged as a recovery path", () => {
    const character = fs.readFileSync(path.join(process.cwd(), "api/character.js"), "utf8");
    assert.match(character, /HOSTED_ENGINE_NOT_CONFIGURED|openai\.com\/v1\/responses/);
    assert.match(character, /x-relay-request/);
    assert.match(character, /requireRelayOperator/);
  });

  it("hosted inference spend requires Knoxmortis VeilLink identity before engine selection", () => {
    const relay = fs.readFileSync(path.join(process.cwd(), "studio/relay/relay.js"), "utf8");
    const character = fs.readFileSync(path.join(process.cwd(), "api/character.js"), "utf8");
    const api = fs.readFileSync(path.join(process.cwd(), "api/relay-remote/[action].js"), "utf8");
    assert.match(relay, /state\.operatorReady \|\| await ensureHostedOperator/);
    assert.match(relay, /if \(!IS_LOCAL_BRIDGE && !state\.operatorReady\)/);
    assert.match(character, /requireRelayOperator/);
    assert.match(api, /requireHostedOperator/);
    assert.match(api, /action === "whoami"/);
  });

  it("remote requests cannot escalate Forge authority", () => {
    const adapter = fs.readFileSync(path.join(process.cwd(), "lib/veilforgeRemoteTurn.js"), "utf8");
    const api = fs.readFileSync(path.join(process.cwd(), "api/relay-remote/[action].js"), "utf8");
    const relay = fs.readFileSync(path.join(process.cwd(), "studio/relay/relay.js"), "utf8");
    assert.match(adapter, /Intentionally omits profile_name/);
    assert.match(adapter, /profile_name_forbidden/);
    assert.doesNotMatch(api, /profile_name/);
    assert.doesNotMatch(relay, /profile_name/);
    assert.doesNotMatch(api, /console\.(log|info|warn|error)\([^)]*messages/);
  });
});
