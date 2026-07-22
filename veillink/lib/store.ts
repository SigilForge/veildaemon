import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase";
import { plans } from "@/lib/config";
import type { PlanId, RedirectInput, RedirectRecord } from "@/lib/types";
import {
  contrastRatio,
  redirectInputSchema,
  validateDestinationUrl,
  validateHexColor,
  validateSlug,
} from "@/lib/validation";
import { canCreateActiveRedirect, requireAdminRole } from "@/lib/policy";
import type { Json } from "@/lib/database.types";

export function publicError(message: string, status = 400) {
  const error = new Error(message);
  Object.assign(error, { status });
  return error;
}

export async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw publicError("Authentication required.", 401);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,plan,role,billing_status,suspended_at")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) throw publicError("Profile unavailable.", 403);
  if (profile.suspended_at) throw publicError("Account suspended.", 403);
  return { supabase, user: data.user, profile };
}

export async function requireAdmin() {
  const session = await requireUser();
  const configured = (process.env.VEILLINK_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!requireAdminRole(session.profile.role, session.user.email, configured.join(","))) {
    throw publicError("Admin access required.", 403);
  }
  return session;
}

export async function listUserRedirects(userId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("redirects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as RedirectRecord[];
}

export async function getUsage(userId: string, plan: PlanId) {
  const admin = getSupabaseAdminClient();
  const { count, error } = await admin
    .from("redirects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("active", true)
    .is("suspended_at", null);
  if (error) throw error;
  return {
    activeRedirects: count || 0,
    limit: plans[plan].activeRedirectLimit,
  };
}

export function normalizeRedirectInput(input: unknown) {
  const parsed = redirectInputSchema.parse(input);
  const slugResult = validateSlug(parsed.slug);
  if (!slugResult.ok) throw publicError(slugResult.error);

  const urlResult = validateDestinationUrl(parsed.destinationUrl);
  if (!urlResult.ok) throw publicError(urlResult.error);

  const qrForeground = validateHexColor(parsed.qrForeground, "#111827");
  const qrBackground = validateHexColor(parsed.qrBackground, "#ffffff");
  if (contrastRatio(qrForeground, qrBackground) < 4.5) {
    throw publicError("QR foreground and background need stronger contrast.");
  }

  return {
    name: parsed.name,
    slug: slugResult.slug,
    routing_mode: parsed.routingMode,
    destination_url: urlResult.url,
    active: parsed.active,
    expires_at: parsed.expiresAt || null,
    notes: parsed.notes || "",
    qr_foreground: qrForeground,
    qr_background: qrBackground,
    qr_ecc: parsed.qrEcc,
  };
}

export async function createRedirect(userId: string, plan: PlanId, input: RedirectInput) {
  const admin = getSupabaseAdminClient();
  const record = normalizeRedirectInput(input);
  if (record.active) {
    const usage = await getUsage(userId, plan);
    if (!canCreateActiveRedirect(plan, usage.activeRedirects)) {
      throw publicError(`Your ${plans[plan].label} plan allows ${usage.limit} active redirects.`, 403);
    }
  }

  const { data, error } = await admin
    .from("redirects")
    .insert({ ...record, user_id: userId })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw publicError("That slug is already in use.");
    throw error;
  }
  await audit(userId, "redirect.create", "redirect", data.id, { slug: record.slug });
  return data as RedirectRecord;
}

export async function updateRedirect(userId: string, plan: PlanId, id: string, input: RedirectInput) {
  const admin = getSupabaseAdminClient();
  const current = await getOwnedRedirect(userId, id);
  const record = normalizeRedirectInput(input);
  if (!current.active && record.active) {
    const usage = await getUsage(userId, plan);
    if (!canCreateActiveRedirect(plan, usage.activeRedirects)) {
      throw publicError(`Your ${plans[plan].label} plan allows ${usage.limit} active redirects.`, 403);
    }
  }

  const { data, error } = await admin
    .from("redirects")
    .update(record)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw publicError("That slug is already in use.");
    throw error;
  }
  await audit(userId, "redirect.update", "redirect", id, { slug: record.slug });
  return data as RedirectRecord;
}

export async function deleteRedirect(userId: string, id: string) {
  const admin = getSupabaseAdminClient();
  await getOwnedRedirect(userId, id);
  const { error } = await admin.from("redirects").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  await audit(userId, "redirect.delete", "redirect", id, {});
}

export async function getOwnedRedirect(userId: string, id: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("redirects").select("*").eq("id", id).eq("user_id", userId).single();
  if (error || !data) throw publicError("Redirect not found.", 404);
  return data as RedirectRecord;
}

export async function audit(actorUserId: string | null, action: string, entityType: string, entityId: string | null, metadata: Json) {
  const admin = getSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}
