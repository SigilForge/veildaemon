const memoryQueue = [];
const MAX_QUEUE_LENGTH = 80;

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

async function enqueue(alert) {
  const record = createAlert(alert);
  const serialized = JSON.stringify(record);

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    await redisCommand(["LPUSH", "veildaemon:stream-alerts", serialized]);
    await redisCommand(["LTRIM", "veildaemon:stream-alerts", "0", String(MAX_QUEUE_LENGTH - 1)]);
    return record;
  }

  memoryQueue.unshift(record);
  memoryQueue.splice(MAX_QUEUE_LENGTH);
  return record;
}

async function dequeue(count = 1) {
  const safeCount = Math.max(1, Math.min(Number(count) || 1, 6));

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const alerts = [];
    for (let index = 0; index < safeCount; index += 1) {
      const item = await redisCommand(["RPOP", "veildaemon:stream-alerts"]);
      if (!item) break;
      alerts.push(JSON.parse(item));
    }
    return alerts;
  }

  return memoryQueue.splice(-safeCount).reverse();
}

module.exports = {
  createAlert,
  dequeue,
  enqueue,
  json,
  readBody,
  requireAdmin,
};
