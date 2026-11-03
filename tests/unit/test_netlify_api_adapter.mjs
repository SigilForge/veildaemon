import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import handleApiRequest, { config } from "../../netlify/functions/api.mjs";

const origin = "https://netlify-preview.example";

function call(path, options) {
  return handleApiRequest(new Request(origin + path, options));
}

test("Netlify keeps the original /api route contract", () => {
  assert.equal(config.path, "/api/*");
});

test("debug ping responds through the compatibility adapter", async () => {
  const res = await call("/api/debug/ping");
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.marker, "PRIMAL_GLASS_TAP");
});

test("method rejection keeps status and Allow header", async () => {
  const res = await call("/api/debug/ping", { method: "POST" });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET");
});

test("unknown API routes fail closed", async () => {
  const res = await call("/api/nonexistent");
  assert.equal(res.status, 404);
  assert.equal((await res.json()).ok, false);
});

test("Discord route cannot expose a target without a configured key", async () => {
  const res = await call("/api/route?key=unknown-test-key");
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("location"), null);
});

test("Twitch EventSub signature covers exact raw request bytes", async () => {
  const previousSecret = process.env.TWITCH_EVENTSUB_SECRET;
  const secret = "local-test-secret";
  process.env.TWITCH_EVENTSUB_SECRET = secret;
  try {
    const id = "eventsub-bridge-test";
    const timestamp = "2026-11-02T21:00:00Z";
    const body = '{ "challenge" : "netlify-verified", "subscription": {}, "event": {} }';
    const signature = "sha256=" + createHmac("sha256", secret).update(id + timestamp + body).digest("hex");
    const res = await call("/api/twitch/eventsub", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": timestamp,
        "Twitch-Eventsub-Message-Signature": signature,
        "Twitch-Eventsub-Message-Type": "webhook_callback_verification",
      },
      body,
    });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "netlify-verified");
  } finally {
    if (previousSecret === undefined) delete process.env.TWITCH_EVENTSUB_SECRET;
    else process.env.TWITCH_EVENTSUB_SECRET = previousSecret;
  }
});

test("Twitch EventSub rejects forged signatures", async () => {
  const res = await call("/api/twitch/eventsub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge: "not-trusted" }),
  });
  assert.equal(res.status, 403);
});
