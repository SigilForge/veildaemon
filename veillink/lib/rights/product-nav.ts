import { PRODUCTION_APP_URL, product } from "@/lib/config";

/**
 * Creator Rights product navigation — define once, reuse everywhere.
 * Customer-facing label is always "Account" (not Acct / entitlement jargon).
 * Target is the rights manage surface, not the general account hub.
 */
export const RIGHTS_PRODUCT_ACCOUNT_LABEL = "Account";
export const RIGHTS_PRODUCT_ACCOUNT_PATH = "/account/rights";
export const RIGHTS_PRODUCT_ADVISOR_PATH = "/rights/advisor";
export const RIGHTS_PRODUCT_ADVISOR_LABEL = "Open Advisor";
export const RIGHTS_PRODUCT_CREATE_PATH = "/rights/create";
export const RIGHTS_PRODUCT_CREATE_LABEL = "Preserve record";
export const RIGHTS_PRODUCT_REGISTRY_PATH = "/rights";
export const RIGHTS_PRODUCT_STUDIO_OVERVIEW = "https://veildaemon.app/studio/creator-rights/";

/** App origin for absolute links from GitHub Pages / Studio. Never encode localhost into public chrome. */
export function rightsProductAppOrigin() {
  const configured = (process.env.RIGHTS_PUBLIC_ORIGIN || product.appUrl || PRODUCTION_APP_URL).replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(configured)) return PRODUCTION_APP_URL;
  return configured;
}

export function rightsProductAccountPath(returnTo?: string) {
  if (!returnTo) return RIGHTS_PRODUCT_ACCOUNT_PATH;
  return `${RIGHTS_PRODUCT_ACCOUNT_PATH}?from=${encodeURIComponent(returnTo)}`;
}

export function rightsProductAccountHref(options?: { absolute?: boolean; returnTo?: string }) {
  const path = rightsProductAccountPath(options?.returnTo);
  if (options?.absolute) return `${rightsProductAppOrigin()}${path}`;
  return path;
}

export function rightsProductLoginHref(returnTo = RIGHTS_PRODUCT_ACCOUNT_PATH) {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}

/** Markup for static Studio / GH Pages headers (single definition for external surfaces). */
export function rightsProductAccountAnchorHtml(className = "nav-cta") {
  const href = rightsProductAccountHref({ absolute: true });
  return `<a class="${className}" href="${href}" target="_blank" rel="noopener noreferrer">${RIGHTS_PRODUCT_ACCOUNT_LABEL}</a>`;
}
