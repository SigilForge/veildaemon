import { plans, type PlanId } from "@/lib/config";
import type { RedirectRecord } from "@/lib/types";

export function userOwnsRedirect(userId: string, redirect: Pick<RedirectRecord, "user_id">) {
  return Boolean(userId && redirect.user_id === userId);
}

export function canCreateActiveRedirect(plan: PlanId, activeRedirectCount: number) {
  return activeRedirectCount < plans[plan].activeRedirectLimit;
}

export function requireAdminRole(role: string, email: string | null | undefined, allowlist: string) {
  const allowedEmails = allowlist
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return role === "admin" || allowedEmails.includes(String(email || "").toLowerCase());
}
