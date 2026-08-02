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
- In **Authentication -> URL Configuration**, set **Site URL** to `https://app.veildaemon.app` (not any `*.vercel.app` host).
- In **Authentication -> URL Configuration**, keep redirect allow-list entries scoped to the app routes VeilLink actually uses:
  - `https://app.veildaemon.app/**`
  - `https://app.veildaemon.app/auth/confirm**`
  - `https://app.veildaemon.app/update-password**`
  - `https://veildaemon.app/**`
- Remove every `*.vercel.app` entry from Supabase redirect allow-list and Site URL. Team deployment hosts can hit Vercel SSO and look like “the void.”
- Set password reset redirects to `https://app.veildaemon.app/update-password`.
- **Confirm email template** (Authentication → Email Templates → Confirm signup) must use `token_hash`, not a bare Site URL root:

```html
<h2>Confirm your email</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm email address</a></p>
```

  Do **not** append `/auth/confirm?...` onto `{{ .RedirectTo }}` when the app already passes `emailRedirectTo` as a full `/auth/confirm` URL (that produces a broken double path). Prefer the `token_hash` template above with Site URL = `https://app.veildaemon.app`.
- Magic link / recovery templates should also land on `/auth/confirm?token_hash={{ .TokenHash }}&type=...` (or `/update-password` for recovery after confirm).
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
RIGHTS_STRIPE_PRICE_ID=...
RIGHTS_STRIPE_WEBHOOK_SECRET=...
RIGHTS_SUCCESS_URL=https://app.veildaemon.app/account/rights?checkout=success
RIGHTS_CANCEL_URL=https://app.veildaemon.app/account/rights?checkout=cancelled
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

Creator Rights Records use a separate payment-governed publication boundary:

- Endpoint: `https://app.veildaemon.app/api/rights/webhook`
- Events:
  - `checkout.session.completed`
  - `checkout.session.expired`
- Store the endpoint signing secret in `RIGHTS_STRIPE_WEBHOOK_SECRET`, or use `STRIPE_WEBHOOK_SECRET` only if the same Stripe endpoint is intentionally shared.
- Configure `RIGHTS_STRIPE_PRICE_ID=price_1TzpmbFht6uPr4mzfE0KcB0H` for the one-time `$1.99 USD` Founders Price in the same Stripe mode as `STRIPE_SECRET_KEY`.
- The webhook validates the configured Price ID, `amount_total=199`, `currency=usd`, `payment_status=paid`, stable metadata, and the database-owned pending Checkout Session before publishing.
- Successful publish sets durable fields: `payment_status=paid`, `entitlement_status=active`, permanent `record_id`, `slug`, and `qr_asset_version >= 1`.
- Branded QR GET/POST `/api/rights/:id/qr` requires owner session **and** `entitlement_status=active`. Browser Checkout success alone never unlocks assets.
- Controlled QR customization only (colors, center mark presets, frame, labels, format). Server enforces ECC H, quiet zone, contrast ≥ 4.5, max center obstruction, and post-generation decode verification.
- Apply migration `20260727170000_creator_rights_entitlement.sql` before enabling paid issuance.
- Browser success/cancel URLs do not publish. Missing Stripe config fails closed: checkout returns unavailable, webhook returns unavailable, and no public record is created.

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
