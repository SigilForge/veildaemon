/**
 * Server-side helpers for the Cell/Live-Link Bearer-token API (api/cell/[action].js).
 *
 * The static site (veildaemon.app) calls api.veildaemon.app cross-origin with no
 * cookies, so this cannot reuse VeilLink's cookie-based `requireUser()`. Instead it
 * validates the Supabase access token the browser already holds via
 * `window.VeilAuth.getSession().access_token` (see root veildaemon-auth.js) and then
 * talks to Supabase's REST API directly with THAT token in the Authorization header --
 * exactly what the Supabase JS client does under the hood -- so every existing RLS
 * policy (is_session_handler / is_session_operator, owner_user_id = auth.uid(), etc.)
 * keeps doing the authorization work. This module never uses the service-role key to
 * bypass RLS except for the two lookups an unseated Operator legitimately cannot see
 * yet: resolving a join code and checking the seat cap before they have a seat.
 */

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ABSOLUTE_MAX_SEATS = 32;
const MAX_BODY_BYTES = 20_000;

function supabaseUrl() {
  return (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
}

function anonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function assertConfigured() {
  if (!supabaseUrl() || !anonKey()) {
    const error = new Error("Cell sync is not configured (SUPABASE_URL / SUPABASE_ANON_KEY).");
    error.statusCode = 503;
    throw error;
  }
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request payload too large."));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const text = await readBody(req);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    const error = new Error("Malformed JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function getAuthedUser(token) {
  if (!token) return null;
  assertConfigured();
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey() },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && user.id ? user : null;
}

/** REST call scoped to the caller's own token -- RLS enforces authorization. */
async function restAsUser(token, path, options = {}) {
  assertConfigured();
  const response = await fetch(`${supabaseUrl()}/rest/v1${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey(),
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return response;
}

/**
 * Service-role REST call. Only for the two lookups an unseated Operator can't see
 * under RLS yet (resolve a join code, count active seats for the cap check) --
 * never used to bypass RLS for anything a normal user-token call could do.
 */
async function restAsService(path, options = {}) {
  const key = serviceRoleKey();
  if (!key) {
    const error = new Error("Cell sync service role is not configured.");
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(`${supabaseUrl()}/rest/v1${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return response;
}

function generateJoinCode() {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

function normalizeSeatCap(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, ABSOLUTE_MAX_SEATS);
}

async function restJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

module.exports = {
  json,
  readBody,
  readJsonBody,
  getBearerToken,
  getAuthedUser,
  restAsUser,
  restAsService,
  restJson,
  generateJoinCode,
  normalizeSeatCap,
  supabaseUrl,
  anonKey,
};
