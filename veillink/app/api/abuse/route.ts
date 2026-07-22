import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { validateDestinationUrl } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const url = String(form.get("url") || "").trim();
  const email = String(form.get("email") || "").trim().slice(0, 240);
  const reason = String(form.get("reason") || "").trim().slice(0, 120);
  const details = String(form.get("details") || "").trim().slice(0, 2000);
  if (!reason) return NextResponse.json({ ok: false, error: "Reason is required." }, { status: 400 });

  let redirectId: string | null = null;
  const parsed = validateDestinationUrl(url);
  if (parsed.ok) {
    const slug = new URL(parsed.url).pathname.split("/").filter(Boolean)[0] || "";
    if (slug) {
      const { data } = await getSupabaseAdminClient().from("redirects").select("id").eq("slug", slug.toLowerCase()).maybeSingle();
      redirectId = data?.id || null;
    }
  }

  const { error } = await getSupabaseAdminClient().from("abuse_reports").insert({
    redirect_id: redirectId,
    reporter_email: email || null,
    reason,
    details,
  });
  if (error) return NextResponse.json({ ok: false, error: "Could not submit report." }, { status: 500 });
  return NextResponse.redirect(new URL("/report?submitted=1", request.url), 303);
}
