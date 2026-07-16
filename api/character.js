const MAX_BODY_BYTES = 60_000;
const MAX_MESSAGE_CHARS = 48_000;
// gpt-5-mini counts reasoning + visible JSON against max_output_tokens. 2400 routinely
// cuts off before platformDrafts close (status incomplete / reason max_output_tokens).
const MAX_OUTPUT_TOKENS = Number.parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || "8192", 10);
const RETRY_OUTPUT_TOKENS = Number.parseInt(process.env.OPENAI_RETRY_OUTPUT_TOKENS || "12288", 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS || "55000", 10);
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "low";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const rateBuckets = new Map();

const CHARACTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["masterDraft", "platformDrafts", "validation"],
  properties: {
    masterDraft: { type: "string", minLength: 40, maxLength: 8_000 },
    platformDrafts: {
      type: "object",
      additionalProperties: false,
      required: ["x", "threads", "bluesky", "mastodon"],
      properties: {
        x: { type: "string", minLength: 40, maxLength: 1_500 },
        threads: { type: "string", minLength: 40, maxLength: 1_500 },
        bluesky: { type: "string", minLength: 40, maxLength: 1_500 },
        mastodon: { type: "string", minLength: 40, maxLength: 1_500 },
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
        characterMarkers: { type: "array", maxItems: 12, items: { type: "string", maxLength: 160 } },
        warnings: { type: "array", maxItems: 12, items: { type: "string", maxLength: 240 } },
      },
    },
  },
};

function send(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  Object.entries(extraHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("BODY_TOO_LARGE"), { statusCode: 413 }));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function requestHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
}

function authorizedRequest(req) {
  if (req.headers["x-relay-request"] !== "character-v1") return false;
  if (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-origin") return false;
  const origin = String(req.headers.origin || "");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.host.toLowerCase() === requestHost(req);
  } catch (_error) {
    return false;
  }
}

function rateKey(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function consumeRateLimit(req) {
  const now = Date.now();
  const key = rateKey(req);
  const current = rateBuckets.get(key);
  const bucket = !current || now - current.startedAt >= RATE_WINDOW_MS ? { startedAt: now, count: 0 } : current;
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return { allowed: bucket.count <= RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - bucket.count), resetAt: bucket.startedAt + RATE_WINDOW_MS };
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) throw Object.assign(new Error("INVALID_MESSAGES"), { statusCode: 400 });
  let chars = 0;
  const messages = value.map((message) => {
    if (!message || !["system", "user"].includes(message.role) || typeof message.content !== "string") throw Object.assign(new Error("INVALID_MESSAGES"), { statusCode: 400 });
    chars += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (chars > MAX_MESSAGE_CHARS) throw Object.assign(new Error("INPUT_TOO_LARGE"), { statusCode: 413 });
  return messages;
}

function responseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const part of item.content || []) if (part.type === "output_text" && typeof part.text === "string") return part.text;
  }
  return "";
}

function responseFailure(payload, text) {
  const parts = (payload.output || []).flatMap((item) => item.content || []);
  if (parts.some((part) => part.type === "refusal")) return "HOSTED_ENGINE_REFUSED";
  if (payload.status === "incomplete" || payload.incomplete_details || (text && !text.trim().endsWith("}"))) return "HOSTED_ENGINE_INCOMPLETE";
  return "INVALID_MODEL_OUTPUT";
}

function isTokenBudgetIncomplete(payload, text) {
  if (payload?.incomplete_details?.reason === "max_output_tokens") return true;
  if (payload?.status === "incomplete" && !text?.trim()) return true;
  return false;
}

function buildOpenAiBody(messages, maxOutputTokens) {
  const body = {
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: messages,
    max_output_tokens: maxOutputTokens,
    store: false,
    text: { format: { type: "json_schema", name: "relay_character_master", strict: true, schema: CHARACTER_SCHEMA } },
  };
  // Keep reasoning cheap for structured JSON; full effort burns the token budget before drafts finish.
  if (REASONING_EFFORT && REASONING_EFFORT !== "default") body.reasoning = { effort: REASONING_EFFORT };
  return body;
}

async function requestOpenAiCharacter(messages, maxOutputTokens, signal) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildOpenAiBody(messages, maxOutputTokens)),
  });
  return response;
}

function parseStructuredResult(payload, response) {
  const text = responseText(payload);
  let structured;
  try {
    structured = JSON.parse(text);
  } catch (_error) {
    const code = responseFailure(payload, text);
    const error = new Error(code);
    error.code = code;
    error.payload = payload;
    error.requestId = response.headers.get("x-request-id") || null;
    error.textLength = text.length;
    throw error;
  }
  try {
    return { result: validateResult(structured), model: payload.model || process.env.OPENAI_MODEL || "gpt-5-mini", textLength: text.length };
  } catch (_error) {
    const error = new Error("INVALID_MODEL_OUTPUT");
    error.code = "INVALID_MODEL_OUTPUT";
    error.requestId = response.headers.get("x-request-id") || null;
    throw error;
  }
}

function validateResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_MODEL_OUTPUT");
  if (typeof value.masterDraft !== "string" || value.masterDraft.trim().length < 40 || value.masterDraft.length > 8_000) throw new Error("INVALID_MODEL_OUTPUT");
  const limits = { x: 1_500, threads: 1_500, bluesky: 1_500, mastodon: 1_500 };
  const platformDrafts = value.platformDrafts;
  if (!platformDrafts || typeof platformDrafts !== "object" || Array.isArray(platformDrafts)) throw new Error("INVALID_MODEL_OUTPUT");
  for (const [key, limit] of Object.entries(limits)) {
    const draft = platformDrafts[key];
    if (typeof draft !== "string" || draft.trim().length < 40 || [...draft.trim()].length > limit || /…$/.test(draft.trim())) throw new Error("INVALID_MODEL_OUTPUT");
  }
  const validation = value.validation;
  if (!validation || typeof validation !== "object") throw new Error("INVALID_MODEL_OUTPUT");
  const normalizedValidation = { ...validation };
  for (const key of ["voiceMatch", "sourceFidelity"]) {
    const score = validation[key];
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("INVALID_MODEL_OUTPUT");
    normalizedValidation[key] = score > 1 ? score / 100 : score;
  }
  for (const key of ["canonSafe", "knowledgeBoundarySafe"]) if (typeof validation[key] !== "boolean") throw new Error("INVALID_MODEL_OUTPUT");
  for (const key of ["characterMarkers", "warnings"]) if (!Array.isArray(validation[key]) || validation[key].length > 12 || validation[key].some((item) => typeof item !== "string")) throw new Error("INVALID_MODEL_OUTPUT");
  return { masterDraft: value.masterDraft.trim(), platformDrafts: Object.fromEntries(Object.entries(platformDrafts).map(([key, draft]) => [key, draft.trim()])), validation: normalizedValidation };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
  }
  if (!authorizedRequest(req)) return send(res, 401, { status: "error", error: "UNAUTHORIZED" });
  const rate = consumeRateLimit(req);
  const rateHeaders = { "X-RateLimit-Limit": String(RATE_LIMIT), "X-RateLimit-Remaining": String(rate.remaining), "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)) };
  if (!rate.allowed) return send(res, 429, { status: "error", error: "RATE_LIMITED" }, rateHeaders);
  if (!process.env.OPENAI_API_KEY) return send(res, 503, { status: "error", error: "HOSTED_ENGINE_NOT_CONFIGURED" }, rateHeaders);

  try {
    let parsed;
    try {
      parsed = JSON.parse((await readBody(req)) || "{}");
    } catch (_error) {
      return send(res, 400, { status: "error", error: "MALFORMED_REQUEST" }, rateHeaders);
    }
    const messages = validateMessages(parsed.messages);
    const budgets = [MAX_OUTPUT_TOKENS];
    if (RETRY_OUTPUT_TOKENS > MAX_OUTPUT_TOKENS) budgets.push(RETRY_OUTPUT_TOKENS);

    let lastError = null;
    for (let attempt = 0; attempt < budgets.length; attempt += 1) {
      const maxOutputTokens = budgets[attempt];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response;
      try {
        response = await requestOpenAiCharacter(messages, maxOutputTokens, controller.signal);
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        console.error("Relay hosted character request failed", { status: response.status, requestId: response.headers.get("x-request-id") || null, attempt, maxOutputTokens });
        return send(res, 502, { status: "error", error: "HOSTED_ENGINE_FAILED" }, rateHeaders);
      }
      const payload = await response.json();
      try {
        const parsedResult = parseStructuredResult(payload, response);
        return send(res, 200, {
          status: "ok",
          engine: "openai",
          model: parsedResult.model,
          result: parsedResult.result,
        }, rateHeaders);
      } catch (error) {
        lastError = error;
        const canRetry = attempt < budgets.length - 1 && error?.code === "HOSTED_ENGINE_INCOMPLETE" && isTokenBudgetIncomplete(payload, responseText(payload));
        console.error("Relay hosted character output was not complete structured JSON", {
          code: error?.code || error?.message || "HOSTED_ENGINE_FAILED",
          status: payload.status || null,
          incompleteReason: payload.incomplete_details?.reason || null,
          requestId: error?.requestId || response.headers.get("x-request-id") || null,
          attempt,
          maxOutputTokens,
          retrying: canRetry,
          textLength: error?.textLength || 0,
        });
        if (!canRetry) {
          return send(res, 502, { status: "error", error: error?.code || error?.message || "HOSTED_ENGINE_FAILED" }, rateHeaders);
        }
      }
    }
    return send(res, 502, { status: "error", error: lastError?.code || "HOSTED_ENGINE_INCOMPLETE" }, rateHeaders);
  } catch (error) {
    if (error?.name === "AbortError") return send(res, 504, { status: "error", error: "HOSTED_ENGINE_TIMEOUT" }, rateHeaders);
    const status = error?.statusCode || 502;
    const code = error?.message === "BODY_TOO_LARGE" || error?.message === "INPUT_TOO_LARGE" ? "INPUT_TOO_LARGE" : error?.message === "INVALID_MESSAGES" ? "INVALID_REQUEST" : "HOSTED_ENGINE_FAILED";
    return send(res, status, { status: "error", error: code }, rateHeaders);
  }
};
