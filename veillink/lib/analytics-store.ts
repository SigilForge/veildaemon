import { getSupabaseAdminClient } from "@/lib/supabase";

function startOfDay(daysAgo: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

export async function analyticsForUser(userId: string) {
  const admin = getSupabaseAdminClient();
  const { data: redirects, error: redirectError } = await admin
    .from("redirects")
    .select("id,name,total_scans")
    .eq("user_id", userId);
  if (redirectError) throw redirectError;
  const ids = (redirects || []).map((item) => item.id);
  if (!ids.length) {
    return { total: 0, today: 0, last7: 0, last30: 0, daily: [], recent: [], devices: [] };
  }

  const [today, last7, last30, recent, devices] = await Promise.all([
    countSince(ids, startOfDay(0)),
    countSince(ids, startOfDay(6)),
    countSince(ids, startOfDay(29)),
    admin
      .from("scan_events")
      .select("id,redirect_id,scanned_at,referrer,device_category,browser_family,operating_system,country")
      .in("redirect_id", ids)
      .order("scanned_at", { ascending: false })
      .limit(10),
    admin.from("scan_events").select("device_category").in("redirect_id", ids).limit(500),
  ]);

  const total = (redirects || []).reduce((sum, item) => sum + Number(item.total_scans || 0), 0);
  const deviceCounts = new Map<string, number>();
  (devices.data || []).forEach((event) => deviceCounts.set(event.device_category || "other", (deviceCounts.get(event.device_category || "other") || 0) + 1));
  const daily = [];
  for (let index = 6; index >= 0; index -= 1) {
    daily.push({ label: startOfDay(index).slice(5, 10), scans: await countSinceUntil(ids, startOfDay(index), startOfDay(index - 1)) });
  }

  return {
    total,
    today,
    last7,
    last30,
    daily,
    recent: recent.data || [],
    devices: [...deviceCounts.entries()].map(([label, count]) => ({ label, count })),
  };
}

async function countSince(ids: string[], since: string) {
  const admin = getSupabaseAdminClient();
  const { count, error } = await admin
    .from("scan_events")
    .select("id", { count: "exact", head: true })
    .in("redirect_id", ids)
    .gte("scanned_at", since);
  if (error) throw error;
  return count || 0;
}

async function countSinceUntil(ids: string[], since: string, until: string) {
  const admin = getSupabaseAdminClient();
  const query = admin
    .from("scan_events")
    .select("id", { count: "exact", head: true })
    .in("redirect_id", ids)
    .gte("scanned_at", since);
  if (until > since) query.lt("scanned_at", until);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}
