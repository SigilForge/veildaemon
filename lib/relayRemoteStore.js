/**
 * Bounded key-value store for RelayDaemon remote transport.
 * Memory is the test/default backend. Upstash/Vercel KV is used when already configured.
 * Do not persist prompt or draft content to logs; values here are short-TTL transport state.
 *
 * Redis commands use POST bodies so character packages are not truncated by URL length.
 */
const PREFIX = "veildaemon:relay-remote:";

function redisEnv() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  return {
    url: upstashUrl || kvUrl || "",
    token: upstashToken || kvToken || "",
  };
}

function backend() {
  const redis = redisEnv();
  return redis.url && redis.token ? "upstash" : "memory";
}

function nowMs(clock) {
  return typeof clock === "function" ? clock() : Date.now();
}

function namespaced(key) {
  return `${PREFIX}${key}`;
}

function pruneMemory(map, clock) {
  const now = nowMs(clock);
  for (const [key, entry] of map.entries()) {
    if (entry.expiresAt && entry.expiresAt <= now) map.delete(key);
  }
}

function decodeRedisValue(raw) {
  if (raw == null) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return raw;
  }
}

async function redisCommand(command) {
  const { url, token } = redisEnv();
  if (!url || !token) return null;
  const response = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`REDIS_COMMAND_FAILED:${response.status}`);
  const payload = await response.json();
  return payload.result;
}

function createMemoryStore(options = {}) {
  const clock = options.now || Date.now;
  const memory = options.memory || new Map();
  return {
    backend: "memory",
    async get(key) {
      pruneMemory(memory, clock);
      const entry = memory.get(namespaced(key));
      if (!entry) return null;
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      const ttl = Number(ttlSeconds) || 0;
      memory.set(namespaced(key), {
        value,
        expiresAt: ttl > 0 ? nowMs(clock) + ttl * 1000 : 0,
      });
    },
    async del(key) {
      memory.delete(namespaced(key));
    },
    async addToSet(key, member, ttlSeconds) {
      pruneMemory(memory, clock);
      const ns = namespaced(key);
      const entry = memory.get(ns) || { value: new Set(), expiresAt: 0 };
      const set = entry.value instanceof Set ? entry.value : new Set(entry.value || []);
      set.add(member);
      const ttl = Number(ttlSeconds) || 0;
      memory.set(ns, { value: set, expiresAt: ttl > 0 ? nowMs(clock) + ttl * 1000 : entry.expiresAt });
    },
    async setHas(key, member) {
      pruneMemory(memory, clock);
      const entry = memory.get(namespaced(key));
      if (!entry) return false;
      const set = entry.value instanceof Set ? entry.value : new Set(entry.value || []);
      return set.has(member);
    },
    async llen(key) {
      pruneMemory(memory, clock);
      const entry = memory.get(namespaced(key));
      return Array.isArray(entry?.value) ? entry.value.length : 0;
    },
    async lpush(key, value) {
      pruneMemory(memory, clock);
      const ns = namespaced(key);
      const entry = memory.get(ns) || { value: [], expiresAt: 0 };
      const list = Array.isArray(entry.value) ? entry.value : [];
      list.unshift(value);
      entry.value = list;
      memory.set(ns, entry);
    },
    async rpop(key) {
      pruneMemory(memory, clock);
      const entry = memory.get(namespaced(key));
      if (!entry || !Array.isArray(entry.value) || entry.value.length === 0) return null;
      return entry.value.pop();
    },
  };
}

function createRedisStore() {
  return {
    backend: "upstash",
    async get(key) {
      return decodeRedisValue(await redisCommand(["GET", namespaced(key)]));
    },
    async set(key, value, ttlSeconds) {
      const encoded = JSON.stringify(value);
      const command = ["SET", namespaced(key), encoded];
      if (ttlSeconds) command.push("EX", String(ttlSeconds));
      return redisCommand(command);
    },
    async del(key) {
      return redisCommand(["DEL", namespaced(key)]);
    },
    async addToSet(key, member, ttlSeconds) {
      await redisCommand(["SADD", namespaced(key), String(member)]);
      if (ttlSeconds) await redisCommand(["EXPIRE", namespaced(key), String(ttlSeconds)]);
    },
    async setHas(key, member) {
      return Number(await redisCommand(["SISMEMBER", namespaced(key), String(member)])) === 1;
    },
    async llen(key) {
      return Number(await redisCommand(["LLEN", namespaced(key)])) || 0;
    },
    async lpush(key, value) {
      return redisCommand(["LPUSH", namespaced(key), String(value)]);
    },
    async rpop(key) {
      return decodeRedisValue(await redisCommand(["RPOP", namespaced(key)]));
    },
  };
}

function createStore(options = {}) {
  if (options.store) return options.store;
  if (options.backend === "memory") return createMemoryStore(options);
  if (backend() === "upstash" && options.backend !== "memory") return createRedisStore();
  return createMemoryStore(options);
}

module.exports = {
  backend,
  createStore,
  createMemoryStore,
};
