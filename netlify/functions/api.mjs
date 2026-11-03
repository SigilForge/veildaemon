// Netlify adapter for the root Vercel-style Node HTTP handlers.
// Preserve request bytes for webhook signatures and streaming body readers.
import { Readable } from "node:stream";
import alerts from "../../api/alerts/[action].js";
import authConfig from "../../api/auth/config.js";
import bookOneClaim from "../../api/book-one/claim.js";
import cell from "../../api/cell/[action].js";
import character from "../../api/character.js";
import debugPing from "../../api/debug/ping.js";
import observe from "../../api/observe.js";
import reports from "../../api/reports/[action].js";
import route from "../../api/route.js";
import scanCode from "../../api/scan-code.js";
import twitchEventsubConfig from "../../api/twitch/eventsub-config.js";
import twitchEventsub from "../../api/twitch/eventsub.js";

const staticRoutes = new Map([
  ["/api/auth/config", authConfig],
  ["/api/book-one/claim", bookOneClaim],
  ["/api/character", character],
  ["/api/debug/ping", debugPing],
  ["/api/observe", observe],
  ["/api/route", route],
  ["/api/scan-code", scanCode],
  ["/api/twitch/eventsub-config", twitchEventsubConfig],
  ["/api/twitch/eventsub", twitchEventsub],
]);
const dynamicRoutes = [
  [/^\/api\/alerts\/([^/]+)$/, alerts],
  [/^\/api\/cell\/([^/]+)$/, cell],
  [/^\/api\/reports\/([^/]+)$/, reports],
];

function matchRoute(pathname) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const exact = staticRoutes.get(normalized);
  if (exact) return { handler: exact, params: {} };
  for (const [pattern, handler] of dynamicRoutes) {
    const match = pattern.exec(normalized);
    if (match) return { handler, params: { action: decodeURIComponent(match[1]) } };
  }
  return null;
}

function parseBody(raw, contentType) {
  if (!raw.length) return undefined;
  if (/^application\/json(?:;|$)/i.test(contentType)) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return undefined;
    }
  }
  if (/^application\/x-www-form-urlencoded(?:;|$)/i.test(contentType)) {
    return Object.fromEntries(new URLSearchParams(raw.toString("utf8")));
  }
  return raw.toString("utf8");
}

function makeLegacyRequest(request, url, params, raw) {
  const req = Readable.from(raw.length ? [raw] : []);
  req.method = request.method;
  req.url = url.pathname + url.search;
  req.headers = Object.fromEntries(request.headers);
  req.query = { ...Object.fromEntries(url.searchParams), ...params };
  req.body = parseBody(raw, request.headers.get("content-type") || "");
  req.rawBody = raw;
  req.cookies = Object.fromEntries(
    (request.headers.get("cookie") || "").split(";").map((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return [];
      return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }).filter((entry) => entry.length === 2)
  );
  return req;
}

function makeLegacyResponse() {
  const headers = new Headers();
  const chunks = [];
  let finished = false;
  let resolveFinished;
  const completion = new Promise((resolve) => { resolveFinished = resolve; });
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
      return this;
    },
    getHeader(name) { return headers.get(name); },
    removeHeader(name) { headers.delete(name); },
    writeHead(status, extraHeaders = {}) {
      this.statusCode = status;
      for (const [key, value] of Object.entries(extraHeaders)) this.setHeader(key, value);
      return this;
    },
    status(status) { this.statusCode = status; return this; },
    write(chunk) {
      if (finished) return false;
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    },
    end(chunk) {
      if (finished) return this;
      if (chunk !== undefined && chunk !== null) this.write(chunk);
      finished = true;
      resolveFinished();
      return this;
    },
    json(value) {
      this.setHeader("Content-Type", "application/json; charset=utf-8");
      return this.end(JSON.stringify(value));
    },
    send(value) { return this.end(typeof value === "object" ? JSON.stringify(value) : value); },
  };
  return {
    res,
    completion,
    toResponse() {
      const status = Number(res.statusCode) || 200;
      const body = status === 204 || status === 304 ? null : Buffer.concat(chunks);
      return new Response(body, { status, headers });
    },
  };
}

export async function handleApiRequest(request) {
  const url = new URL(request.url);
  const matched = matchRoute(url.pathname);
  if (!matched) {
    return Response.json({ ok: false, error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const raw = Buffer.from(await request.arrayBuffer());
  const req = makeLegacyRequest(request, url, matched.params, raw);
  const { res, completion, toResponse } = makeLegacyResponse();
  try {
    await matched.handler(req, res);
    await completion;
    return toResponse();
  } catch (error) {
    console.error("Netlify API handler failed", url.pathname, error);
    return Response.json({ ok: false, error: "Internal server error." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export default handleApiRequest;

// Netlify Functions' modern request/response runtime invokes this endpoint
// directly for the original /api paths; no client URL changes are necessary.
export const config = { path: "/api/*" };
