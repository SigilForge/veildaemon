import { plans, type PlanId } from "@/lib/config";
import type { RedirectRecord } from "@/lib/types";

const DEFAULT_RELAY_OPERATOR_EMAILS = ["j.donavon.love@gmail.com"];
const DEFAULT_RELAY_OPERATOR_HANDLES = ["knoxmortis"];

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

function splitList(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function githubHandle(user: {
  identities?: Array<{ provider?: string | null; identity_data?: Record<string, unknown> | null }>;
  user_metadata?: Record<string, unknown>;
} | null | undefined) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  for (const identity of identities) {
    if (String(identity?.provider || "").toLowerCase() !== "github") continue;
    const data = identity.identity_data || {};
    const handle = data.user_name || data.preferred_username || data.login || "";
    if (handle) return String(handle).toLowerCase();
  }
  const meta = user?.user_metadata || {};
  return String(meta.user_name || meta.preferred_username || meta.user_handle || "").toLowerCase();
}

export function isRelayOperator(
  email: string | null | undefined,
  user?: {
    id?: string;
    email?: string | null;
    identities?: Array<{ provider?: string | null; identity_data?: Record<string, unknown> | null }>;
    user_metadata?: Record<string, unknown>;
  } | null,
) {
  const emails = splitList(process.env.RELAY_OPERATOR_EMAILS);
  const handles = splitList(process.env.RELAY_OPERATOR_HANDLES);
  const userIds = splitList(process.env.RELAY_OPERATOR_USER_IDS);
  const allowedEmails = emails.length ? emails : DEFAULT_RELAY_OPERATOR_EMAILS;
  const allowedHandles = handles.length ? handles : DEFAULT_RELAY_OPERATOR_HANDLES;
  const normalizedEmail = String(email || user?.email || "").trim().toLowerCase();
  const userId = String(user?.id || "").trim().toLowerCase();
  const handle = githubHandle(user);
  if (normalizedEmail && allowedEmails.includes(normalizedEmail)) return true;
  if (userId && userIds.includes(userId)) return true;
  if (handle && allowedHandles.includes(handle)) return true;
  return false;
}
