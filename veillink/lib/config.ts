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

function assertProductionAuthOrigin(appUrl: string, vercelEnv = process.env.VERCEL_ENV) {
  const { hostname } = new URL(appUrl);
  if (vercelEnv === "production" && (hostname === "vercel.app" || hostname.endsWith(".vercel.app"))) {
    throw new Error("Production VeilLink auth redirects must use https://app.veildaemon.app, not a Vercel deployment domain.");
  }
}

export function authRedirectUrl(
  pathname: string,
  searchParams?: Record<string, string>,
  appUrl = product.appUrl,
  vercelEnv = process.env.VERCEL_ENV
) {
  assertProductionAuthOrigin(appUrl, vercelEnv);
  const url = new URL(pathname, appUrl);
  for (const [key, value] of Object.entries(searchParams || {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function publicPathUrl(slug: string) {
  return `https://${product.pathHost}/${slug}`;
}

export function publicSubdomainUrl(slug: string) {
  return `https://${slug}.${product.baseDomain}`;
}
