const { createTransport, transportError, newSecretBytes } = require("../../lib/relayRemoteTransport");

function json(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  Object.entries(extraHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

function routeAction(req) {
  if (req.query && typeof req.query.action === "string") return req.query.action;
  const path = String(req.url || "").split("?")[0];
  return path.split("/").filter(Boolean).pop() || "";
}

function requestHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
}

function authorizedBrowser(req) {
  if (req.headers["x-relay-request"] !== "character-v1") return false;
  if (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-origin") return false;
  const origin = String(req.headers.origin || "");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.host.toLowerCase() === requestHost(req);
  } catch (_error) {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 60_000) {
        reject(Object.assign(new Error("INPUT_TOO_LARGE"), { statusCode: 413, code: "INPUT_TOO_LARGE" }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function bearer(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : String(req.headers["x-relay-device-token"] || "").trim();
}

function logStructural(event, fields) {
  console.warn("RelayDaemon remote transport", { event, ...fields });
}

function createDefaultTransport() {
  return createTransport({
    durableRequired: process.env.VERCEL === "1" || process.env.RELAY_REMOTE_REQUIRE_REDIS === "1",
  });
}

function fail(res, error) {
  const code = error?.code || error?.message || "REMOTE_FAILED";
  const status = error?.statusCode || 400;
  logStructural("error", { code, status });
  return json(res, status, { status: "error", error: code });
}

function deviceAuth(req, body) {
  return {
    deviceId: body.deviceId || req.headers["x-relay-device-id"],
    deviceToken: bearer(req),
  };
}

module.exports = async function handler(req, res) {
  const action = routeAction(req);
  const transport = req.relayTransport || createDefaultTransport();

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }

  try {
    if (action === "status") {
      if (req.method !== "GET") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
      if (!authorizedBrowser(req)) return json(res, 401, { status: "error", error: "UNAUTHORIZED" });
      const snapshot = await transport.status();
      logStructural("status", { localBridge: snapshot.localBridge, durableStore: snapshot.durableStore });
      return json(res, 200, { status: "ok", ...snapshot });
    }

    if (action === "pair") {
      if (req.method !== "POST") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = await transport.pair({
        pairingSecret: req.headers["x-relay-pairing-secret"] || body.pairingSecret,
        deviceId: body.deviceId,
      });
      logStructural("pair", { deviceId: out.deviceId });
      return json(res, 200, { status: "ok", ...out });
    }

    if (action === "revoke") {
      if (req.method !== "POST") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = await transport.revoke({
        pairingSecret: req.headers["x-relay-pairing-secret"] || body.pairingSecret,
        deviceId: body.deviceId,
      });
      logStructural("revoke", { deviceId: out.deviceId });
      return json(res, 200, { status: "ok", ...out });
    }

    if (action === "heartbeat") {
      if (req.method !== "POST") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const device = await transport.authorizeDevice(deviceAuth(req, body));
      const out = await transport.heartbeat(device);
      logStructural("heartbeat", { deviceId: out.deviceId });
      return json(res, 200, { status: "ok", ...out });
    }

    if (action === "submit") {
      if (req.method !== "POST") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
      if (!authorizedBrowser(req)) return json(res, 401, { status: "error", error: "UNAUTHORIZED" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = await transport.submit({
        messages: body.messages,
        requestId: body.requestId,
        deviceId: body.deviceId,
      });
      logStructural("submit", { requestId: out.requestId, status: out.status });
      return json(res, 202, { status: "ok", ...out });
    }

    if (action === "poll") {
      if (req.method !== "POST") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = await transport.poll({
        ...deviceAuth(req, body),
        pollNonce: body.pollNonce || newSecretBytes(16),
      });
      logStructural("poll", { empty: Boolean(out.empty), requestId: out.request?.requestId || null });
      return json(res, 200, { status: "ok", ...out });
    }

    if (action === "complete") {
      if (req.method !== "POST") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = await transport.complete({
        ...deviceAuth(req, body),
        requestId: body.requestId,
        result: body.result,
        error: body.error,
        completeNonce: body.completeNonce || newSecretBytes(16),
      });
      logStructural("complete", { requestId: out.requestId, status: out.status });
      return json(res, 200, { status: "ok", ...out });
    }

    if (action === "result") {
      if (req.method !== "GET") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
      if (!authorizedBrowser(req)) return json(res, 401, { status: "error", error: "UNAUTHORIZED" });
      const url = new URL(req.url || "/", "https://relay.local");
      const requestId = (req.query && req.query.requestId) || url.searchParams.get("requestId");
      const out = await transport.result({ requestId });
      logStructural("result", { requestId: out.requestId, status: out.status });
      return json(res, 200, { status: "ok", ...out });
    }

    return json(res, 404, { status: "error", error: "UNKNOWN_ACTION" });
  } catch (error) {
    if (error instanceof SyntaxError) return fail(res, transportError("MALFORMED_REQUEST"));
    return fail(res, error);
  }
};
