# VeilLink

VeilLink is an isolated SaaS application inside the VeilDaemon repository. It creates editable short links and QR codes whose printed QR target stays stable while the destination can change later.

The existing static VeilDaemon site remains unchanged. Deploy VeilLink as its own Vercel project with the root directory set to `veillink`.

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
