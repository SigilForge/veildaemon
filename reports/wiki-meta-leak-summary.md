# Wiki Meta Leak Summary

Generated from `wiki.veildaemon.app` sitemap crawl on 2026-06-19.

## Files

- Full parsed report: `reports/wiki-meta-leak-audit-bs4.md`
- Raw parsed data: `reports/wiki-meta-leak-audit-bs4.json`

## Rule Basis

- Public/player surfaces should stay spoiler-safe, light, runnable, and avoid ontology lecture.
- Public/player-facing material may show observable behavior and player-actionable truths, but should not expose hidden substrate theory, developer architecture, deep rendering/compression theory, or spoiler-first entity ecology.
- Systems Metaphysics, Monster Manual material, GM-only mechanics, GM runtime structure, and pips 7+ belong outside public/player surfaces unless intentionally framed as product-facing GM material.
- Fiction/source-note material should not become generalized player procedure.

## Buckets

- `likely_gm_leak`: 19 pages
- `diegetic_redaction_warning_but_meta_terms_visible`: 19 pages
- `review_product_boundary`: 10 pages
- `tone_or_product_meta_review`: 24 pages
- `likely_meta_leak`: 1 false-positive-ish technical page

## Highest Priority

These pages expose explicit GM-only / GM-facing structure or pips 7+ in article bodies:

- Len Orra
- Agnes Marlowe
- Children of the Cracked Eye
- Cult Mouth
- Apartment 13F
- Broken Mirror Chamber
- Diana Vale
- Kira Silverwood
- Mira
- Reflection Drift
- Ruined Church
- Saffi Dell
- The Unfinished Witness
- Viridian House
- Entity Index - Preliminary Field Taxonomy

## Pattern

Most likely leaks are not full hidden substrate dumps. They are public pages naming the existence of hidden runtime structures: `GM-facing`, `case clock`, `entity loop`, `stabilizer language`, `exit condition`, `Monster Manual`, `GM-only`, and pip bands such as `7+`.

Recommended cleanup pattern:

- Replace `GM-facing` with `restricted field layer`, `withheld operator layer`, or `sealed procedure`.
- Replace `GM-only` with `withheld`, `restricted`, or `not public-safe`.
- Replace `case clock`, `entity loop`, `stabilizer`, and `exit condition` with diegetic phrases like `removed timing model`, `withheld behavior model`, `stabilization procedure withheld`, and `resolution path removed`.
- Remove explicit pip 7+ progression labels from public character/entity pages, or replace with `classification withheld`.

## Product Boundary

Pages like `Play Tonight`, `What Is Cradlepoint?`, `Needlepoint`, and `GM Toolbox` intentionally use product language. These are not automatically wrong, but they should be reviewed for whether they are meant to be public marketing/onboarding pages or diegetic archive pages. Mixing both modes creates the most visible meta leakage.

## Diegetic Redaction Pages

Several pages intentionally say things like `Do not publish GM-facing material` as part of the archive voice. That is flavorful, but it still teaches the reader what layer exists behind the curtain. If the target public surface should remain diegetic, convert those warnings to Shade/VeilCorp language without the tabletop role label.
