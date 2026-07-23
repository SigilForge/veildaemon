# VeilLink Deployment Checklist

This checklist is for the isolated VeilLink Vercel project whose root directory is `veillink`.

Current Vercel project:

- Team: `knoxmortis-projects`
- Project: `veillink`
- Project ID: `prj_yIporTovuVLyKTbvfPtxGi6uwuiQ`
- Production alias: `https://veillink-alpha.vercel.app`

## 1. Supabase

- Confirm the hosted Supabase project is the intended VeilLink project.
- Apply all migrations in `supabase/migrations/`, including `002_stripe_webhook_events.sql`.
- Enable email/password auth.
- Set password reset redirects to the deployed VeilLink app URL.
- Add `VEILLINK_ADMIN_EMAILS` in Vercel for operator/admin access.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. Never expose it through a `NEXT_PUBLIC_` variable.

## 2. Stripe catalog

Live-mode catalog objects created on 2026-07-22:

| Plan | Product ID | Interval | Amount | Price ID | Lookup key |
| --- | --- | --- | --- | --- | --- |
| Pro | `prod_UvzVuwkV4LOkEQ` | Monthly | `$7` | `price_1Tw7WwFht6uPr4mz8XUCExEX` | `veillink_pro_monthly` |
| Pro | `prod_UvzVuwkV4LOkEQ` | Yearly | `$60` | `price_1Tw7X1Fht6uPr4mzVswg6DQ9` | `veillink_pro_yearly` |
| Business | `prod_UvzVwnCXE3JaT8` | Monthly | `$19` | `price_1Tw7X6Fht6uPr4mzA6QzzNmW` | `veillink_business_monthly` |
| Business | `prod_UvzVwnCXE3JaT8` | Yearly | `$180` | `price_1Tw7XEFht6uPr4mzSYwqM4RY` | `veillink_business_yearly` |

Create matching test-mode Products and Prices before running the full test-mode purchase flow. Test-mode and live-mode Price IDs are not interchangeable.

## 3. Vercel environment variables

Set these in the VeilLink Vercel project:

```bash
NEXT_PUBLIC_VEILLINK_PRODUCT_NAME=VeilLink
NEXT_PUBLIC_VEILLINK_APP_URL=https://app.veildaemon.app
NEXT_PUBLIC_VEILLINK_BASE_DOMAIN=veildaemon.app
NEXT_PUBLIC_VEILLINK_PATH_HOST=go.veildaemon.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VEILLINK_ADMIN_EMAILS=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRO_MONTHLY_PRICE_ID=price_1Tw7WwFht6uPr4mz8XUCExEX
STRIPE_PRO_YEARLY_PRICE_ID=price_1Tw7X1Fht6uPr4mzVswg6DQ9
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_1Tw7X6Fht6uPr4mzA6QzzNmW
STRIPE_BUSINESS_YEARLY_PRICE_ID=price_1Tw7XEFht6uPr4mzSYwqM4RY
```

Use Vercel's encrypted environment variable UI or CLI for secrets. Do not commit secret keys, restricted keys, publishable live keys, webhook signing secrets, Supabase service-role keys, or local `.env` files.

Prefer a least-privilege Stripe restricted key for the server if it supports the Checkout, Customer, Subscription, Billing Portal, Product/Price read, and webhook verification operations VeilLink needs.

## 4. Stripe webhook

- Endpoint: `https://app.veildaemon.app/api/billing/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Store the endpoint signing secret in `STRIPE_WEBHOOK_SECRET`.

VeilLink verifies Stripe signatures before processing events. Processed event IDs are recorded in `stripe_webhook_events`, so duplicate deliveries return without reapplying billing state.

## 5. Routing and DNS

- Point `app.veildaemon.app` at the VeilLink Vercel project.
- Point `go.veildaemon.app` at the same Vercel project for path redirects.
- Add `*.veildaemon.app` only if wildcard subdomain redirects are enabled for launch.
- Keep the root `veildaemon.app` GitHub Pages site separate from VeilLink.

Vercel domain attachment status on 2026-07-22:

- `app.veildaemon.app` is attached to the `veillink` project, but DNS still needs to change at Porkbun.
- `go.veildaemon.app` is attached to the `veillink` project, but DNS still needs to change at Porkbun.

Recommended DNS records from Vercel:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `app` | `1ae0b94dbd121cf0.vercel-dns-017.com.` |
| CNAME | `go` | `1ae0b94dbd121cf0.vercel-dns-017.com.` |

For v1, Vercel resolves redirects. Cloudflare Workers can later take over the high-volume public redirect path without changing the dashboard/auth/billing app.

## 6. Verification flow

Run this once in test mode with test-mode Price IDs:

1. Sign up.
2. Create a redirect.
3. Confirm the stable short URL resolves.
4. Download a QR code.
5. Change the redirect destination.
6. Confirm the same QR target resolves to the new destination.
7. Confirm scan count appears in the dashboard.
8. Confirm another user cannot read or edit the redirect.
9. Upgrade through Stripe Checkout.
10. Confirm the webhook updates plan and billing state.
11. Cancel through the Stripe Customer Portal.
12. Confirm the webhook downgrades or updates billing state.

Then repeat the same flow once in live mode with the cheapest practical real transaction.
