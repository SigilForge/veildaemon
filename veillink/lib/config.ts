/** Canonical production origin. Never use a Vercel deployment host for auth/email links. */
export const PRODUCTION_APP_URL = "https://app.veildaemon.app";

export const product = {
  name: process.env.NEXT_PUBLIC_VEILLINK_PRODUCT_NAME || "VeilLink",
  appUrl: process.env.NEXT_PUBLIC_VEILLINK_APP_URL || "http://localhost:3000",
  baseDomain: process.env.NEXT_PUBLIC_VEILLINK_BASE_DOMAIN || "veildaemon.app",
  pathHost: process.env.NEXT_PUBLIC_VEILLINK_PATH_HOST || "go.veildaemon.app",
};

export const plans = {
  free: {
    id: "free",
    label: "Free",
    activeRedirectLimit: 3,
    monthlyPrice: 0,
    yearlyPrice: 0,
  },
  pro: {
    id: "pro",
    label: "Pro",
    activeRedirectLimit: 100,
    monthlyPrice: 7,
    yearlyPrice: 60,
  },
  business: {
    id: "business",
    label: "Business",
    activeRedirectLimit: 1000,
    monthlyPrice: 19,
    yearlyPrice: 180,
  },
} as const;

export type PlanId = keyof typeof plans;

const DEFAULT_AUTH_RETURN_TARGET = "/dashboard";
const ROOT_APP_AUTH_RETURN_ORIGIN = "https://veildaemon.app";
const ROOT_APP_AUTH_RETURN_PATHS = ["/operator", "/handler"];

function isVercelDeploymentHost(hostname: string) {
  return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
}

function pathMatchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Origin used for signup confirm, password reset, and post-auth redirects.
 * In production, always force app.veildaemon.app so mis-set env or a Vercel
 * preview host cannot leak into confirmation emails.
 */
export function canonicalAppUrl(
  appUrl = product.appUrl,
  vercelEnv = process.env.VERCEL_ENV
) {
  try {
    const { hostname } = new URL(appUrl);
    if (vercelEnv === "production" || isVercelDeploymentHost(hostname)) {
      return PRODUCTION_APP_URL;
    }
    return appUrl.replace(/\/$/, "") || PRODUCTION_APP_URL;
  } catch {
    return vercelEnv === "production" ? PRODUCTION_APP_URL : "http://localhost:3000";
  }
}

function assertProductionAuthOrigin(appUrl: string, vercelEnv = process.env.VERCEL_ENV) {
  const { hostname } = new URL(appUrl);
  if (vercelEnv === "production" && isVercelDeploymentHost(hostname)) {
    throw new Error("Production VeilLink auth redirects must use https://app.veildaemon.app, not a Vercel deployment domain.");
  }
}

export function authRedirectUrl(
  pathname: string,
  searchParams?: Record<string, string>,
  appUrl = product.appUrl,
  vercelEnv = process.env.VERCEL_ENV
) {
  const origin = canonicalAppUrl(appUrl, vercelEnv);
  assertProductionAuthOrigin(origin, vercelEnv);
  const url = new URL(pathname, origin.endsWith("/") ? origin : `${origin}/`);
  for (const [key, value] of Object.entries(searchParams || {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function authReturnTarget(value: string | null | undefined, appUrl = product.appUrl) {
  const target = String(value || "").trim();
  if (!target) return DEFAULT_AUTH_RETURN_TARGET;
  if (target.startsWith("/") && !target.startsWith("//")) return target;

  try {
    const url = new URL(target);
    const canonical = new URL(canonicalAppUrl(appUrl));
    if (url.origin === canonical.origin) {
      return `${url.pathname}${url.search}${url.hash}` || DEFAULT_AUTH_RETURN_TARGET;
    }
    if (url.origin === ROOT_APP_AUTH_RETURN_ORIGIN && pathMatchesPrefix(url.pathname, ROOT_APP_AUTH_RETURN_PATHS)) {
      return url.toString();
    }
  } catch {
    return DEFAULT_AUTH_RETURN_TARGET;
  }

  return DEFAULT_AUTH_RETURN_TARGET;
}

export function publicPathUrl(slug: string) {
  return `https://${product.pathHost}/${slug}`;
}

export function publicSubdomainUrl(slug: string) {
  return `https://${slug}.${product.baseDomain}`;
}
