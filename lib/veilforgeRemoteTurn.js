/**
 * Isolated VeilForge Stage 6A adapter.
 *
 * Cross-repo dependency: SigilForge/VeilForge#23
 * (`feature/stage-6a-remote-turn-contract`, remote_turn contract).
 *
 * This module speaks the Forge operator-daemon AF_UNIX protocol. It does not
 * implement Forge runtime, does not choose a profile, and does not expose
 * Forge to the browser. The daemon forces profile_name="remote".
 *
 * If PR #23 is not merged or the socket/session is not configured, callers
 * should keep using the existing local Ollama character path.
 */
const net = require("net");
const fs = require("fs");
const crypto = require("crypto");

const SCHEMA_VERSION = 1;
const MAX_FRAME_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function config() {
  const socketPath = env("VEILFORGE_SOCKET") || env("VEIL_OPERATOR_SOCKET");
  const sessionId = env("VEILFORGE_REMOTE_SESSION_ID");
  const authToken = env("VEILFORGE_AUTH_TOKEN") || env("VEIL_OPERATOR_TOKEN");
  const enabledRaw = env("VEILFORGE_REMOTE_TURN_ENABLED");
  const enabled = enabledRaw
    ? ["1", "true", "yes", "on"].includes(enabledRaw.toLowerCase())
    : Boolean(socketPath && sessionId);
  const timeoutMs = Math.max(1_000, Math.min(Number(env("VEILFORGE_REMOTE_TURN_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS, 240_000));
  return { socketPath, sessionId, authToken, enabled, timeoutMs };
}

function newRequestId(prefix = "remote-turn") {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Build the Stage 6A envelope. Intentionally omits profile_name — Forge forces "remote".
 */
function buildRemoteTurnEnvelope({
  userInput,
  sessionId,
  deviceId,
  mode = "chat",
  metadata = {},
  requestId,
} = {}) {
  const session = String(sessionId || "").trim();
  const device = String(deviceId || "").trim();
  const input = String(userInput || "");
  const rid = String(requestId || newRequestId());
  const modeNorm = String(mode || "chat").trim().toLowerCase() || "chat";
  if (!session) throw new Error("session_id_required");
  if (!device) throw new Error("device_id_required");
  if (!input.trim()) throw new Error("user_input_required");
  if (!["chat", "code", "story", "stream"].includes(modeNorm)) throw new Error("mode_invalid");
  const meta = metadata && typeof metadata === "object" ? { ...metadata } : {};
  delete meta.workspace;
  delete meta.profile_name;
  delete meta.profile;
  delete meta.allowed_tools;
  const envelope = {
    type: "remote_turn",
    remote_turn: {
      schema_version: SCHEMA_VERSION,
      request_id: rid,
      session_id: session,
      device_id: device.slice(0, 128),
      mode: modeNorm,
      user_input: input,
      metadata: meta,
    },
  };
  if (Object.prototype.hasOwnProperty.call(envelope, "profile_name")) {
    throw new Error("profile_name_forbidden");
  }
  if (Object.prototype.hasOwnProperty.call(envelope.remote_turn, "profile_name")) {
    throw new Error("profile_name_forbidden");
  }
  return envelope;
}

function writeFrame(socket, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  if (body.length > MAX_FRAME_BYTES) throw new Error(`frame_too_large:${body.length}`);
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
        resolve(JSON.parse(body.toString("utf8")));
      } catch (error) {
        reject(error);
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
  });
}

function send(payload, options = {}) {
  const cfg = { ...config(), ...options };
  return new Promise((resolve, reject) => {
    if (!cfg.socketPath) {
      reject(new Error("socket_not_configured"));
      return;
    }
    if (!fs.existsSync(cfg.socketPath)) {
      reject(new Error(`socket_not_found:${cfg.socketPath}`));
      return;
    }
    const socket = net.createConnection({ path: cfg.socketPath });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error("connect_timeout"));
    }, cfg.timeoutMs);

    function finish(err, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.end();
      } catch (_error) {
        /* ignore */
      }
      socket.destroy();
      if (err) reject(err);
      else resolve(value);
    }

    socket.setTimeout(cfg.timeoutMs);
    socket.on("timeout", () => finish(new Error("socket_timeout")));
    socket.on("error", (err) => finish(err));
    socket.on("connect", async () => {
      try {
        const body = cfg.authToken ? { ...payload, auth_token: cfg.authToken } : payload;
        writeFrame(socket, body);
        const response = await readFrame(socket, cfg.timeoutMs);
        finish(null, response);
      } catch (error) {
        finish(error);
      }
    });
  });
}

function messagesToUserInput(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");
}

function parseCharacterResult(response) {
  const text = String(response?.response_text || response?.payload?.response_text || "");
  const raw = text.trim();
  if (!raw) throw new Error("empty_remote_turn_response");
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) parsed = JSON.parse(raw.slice(start, end + 1));
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.masterDraft !== "string") {
    throw new Error("remote_turn_not_character_schema");
  }
  return parsed;
}

async function submitCharacterTurn({ messages, deviceId, requestId, metadata } = {}) {
  const cfg = config();
  if (!cfg.enabled) {
    return { ok: false, skipped: true, reason: "forge_remote_turn_disabled" };
  }
  if (!cfg.sessionId) {
    return { ok: false, skipped: true, reason: "forge_session_required" };
  }
  const envelope = buildRemoteTurnEnvelope({
    userInput: messagesToUserInput(messages),
    sessionId: cfg.sessionId,
    deviceId,
    mode: "chat",
    requestId,
    metadata: {
      source: "veildaemon-relay",
      kind: "character_package",
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    },
  });
  const response = await send(envelope, cfg);
  if (response?.ok === false) {
    return {
      ok: false,
      skipped: false,
      reason: response?.error?.code || "remote_turn_failed",
      error: response?.error || null,
    };
  }
  return { ok: true, result: parseCharacterResult(response), engine: "veilforge-remote-turn" };
}

module.exports = {
  SCHEMA_VERSION,
  config,
  buildRemoteTurnEnvelope,
  messagesToUserInput,
  parseCharacterResult,
  submitCharacterTurn,
  send,
};
