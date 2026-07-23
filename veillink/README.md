# VeilLink

VeilLink is Cradlepoint Studio’s authenticated identity and utility application.

It provides account-backed ownership and delivery for Studio releases, multi-device Operator/Handler Table Live-Link sessions, and editable short links with stable downloadable QR targets.

Table Live-Link uses deliberate synchronization rather than polling or WebSockets. Operators edit local drafts and use **Send to Cell**; Handlers move shared state through **End Pressure Round**, **Sync Cell**, and **Archive Session**. Live synchronization is field-whitelisted, while Lotus cultivation and advancement remain between-session profile actions.

**VeilDaemon provides the Operator and Handler play surfaces. VeilLink provides the authenticated identity, ownership, lobby, and multi-device connection layer.**

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
├── Table Live-Link
│   ├── Operator profiles
│   ├── Handler lobbies
│   ├── Send to Cell
│   ├── End Pressure Round
│   ├── Sync Cell
│   └── Archive Session
│
└── Dynamic Links
    ├── Editable destinations
    ├── Stable printed QR targets
    ├── QR downloads
    └── Scan records
```

### Accounts and Ownership

Authenticated accounts hold purchased recoveries and Studio delivery claims. Book One checkout verifies payment server-side, records entitlement, and issues short-lived private download links. The same identity can attach later revisions and related recoveries without email scavenger hunts.

### Table Live-Link

Multi-device sessions connect Operators and a Handler without background polling or continuous state transfer. Each participant edits locally; selected state moves only at deliberate boundaries:

| Action | Who | Typical payload |
|--------|-----|-----------------|
| **Send to Cell** | Operator | Harm, Stability, conditions (Operator authority when present) |
| **End Pressure Round** | Handler | Closes the round; reconciles pressure-round fields |
| **Sync Cell** | Handler | Adds Handler notes; publishes projection |
| **Archive Session** | Handler | Final Harm, Stability, Breach, Void, unlocks, notes, conditions |

Pressure-round synchronization moves temporary session state. **Archive Session** reconciles mission outcomes. Lotus cultivation and advancement remain between sessions.

Same-origin Operator/Handler consoles may also use the local Cell bus; VeilLink enables authenticated multi-device lobbies and shared session identity.

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
- Table hub: `/table` (authenticated).
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
4. Add a webhook endpoint at `/api/billing/webhook`.
5. Subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

Without those values, checkout and portal routes fail closed with configuration errors.

Webhook handling records processed Stripe event IDs in `stripe_webhook_events` before changing billing state. Duplicate processed events return early, and subscription state is derived from Stripe webhook events rather than from the browser returning after Checkout.

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
