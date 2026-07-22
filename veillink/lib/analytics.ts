export function deviceCategory(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  if (!ua) return "other";
  return "desktop";
}

export function browserFamily(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome/") || ua.includes("crios/")) return "Chrome";
  if (ua.includes("firefox/") || ua.includes("fxios/")) return "Firefox";
  if (ua.includes("safari/")) return "Safari";
  return "Other";
}

export function operatingSystem(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Other";
}

export function trustedCountry(headers: Headers) {
  return headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || null;
}
