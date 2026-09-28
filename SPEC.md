# Lore-Drop QR Pipeline — Spec v1

**Date:** 2026-09-27
**Status:** SPEC ONLY — no implementation. Per Knox: "Don't do it yourself, but spec it."
**Origin:** Strategy proposed by Meta AI; verified against the VeilLink repo before writing.

---

## 1. Problem

Meta throttles page link-posts (the page burned its 2/month cap on the KIRA // VOID drop, 2026-09-27). Any raw URL in post body risks link-post classification and paywall prompts. The pipeline must ship daily drops with **zero raw URLs in post copy**.

## 2. Strategy (stolen, verified)

- Every daily drop ships as a **native image + native caption** — no clickable links in the body.
- The drop image carries a QR **"containment sigil"** → VeilLink dynamic redirect → archive entry page.
- Pixels aren't links: no link-post classification, no cap burned.
- `go.veildaemon.app` becomes the only link in bio — a router, not a destination.
- Dynamic redirects give **retcon power** (edit destination later, QR stays valid) and **decay mechanics** (expire the sigil → funnel to email capture).

## 3. Verified ground truth (2026-09-27)

| Claim | Verdict |
|---|---|
| VeilLink live (dashboard + `go.veildaemon.app/<slug>` redirects) | ✅ VERIFIED — redirect created and resolving today (`kira-void-fb`) |
| Redirect destinations editable after creation | ✅ VERIFIED live today |
| VeilLink QR constructor (styled presets incl. Gold Foil, ECC H, PNG download) | ✅ VERIFIED live today |
| Repo QR generator `npm run qr` → lore-styled SVG (title/subtitle/node/clearance lines, accent colors, ECC H default, scan-test guidance) | ✅ VERIFIED in `sigilforge/veildaemon` README |
| VeilLink Pro $7/mo ($60/yr), Business $19/mo ($180/yr) | ✅ VERIFIED in repo README (Stripe catalog, created 2026-07-22) |
| Stripe billing live | ❌ NOT LIVE — "Stripe-ready but not live until configured" (repo README) |
| Resolver handles expired/inactive/suspended states | ✅ VERIFIED in architecture doc |
| Custom domains | ❌ PLANNED, not live ("Not claimed as live until configured and verified") |
| Tier redirect limits (3 free / 100 Pro / 1,000 Business) | ⚠️ UNVERIFIED — Meta AI's numbers; confirm against pricing page |
| Public API for redirect creation | ❌ NOT LIVE — listed under "not claimed as live" |
| Knox on admin plan (unlimited) | ⚠️ HIS CLAIM via Meta AI — treat as provisional |
| `veilborn.archive` domain | ❌ NOT OWNED — `@veilborn.archive` is a parked Threads handle only. **Do not spec URLs on it.** |

## 4. Pipeline: one prompt → full drop

**Input:** the daily lore brief (existing ChatGPT brief pipeline — unchanged).

**Outputs per drop:**

1. **Native caption pack** — per-platform sections from the dated ledger (MAIN POST / X / INSTAGRAM+THREADS / CTA / TAGS). Hard rule: **no raw URLs in body copy**, ever. Link-in-bio points at the router.
2. **Archive entry page** — `veildaemon.app/archive/entry-NNN` (exact path TBD — confirm routing on the static GitHub Pages site vs. the VeilLink Next app). Full file + image + audio. SEO-indexed; Meta can't throttle Google.
3. **Email HTML** — teaser + sigil CTA. Capture gate: email unlocks the full file + the permanent (non-decaying) sigil. **ESP UNDECIDED — open question; the "automatic email" half of this pipeline does not exist yet.**
4. **VeilLink redirect** — slug `entry-NNN`, destination = archive entry page. Platform tracking via `?source=` query params on the destination (NOT per-platform slugs — preserves slug budget).
5. **QR sigil PNG** — minted from the redirect, lore-styled (Section 5), composited into the drop image corner (same PIL composite technique proven today).

**Ordering constraint:** archive page must be live (or its URL reserved) *before* the redirect is created; redirect must exist *before* the QR is minted; QR must be composited *before* the social publish. The existing publishing loop stays the last step.

## 5. QR sigil visual template

Foundation is the **existing repo generator** (`npm run qr`), not a new build:

- Dark field, styled QR modules (accent colors per entry/character — e.g. void-gold for Kira), VeilCorp typography lines: title / subtitle / clearance.
- Lore microcopy baked into the frame: `SCAN THE CONTAINMENT SIGIL — FULL FILE // ENTRY 047`.
- ECC level **H** (30% damage tolerance — survives meme recompression across platforms).
- Placement: bottom corner of the drop image, ~15–18% of image width, quiet zone intact.
- Output SVG for print/stickers; PNG for social composite.
- Rule: it must read as VeilCorp tech, never a grocery coupon. Dark, gold-foil or character-accented, typographic.
- v2 (optional): per-character accent variants keyed to the drop's character.

## 6. VeilLink wiring (specced, not built)

**Gap:** no public API for redirect creation (confirmed not-live). v1 options:

- **A. New authed API route** in the VeilLink Next app (service-role, owner-only) — cleanest; needs his programmer.
- **B. Browser automation** against the existing dashboard — works today, fragile tomorrow.

**Flow (either route):** create redirect (`entry-NNN` → archive URL) → mint styled QR → download PNG → composite into drop image → publish.

**Mechanics:**
- **Retcon:** edit destination any time; printed/posted QRs keep working.
- **Decay:** set `expires_at` on the redirect → expired slug resolves to the **email capture page**, not a 404. Lore copy: *"This sigil self-destructed in 24h. Archive subscribers hold the permanent key."* Urgency + list growth in one mechanic.
- **Analytics:** scan counts per slug → which entries/characters convert. Feed back into brief targeting.
- **Bio router:** a `latest` slug (or the bio link target) always points at the current entry; rotated from the dashboard. One link in bio, infinite destinations.

## 7. Funnel (matches standing rule)

Social (billboard, native, no links) → `go.veildaemon.app/entry-NNN` (router) → archive entry (his property, SEO) → email capture (owned list) → paid tiers on his stack. Contra remains the cash register, only at the buy step. No raw Contra/social-checkout links in copy.

## 8. Naming

Meta AI's petty suggestion, recorded for the record: name the paid tier **"Uncapped."** Knox's call.

## 9. Open questions

1. Tier redirect limits (3 / 100 / 1,000) — verify against the live pricing page.
2. When does Stripe billing go live? (Gates whether expiration/analytics/deep tiers are real for anyone but admin.)
3. Archive entry page: exact path + hosting (static site `veildaemon.app/archive/` vs. VeilLink app route).
4. ESP choice for the email half (list + sender infra = the actual missing build).
5. Redirect-creation route: new API (owner-only) vs. browser automation for v1.
6. `?source=` tracking params: confirm the resolver preserves query strings to the destination.

## 10. Non-goals

- No implementation in this spec — spec only, per order.
- No changes to publishing accounts, sessions, or the existing daily loop's approval gates.
- No new domains. `veilborn.archive` is **not owned** — no spec'd URL may use it.
- No invented metrics, pricing, or tier capabilities — unverified items are flagged, not assumed.
