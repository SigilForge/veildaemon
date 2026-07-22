import { NextRequest, NextResponse } from "next/server";
import { parseRedirectRequest } from "@/lib/host";

export function proxy(request: NextRequest) {
  const match = parseRedirectRequest(request.headers.get("host") || "", request.nextUrl.pathname);
  if (match.type === "none") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/api/resolve/${encodeURIComponent(match.slug)}`;
  url.searchParams.set("mode", match.type);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api|.*\\.(?:css|js|svg|png|webp|ico)).*)"],
};
