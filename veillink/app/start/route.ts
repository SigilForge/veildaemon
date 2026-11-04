import { NextRequest, NextResponse } from "next/server";
import { planHandoffTarget } from "@/lib/plan-handoff";
import { currentUser } from "@/lib/supabase";

// Session-aware handoff for plan CTAs on static pages (/links, /links/pricing):
// GET-only redirects, no side effects. Checkout itself stays a POST from /billing.
export async function GET(request: NextRequest) {
  const user = await currentUser().catch(() => null);
  const target = planHandoffTarget(request.nextUrl.searchParams.get("plan"), Boolean(user));
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
