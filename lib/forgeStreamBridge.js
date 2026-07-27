/**
 * Stage 4F.2 — narrow VeilDaemon → VeilForge stream-bridge host glue.
 *
 * Does NOT import Forge logic. Speaks the same AF_UNIX length-prefixed JSON
 * protocol as veil_agents.core.stream (schema_version 1).
 *
 * Env:
 *   VEIL_STREAM_BRIDGE_SOCKET   Unix socket path
 *   VEIL_STREAM_BRIDGE_TOKEN    shared auth token
 *   VEIL_STREAM_BRIDGE_ENABLED  "1"/"true" to enable (default: enabled when socket+token set)
 *   VEIL_STREAM_BRIDGE_TIMEOUT_MS  connect/request timeout (default 2000)
 *
 * Fail-open: when Forge is down/misconfigured, callers keep existing alert behavior.
 * No unbounded offline queue — at most one in-flight push; failures enter bounded backoff.
 */

const net = require("net");
const fs = require("fs");
const crypto = require("crypto");

const SCHEMA_VERSION = 1;
const MAX_FRAME_BYTES = 64 * 1024;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 2_000;

/** @type {{ nextAttemptAt: number, failCount: number, lastResult: object | null, lastError: string }} */
const state = {
  nextAttemptAt: 0,
  failCount: 0,
  lastResult: null,
  lastError: "",
  inFlight: 0,
};

function envFlag(name, defaultWhenUnset = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return defaultWhenUnset;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function config() {
  const socketPath = String(process.env.VEIL_STREAM_BRIDGE_SOCKET || "").trim();
  const authToken = String(process.env.VEIL_STREAM_BRIDGE_TOKEN || "").trim();
  const explicit = process.env.VEIL_STREAM_BRIDGE_ENABLED;
  const enabled =
    explicit === undefined || explicit === null || explicit === ""
      ? Boolean(socketPath && authToken)
      : envFlag("VEIL_STREAM_BRIDGE_ENABLED", false);
  const timeoutMs = Math.max(
    200,
    Math.min(Number(process.env.VEIL_STREAM_BRIDGE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS, 15_000),
  );
  return { socketPath, authToken, enabled, timeoutMs };
}

function status() {
  const cfg = config();
  return {
    enabled: cfg.enabled,
    socketPath: cfg.socketPath || null,
    tokenConfigured: Boolean(cfg.authToken),
    schemaVersion: SCHEMA_VERSION,
    backoffUntil: state.nextAttemptAt || null,
    failCount: state.failCount,
    inFlight: state.inFlight,
    lastError: state.lastError || null,
    lastResult: state.lastResult
      ? {
          ok: state.lastResult.ok,
          status: state.lastResult.status,
          event_id: state.lastResult.event_id,
          overlay_count: Array.isArray(state.lastResult.overlay_commands)
            ? state.lastResult.overlay_commands.length
            : 0,
          pending_count: Array.isArray(state.lastResult.pending_actions)
            ? state.lastResult.pending_actions.length
            : 0,
        }
      : null,
  };
}

/**
 * Stable event id from native VeilDaemon identity when available.
 * Prefer Twitch EventSub message id, then alert.id.
 */
function stableEventId(alert) {
  const record = alert && typeof alert === "object" ? alert : {};
  const twitchId = String(record.twitchMessageId || record.twitch_message_id || "").trim();
  if (twitchId) return `esub-${twitchId}`;
  const id = String(record.id || record.event_id || "").trim();
  if (id) return id;
  const type = String(record.type || "event");
  const user = String(record.user || record.username || "");
  const created = String(record.createdAt || "");
  const digest = crypto
    .createHash("sha256")
    .update(`${type}|${user}|${created}`)
    .digest("hex")
    .slice(0, 16);
  return `vd-${digest}`;
}

function writeFrame(socket, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  if (body.length > MAX_FRAME_BYTES) {
    throw new Error(`frame_too_large:${body.length}`);
  }
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length, 0);
  socket.write(Buffer.concat([header, body]));
}

function readFrame(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let expected = null;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("read_timeout"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
      socket.removeListener("end", onEnd);
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    function onEnd() {
      cleanup();
      reject(new Error("connection_closed"));
    }

    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      if (expected === null) {
        if (buffer.length < 4) return;
        expected = buffer.readUInt32BE(0);
        if (expected <= 0 || expected > MAX_FRAME_BYTES) {
          cleanup();
          reject(new Error(`frame_size_invalid:${expected}`));
          return;
        }
        buffer = buffer.subarray(4);
      }
      if (buffer.length < expected) return;
      const body = buffer.subarray(0, expected);
      cleanup();
      try {
        const obj = JSON.parse(body.toString("utf8"));
        if (!obj || typeof obj !== "object") {
          reject(new Error("frame_payload_not_dict"));
          return;
        }
        resolve(obj);
      } catch (error) {
        reject(error);
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
  });
}

function request(payload, options = {}) {
  const cfg = config();
  const timeoutMs = options.timeoutMs || cfg.timeoutMs;
  const socketPath = options.socketPath || cfg.socketPath;
  const authToken = options.authToken !== undefined ? options.authToken : cfg.authToken;

  return new Promise((resolve, reject) => {
    if (!socketPath) {
      reject(new Error("socket_not_configured"));
      return;
    }
    if (!fs.existsSync(socketPath)) {
      reject(new Error(`socket_not_found:${socketPath}`));
      return;
    }

    const socket = net.createConnection({ path: socketPath });
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error("connect_timeout"));
    }, timeoutMs);

    function finish(err, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.end();
      } catch (_) {
        /* ignore */
      }
      socket.destroy();
      if (err) reject(err);
      else resolve(value);
    }

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => finish(new Error("socket_timeout")));
    socket.on("error", (err) => finish(err));
    socket.on("connect", async () => {
      try {
        const body = {
          schema_version: SCHEMA_VERSION,
          request_id: payload.request_id || `vd-${crypto.randomBytes(5).toString("hex")}`,
          auth_token: authToken || "",
          ...payload,
        };
        writeFrame(socket, body);
        const response = await readFrame(socket, timeoutMs);
        finish(null, response);
      } catch (error) {
        finish(error);
      }
    });
  });
}

function noteFailure(error) {
  state.failCount += 1;
  state.lastError = String(error && error.message ? error.message : error);
  const backoff = Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(state.failCount, 6));
  state.nextAttemptAt = Date.now() + backoff;
}

function noteSuccess(result) {
  state.failCount = 0;
  state.nextAttemptAt = 0;
  state.lastError = "";
  state.lastResult = result && typeof result === "object" ? result : null;
}

/**
 * Push a VeilDaemon alert-shaped record to Forge as kind=alert.
 * Fail-open: returns { ok:false, skipped|error } without throwing to callers that prefer soft fail.
 */
async function pushAlertEvent(alert, options = {}) {
  const cfg = config();
  const soft = options.soft !== false;

  if (!cfg.enabled) {
    return { ok: false, skipped: true, reason: "bridge_disabled", status: "skipped" };
  }
  if (!cfg.socketPath || !cfg.authToken) {
    return { ok: false, skipped: true, reason: "bridge_not_configured", status: "skipped" };
  }
  if (Date.now() < state.nextAttemptAt) {
    return {
      ok: false,
      skipped: true,
      reason: "backoff",
      status: "skipped",
      retryAt: state.nextAttemptAt,
    };
  }
  // No unbounded offline queue: drop if already in-flight.
  if (state.inFlight > 0 && !options.allowParallel) {
    return { ok: false, skipped: true, reason: "in_flight", status: "dropped" };
  }

  const record = alert && typeof alert === "object" ? alert : {};
  const eventId = stableEventId(record);
  const event = {
    id: eventId,
    type: record.type || "follow",
    user: record.user || record.username || "UnclassifiedObserver",
    count: record.count,
    months: record.months,
    level: record.level,
    amount: record.amount,
    createdAt: record.createdAt || new Date().toISOString(),
    source: record.source || "veildaemon",
    twitchMessageId: record.twitchMessageId || undefined,
  };

  state.inFlight += 1;
  try {
    const response = await request(
      {
        request_type: "stream_event",
        kind: "alert",
        event,
      },
      options,
    );
    noteSuccess(response);
    return {
      ok: Boolean(response && response.ok),
      status: response && response.status,
      event_id: response && response.event_id,
      overlay_commands: (response && response.overlay_commands) || [],
      pending_actions: (response && response.pending_actions) || [],
      approved_presentation: (response && response.approved_presentation) || [],
      error: response && response.error,
      raw: response,
    };
  } catch (error) {
    noteFailure(error);
    const result = {
      ok: false,
      status: "error",
      error: String(error && error.message ? error.message : error),
      event_id: eventId,
    };
    if (soft) return result;
    throw error;
  } finally {
    state.inFlight = Math.max(0, state.inFlight - 1);
  }
}

/**
 * Notify Forge of a newly enqueued alert and return presentation fields to attach.
 * Never throws. Never blocks alert pipeline beyond timeout.
 */
async function notifyForgeFromAlert(alert) {
  const result = await pushAlertEvent(alert, { soft: true });
  if (result.skipped) {
    return {
      bridge: "skipped",
      reason: result.reason,
      status: result.status,
    };
  }
  if (!result.ok) {
    return {
      bridge: "unavailable",
      status: result.status || "error",
      error: result.error || "unknown",
      event_id: result.event_id || null,
    };
  }
  // Privileged pending_actions stay proposals — surface only, do not execute.
  return {
    bridge: "ok",
    status: result.status,
    event_id: result.event_id,
    overlay_commands: result.overlay_commands || [],
    pending_actions: result.pending_actions || [],
    approved_presentation: result.approved_presentation || [],
  };
}

async function health(options = {}) {
  const cfg = config();
  if (!cfg.enabled || !cfg.socketPath) {
    return { ok: false, skipped: true, reason: "bridge_not_configured" };
  }
  try {
    const response = await request({ request_type: "health" }, options);
    noteSuccess(response);
    return response;
  } catch (error) {
    noteFailure(error);
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

module.exports = {
  SCHEMA_VERSION,
  config,
  status,
  stableEventId,
  pushAlertEvent,
  notifyForgeFromAlert,
  health,
  request,
  // test hooks
  _state: state,
};
