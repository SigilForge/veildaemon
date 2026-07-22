# VeilLink Architecture

## Current Repository Fit

The parent repository is a static GitHub Pages public surface with a small root Vercel Functions API. VeilLink is intentionally isolated under `/veillink` so the existing VeilDaemon site, RelayDaemon, and root API functions are not converted or migrated.

## Application Stack

- Next.js App Router with TypeScript.
- Supabase Auth for signup, login, logout, and password reset.
- Supabase Postgres for profiles, redirects, scan events, abuse reports, and audit logs.
- Supabase RLS for user-owned data.
- Stripe-ready Vercel route handlers for checkout, portal, and webhooks.
- `qrcode` for PNG/SVG QR generation.

## Request Routing

| Request | Owner | Behavior |
| --- | --- | --- |
| VeilLink app root | VeilLink Vercel project | Landing, pricing, dashboard, account, admin |
| `go.veildaemon.app/<slug>` | VeilLink Vercel project | Middleware rewrites to `/api/resolve/<slug>?mode=path` |
| `<slug>.veildaemon.app` | VeilLink Vercel project | Middleware rewrites to `/api/resolve/<slug>?mode=subdomain` |
| `localhost:3000/r/<slug>` | Local Next dev | Middleware rewrites to path-mode resolver |

The existing `veildaemon.app` GitHub Pages site should not route through this Next app unless a later deployment decision changes that.

## Edge Redirect Scaling Path

V1 intentionally keeps public redirects in the VeilLink Vercel project. That is simpler while validating whether people will pay for the product.

If scan traffic becomes the dominant workload, move only the public redirect resolver to Cloudflare Workers:

- Next.js + Supabase remains the dashboard, auth, billing, CRUD, admin, and analytics UI.
- Supabase Postgres remains the source of truth for users, redirects, plans, abuse state, and billing state.
- A Cloudflare Worker owns `go.veildaemon.app/<slug>` and `*.veildaemon.app` request handling.
- The Worker reads redirect records from a low-latency edge cache or Cloudflare-native store synced from Supabase.
- Scan events can be queued/batched back to Supabase so every phone scan does not wake the app server.

Do not add that split before it pays for itself. The first commercial milestone is one customer successfully creating, editing, printing, and scanning paid dynamic QR codes.

## MVP Boundaries

Implemented for the first milestone:

- Supabase-backed auth screens.
- Redirect CRUD endpoints and dashboard UI.
- Owner authorization on all redirect management actions.
- Server-side free-plan limit enforcement.
- Stable path and subdomain URL generation.
- QR PNG/SVG download route.
- Redirect resolver with active, inactive, expired, suspended, and unknown states.
- Scan event storage with non-invasive user-agent breakdown.
- Pricing page, billing shell, abuse report endpoint, admin suspension controls, audit logs.

Not claimed as live until configured and verified:

- Stripe subscription billing.
- Production wildcard DNS/TLS.
- Custom domains.
- Account deletion workflow.
- Team accounts, bulk CSV, public API, A/B routing, geolocation routing, device routing.
