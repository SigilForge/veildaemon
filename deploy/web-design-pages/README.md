# Commercial Web Design brochure on Cloudflare Pages Free

This is a standalone copy of `studio/web-design/index.html`, not a new checkout
system. Payment is handled directly by existing Stripe Payment Links and the
review form currently composes an email. The copy preserves both.

## Preview build

Cloudflare Pages repository: `SigilForge/veildaemon`.
Root directory: `deploy/web-design-pages`.
Build command: `node ../../scripts/prepare-web-design-pages.mjs`.
Build output directory: `public`.
No functions, API calls, database secrets, or build credentials needed.

In Porkbun, eventually point only `design.veildaemon.app` via CNAME to the
new Pages site's assigned `*.pages.dev` target (the custom hostname must be
registered in Cloudflare Pages before changing DNS).

Before switch, verify images, typography, contact form mailto behavior, and
the existing Stripe Payment Links. Do not remove or redirect the old
`veildaemon.app/studio/web-design/` location until preview is verified;
navigation and search indexing need a deliberate continuity plan.

Static assets are free and unlimited on Cloudflare Pages; no Workers/Pages
Functions are used by this brochure.
