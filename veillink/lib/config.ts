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

export function publicPathUrl(slug: string) {
  return `https://${product.pathHost}/${slug}`;
}

export function publicSubdomainUrl(slug: string) {
  return `https://${slug}.${product.baseDomain}`;
}
