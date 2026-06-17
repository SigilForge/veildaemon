const memoryQueue = [];
const memoryFeed = [];
const MAX_QUEUE_LENGTH = 80;
const MAX_FEED_LENGTH = 120;
const QUEUE_KEY = "veildaemon:stream-alerts";
const FEED_KEY = "veildaemon:stream-alerts-feed";
const CURRENT_KEY = "veildaemon:stream-alerts-current";
const CURRENT_LOCK_KEY = "veildaemon:stream-alerts-current-lock";
let memoryCurrent = null;
let memoryLockUntil = 0;

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
  const redis = redisEnv();
  return {
    upstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    upstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    kvUrl: Boolean(process.env.KV_REST_API_URL),
    kvToken: Boolean(process.env.KV_REST_API_TOKEN),
    redisUrlSource: redis.urlSource,
    redisTokenSource: redis.tokenSource,
    adminToken: Boolean(process.env.ALERT_ADMIN_TOKEN),
    twitchSecret: Boolean(process.env.TWITCH_EVENTSUB_SECRET),
  };
}

function queueBackend() {
  const redis = redisEnv();
  return redis.url && redis.token ? "upstash" : "memory";
}

function redisEnv() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  return {
    url: upstashUrl || kvUrl || "",
    token: upstashToken || kvToken || "",
    urlSource: upstashUrl ? "UPSTASH_REDIS_REST_URL" : kvUrl ? "KV_REST_API_URL" : "",
    tokenSource: upstashToken ? "UPSTASH_REDIS_REST_TOKEN" : kvToken ? "KV_REST_API_TOKEN" : "",
  };
}

async function redisCommand(command) {
  const { url, token } = redisEnv();
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

async function redisGetJson(key) {
  const value = await redisCommand(["GET", key]);
  return value ? JSON.parse(value) : null;
}

async function redisSetJson(key, value, ttlSeconds) {
  const command = ["SET", key, JSON.stringify(value)];
  if (ttlSeconds) command.push("EX", String(ttlSeconds));
  return redisCommand(command);
}

async function redisAcquireLock(key, ttlMs) {
  const result = await redisCommand(["SET", key, String(Date.now()), "NX", "PX", String(ttlMs)]);
  return result === "OK";
}

async function queueLength() {
  if (queueBackend() === "upstash") {
    return Number(await redisCommand(["LLEN", QUEUE_KEY]));
  }

  return memoryQueue.length;
}

async function feedLength() {
  if (queueBackend() === "upstash") {
    return Number(await redisCommand(["LLEN", FEED_KEY]));
  }

  return memoryFeed.length;
}

async function queueDiagnostics(extra = {}, options = {}) {
  const backend = queueBackend();
  const includeLengths = options.includeLengths !== false;
  const diagnostics = {
    backend,
    env: envStatus(),
    readFromUpstash: backend === "upstash",
    queueLength: null,
    feedLength: null,
    ...extra,
  };

  if (includeLengths) {
    try {
      diagnostics.queueLength = await queueLength();
    } catch (error) {
      diagnostics.queueLengthError = error.message;
    }

    try {
      diagnostics.feedLength = await feedLength();
    } catch (error) {
      diagnostics.feedLengthError = error.message;
    }
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

async function popOneQueuedAlert() {
  if (queueBackend() === "upstash") {
    const item = await redisCommand(["RPOP", QUEUE_KEY]);
    return item ? JSON.parse(item) : null;
  }

  return memoryQueue.pop() || null;
}

function isFreshAlert(alert, maxAgeMs, now = Date.now()) {
  if (!alert || !maxAgeMs) return Boolean(alert);
  const createdAt = Date.parse(alert.createdAt || "");
  return Number.isFinite(createdAt) && now - createdAt <= maxAgeMs;
}

function isActiveCurrent(record, now = Date.now(), maxAgeMs = 0) {
  return record
    && record.alert
    && Date.parse(record.expiresAt || "") > now
    && isFreshAlert(record.alert, maxAgeMs, now);
}

async function getStoredCurrent() {
  if (queueBackend() === "upstash") {
    return redisGetJson(CURRENT_KEY);
  }

  return memoryCurrent;
}

async function setStoredCurrent(record, holdMs) {
  if (queueBackend() === "upstash") {
    return redisSetJson(CURRENT_KEY, record, Math.max(1, Math.ceil(holdMs / 1000) + 2));
  }

  memoryCurrent = record;
  return "OK";
}

async function currentAlert(options = {}) {
  const holdMs = Math.max(1500, Math.min(Number(options.holdMs) || 9000, 30000));
  const maxAgeMs = Math.max(0, Math.min(Number(options.maxAgeMs) || 120000, 900000));
  const now = Date.now();
  const current = await getStoredCurrent();
  if (isActiveCurrent(current, now, maxAgeMs)) {
    return {
      alert: current.alert,
      currentId: current.id,
      expiresAt: current.expiresAt,
      promoted: false,
      diagnostics: await queueDiagnostics({ holdMs, maxAgeMs, currentActive: true }, { includeLengths: false }),
    };
  }

  let locked = true;
  if (queueBackend() === "upstash") {
    locked = await redisAcquireLock(CURRENT_LOCK_KEY, 1800);
  } else if (memoryLockUntil > now) {
    locked = false;
  } else {
    memoryLockUntil = now + 1800;
  }

  if (!locked) {
    const lockedCurrent = await getStoredCurrent();
    return {
      alert: isActiveCurrent(lockedCurrent, Date.now(), maxAgeMs) ? lockedCurrent.alert : null,
      currentId: lockedCurrent && lockedCurrent.id ? lockedCurrent.id : "",
      expiresAt: lockedCurrent && lockedCurrent.expiresAt ? lockedCurrent.expiresAt : "",
      promoted: false,
      diagnostics: await queueDiagnostics({ holdMs, maxAgeMs, dispatcherLocked: true }, { includeLengths: false }),
    };
  }

  const refreshed = await getStoredCurrent();
  if (isActiveCurrent(refreshed, Date.now(), maxAgeMs)) {
    return {
      alert: refreshed.alert,
      currentId: refreshed.id,
      expiresAt: refreshed.expiresAt,
      promoted: false,
      diagnostics: await queueDiagnostics({ holdMs, maxAgeMs, currentActive: true }, { includeLengths: false }),
    };
  }

  let alert = null;
  let discardedStale = 0;
  for (let index = 0; index < MAX_QUEUE_LENGTH; index += 1) {
    const candidate = await popOneQueuedAlert();
    if (!candidate) break;
    if (isFreshAlert(candidate, maxAgeMs, now)) {
      alert = candidate;
      break;
    }
    discardedStale += 1;
  }

  if (!alert) {
    return {
      alert: null,
      currentId: "",
      expiresAt: "",
      promoted: false,
      diagnostics: await queueDiagnostics({ holdMs, maxAgeMs, queueEmpty: true, discardedStale }, { includeLengths: false }),
    };
  }

  const record = {
    id: alert.id,
    alert,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + holdMs).toISOString(),
  };
  await setStoredCurrent(record, holdMs);

  return {
    alert: record.alert,
    currentId: record.id,
    expiresAt: record.expiresAt,
    promoted: true,
    diagnostics: await queueDiagnostics({ holdMs, maxAgeMs, currentActive: true, discardedStale }, { includeLengths: false }),
  };
}

async function recentAlerts(options = {}) {
  const safeCount = Math.max(1, Math.min(Number(options.count) || 30, MAX_FEED_LENGTH));
  const sinceMs = options.since ? Date.parse(options.since) : 0;
  const source = queueBackend() === "upstash"
    ? await redisCommand(["LRANGE", FEED_KEY, "0", String(safeCount - 1)])
    : memoryFeed.slice(0, safeCount);

  const alerts = (source || [])
    .map((item) => (typeof item === "string" ? JSON.parse(item) : item))
    .filter((alert) => {
      if (!sinceMs) return true;
      const createdAt = Date.parse(alert.createdAt || "");
      return Number.isFinite(createdAt) && createdAt >= sinceMs;
    })
    .sort((first, second) => Date.parse(first.createdAt || "") - Date.parse(second.createdAt || ""));

  return {
    alerts,
    diagnostics: await queueDiagnostics(
      { requested: safeCount, feedSince: options.since || "" },
      { includeLengths: false },
    ),
  };
}

module.exports = {
  createAlert,
  currentAlert,
  dequeue,
  enqueue,
  recentAlerts,
  queueDiagnostics,
  json,
  readBody,
  requireAdmin,
};
