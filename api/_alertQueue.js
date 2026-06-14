const memoryQueue = [];
const MAX_QUEUE_LENGTH = 80;
const QUEUE_KEY = "veildaemon:stream-alerts";

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function requireAdmin(req, res) {
  const expected = process.env.ALERT_ADMIN_TOKEN;
  if (!expected) {
    json(res, 503, { ok: false, error: "Alert admin token is not configured." });
    return false;
  }

  const supplied = getBearerToken(req) || req.headers["x-alert-admin-token"];
  if (supplied !== expected) {
    json(res, 401, { ok: false, error: "Alert admin token rejected." });
    return false;
  }

  return true;
}

function createAlert(input) {
  const alert = input && typeof input === "object" ? input : {};
  return {
    id: alert.id || `alert-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: alert.type || "follow",
    user: alert.user || alert.username || "UnclassifiedObserver",
    count: Number(alert.count || alert.viewers || alert.bits || 1),
    months: Number(alert.months || alert.cumulativeMonths || 1),
    level: Number(alert.level || alert.hypeLevel || 1),
    amount: alert.amount || "",
    createdAt: new Date().toISOString(),
  };
}

function envStatus() {
  return {
    upstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    upstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    adminToken: Boolean(process.env.ALERT_ADMIN_TOKEN),
    twitchSecret: Boolean(process.env.TWITCH_EVENTSUB_SECRET),
  };
}

function queueBackend() {
  const env = envStatus();
  return env.upstashUrl && env.upstashToken ? "upstash" : "memory";
}

async function redisCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const response = await fetch(`${url.replace(/\/$/, "")}/${command.map(encodeURIComponent).join("/")}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Redis command failed with ${response.status}`);
  }

  const payload = await response.json();
  return payload.result;
}

async function queueLength() {
  if (queueBackend() === "upstash") {
    return Number(await redisCommand(["LLEN", QUEUE_KEY]));
  }

  return memoryQueue.length;
}

async function queueDiagnostics(extra = {}) {
  const backend = queueBackend();
  const diagnostics = {
    backend,
    env: envStatus(),
    readFromUpstash: backend === "upstash",
    queueLength: null,
    ...extra,
  };

  try {
    diagnostics.queueLength = await queueLength();
  } catch (error) {
    diagnostics.queueLengthError = error.message;
  }

  return diagnostics;
}

async function enqueue(alert) {
  const record = createAlert(alert);
  const serialized = JSON.stringify(record);

  if (queueBackend() === "upstash") {
    await redisCommand(["LPUSH", QUEUE_KEY, serialized]);
    await redisCommand(["LTRIM", QUEUE_KEY, "0", String(MAX_QUEUE_LENGTH - 1)]);
    return {
      alert: record,
      diagnostics: await queueDiagnostics({ pushed: true }),
    };
  }

  memoryQueue.unshift(record);
  memoryQueue.splice(MAX_QUEUE_LENGTH);
  return {
    alert: record,
    diagnostics: await queueDiagnostics({ pushed: true }),
  };
}

async function dequeue(count = 1) {
  const safeCount = Math.max(1, Math.min(Number(count) || 1, 6));

  if (queueBackend() === "upstash") {
    const alerts = [];
    for (let index = 0; index < safeCount; index += 1) {
      const item = await redisCommand(["RPOP", QUEUE_KEY]);
      if (!item) break;
      alerts.push(JSON.parse(item));
    }
    return {
      alerts,
      diagnostics: await queueDiagnostics({ requested: safeCount }),
    };
  }

  return {
    alerts: memoryQueue.splice(-safeCount).reverse(),
    diagnostics: await queueDiagnostics({ requested: safeCount }),
  };
}

module.exports = {
  createAlert,
  dequeue,
  enqueue,
  queueDiagnostics,
  json,
  readBody,
  requireAdmin,
};
