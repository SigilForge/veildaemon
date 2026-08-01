# VeilLink

VeilLink is Cradlepoint Studio’s authenticated identity and utility application.

It provides account-backed ownership and delivery for Studio releases, and editable short links with stable downloadable QR targets.

**VeilDaemon's Operator and Handler apps connect to each other directly** through a Bearer-token API on the root VeilDaemon Vercel project (`api.veildaemon.app/api/cell/*`, source in the root repo's `api/cell/`, `lib/cellSync.js`, and `cell-sync-remote.js`), using the same Supabase access token this app's own auth issues. VeilLink no longer hosts a Cell/Live-Link gameplay UI of its own -- that used to live here (`TableHubClient`/`TableSessionClient`, `/live-link`, `/api/table/*`) as a disconnected mini-sheet requiring manual export/import; it was replaced and removed once the real apps grew their own Connect UI. VeilLink's role for Cell/Live-Link now is purely identity: issuing the Supabase session those apps authenticate with.

**VeilDaemon provides the Operator and Handler play surfaces. VeilLink provides authenticated identity, ownership, and the account/billing/utility layer.**

VeilLink is deployed as an isolated Vercel application from the `veillink` directory while the public VeilDaemon site remains separately hosted.

## Product shape

```text
VEILLINK
Identity and utility layer

├── Accounts and ownership
│   ├── Authentication
│   ├── Purchased recoveries
│   ├── Book One delivery
│   └── Future identity-linked releases
│
└── Dynamic Links
    ├── Editable destinations
    ├── Stable printed QR targets
    ├── QR downloads
    └── Scan records
```

### Accounts and Ownership

Authenticated accounts hold purchased recoveries and Studio delivery claims. Book One checkout verifies payment server-side, records entitlement, and issues short-lived private download links. The same identity can attach later revisions and related recoveries without email scavenger hunts.

### Dynamic Links and QR Codes

Editable short links and downloadable QR codes whose printed target stays stable while the destination can change later. Ownership enforcement, scan storage, free-plan limits, and Stripe subscription billing support the public utility product.

## Local Development

```bash
cd veillink
npm install
cp .env.example .env.local
npm run dev
```

Required local services:

- Supabase project or local Supabase stack.
- SQL migration applied from `supabase/migrations/001_initial_veillink.sql`.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

The service role key is server-only. Never expose it to browser code.

## Routing

- `/veillink` is not used inside this isolated app. The app root serves the VeilLink landing page.
- `go.veildaemon.app/<slug>` is the production path redirect host.
- `<slug>.veildaemon.app` is the production wildcard subdomain redirect form.
- Local fallback is `localhost:3000/r/<slug>` or `<slug>.localhost:3000` if your browser/dev setup resolves it.
- `/table` and `/live-link` redirect to `/dashboard` (retired routes -- see Cell/Live-Link note above).
- Book One: `/book-one` (authenticated checkout entry).

Production DNS/TLS must be configured outside this repository:

- Point `go.veildaemon.app` at the VeilLink Vercel project.
- Point `*.veildaemon.app` at the VeilLink Vercel project if wildcard subdomains are enabled.
- Confirm the hosting platform provisions TLS for both the explicit host and wildcard host.
- Keep `veildaemon.app` GitHub Pages routing separate from the VeilLink Vercel project.

## Supabase Setup

1. Create a Supabase project.
2. Apply `supabase/migrations/001_initial_veillink.sql`.
3. Enable email auth.
4. Configure password reset redirect URL to `https://app.veildaemon.app/update-password` or the final VeilLink app URL.
5. Add one or more admin emails to `VEILLINK_ADMIN_EMAILS`.
6. If preferred, promote admin users by setting `profiles.role = 'admin'`.

The migration enables RLS:

- Users can read and mutate their own redirects.
- Users can read scan events only for their own redirects.
- Abuse reports can be submitted publicly.
- Admin reads and destructive actions happen through server-side service-role routes.

## Stripe Setup

Billing is Stripe-ready but not live until configured. The live Stripe catalog was created on 2026-07-22:

- `VeilLink Pro` (`prod_UvzVuwkV4LOkEQ`)
  - Monthly: `$7/month` (`price_1Tw7WwFht6uPr4mz8XUCExEX`)
  - Yearly: `$60/year` (`price_1Tw7X1Fht6uPr4mzVswg6DQ9`)
- `VeilLink Business` (`prod_UvzVwnCXE3JaT8`)
  - Monthly: `$19/month` (`price_1Tw7X6Fht6uPr4mzA6QzzNmW`)
  - Yearly: `$180/year` (`price_1Tw7XEFht6uPr4mzSYwqM4RY`)

Book One uses a separate price/product configuration on the root API claim path (`BOOK_ONE_STRIPE_PRICE_ID` and related env on the VeilDaemon Vercel project).

Creator Rights Records use a separate one-time Stripe Price. The application expects `$9.99 USD`; the code validates the configured Price ID, `amount_total = 999`, `currency = usd`, metadata, and `payment_status = paid` before calling the service-role Supabase publication function. Browser success redirects never publish records.

1. Create Stripe products for Pro and Business.
2. Create monthly and yearly recurring prices.
3. Set:
   - `STRIPE_SECRET_KEY` or a least-privilege restricted key where your Stripe account supports the required Checkout, Billing Portal, Subscription, Customer, and webhook-read operations.
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRO_MONTHLY_PRICE_ID`
   - `STRIPE_PRO_YEARLY_PRICE_ID`
   - `STRIPE_BUSINESS_MONTHLY_PRICE_ID`
   - `STRIPE_BUSINESS_YEARLY_PRICE_ID`
   - `RIGHTS_STRIPE_PRICE_ID`
   - `RIGHTS_STRIPE_WEBHOOK_SECRET` if the Creator Rights webhook uses a separate Stripe endpoint signing secret. If omitted, `/api/rights/webhook` falls back to `STRIPE_WEBHOOK_SECRET`.
   - Optional `RIGHTS_SUCCESS_URL` and `RIGHTS_CANCEL_URL`; defaults return to `/account/rights`.
4. Add a webhook endpoint at `/api/billing/webhook`.
5. Subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Add a Creator Rights webhook endpoint at `/api/rights/webhook`.
7. Subscribe the Creator Rights endpoint to:
   - `checkout.session.completed`
   - `checkout.session.expired`

Without those values, checkout and portal routes fail closed with configuration errors.

Without `STRIPE_SECRET_KEY` and `RIGHTS_STRIPE_PRICE_ID`, Creator Rights draft creation and preview can remain available, but `/api/rights/checkout` returns a clear unavailable response. Without a webhook signing secret, `/api/rights/webhook` returns unavailable and cannot publish. No partial paid/public state should be produced when configuration is absent.

Webhook handling records processed Stripe event IDs in `stripe_webhook_events` before changing billing state. Duplicate processed events return early, and subscription state is derived from Stripe webhook events rather than from the browser returning after Checkout.

Creator Rights publication additionally validates stable Stripe metadata only:

```json
{
  "rights_record_uuid": "...",
  "owner_user_id": "...",
  "purchase_type": "creator_rights_record"
}
```

Titles, slugs, creator names, and pricing are not trusted from Stripe metadata. Those values come from the database and configured Price ID.

VeilLink pins Stripe API calls to `2026-06-24.dahlia` and tags Checkout Sessions with a stable integration identifier for Dashboard tracking. Do not enable Stripe Tax until tax registrations are configured in Stripe; enabling tax without registrations can make the integration look tax-ready while collecting nothing.

See `docs/deployment-checklist.md` for the launch checklist and the live-vs-test Price ID split.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

The root VeilDaemon project should still validate independently from the repository root:

```bash
npm run check
git diff --check
```
