import assert from "node:assert/strict";
import { test } from "node:test";
import { validSlug, stateForRedirect, statusForState, safeDestination, deviceCategory, browserFamily, operatingSystem, proxyAuthorized } from "../../supabase/functions/veillink-resolve/logic.mjs";
import { onRequestGet } from "../../deploy/veillink-go-pages/functions/[slug].js";

test("matches VeilLink slug creation validation", () => {
  assert.equal(validSlug("sample-link"), true);
  assert.equal(validSlug("sample--link"), false);
  assert.equal(validSlug("a"), false);
  assert.equal(validSlug("a-"), false);
  assert.equal(validSlug("a".repeat(64)), false);
  assert.equal(validSlug("sample/link"), false);
});

test("matches suspended, inactive, expired, active and missing state", () => {
  assert.equal(stateForRedirect(null), "unknown");
  assert.equal(stateForRedirect({ suspended_at: "2026-01-01", active: true }), "suspended");
  assert.equal(stateForRedirect({ active: false }), "inactive");
  assert.equal(stateForRedirect({ active: true, expires_at: "2026-10-01" }, Date.parse("2026-11-02")), "expired");
  assert.equal(stateForRedirect({ active: true, expires_at: "2026-12-01" }, Date.parse("2026-11-02")), "active");
  assert.equal(statusForState("expired"), 410);
  assert.equal(statusForState("suspended"), 403);
  assert.equal(statusForState("unknown"), 404);
});

test("rejects non-http redirect targets", () => {
  assert.equal(safeDestination("javascript:alert(1)"), "");
  assert.equal(safeDestination("file:///etc/passwd"), "");
  assert.equal(safeDestination("https://example.com/path"), "https://example.com/path");
});

test("analytics categories preserve existing classification", () => {
  assert.equal(deviceCategory("Mozilla iPhone"), "mobile");
  assert.equal(browserFamily("Edg/100"), "Edge");
  assert.equal(operatingSystem("Mozilla Android"), "Android");
});

const SECRET = "s".repeat(48);
const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });

test("Cloudflare edge forwards a slug to Supabase and returns the established redirect", async () => {
  let capturedUrl;
  let capturedOptions;
  globalThis.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options;
    return new Response(null, { status: 302, headers: { Location: "https://example.com/path" } });
  };
  const request = new Request("https://go.veildaemon.app/needlepoint", { headers: { "User-Agent": "Test Browser", Referer: "https://veildaemon.app" } });
  const result = await onRequestGet({ request, params: { slug: "needlepoint" }, env: { VEILLINK_RESOLVER_URL: "https://example.supabase.co/functions/v1/veillink-resolve", VEILLINK_PROXY_SECRET: SECRET } });
  assert.equal(result.status, 302);
  assert.equal(result.headers.get("location"), "https://example.com/path");
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(new URL(capturedUrl).searchParams.get("slug"), "needlepoint");
  assert.equal(capturedOptions.redirect, "manual");
  assert.equal(capturedOptions.headers["x-original-user-agent"], "Test Browser");
});

test("Cloudflare edge refuses invalid slugs without consulting Supabase", async () => {
  globalThis.fetch = async () => { throw new Error("Should not fetch"); };
  const result = await onRequestGet({
    request: new Request("https://go.veildaemon.app/no"),
    params: { slug: "no" },
    env: { VEILLINK_RESOLVER_URL: "https://example.supabase.co/functions/v1/veillink-resolve" },
  });
  assert.equal(result.status, 404);
});

test("Cloudflare edge does not leak invalid upstream redirect targets", async () => {
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: "javascript:alert(1)" } });
  const result = await onRequestGet({
    request: new Request("https://go.veildaemon.app/needlepoint"),
    params: { slug: "needlepoint" },
    env: { VEILLINK_RESOLVER_URL: "https://example.supabase.co/functions/v1/veillink-resolve", VEILLINK_PROXY_SECRET: SECRET },
  });
  assert.equal(result.status, 502);
});

test("Cloudflare edge fails closed when the resolver is unconfigured", async () => {
  const result = await onRequestGet({
    request: new Request("https://go.veildaemon.app/needlepoint"),
    params: { slug: "needlepoint" }, env: {},
  });
  assert.equal(result.status, 503);
});


test("proxy secret check is exact and fails closed", () => {
  assert.equal(proxyAuthorized(SECRET, SECRET), true);
  assert.equal(proxyAuthorized(SECRET.slice(0, -1) + "t", SECRET), false);
  assert.equal(proxyAuthorized(SECRET + "s", SECRET), false);
  assert.equal(proxyAuthorized(SECRET.slice(1), SECRET), false);
  assert.equal(proxyAuthorized(null, SECRET), false);
  assert.equal(proxyAuthorized("", ""), false);
  assert.equal(proxyAuthorized("short", "short"), false);
});

test("Cloudflare edge sends the proxy secret to the resolver", async () => {
  let capturedOptions;
  globalThis.fetch = async (url, options) => {
    capturedOptions = options;
    return new Response(null, { status: 404 });
  };
  const result = await onRequestGet({
    request: new Request("https://go.veildaemon.app/needlepoint"),
    params: { slug: "needlepoint" },
    env: { VEILLINK_RESOLVER_URL: "https://example.supabase.co/functions/v1/veillink-resolve", VEILLINK_PROXY_SECRET: SECRET },
  });
  assert.equal(result.status, 404);
  assert.equal(capturedOptions.headers["x-veillink-proxy-secret"], SECRET);
});

test("Cloudflare edge fails closed without the proxy secret", async () => {
  globalThis.fetch = async () => { throw new Error("Should not fetch"); };
  const result = await onRequestGet({
    request: new Request("https://go.veildaemon.app/needlepoint"),
    params: { slug: "needlepoint" },
    env: { VEILLINK_RESOLVER_URL: "https://example.supabase.co/functions/v1/veillink-resolve" },
  });
  assert.equal(result.status, 503);
});
