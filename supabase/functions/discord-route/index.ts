// VEILDAEMON // Discord route resolver
// Public and intentionally ungated. Invite values are stored in Supabase secrets.
const routeEnv = new Map([
  ["operator-dream", "DISCORD_OPERATOR_DREAM_URL"],
  ["operator-silence", "DISCORD_OPERATOR_SILENCE_URL"],
  ["operator-hunger", "DISCORD_OPERATOR_HUNGER_URL"],
  ["operator-stillness", "DISCORD_OPERATOR_STILLNESS_URL"],
  ["operator-empyrean", "DISCORD_OPERATOR_EMPYREAN_URL"],
  ["operator-becoming", "DISCORD_OPERATOR_BECOMING_URL"],
  ["triage-dream", "DISCORD_TRIAGE_DREAM_URL"],
  ["triage-silence", "DISCORD_TRIAGE_SILENCE_URL"],
  ["triage-hunger", "DISCORD_TRIAGE_HUNGER_URL"],
  ["triage-stillness", "DISCORD_TRIAGE_STILLNESS_URL"],
  ["triage-empyrean", "DISCORD_TRIAGE_EMPYREAN_URL"],
  ["triage-becoming", "DISCORD_TRIAGE_BECOMING_URL"],
  ["threadbreaker", "DISCORD_THREADBREAKER_URL"],
]);
function cleanRouteKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z-]/g, "").slice(0, 40);
}
function decodeBase64Url(value) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
// Support legacy vd1:IV:TAG:CIPHERTEXT values; plain secrets are preferred.
async function decryptRouteValue(value) {
  if (!value.startsWith("vd1:")) return value;
  const secret = Deno.env.get("DISCORD_ROUTE_SECRET") || "";
  if (!secret) return "";
  const parts = value.split(":");
  if (parts.length !== 4) return "";
  try {
    const keyBytes = decodeBase64Url(secret);
    const iv = decodeBase64Url(parts[1]);
    const tag = decodeBase64Url(parts[2]);
    const ciphertext = decodeBase64Url(parts[3]);
    if (keyBytes.length !== 32 || tag.length !== 16 || !iv.length) return "";
    const encrypted = new Uint8Array(ciphertext.length + tag.length);
    encrypted.set(ciphertext);
    encrypted.set(tag, ciphertext.length);
    const key = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 }, key, encrypted,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return "";
  }
}
async function routeTarget(routeKey) {
  const envName = routeEnv.get(routeKey);
  if (!envName) return "";
  const target = await decryptRouteValue(Deno.env.get(envName) || "");
  return /^https:\/\/discord\.gg\/[a-z0-9-]+$/i.test(target) ? target : "";
}
function responseHeaders(request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin === "https://www.veildaemon.app"
    ? "https://www.veildaemon.app"
    : "https://veildaemon.app";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}
function json(request, status, value, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...responseHeaders(request),
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders(request) });
  }
  if (request.method !== "GET") {
    return json(request, 405, { ok: false, error: "Method not allowed." }, {
      Allow: "GET, OPTIONS",
    });
  }
  const key = cleanRouteKey(new URL(request.url).searchParams.get("key"));
  const target = await routeTarget(key);
  if (!target) {
    return json(request, 404, { ok: false, error: "Route unavailable." });
  }
  return json(request, 200, { url: target });
});
