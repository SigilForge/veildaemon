// Cloudflare Pages Function for go.veildaemon.app/<slug>.
// DNS remains in Porkbun: CNAME "go" -> this site's *.pages.dev address.
// This contains no Supabase service keys. The lookup and analytics live
// in the EXISTING Supabase project via veillink-resolve Edge Function.
// VEILLINK_PROXY_SECRET (an encrypted Pages secret, the same value as the
// Edge Function secret) proves to the resolver that requests come from here.
export async function onRequestGet({ request, params, env }) {
  const slug = String(params.slug || "").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 63) {
    return new Response("Link not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const endpoint = env.VEILLINK_RESOLVER_URL;
  const secret = env.VEILLINK_PROXY_SECRET;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") ||
      typeof secret !== "string" || secret.length < 32) {
    return new Response("Link unavailable.", { status: 503 });
  }
  try {
    const url = new URL(endpoint);
    url.searchParams.set("slug", slug);
    url.searchParams.set("mode", "path");
    const upstream = await fetch(url, {
      redirect: "manual",
      headers: {
        "x-veillink-proxy-secret": secret,
        "x-original-user-agent": request.headers.get("user-agent") || "",
        "x-original-referer": request.headers.get("referer") || "",
        "x-original-country": request.headers.get("cf-ipcountry") || "",
      },
    });
    const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
    if (upstream.status === 302) {
      const location = upstream.headers.get("location") || "";
      const parsed = new URL(location);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return new Response("Link unavailable.", { status: 502, headers });
      }
      return new Response(null, { status: 302, headers: { ...headers, Location: parsed.href, "Referrer-Policy": "no-referrer" } });
    }
    if ([403, 404, 410].includes(upstream.status)) {
      return new Response("This link is unavailable.", { status: upstream.status, headers });
    }
    return new Response("Link temporarily unavailable.", { status: 503, headers });
  } catch {
    return new Response("Link temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
