import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { authReturnTarget, canonicalAppUrl } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase";

function authRedirect(target: string, params?: Record<string, string>) {
  const url = target.startsWith("https://veildaemon.app/")
    ? new URL(target)
    : new URL(target, `${canonicalAppUrl()}/`);
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") || "email") as EmailOtpType;
  const code = searchParams.get("code");
  const next = authReturnTarget(searchParams.get("next"));
  const errorDescription = searchParams.get("error_description") || searchParams.get("error");

  // Supabase sometimes bounces failed redirects with error_* query params and no token.
  if (errorDescription && !token_hash && !code) {
    return authRedirect("/login", {
      error: errorDescription.slice(0, 300),
      next,
    });
  }

  const supabase = await getSupabaseServerClient();

  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        return authRedirect(next, { verified: "1" });
      }
      // Account confirmed but session cookie did not attach — still let them sign in.
      return authRedirect("/login", { verified: "1", next });
    }
    console.error("auth_confirm_verify_otp_failed", error.message);
    return authRedirect("/login", {
      error: "Email confirmation link is invalid or expired. Please sign in or request a new link.",
      next,
    });
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        return authRedirect(next, { verified: "1" });
      }
      return authRedirect("/login", { verified: "1", next });
    }
    console.error("auth_confirm_exchange_code_failed", error.message);
    return authRedirect("/login", {
      error:
        "Email confirmation could not complete on this device. Open the link in the same browser you used to sign up, or sign in if the account is already active.",
      next,
    });
  }

  // No token and no code: usually means Supabase Site URL / email template
  // did not send users to /auth/confirm with credentials.
  return authRedirect("/login", {
    error:
      "Email confirmation link is missing credentials. In Supabase Auth, set Site URL to https://app.veildaemon.app and use a confirm template with token_hash.",
    next,
  });
}
