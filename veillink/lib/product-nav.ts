/**
 * Original VeilLink QR / short-link product navigation.
 * Account lands on the general account hub (redirects, billing, plan) — not Creator Rights.
 */
export const QR_PRODUCT_ACCOUNT_LABEL = "Account";
export const QR_PRODUCT_ACCOUNT_PATH = "/account";

export function qrProductAccountHref() {
  return QR_PRODUCT_ACCOUNT_PATH;
}

export function qrProductLoginHref(returnTo = QR_PRODUCT_ACCOUNT_PATH) {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}
