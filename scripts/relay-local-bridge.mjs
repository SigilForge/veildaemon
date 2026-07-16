import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.RELAY_PORT || "4174", 10);
const OLLAMA_CHAT_URL = process.env.RELAY_OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = process.env.RELAY_OLLAMA_MODEL || "hermes4:14b";
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
  required: ["masterDraft", "platformDrafts", "validation"],
  properties: {
    masterDraft: { type: "string" },
    platformDrafts: {
      type: "object",
      additionalProperties: false,
      required: ["x", "threads", "bluesky", "mastodon"],
      properties: {
        x: { type: "string" },
        threads: { type: "string" },
        bluesky: { type: "string" },
        mastodon: { type: "string" },
      },
    },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["voiceMatch", "sourceFidelity", "canonSafe", "knowledgeBoundarySafe", "characterMarkers", "warnings"],
      properties: {
        voiceMatch: { type: "number", minimum: 0, maximum: 1 },
        sourceFidelity: { type: "number", minimum: 0, maximum: 1 },
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

function invalidOutput(detail, metadata = {}) {
  return Object.assign(new Error("OLLAMA_INVALID_OUTPUT"), { detail, ...metadata });
}

function countGraphemes(value) {
  return [...String(value || "")].length;
}

function splitSentences(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function sentenceKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Models often emit "5. 6" / "5. 6?" when they mean "5.6". */
function repairVersionNumbers(value) {
  let text = String(value || "");
  for (let i = 0; i < 4; i += 1) {
    const next = text.replace(/(\d)\.\s+(\d)/g, "$1.$2");
    if (next === text) break;
    text = next;
  }
  text = text.replace(/\b([Vv])\s+(\d+\.\d+)/g, "$1$2");
  text = text.replace(/\b([Vv])(\d)\s+\.\s+(\d)/g, "$1$2.$3");
  return text;
}

function repairBrokenQuotes(value) {
  let text = String(value || "");
  text = text.replace(/(["“])([^"“”\n]{1,220}[.!?…])\s*\n\n+([A-Z“"][^"“”\n]{1,220}[.!?…])(["”])?/g, (match, open, first, second, close) => {
    const end = close || (open === "“" ? "”" : '"');
    return `${open}${first} ${second}${end}`;
  });
  text = text.replace(/(["“])([^"“”\n]{1,220}[.!?…])\s*\n\n+(["“])([^"“”\n]{1,220}[.!?…])(["”])/g, "$1$2 $4$5");
  return text;
}

/** Strip mid-stream sentence loops only — never delete mid-sentence n-grams (that amputates endings). */
function collapseSelfLoops(value) {
  const sentences = splitSentences(repairBrokenQuotes(repairVersionNumbers(value)));
  const kept = [];
  const seen = new Set();
  for (const sentence of sentences) {
    const key = sentenceKey(sentence);
    if (!key || key.split(" ").length < 3) {
      kept.push(sentence);
      continue;
    }
    if (seen.has(key)) continue;
    const tokens = key.split(" ");
    if (tokens.length >= 8) {
      const tokenSet = new Set(tokens);
      const near = [...seen].some((prior) => {
        const priorTokens = prior.split(" ");
        if (priorTokens.length < 8) return false;
        if (Math.abs(priorTokens.length - tokens.length) > 3) return false;
        const overlap = priorTokens.filter((token) => tokenSet.has(token)).length;
        return overlap / Math.max(priorTokens.length, tokens.length) >= 0.9;
      });
      if (near) continue;
    }
    seen.add(key);
    kept.push(sentence);
  }
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

function isCompleteThought(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length < 40) return false;
  if (/…$|\.\.\.$|—$|-$/.test(clean)) return false;
  if (!/[.!?…"”']["'”']?$/.test(clean)) return false;
  const sentences = splitSentences(clean);
  if (sentences.length < 2) return false;
  const last = sentences[sentences.length - 1];
  const lastCore = last.replace(/[.!?…"”']+/g, "").trim();
  const lastWords = lastCore.split(/\s+/).filter(Boolean);
  if (lastWords.length <= 2 && /\?$/.test(last) && clean.length > 280) return false;
  if (/\b(and|but|or|the|a|an|to|of|with|for|that|which|who|when|while|because|so|then|codex)\s*$/i.test(lastCore)) return false;
  if (lastWords.length < 3 && !/^(end|status|done|verified|failed|terminated|complete|closed)\b/i.test(lastCore)) return false;
  return true;
}

function ensureCompleteEnding(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (isCompleteThought(clean)) return clean;
  const sentences = splitSentences(clean);
  while (sentences.length > 1) {
    sentences.pop();
    const candidate = sentences.join(" ").replace(/\s{2,}/g, " ").trim();
    if (isCompleteThought(candidate)) return candidate;
  }
  return clean;
}

/** Prefer complete sentences under the hard ceiling; never invent text. */
function clampDraft(value, limit) {
  let clean = ensureCompleteEnding(collapseSelfLoops(String(value || "").replace(/\s+/g, " ").trim().replace(/…+$/g, "").trim()));
  if (!clean) return "";
  if (countGraphemes(clean) <= limit) return clean;
  const accepted = [];
  for (const sentence of splitSentences(clean)) {
    const candidate = [...accepted, sentence].join(" ");
    if (countGraphemes(candidate) > limit) break;
    accepted.push(sentence);
  }
  clean = ensureCompleteEnding(accepted.join(" "));
  if (clean && countGraphemes(clean) <= limit) return clean;
  // Prefer a shorter complete thought over a hard mid-sentence cut.
  return clean || "";
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_nested) {
      return null;
    }
  }
}

function validateResult(value) {
  if (!value || typeof value !== "object") throw invalidOutput("result_not_object");
  const masterDraft = clampDraft(value.masterDraft, 8_000);
  if (masterDraft.length < 40) throw invalidOutput("master_draft_length", { draftLength: masterDraft.length });
  const limits = { x: 1_500, threads: 1_500, bluesky: 1_500, mastodon: 1_500 };
  const platformDrafts = value.platformDrafts;
  if (!platformDrafts || typeof platformDrafts !== "object") throw invalidOutput("platform_drafts_missing");
  const normalizedPlatforms = {};
  for (const [key, limit] of Object.entries(limits)) {
    const draft = platformDrafts[key];
    if (typeof draft !== "string") throw invalidOutput(`platform_draft_${key}`, { draftLength: 0 });
    const clean = clampDraft(draft, limit);
    if (clean.length < 40 || /…$/.test(clean)) throw invalidOutput(`platform_draft_${key}`, { draftLength: countGraphemes(clean), endsEllipsis: /…$/.test(clean) });
    normalizedPlatforms[key] = clean;
  }
  const validation = value.validation;
  if (!validation || typeof validation !== "object") throw invalidOutput("validation_missing");
  const normalizedValidation = { ...validation };
  for (const key of ["voiceMatch", "sourceFidelity"]) {
    const score = typeof validation[key] === "string" ? Number.parseFloat(validation[key]) : validation[key];
    if (!Number.isFinite(score) || score < 0 || score > 100) throw invalidOutput(`validation_score_${key}`);
    normalizedValidation[key] = score > 1 ? score / 100 : score;
  }
  for (const key of ["canonSafe", "knowledgeBoundarySafe"]) if (typeof validation[key] !== "boolean") throw invalidOutput(`validation_boolean_${key}`);
  for (const key of ["characterMarkers", "warnings"]) {
    let list = validation[key];
    // Local models sometimes emit a string or object here; coerce rather than fail a good draft.
    if (!Array.isArray(list)) list = typeof list === "string" && list.trim() ? [list.trim()] : [];
    list = list.filter((item) => typeof item === "string").slice(0, 12);
    if (list.some((item) => typeof item !== "string")) throw invalidOutput(`validation_array_${key}`);
    normalizedValidation[key] = list;
  }
  return { masterDraft, platformDrafts: normalizedPlatforms, validation: normalizedValidation };
}

const OLLAMA_ATTEMPTS = [
  // First try may use thinking, but keep enough room for the JSON payload.
  { think: true, temperature: 0.25, num_ctx: 16_384, num_predict: 10_240 },
  // Thinking often burns the budget (done_reason=length, empty content). Fallback without it.
  { think: false, temperature: 0.2, num_ctx: 16_384, num_predict: 6_144 },
  { think: false, temperature: 0.1, num_ctx: 16_384, num_predict: 6_144 },
];

async function requestOllamaOnce(messages, attempt) {
  const { think, temperature, num_ctx, num_predict } = attempt;
  const response = await fetch(OLLAMA_CHAT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(240_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      think,
      format: CHARACTER_SCHEMA,
      keep_alive: "30m",
      messages,
      options: { temperature, num_ctx, num_predict },
    }),
  });
  if (!response.ok) throw Object.assign(new Error("OLLAMA_FAILED"), { status: response.status });
  const payload = await response.json();
  const content = String(payload.message?.content || "");
  const thinking = String(payload.message?.thinking || "");
  const parsed = extractJsonObject(content) || extractJsonObject(thinking);
  if (!parsed) {
    throw Object.assign(invalidOutput(content ? "invalid_json" : "empty_content"), {
      contentLength: content.length,
      thinkingLength: thinking.length,
      doneReason: payload.done_reason || null,
      hasThinking: Boolean(thinking),
      think,
    });
  }
  return validateResult(parsed);
}

async function requestOllamaCharacter(messages) {
  let lastError = null;
  for (let index = 0; index < OLLAMA_ATTEMPTS.length; index += 1) {
    const attempt = OLLAMA_ATTEMPTS[index];
    try {
      const result = await requestOllamaOnce(messages, attempt);
      if (index > 0) console.warn("RelayDaemon Ollama character recovered after retry", { attempt: index, think: attempt.think, temperature: attempt.temperature });
      return result;
    } catch (error) {
      lastError = error;
      const retryable = error?.message === "OLLAMA_INVALID_OUTPUT" || error?.message === "OLLAMA_FAILED";
      console.warn("RelayDaemon Ollama character attempt failed", {
        attempt: index,
        think: attempt.think,
        temperature: attempt.temperature,
        code: error?.message || "UNKNOWN",
        detail: error?.detail || null,
        draftLength: error?.draftLength ?? null,
        contentLength: error?.contentLength ?? null,
        thinkingLength: error?.thinkingLength ?? null,
        doneReason: error?.doneReason || null,
        hasThinking: error?.hasThinking || false,
        retrying: retryable && index < OLLAMA_ATTEMPTS.length - 1,
      });
      if (!retryable || index >= OLLAMA_ATTEMPTS.length - 1) break;
    }
  }
  throw lastError || invalidOutput("exhausted_retries");
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
      ? await fetch(new URL("/api/generate", new URL(OLLAMA_CHAT_URL)), {
          method: "POST",
          signal: AbortSignal.timeout(240_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt: "", stream: false, keep_alive: "30m", options: { num_ctx: 16_384 } }),
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
    const result = await requestOllamaCharacter(messages);
    return json(res, 200, { status: "ok", engine: "ollama", model: OLLAMA_MODEL, result });
  } catch (error) {
    const code = error?.name === "TimeoutError" ? "OLLAMA_TIMEOUT" : ["INPUT_TOO_LARGE", "INVALID_REQUEST", "OLLAMA_FAILED"].includes(error?.message) ? error.message : "OLLAMA_INVALID_OUTPUT";
    console.warn("RelayDaemon Ollama character request failed", {
      code,
      detail: error?.detail || null,
      status: error?.status || null,
      contentLength: error?.contentLength || null,
      thinkingLength: error?.thinkingLength || null,
      draftLength: error?.draftLength ?? null,
      endsEllipsis: error?.endsEllipsis || false,
      doneReason: error?.doneReason || null,
      hasThinking: error?.hasThinking || false,
    });
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
