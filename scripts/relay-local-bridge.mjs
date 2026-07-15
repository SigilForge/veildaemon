import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.RELAY_PORT || "4174", 10);
const OLLAMA_CHAT_URL = process.env.RELAY_OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = process.env.RELAY_OLLAMA_MODEL || "llama3.1:8b";
const ALLOWED_ORIGINS = new Set([
  `http://${HOST}:${PORT}`,
  `http://localhost:${PORT}`,
  "https://veildaemon-relay-knoxmortis-knoxmortis-projects.vercel.app",
  "https://relay.veildaemon.app",
  ...(process.env.RELAY_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean),
]);
const MAX_BODY_BYTES = 60_000;
const CHARACTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["masterDraft", "validation"],
  properties: {
    masterDraft: { type: "string" },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["voiceMatch", "sourceFidelity", "canonSafe", "knowledgeBoundarySafe", "characterMarkers", "warnings"],
      properties: {
        voiceMatch: { type: "number" },
        sourceFidelity: { type: "number" },
        canonSafe: { type: "boolean" },
        knowledgeBoundarySafe: { type: "boolean" },
        characterMarkers: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
      },
    },
  },
};
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".wasm": "application/wasm", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8" };

function json(res, status, body) {
  res.writeHead(status, { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("INPUT_TOO_LARGE"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) throw new Error("INVALID_REQUEST");
  let chars = 0;
  const messages = value.map((message) => {
    if (!message || !["system", "user"].includes(message.role) || typeof message.content !== "string") throw new Error("INVALID_REQUEST");
    chars += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (chars > 48_000) throw new Error("INPUT_TOO_LARGE");
  return messages;
}

function validateResult(value) {
  if (!value || typeof value !== "object" || typeof value.masterDraft !== "string" || value.masterDraft.trim().length < 40 || value.masterDraft.length > 8_000) throw new Error("OLLAMA_INVALID_OUTPUT");
  const validation = value.validation;
  if (!validation || typeof validation !== "object") throw new Error("OLLAMA_INVALID_OUTPUT");
  for (const key of ["voiceMatch", "sourceFidelity"]) if (!Number.isFinite(validation[key]) || validation[key] < 0 || validation[key] > 1) throw new Error("OLLAMA_INVALID_OUTPUT");
  for (const key of ["canonSafe", "knowledgeBoundarySafe"]) if (typeof validation[key] !== "boolean") throw new Error("OLLAMA_INVALID_OUTPUT");
  for (const key of ["characterMarkers", "warnings"]) if (!Array.isArray(validation[key]) || validation[key].length > 12 || validation[key].some((item) => typeof item !== "string")) throw new Error("OLLAMA_INVALID_OUTPUT");
  return { masterDraft: value.masterDraft.trim(), validation };
}

function authorizedOrigin(req) {
  if (req.headers["x-relay-request"] !== "character-v1") return false;
  const origin = String(req.headers.origin || "");
  return ALLOWED_ORIGINS.has(origin);
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (!ALLOWED_ORIGINS.has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Relay-Request");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Vary", "Origin");
  return true;
}

async function ollamaStatus(res, warm = false) {
  try {
    const response = warm
      ? await fetch(OLLAMA_CHAT_URL, {
          method: "POST",
          signal: AbortSignal.timeout(120_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, keep_alive: "30m" }),
        })
      : await fetch(new URL("/api/tags", new URL(OLLAMA_CHAT_URL)), { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error("OLLAMA_UNAVAILABLE");
    return json(res, 200, { status: "ok", engine: "ollama", model: OLLAMA_MODEL, warmed: warm });
  } catch (_error) {
    return json(res, 503, { status: "error", error: "OLLAMA_UNAVAILABLE", model: OLLAMA_MODEL });
  }
}

async function character(req, res, warm = false) {
  if (req.method === "OPTIONS") {
    if (!applyCors(req, res)) return json(res, 403, { status: "error", error: "ORIGIN_NOT_ALLOWED" });
    res.writeHead(204, { "Cache-Control": "no-store" });
    return res.end();
  }
  applyCors(req, res);
  if (req.method === "GET") return ollamaStatus(res, warm);
  if (req.method !== "POST") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
  if (!authorizedOrigin(req)) return json(res, 401, { status: "error", error: "UNAUTHORIZED" });
  try {
    const body = JSON.parse((await readBody(req)) || "{}");
    const messages = validateMessages(body.messages);
    const response = await fetch(OLLAMA_CHAT_URL, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, format: CHARACTER_SCHEMA, keep_alive: "30m", messages, options: { temperature: 0.72, num_predict: 800 } }),
    });
    if (!response.ok) return json(res, 502, { status: "error", error: "OLLAMA_FAILED" });
    const payload = await response.json();
    const result = validateResult(JSON.parse(String(payload.message?.content || "")));
    return json(res, 200, { status: "ok", engine: "ollama", model: OLLAMA_MODEL, result });
  } catch (error) {
    const code = error?.name === "TimeoutError" ? "OLLAMA_TIMEOUT" : ["INPUT_TOO_LARGE", "INVALID_REQUEST"].includes(error?.message) ? error.message : "OLLAMA_INVALID_OUTPUT";
    return json(res, code === "INPUT_TOO_LARGE" ? 413 : code === "INVALID_REQUEST" ? 400 : 502, { status: "error", error: code });
  }
}

function staticPath(pathname) {
  if (pathname === "/") return resolve(ROOT, "studio/relay/index.html");
  const decoded = decodeURIComponent(pathname).replace(/^\/+/, "");
  const path = resolve(ROOT, decoded);
  return path === ROOT || path.startsWith(`${ROOT}${sep}`) ? path : null;
}

async function serveStatic(pathname, res) {
  const path = staticPath(pathname);
  if (!path) return json(res, 404, { status: "error", error: "NOT_FOUND" });
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("NOT_FILE");
    res.writeHead(200, { "Cache-Control": "no-store", "Content-Type": MIME[extname(path).toLowerCase()] || "application/octet-stream", "X-Robots-Tag": "noindex, nofollow" });
    createReadStream(path).pipe(res);
  } catch (_error) {
    json(res, 404, { status: "error", error: "NOT_FOUND" });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/api/character") return character(req, res, url.searchParams.get("warm") === "1");
  return serveStatic(url.pathname, res);
});

server.listen(PORT, HOST, () => {
  console.log(`RelayDaemon local bridge: http://${HOST}:${PORT}/`);
  console.log(`Ollama model: ${OLLAMA_MODEL}`);
});
