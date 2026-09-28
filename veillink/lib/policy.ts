import { plans, type PlanId } from "@/lib/config";
import type { RedirectRecord } from "@/lib/types";

/** Studio operator. Admin role and no active-redirect cap, including before a profile row is promoted. */
export const STUDIO_ADMIN_EMAIL = "knoxmortis@gmail.com";

export function userOwnsRedirect(userId: string, redirect: Pick<RedirectRecord, "user_id">) {
  return Boolean(userId && redirect.user_id === userId);
}

export function requireAdminRole(role: string, email: string | null | undefined, allowlist: string) {
  const normalized = String(email || "").trim().toLowerCase();
  if (role === "admin" || normalized === STUDIO_ADMIN_EMAIL) return true;
  const allowedEmails = allowlist
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowedEmails.includes(normalized);
}

export function hasUncappedRedirects(role: string, email: string | null | undefined, allowlist = "") {
  return requireAdminRole(role, email, allowlist);
}

export function canCreateActiveRedirect(
  plan: PlanId,
  activeRedirectCount: number,
  actor?: { role?: string; email?: string | null },
  allowlist = ""
) {
  if (actor && hasUncappedRedirects(actor.role || "user", actor.email, allowlist)) return true;
  return activeRedirectCount < plans[plan].activeRedirectLimit;
}

export function formatRedirectUsage(active: number, limit: number | null) {
  if (limit === null) return `${active} active redirects, no cap`;
  return `${active} of ${limit} active redirects`;
}
