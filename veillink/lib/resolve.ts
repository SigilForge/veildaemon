import { getSupabaseAdminClient } from "@/lib/supabase";
import { browserFamily, deviceCategory, operatingSystem, trustedCountry } from "@/lib/analytics";
import type { RedirectRecord, RoutingMode } from "@/lib/types";

export type ResolveState = "active" | "inactive" | "expired" | "suspended" | "unknown";

export async function findRedirect(slug: string, routingMode: RoutingMode) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("redirects")
    .select("*")
    .eq("slug", slug)
    .eq("routing_mode", routingMode)
    .maybeSingle();
  if (error) throw error;
  return data as RedirectRecord | null;
}

export function redirectState(redirect: RedirectRecord | null, now = new Date()) {
  if (!redirect) return "unknown" satisfies ResolveState;
  if (redirect.suspended_at) return "suspended" satisfies ResolveState;
  if (!redirect.active) return "inactive" satisfies ResolveState;
  if (redirect.expires_at && new Date(redirect.expires_at).getTime() <= now.getTime()) return "expired" satisfies ResolveState;
  return "active" satisfies ResolveState;
}

export async function recordScan(redirect: RedirectRecord, request: Request) {
  const admin = getSupabaseAdminClient();
  const userAgent = request.headers.get("user-agent") || "";
  const referrer = request.headers.get("referer") || null;
  const country = trustedCountry(request.headers);

  await Promise.all([
    admin.from("scan_events").insert({
      redirect_id: redirect.id,
      referrer,
      user_agent: userAgent.slice(0, 500),
      device_category: deviceCategory(userAgent),
      browser_family: browserFamily(userAgent),
      operating_system: operatingSystem(userAgent),
      country,
    }),
    admin.rpc("increment_redirect_scans", { redirect_id_input: redirect.id }),
  ]);
}
