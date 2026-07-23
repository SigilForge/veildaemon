import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("code");

  const supabase = await getSupabaseServerClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        redirectTo.pathname = next;
        redirectTo.searchParams.set("verified", "1");
        return NextResponse.redirect(redirectTo);
      }
      redirectTo.pathname = "/login";
      redirectTo.searchParams.set("verified", "1");
      redirectTo.searchParams.set("next", next);
      return NextResponse.redirect(redirectTo);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        redirectTo.pathname = next;
        redirectTo.searchParams.set("verified", "1");
        return NextResponse.redirect(redirectTo);
      }
      redirectTo.pathname = "/login";
      redirectTo.searchParams.set("verified", "1");
      redirectTo.searchParams.set("next", next);
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "Email confirmation link is invalid or expired. Please sign in or request a new link.");
  return NextResponse.redirect(redirectTo);
}
