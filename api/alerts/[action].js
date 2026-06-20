const {
  currentAlert,
  enqueue,
  json,
  queueDiagnostics,
  readBody,
  recentAlerts,
  requireAdmin,
} = require("../../lib/alertQueue");

const BUILD_MARKER = "HEALTH_DIAG_2026_06_14_PRIMAL_GLASS_TAP";

function routeAction(req) {
  if (req.query && typeof req.query.action === "string") {
    return req.query.action;
  }

  const path = String(req.url || "").split("?")[0];
  return path.split("/").filter(Boolean).pop() || "";
}

function matchingEnvKeys() {
  return Object.keys(process.env)
    .filter((key) => /(UPSTASH|REDIS|KV|ALERT|TWITCH)/i.test(key))
    .sort();
}

async function handleCurrent(req, res, asList = false) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const result = await currentAlert({
    holdMs: req.query && req.query.holdMs,
    minHoldMs: req.query && req.query.minHoldMs,
    maxAgeMs: req.query && req.query.maxAgeMs,
    client: req.query && req.query.client,
  });

  return json(res, 200, {
    ok: true,
    ...(asList ? { alerts: result.alert ? [result.alert] : [] } : { alert: result.alert }),
    currentId: result.currentId,
    expiresAt: result.expiresAt,
    promoted: result.promoted,
    seenBy: result.seenBy,
    diagnostics: result.diagnostics,
  });
}

async function handleFeed(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const result = await recentAlerts({
    count: req.query && req.query.count,
    since: req.query && req.query.since,
  });
  return json(res, 200, {
    ok: true,
    alerts: result.alerts,
    diagnostics: result.diagnostics,
  });
}

async function handleHealth(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  return json(res, 200, {
    ok: true,
    service: "alerts",
    buildMarker: BUILD_MARKER,
    runtime: {
      nodeEnv: process.env.NODE_ENV || "",
      vercelEnv: process.env.VERCEL_ENV || "",
    },
    detectedEnvKeys: matchingEnvKeys(),
    diagnostics: await queueDiagnostics(),
  });
}

async function handleTest(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  if (!requireAdmin(req, res)) return undefined;

  const body = await readBody(req);
  const payload = body ? JSON.parse(body) : {};
  const result = await enqueue(payload);
  return json(res, 200, {
    ok: true,
    pushed: true,
    alert: result.alert,
    diagnostics: result.diagnostics,
  });
}

module.exports = async function handler(req, res) {
  try {
    const action = routeAction(req);
    if (action === "current") return await handleCurrent(req, res);
    if (action === "next") return await handleCurrent(req, res, true);
    if (action === "feed") return await handleFeed(req, res);
    if (action === "health") return await handleHealth(req, res);
    if (action === "test") return await handleTest(req, res);

    return json(res, 404, { ok: false, error: "Alert route not found." });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      service: "alerts",
      buildMarker: BUILD_MARKER,
      error: error.message,
    });
  }
};
