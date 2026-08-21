/**
 * Authenticated remote transport for RelayDaemon.
 * Local VeilDaemon initiates the outbound relationship. Hosted Vercel never opens
 * a public path to Ollama, VeilForge, or 127.0.0.1:4174.
 */
const crypto = require("crypto");
const { createStore } = require("./relayRemoteStore");

const SCHEMA_VERSION = 1;
const REQUEST_ID_RE = /^[a-f0-9]{32,128}$/i;
const DEVICE_ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const MAX_BODY_BYTES = 60_000;
const MAX_MESSAGE_CHARS = 48_000;
const MAX_QUEUE_DEPTH = 4;
const REQUEST_TTL_SEC = 240;
const RESULT_TTL_SEC = 60;
const NONCE_TTL_SEC = 120;
const DEVICE_TTL_SEC = 30 * 24 * 60 * 60;
const ONLINE_WINDOW_MS = 90_000;
const DEFAULT_TIMEOUT_MS = 240_000;

const CHARACTER_FIELDS = ["x", "threads", "bluesky", "mastodon"];

function transportError(code, statusCode = 400, extra = {}) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

function timingSafeEqualHex(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function secretsEqual(provided, expected) {
  const a = crypto.createHash("sha256").update(String(provided || "")).digest();
  const b = crypto.createHash("sha256").update(String(expected || "")).digest();
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hashToken(secret, token) {
  return crypto.createHmac("sha256", String(secret || "")).update(String(token || "")).digest("hex");
}

function newSecretBytes(size = 32) {
  return crypto.randomBytes(size).toString("hex");
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    throw transportError("MALFORMED_REQUEST");
  }
  let chars = 0;
  const messages = value.map((message) => {
    if (!message || !["system", "user"].includes(message.role) || typeof message.content !== "string") {
      throw transportError("MALFORMED_REQUEST");
    }
    chars += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (chars > MAX_MESSAGE_CHARS) throw transportError("INPUT_TOO_LARGE", 413);
  const encoded = Buffer.byteLength(JSON.stringify({ messages }), "utf8");
  if (encoded > MAX_BODY_BYTES) throw transportError("INPUT_TOO_LARGE", 413);
  return messages;
}

function validateCharacterResult(value) {
  if (!value || typeof value !== "object") throw transportError("MALFORMED_RESULT");
  if (typeof value.masterDraft !== "string" || value.masterDraft.trim().length < 40) {
    throw transportError("MALFORMED_RESULT");
  }
  const drafts = value.platformDrafts;
  if (!drafts || typeof drafts !== "object") throw transportError("MALFORMED_RESULT");
  for (const field of CHARACTER_FIELDS) {
    if (typeof drafts[field] !== "string" || drafts[field].trim().length < 40) {
      throw transportError("MALFORMED_RESULT");
    }
  }
  const validation = value.validation;
  if (!validation || typeof validation !== "object") throw transportError("MALFORMED_RESULT");
  if (typeof validation.voiceMatch !== "number" || typeof validation.sourceFidelity !== "number") {
    throw transportError("MALFORMED_RESULT");
  }
  if (typeof validation.canonSafe !== "boolean" || typeof validation.knowledgeBoundarySafe !== "boolean") {
    throw transportError("MALFORMED_RESULT");
  }
  if (!Array.isArray(validation.characterMarkers) || !Array.isArray(validation.warnings)) {
    throw transportError("MALFORMED_RESULT");
  }
  return {
    masterDraft: value.masterDraft,
    platformDrafts: {
      x: drafts.x,
      threads: drafts.threads,
      bluesky: drafts.bluesky,
      mastodon: drafts.mastodon,
    },
    validation: {
      voiceMatch: validation.voiceMatch,
      sourceFidelity: validation.sourceFidelity,
      canonSafe: validation.canonSafe,
      knowledgeBoundarySafe: validation.knowledgeBoundarySafe,
      characterMarkers: validation.characterMarkers.filter((item) => typeof item === "string").slice(0, 12),
      warnings: validation.warnings.filter((item) => typeof item === "string").slice(0, 12),
    },
  };
}

function createTransport(options = {}) {
  const store = createStore(options);
  const now = options.now || Date.now;
  const pairingSecret = String(options.pairingSecret || process.env.RELAY_REMOTE_PAIRING_SECRET || "");
  const requestTtlSec = options.requestTtlSec || REQUEST_TTL_SEC;
  const resultTtlSec = options.resultTtlSec || RESULT_TTL_SEC;
  const maxQueue = options.maxQueueDepth || MAX_QUEUE_DEPTH;
  const onlineWindowMs = options.onlineWindowMs || ONLINE_WINDOW_MS;
  const durableRequired = options.durableRequired === true;

  function requireSecret() {
    if (!pairingSecret) throw transportError("PAIRING_NOT_CONFIGURED", 503);
  }

  function deviceKey(deviceId) {
    return `device:${deviceId}`;
  }

  function requestKey(requestId) {
    return `request:${requestId}`;
  }

  function queueKey(deviceId) {
    return `queue:${deviceId}`;
  }

  function nonceKey(deviceId) {
    return `nonce:${deviceId}`;
  }

  async function loadDevice(deviceId) {
    return store.get(deviceKey(deviceId));
  }

  async function saveDevice(device, ttl = DEVICE_TTL_SEC) {
    await store.set(deviceKey(device.deviceId), device, ttl);
  }

  function isOnline(device) {
    if (!device || device.revokedAt) return false;
    return now() - Number(device.lastSeenAt || 0) <= onlineWindowMs;
  }

  async function pair({ pairingSecret: providedSecret, deviceId }) {
    requireSecret();
    if (!secretsEqual(providedSecret, pairingSecret)) throw transportError("UNAUTHORIZED", 401);
    const id = String(deviceId || "").trim().toLowerCase();
    if (!DEVICE_ID_RE.test(id)) throw transportError("MALFORMED_REQUEST");
    const deviceToken = newSecretBytes(32);
    const record = {
      deviceId: id,
      tokenHash: hashToken(pairingSecret, deviceToken),
      createdAt: now(),
      lastSeenAt: now(),
      revokedAt: null,
    };
    await saveDevice(record);
    return { deviceId: id, deviceToken, schemaVersion: SCHEMA_VERSION };
  }

  async function revoke({ pairingSecret: providedSecret, deviceId }) {
    requireSecret();
    if (!secretsEqual(providedSecret, pairingSecret)) throw transportError("UNAUTHORIZED", 401);
    const id = String(deviceId || "").trim().toLowerCase();
    const device = await loadDevice(id);
    if (!device) throw transportError("DEVICE_NOT_FOUND", 404);
    device.revokedAt = now();
    await saveDevice(device);
    return { deviceId: id, revoked: true };
  }

  async function authorizeDevice({ deviceId, deviceToken }) {
    requireSecret();
    const id = String(deviceId || "").trim().toLowerCase();
    const token = String(deviceToken || "").trim();
    if (!DEVICE_ID_RE.test(id) || !token) throw transportError("UNAUTHORIZED", 401);
    const device = await loadDevice(id);
    if (!device || device.revokedAt) throw transportError("UNAUTHORIZED", 401);
    const expected = device.tokenHash;
    const actual = hashToken(pairingSecret, token);
    if (!timingSafeEqualHex(expected, actual)) throw transportError("UNAUTHORIZED", 401);
    return device;
  }

  async function heartbeat(device) {
    device.lastSeenAt = now();
    await saveDevice(device);
    return { deviceId: device.deviceId, online: true, lastSeenAt: device.lastSeenAt };
  }

  async function status({ deviceId } = {}) {
    const configured = Boolean(pairingSecret);
    if (!configured) {
      return {
        schemaVersion: SCHEMA_VERSION,
        configured: false,
        localBridge: "unconfigured",
        durableStore: store.backend,
      };
    }
    if (durableRequired && store.backend === "memory") {
      return {
        schemaVersion: SCHEMA_VERSION,
        configured: true,
        localBridge: "store_unavailable",
        durableStore: store.backend,
      };
    }
    const id = String(deviceId || process.env.RELAY_DEVICE_ID || "home-primary").trim().toLowerCase();
    const device = await loadDevice(id);
    if (!device) {
      return { schemaVersion: SCHEMA_VERSION, configured: true, localBridge: "unpaired", durableStore: store.backend, deviceId: id };
    }
    if (device.revokedAt) {
      return { schemaVersion: SCHEMA_VERSION, configured: true, localBridge: "revoked", durableStore: store.backend, deviceId: id };
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      configured: true,
      localBridge: isOnline(device) ? "online" : "offline",
      durableStore: store.backend,
      deviceId: id,
      lastSeenAt: device.lastSeenAt || null,
    };
  }

  async function submit({ messages, requestId, deviceId }) {
    if (durableRequired && store.backend === "memory") {
      throw transportError("REMOTE_STORE_UNAVAILABLE", 503);
    }
    requireSecret();
    const id = String(deviceId || process.env.RELAY_DEVICE_ID || "home-primary").trim().toLowerCase();
    const rid = String(requestId || "").trim().toLowerCase();
    if (!REQUEST_ID_RE.test(rid)) throw transportError("MALFORMED_REQUEST");
    const existing = await store.get(requestKey(rid));
    if (existing) throw transportError("REQUEST_REPLAY", 409);
    const normalized = validateMessages(messages);
    const device = await loadDevice(id);
    if (!device || device.revokedAt) throw transportError("LOCAL_DAEMON_OFFLINE", 503);
    if (!isOnline(device)) throw transportError("LOCAL_DAEMON_OFFLINE", 503);
    const depth = await store.llen(queueKey(id));
    if (depth >= maxQueue) throw transportError("QUEUE_FULL", 429);
    const record = {
      schemaVersion: SCHEMA_VERSION,
      requestId: rid,
      deviceId: id,
      status: "pending",
      messages: normalized,
      createdAt: now(),
      expiresAt: now() + requestTtlSec * 1000,
      result: null,
      error: null,
    };
    const persistTtl = requestTtlSec + resultTtlSec;
    await store.set(requestKey(rid), record, persistTtl);
    await store.lpush(queueKey(id), rid);
    return { schemaVersion: SCHEMA_VERSION, requestId: rid, status: "pending", expiresAt: record.expiresAt };
  }

  async function poll({ deviceId, deviceToken, pollNonce }) {
    const device = await authorizeDevice({ deviceId, deviceToken });
    await heartbeat(device);
    const nonce = String(pollNonce || "").trim().toLowerCase();
    if (!REQUEST_ID_RE.test(nonce)) throw transportError("MALFORMED_REQUEST");
    if (await store.setHas(nonceKey(device.deviceId), nonce)) throw transportError("REQUEST_REPLAY", 409);
    await store.addToSet(nonceKey(device.deviceId), nonce, NONCE_TTL_SEC);
    const rid = await store.rpop(queueKey(device.deviceId));
    if (!rid) return { empty: true, localBridge: "online" };
    const record = await store.get(requestKey(rid));
    if (!record) return { empty: true, localBridge: "online" };
    if (record.expiresAt <= now()) {
      record.status = "timeout";
      record.error = "REMOTE_TIMEOUT";
      record.messages = [];
      await store.set(requestKey(rid), record, resultTtlSec);
      return { empty: true, localBridge: "online" };
    }
    record.status = "claimed";
    record.claimedAt = now();
    await store.set(requestKey(rid), record, requestTtlSec + resultTtlSec);
    return {
      empty: false,
      request: {
        requestId: record.requestId,
        messages: record.messages,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      },
    };
  }

  async function complete({ deviceId, deviceToken, requestId, result, error, completeNonce }) {
    const device = await authorizeDevice({ deviceId, deviceToken });
    await heartbeat(device);
    const rid = String(requestId || "").trim().toLowerCase();
    const nonce = String(completeNonce || "").trim().toLowerCase();
    if (!REQUEST_ID_RE.test(rid) || !REQUEST_ID_RE.test(nonce)) throw transportError("MALFORMED_REQUEST");
    if (await store.setHas(`complete:${rid}`, nonce)) throw transportError("REQUEST_REPLAY", 409);
    const record = await store.get(requestKey(rid));
    if (!record || record.deviceId !== device.deviceId) throw transportError("REQUEST_NOT_FOUND", 404);
    if (record.status === "complete" || record.status === "error") throw transportError("REQUEST_REPLAY", 409);
    if (record.expiresAt <= now() && !result) {
      record.status = "timeout";
      record.error = "REMOTE_TIMEOUT";
      record.messages = [];
      await store.set(requestKey(rid), record, resultTtlSec);
      throw transportError("REMOTE_TIMEOUT", 408);
    }
    await store.addToSet(`complete:${rid}`, nonce, NONCE_TTL_SEC);
    if (error) {
      record.status = "error";
      record.error = String(error).slice(0, 80);
      record.result = null;
    } else {
      record.result = validateCharacterResult(result);
      record.status = "complete";
      record.error = null;
    }
    record.completedAt = now();
    // Drop messages after completion so prompt text is not retained for the result TTL.
    record.messages = [];
    await store.set(requestKey(rid), record, resultTtlSec);
    return { requestId: rid, status: record.status };
  }

  async function result({ requestId }) {
    const rid = String(requestId || "").trim().toLowerCase();
    if (!REQUEST_ID_RE.test(rid)) throw transportError("MALFORMED_REQUEST");
    const record = await store.get(requestKey(rid));
    if (!record) throw transportError("REQUEST_NOT_FOUND", 404);
    if (record.expiresAt <= now() && record.status !== "complete") {
      return { schemaVersion: SCHEMA_VERSION, requestId: rid, status: "timeout", error: "REMOTE_TIMEOUT", result: null };
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      requestId: rid,
      status: record.status,
      error: record.error,
      result: record.result,
      correlation: rid,
    };
  }

  return {
    SCHEMA_VERSION,
    store,
    pair,
    revoke,
    authorizeDevice,
    heartbeat,
    status,
    submit,
    poll,
    complete,
    result,
    validateMessages,
    validateCharacterResult,
  };
}

module.exports = {
  SCHEMA_VERSION,
  MAX_BODY_BYTES,
  MAX_QUEUE_DEPTH,
  REQUEST_TTL_SEC,
  DEFAULT_TIMEOUT_MS,
  createTransport,
  transportError,
  newSecretBytes,
  validateMessages,
  validateCharacterResult,
};
