import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { audit, requireAdmin } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin();
  const { id } = await context.params;
  const form = await request.formData();
  const reason = String(form.get("reason") || "Administrative suspension").trim().slice(0, 500);
  const { error } = await getSupabaseAdminClient().from("redirects").update({
    active: false,
    suspended_at: new Date().toISOString(),
    suspension_reason: reason,
  }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "Could not suspend redirect." }, { status: 500 });
  await audit(user.id, "admin.redirect.suspend", "redirect", id, { reason });
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
