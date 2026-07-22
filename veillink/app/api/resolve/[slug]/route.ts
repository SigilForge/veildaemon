import { NextRequest, NextResponse } from "next/server";
import { findRedirect, recordScan, redirectState } from "@/lib/resolve";
import type { RoutingMode } from "@/lib/types";

function errorPage(state: string, status: number) {
  const title = state === "unknown" ? "Link not found" : `Link ${state}`;
  return new NextResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - VeilLink</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1117;color:#f7f4ee;font-family:Arial,Helvetica,sans-serif}
    main{max-width:560px;padding:32px}
    a{color:#f5b85b}
    .box{border:1px solid #303441;border-radius:8px;padding:28px;background:#151924}
    p{color:#bec3cf;line-height:1.55}
  </style>
</head>
<body>
  <main class="box">
    <p>VEILLINK</p>
    <h1>${title}</h1>
    <p>This dynamic QR or short link is not currently available. If you believe this is an error, contact the person who shared it.</p>
    <p><a href="/report">Report abuse or a broken link</a></p>
  </main>
</body>
</html>`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const mode = request.nextUrl.searchParams.get("mode") === "subdomain" ? "subdomain" : "path";
  const redirect = await findRedirect(slug.toLowerCase(), mode as RoutingMode);
  const state = redirectState(redirect);

  if (state !== "active" || !redirect) {
    const status = state === "unknown" ? 404 : state === "expired" ? 410 : 403;
    return errorPage(state, status);
  }

  recordScan(redirect, request).catch((error) => {
    console.error("scan_event_failed", { redirectId: redirect.id, error: error instanceof Error ? error.message : "unknown" });
  });

  return NextResponse.redirect(redirect.destination_url, {
    status: 302,
    headers: {
      "cache-control": "no-store",
    },
  });
}
