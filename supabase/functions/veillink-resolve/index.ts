// Public VeilLink redirect resolver. Deployed to the EXISTING Supabase project.
// Only the path-mode QR redirects (go.veildaemon.app/<slug>) are handled here.
// No user authentication is required to follow a public link, but requests must
// come through the go.veildaemon.app proxy, which proves itself with the shared
// VEILLINK_PROXY_SECRET. Privileged Supabase credentials never leave this
// function's server environment.
import {
  validSlug, stateForRedirect, statusForState, safeDestination,
  deviceCategory, browserFamily, operatingSystem, proxyAuthorized,
} from "./logic.mjs";

function adminKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const named = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (named) {
    try { return JSON.parse(named).default || ""; } catch { return ""; }
  }
  return "";
}

function response(status: number, error: string) {
  return Response.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}

async function recordScan(baseUrl: string, key: string, id: string, request: Request) {
  const agent = (request.headers.get("x-original-user-agent") || request.headers.get("user-agent") || "").slice(0, 500);
  const referer = (request.headers.get("x-original-referer") || request.headers.get("referer") || "").slice(0, 2048) || null;
  const reportedCountry = request.headers.get("x-original-country") || "";
  const country = /^[A-Z]{2}$/.test(reportedCountry) ? reportedCountry : null;
  const authHeaders = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  // One insert: the scan_events trigger increments redirects.total_scans in
  // the same transaction, so the counter can never drift from the scan log.
  try {
    const result = await fetch(`${baseUrl}/rest/v1/scan_events`, {
      method: "POST",
      headers: { ...authHeaders, "Prefer": "return=minimal" },
      body: JSON.stringify({
        redirect_id: id,
        referrer: referer,
        user_agent: agent,
        device_category: deviceCategory(agent),
        browser_family: browserFamily(agent),
        operating_system: operatingSystem(agent),
        country,
      }),
    });
    if (!result.ok) console.error("VeilLink scan analytics write failed", result.status);
  } catch {
    // Analytics failures must not break a legitimate printed QR link.
    console.error("VeilLink scan analytics write failed");
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return response(405, "Method not allowed.");
  }
  const proxySecret = Deno.env.get("VEILLINK_PROXY_SECRET") || "";
  if (!proxySecret) return response(503, "Resolver unavailable.");
  if (!proxyAuthorized(request.headers.get("x-veillink-proxy-secret"), proxySecret)) {
    return response(401, "Unauthorized.");
  }
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").toLowerCase();
  const mode = url.searchParams.get("mode") || "path";

  if (mode !== "path" || !validSlug(slug)) {
    return response(404, "Link not found.");
  }

  const baseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const key = adminKey();
  if (!baseUrl || !key) return response(503, "Resolver unavailable.");

  try {
    const query = new URL(`${baseUrl}/rest/v1/redirects`);
    query.searchParams.set("select", "id,destination_url,active,suspended_at,expires_at");
    query.searchParams.set("slug", `eq.${slug}`);
    query.searchParams.set("routing_mode", "eq.path");
    query.searchParams.set("limit", "1");

    const result = await fetch(query, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!result.ok) return response(503, "Resolver unavailable.");
    const [redirect] = await result.json();
    const state = stateForRedirect(redirect);
    if (state !== "active") return response(statusForState(state), `Link ${state}.`);

    const destination = safeDestination(redirect.destination_url);
    if (!destination) return response(403, "Invalid destination.");

    const work = recordScan(baseUrl, key, redirect.id, request);
    // Official Supabase Edge runtime keeps background writes alive until done.
    EdgeRuntime.waitUntil(work);

    return new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("VeilLink resolver request failed", error instanceof Error ? error.name : "unknown");
    return response(503, "Resolver unavailable.");
  }
});
