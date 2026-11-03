# VeilDaemon / VeilLink / RelayDaemon — $0-hosting migration

Status: **implementation branch only**. Production still runs the original
GitHub Pages and Vercel deployments. **Do not change DNS, webhooks, or disable
Vercel before all Netlify preview tests pass.**

## Why Netlify Free

Vercel Hobby prohibits commercial use, whether or not a project has made a sale.
Netlify permits commercial projects on its Free plan. As of November 2026, the
Free plan has **300 credits/month, a hard limit and no automatic overage fee**.
A production deployment uses 15 credits, plus compute, bandwidth and requests.
If the account runs out, **all its Netlify sites pause** until the next cycle.
The ignore rules in these three site configs suppress builds for unrelated repo
pushes, but intentionally relevant changes still consume credits.

Reference:
- https://vercel.com/docs/plans/hobby
- https://www.netlify.com/pricing/
- https://answers.netlify.com/t/can-we-use-netlify-free-plan-for-commercial-purposes/41545
- https://docs.netlify.com/build/configure-builds/monorepos/

## What moves

| Existing host | New Netlify site | Package directory | Netlify config |
|---|---|---|---|
| Vercel `veillink`: `app.veildaemon.app`, `go.veildaemon.app` | VeilLink Next.js | `veillink` | `veillink/netlify.toml` |
| Vercel `veildaemon`: `api.veildaemon.app` | Root API | leave empty (repository root) | `netlify.toml` |
| Vercel `veildaemon-relay`: `relay.veildaemon.app` | RelayDaemon | `deploy/relay-netlify` | `deploy/relay-netlify/netlify.toml` |

**For all three sites, leave Netlify Base directory empty (repo root).**
Use the Package directory exactly as shown; the site-specific netlify.toml
takes precedence over the root file. For VeilLink this is essential: the
committed build command targets the nested Next.js package explicitly.

`veildaemon.app`, `/operator/`, `/handler/`, `/studio/`, and the other
static public surfaces are still on GitHub Pages. Moving those to Cloudflare
Pages Free is a *separate, lower-risk* static-host task, not a dependency of
removing Vercel.

## Setup — existing accounts and resources

1. Create/connect a **Netlify Free** account and authorize read access to
   `SigilForge/veildaemon`. No new Supabase project, Stripe account, database,
   or purchase tables are needed.
2. Create **three separate Netlify sites**, each importing the same GitHub repo.
   Set Package directory according to the table. Keep Base directory empty.
   Make the migration branch the preview source first. **Do not attach the
   production custom domains** until after preview tests.
3. Copy only necessary environment variable **values privately** from the
   matching Vercel project into the corresponding Netlify site's runtime
   environment. Never paste secrets into chat, GitHub, PR text, or TOML files.
   Configure their scopes for production and preview.
   - **VeilLink:** `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
     `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
     `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, the Pro/Business Stripe Price IDs,
     Book One Price/claim/cancel configuration, Creator Rights Price ID, the
     `NEXT_PUBLIC_VEILLINK_*` public host/app settings, and admin allowlist.
     Preserve any additional env keys used by enabled features.
   - **Root API:** Supabase URL/keys, Stripe/Book One claim settings,
     alert Upstash/Redis or KV settings, admin/report tokens, Twitch EventSub
     secret/callback and client configuration, and intake stats token as
     required by the active routes. The existing `api/route.js` still expects
     13 Discord route variables plus `DISCORD_ROUTE_SECRET` where encrypted
     values are in use. If another in-progress work order removes this endpoint
     in favor of a Supabase Edge Function, reconcile that change first rather
     than restoring a second Discord route source of truth.
   - **Relay:** `OPENAI_API_KEY` **only if hosted character generation is
     intentionally enabled**; it consumes paid OpenAI API usage separately
     from Netlify's free hosting. `RELAY_IMAGE_HOSTS` if remote scan-code
     hosts are configured. The local Ollama bridge remains independent.
4. Allow the Netlify preview origins in any strict OAuth/auth redirect rules
   needed for preview testing. Preserve existing production domains and rules.
5. Disable automatic publishing or keep production deploys intentionally
   batched. With three sites sharing 300 credits, repeated deploys can consume
   the entire Free allowance before traffic does.

## Preview acceptance gates

### VeilLink (Next.js + real commerce)

- `/` and `/login` load; email login/logout and reset callback work.
- `/book-one` starts a **Stripe test-mode** checkout, webhook signature
  validates, entitlement is recorded once, and the download link uses a
  short-lived Supabase signed URL. Never use a live charge for the smoke test.
- `/pricing`, `/billing`, `/api/billing/webhook`,
  `/api/rights/webhook`, `go`-host QR redirect and ownership checks work.
- Admin-only routes deny anonymous users; server secrets are not exposed via
  `NEXT_PUBLIC_*`.
- Verify Next.js 16 App Router, `proxy.ts`, auth cookies, generated routes,
  webhook raw request bodies, and rate limits on Netlify's **actual preview**.

### Root API (Node handler compatibility layer)

- `/api/debug/ping` returns marker `PRIMAL_GLASS_TAP`.
- `/api/route?key=invalid` returns 404 without a Discord invite.
- Handler/Operator `/api/cell/*` connect, roll, leave, and synchronize
  authenticated sessions against the **existing** Supabase project.
- Reports, alerts, rights configuration, scan-code WASM, and Book One
  claim authorization behave as before.
- Twitch EventSub challenge works only with a correct HMAC over the original
  raw body, then notification/revocation handling succeeds against a configured
  persistent queue. **Do not use an in-memory queue as a production substitute.**
- Exercise function cold starts and load against Netlify's runtime limits.

### RelayDaemon

- `/` and `/studio/relay/` both load all CSS, JS, persona JSON, and ZXing WASM.
- `/api/character` is same-origin and rejects unauthorized cross-origin calls.
- `/api/scan-code` enforces its image-host allowlist.
- Do not enable or exercise paid hosted AI generation merely to prove the
  free-hosting migration. For a live test, set a deliberate cost budget.

### Tests already run on the isolated branch

- `npm run check` — passed.
- `node --test tests/unit/test_netlify_api_adapter.mjs` — seven passed,
  including a signed Twitch challenge and forged signature rejection.
- `node scripts/prepare-relay-netlify.mjs` — produced public assets and
  the scanner WASM; the output directory is gitignored.
- `npm run typecheck --prefix veillink` — passed.
- `npm run build --prefix veillink` — passed; Next.js dynamic routes and
  proxy middleware built locally (this is not a Netlify OpenNext build).
- `npm run test --prefix veillink` — 116 tests passed across 11 suites.

These local tests **do not** establish Netlify platform compatibility or
successful production deploys. At least one real Netlify preview and the above
acceptance checks are mandatory before DNS cutover.

## Domain cutover (only after previews)

1. In Netlify, add and verify custom domains `app.veildaemon.app` and
   `go.veildaemon.app` on VeilLink, `api.veildaemon.app` on Root API,
   and `relay.veildaemon.app` on Relay.
2. Record current DNS values and Vercel deployment IDs for rollback, then
   change DNS to the Netlify-provided targets. Do **not** guess CNAME/A records.
3. Re-run production smoke tests against **the existing custom domains**.
   Most Stripe webhook and Supabase redirect URLs remain unchanged because the
   hostnames do not change, but verify the provider's delivery logs explicitly.
4. Keep Vercel services available for rollback through DNS propagation and a
   stable observation window. Only then disable Vercel projects.
5. **After cutover**, change `scripts/unified-push.mjs` and
   `README_DEPLOY.md`: they still deploy Vercel. Do not change these before
   the replacement deployments are verified, or existing release automation
   would stop working prematurely.

## Rollback

Restore recorded Vercel DNS targets, check all four affected hostnames, and
verify Stripe and Twitch provider delivery logs. Supabase databases,
entitlements, and purchases remain the existing source of truth: there is
**no database migration to reverse**. Avoid deploying two webhook consumers
against the same events without idempotency checks.

## Current blockers

- No connected Netlify account or deploy credentials are available through
  this chat, so no actual Netlify preview/build or domain cutover has occurred.
- Production environment secrets must be configured privately in Netlify.
- Next.js, Node module/WASM packaging, and full end-to-end commerce/play flows
  still require a platform preview before this branch can merge.
