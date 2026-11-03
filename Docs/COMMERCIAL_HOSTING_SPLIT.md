# Commercial services — preserve free gameplay, remove only paid workloads

## Current state (2026-11-03): cut over

| Host | Serves | Runs on | DNS (Porkbun) |
|---|---|---|---|
| `app.veildaemon.app` | VeilLink app, Stripe webhooks, paid Book One claim | Pages `veillink-app-front` → Worker `veillink-app` (+ `veillink-raster` via service binding) | CNAME `veillink-app-front.pages.dev` |
| `go.veildaemon.app` | QR redirects | Pages `veillink-go-pages` → Supabase `veillink-resolve` | CNAME `veillink-go-pages.pages.dev` |
| `design.veildaemon.app` | Web Design brochure | Pages `veildaemon-web-design` | CNAME `veildaemon-web-design.pages.dev` |

Unchanged: `veildaemon.app` (GitHub Pages; `/studio/web-design/` now forwards to
`design`), `api.veildaemon.app` gameplay API (Vercel `veildaemon`),
`relay.veildaemon.app` (Vercel, non-commercial). Cost: $0/month (Cloudflare
Free, existing Supabase Free project, existing Stripe and Porkbun).

Deploy VeilLink with `npm run veillink:deploy`; Worker and Pages secrets are
set with `wrangler secret put` / `wrangler pages secret put`, never committed.
Stripe: restricted key "VeilLink Cloudflare" (Checkout Sessions + Customer
Portal write); live webhook endpoints were created fresh at cutover (none
existed before; no live sale had gone through these flows).

**Retired (2026-11-03, soak waived by Knox):** the Vercel `veillink` project
is deleted; `.vercelignore` keeps `api/book-one/` out of the Hobby root API
deploy (the source stays as the single copy the Cloudflare front bundles); the
Stripe and Book One variables are removed from the root Vercel project. There
is no Vercel rollback for VeilLink any more: roll back by redeploying an
earlier Cloudflare version (`wrangler rollback` / Pages deployment history).


**No DNS or production client changes are included in this branch.**

## Verified architecture

- **Porkbun** manages DNS. It does not execute Node handlers or route URL paths.
- `veildaemon.app/operator/` and `/handler/` are free gameplay on GitHub Pages.
  Their `api.veildaemon.app/api/cell/*` interaction remains on the root Vercel
  Hobby deployment. **Don't migrate it as part of this commercial split.**
- `veildaemon.app/studio/web-design/` is a **static commercial sales page** on
  GitHub Pages using direct Stripe Payment Links and a contact/review form. It
  does not run on Vercel. Move this page to a commercial-permitted static host
  on a *new subdomain* if the GitHub Pages restriction applies.
- `app.veildaemon.app` runs the VeilLink Next.js 16 application: QR creation,
  accounts, plan billing, Stripe webhook processing, Creator Rights draft,
  validation, $1.99 record checkout, and ownership views.
- `go.veildaemon.app` serves **path-mode** QR redirects using a Next.js
  proxy and `/api/resolve/[slug]`. Production currently has 3 path-mode
  links, 0 subdomain-mode links in the existing Supabase database.
- The **existing** VeilLink Supabase project provides database, storage and
  auth. No new Supabase project, migrations or commercial storage required.
  `discord-route` is already an active Edge Function.

## First isolated slice: QR redirect hot path

**Deployment verification (2026-11-02, late evening CT):** The `veillink-resolve`
Edge Function was deployed to the existing Supabase project `iaeykfeyctujqsqyenqt`
(version 1, `verify_jwt=false`). A public GET for a nonexistent slug returned HTTP
404; a public GET for an existing active path-mode slug returned HTTP 302,
without following the destination. Existing `card` scan count changed from
3 to 5 during two live smoke calls; those **two entries are synthetic testing**
(not customer traffic). 8/8 pure and Cloudflare-wrapper unit tests passed.
**The production `go.veildaemon.app` DNS is unchanged.** Cloudflare is still
unconnected, so the Pages deployment has not run yet.

The standalone Web Design site builder also passed locally and generated a
2.5 MB publication directory including all 16 directly referenced assets.
Its Cloudflare Pages custom domain and live preview remain pending.

**Proxy secret and counter fix (2026-11-03):** `veillink-resolve` now rejects
any request without the `x-veillink-proxy-secret` header matching the Edge
Function secret `VEILLINK_PROXY_SECRET` (HTTP 401; HTTP 503 if the secret is
unset), so the public function URL can no longer be called directly to forge
analytics headers or inflate counts. Live checks: no secret 401, wrong secret
401, valid secret + unknown slug 404, valid secret + `card` 302.
`redirects.total_scans` had drifted from `scan_events` (`card`: 5 counted, 8
logged) because the scan insert and the `increment_redirect_scans` RPC were
independent writes. Migration `20261103053511_scan_counter_from_events` adds a
`scan_events` insert trigger that increments the counter in the same
transaction, turns the RPC into a no-op (so not-yet-redeployed resolvers cannot
double count), and re-derived every counter from the scan log. Both resolvers
now perform a single insert. The post-fix smoke scan of `card` (user agent
`veillink-smoke-test`) moved counter and log together to 9/9; `card` now holds
six synthetic test scans (five `curl/8.5.0`, one `veillink-smoke-test`).


This branch implements:

1. `supabase/functions/veillink-resolve/index.ts` — Edge Function that
   resolves a path slug against existing `redirects`, applies the exact active
   / expired / suspended rules, validates the target URL, issues a 302, and
   records the scan in `scan_events` in the background (a trigger keeps
   `redirects.total_scans` in step). Requests must carry the shared
   `x-veillink-proxy-secret`.
2. `deploy/veillink-go-pages/functions/[slug].js` — tiny Cloudflare Pages
   handler on `go.veildaemon.app/<slug>`; forwards to the Supabase function
   without exposing service keys, and returns only verified HTTP(S) targets.
3. `deploy/veillink-go-pages/public` — minimal landing page. Cloudflare Pages
   static assets are unlimited on Free; Pages Functions use Workers Free quota.

Use the **free Cloudflare Pages plan** for `go.veildaemon.app`, with the CNAME
record in **Porkbun** pointed to the Pages project, but **only after a verified
Pages preview**. Do not change nameservers; Cloudflare Pages explicitly
supports third-party DNS CNAME subdomains:
https://developers.cloudflare.com/pages/configuration/custom-domains/

### Free limits (check again at cutover)

- Supabase Free: 500,000 Edge Function invocations per month (shared
  organization allowance); 2 seconds CPU time per Edge request.
- Cloudflare Workers/Pages Functions Free: 100,000 invocations per day,
  10 milliseconds active CPU time; static asset requests unlimited.
- Neither is *unlimited*; if go links become popular, measure scans before
  scaling. CDN cache must **not** cache live QR redirects or they will stop
  being editable.

### Preview and cutover gates

- Ensure the Edge Function deploys with `verify_jwt=false`: opening a public
  QR is not an authenticated operation. DB access is performed server-side
  with the existing secret, never from the browser.
- Directly smoke test a nonexistent slug for 404 and a known link for 302;
  check that expiration, suspension, and scanning counters match prior logic.
- Verify Cloudflare Pages preview returns the same 302 and 404 results.
- Verify there are no subdomain-mode links before moving `go`. Any newly
  created subdomain-mode QR requires a separate routing plan (wildcard DNS and
  certificate) before moving away from VeilLink.
- Connect this same GitHub repo to Cloudflare Pages with **root directory**
  `deploy/veillink-go-pages` and build output directory `public`. Pages
  automatically finds the project's `functions/[slug].js`. Configure public environment value
  `VEILLINK_RESOLVER_URL` to the deployed Edge Function URL. It is an endpoint,
  **not a secret**. Configure `VEILLINK_PROXY_SECRET` as an **encrypted** Pages
  secret with the same value as the Edge Function secret of that name (kept
  locally in `~/.veillink-proxy-secret`, never committed). Without it the
  Pages function fails closed with 503. No service-role key is stored in
  Cloudflare.
- In Cloudflare Pages, add `go.veildaemon.app` under Custom Domains first;
  then change only Porkbun `go` CNAME to the Pages-provided `*.pages.dev`
  value. No unrelated DNS changes. Preserve original target for rollback.
- Confirm printed QR URLs still resolve, edits change their target immediately,
  no redirect is cached, and scan statistics increment.
- Only after sustained verification, remove the paid QR resolver dependency
  from the Vercel app.

### Other commercial surfaces (not migrated by this branch)

- **Creator Rights:** checkout, signature-verified Stripe webhook, payment
  idempotency and publication logic still live in VeilLink Next.js. Port
  together to the same Supabase Edge project with a test-mode webhook and
  transactional invariants; partial port without signed webhook is unsafe.
- **VeilLink authenticated UI and subscriptions:** Next.js cookie/session
  and server-rendered routes still live on Vercel. Keep the existing app
  running until an independently tested free-host replacement is ready.
  Simply moving `go` does not resolve the entire Hobby/commercial problem.
- **Web Design:** static on GitHub Pages, with direct Stripe Payment Links.
  Migrate it as a standalone static commercial site, not a Vercel API.
- **Book One paid claim:** still involves Vercel checkout and signed URL
  issuance; retain in the commercial-workload inventory, even if not a
  priority this week.

There is **no provider account or DNS access via this migration branch**.
The Cloudflare Pages site, actual domain record and checkout webhook cutovers
have not been changed.
