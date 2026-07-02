# VEILDAEMON.APP deploy notes

This is a static GitHub Pages site. No Jekyll build step. `.nojekyll` is present at repo root.

## GitHub Pages source

Use **one** deploy path only. Mixing legacy branch publishing with GitHub Actions Pages leaves `veildaemon.app` stale.

**Automatic deploys:** publish from branch `main` at `/` (legacy static mode). `.nojekyll` disables Jekyll processing.

**Manual fallback:** workflow `Deploy Pages` (`.github/workflows/deploy-pages.yml`)
- Run from **Actions → Deploy Pages → Run workflow** when the automatic build errors or the site is stuck
- Uploads a slim static artifact and waits up to 30 minutes for GitHub Pages to finish syncing

If the site looks stale after a push:

1. Check **Settings → Pages** for a failed build
2. If needed, run **Actions → Deploy Pages** manually
3. Hard refresh the browser (or open a private window)
4. Confirm `operator/index.html` references the expected `?v=` cache string

## Replace links if needed
Open `index.html` and search for these button labels:

- Access VeilCorp Archives -> https://wiki.veildaemon.app/
- Open Case Files -> https://the-cradlepoint-archives.itch.io/needlepoint
- Begin Operator Intake -> https://veilborn.carrd.co/
- Archive Index -> https://wiki.veildaemon.app/wiki/Main_Page

## Files

- `index.html` — page content
- `styles.css` — layout/visual styling
- `assets/background.jpg` — full-page art
- `assets/veilcorp-avatar.png` — circular seal
- `CNAME` — tells GitHub Pages the custom domain is `veildaemon.app`


## Primary Feed Embed

The homepage embeds the Primary Feed playlist using:

`https://www.youtube.com/embed/videoseries?list=PLEoIdLPqOjeuJaD74EtiQWXScSqVtXJh4`

To change the playlist later, replace the playlist ID in `index.html`.

## Debrief API

`https://veildaemon.app/play-report/` is served by GitHub Pages, so the report buttons call the Vercel API through:

`https://api.veildaemon.app`

Assign `api.veildaemon.app` to the Vercel project that deploys this repository, then point that DNS record at Vercel. The form still accepts an override for testing:

`https://veildaemon.app/play-report/?api=https://your-vercel-deployment.vercel.app`
