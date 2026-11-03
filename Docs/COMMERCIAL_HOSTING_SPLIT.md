# Commercial services — preserve free gameplay, remove only paid workloads

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

This branch prepares:

1. `supabase/functions/veillink-resolve/index.ts` — Edge Function that
   resolves a path slug against existing `redirects`, applies the exact active
   / expired / suspended rules, validates the target URL, issues a 302, and
   records scan analytics using existing `scan_events` and
   `increment_redirect_scans` in the background.
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
  **not a secret**. No service-role key is stored in Cloudflare.
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
