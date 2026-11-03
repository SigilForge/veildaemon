// Pure helpers for public, branded VeilLink path-mode redirects.
// Semantics match veillink/lib/validation.ts and veillink/lib/resolve.ts.
export function validSlug(value) {
  return typeof value === "string" &&
    value.length >= 3 && value.length <= 63 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function stateForRedirect(redirect, now = Date.now()) {
  if (!redirect) return "unknown";
  if (redirect.suspended_at) return "suspended";
  if (!redirect.active) return "inactive";
  if (redirect.expires_at && new Date(redirect.expires_at).getTime() <= now) return "expired";
  return "active";
}

export function statusForState(state) {
  return state === "unknown" ? 404 : state === "expired" ? 410 : state === "active" ? 302 : 403;
}

export function safeDestination(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export function deviceCategory(userAgent) {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  return ua ? "desktop" : "other";
}

export function browserFamily(userAgent) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome/") || ua.includes("crios/")) return "Chrome";
  if (ua.includes("firefox/") || ua.includes("fxios/")) return "Firefox";
  if (ua.includes("safari/")) return "Safari";
  return "Other";
}

export function operatingSystem(userAgent) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Other";
}

// The resolver is only reachable through the go.veildaemon.app proxy, which
// sends this shared secret. Without it, anyone could call the public function
// URL directly, forge the forwarded analytics headers and inflate scan counts.
// Compares in constant time; an unset expected secret always fails closed.
export function proxyAuthorized(provided, expected) {
  if (typeof expected !== "string" || expected.length < 32) return false;
  if (typeof provided !== "string") return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}
