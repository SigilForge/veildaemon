# VEILDAEMON.APP deploy notes

This is a static GitHub Pages site. No Jekyll build step. `.nojekyll` is present at repo root.

## GitHub Pages source

Use **one** deploy path only. Racing legacy branch publishing against GitHub Actions Pages leaves `veildaemon.app` stale.

**Automatic deploys:** publish from branch `main` at `/` (legacy static mode). `.nojekyll` disables Jekyll processing.

In **Settings → Pages**, source should be **Deploy from a branch** (`main` / `/`), not **GitHub Actions**. If both are active, pushes can spawn a stuck `pages-build-deployment` run while the legacy build is still working.

Legacy builds for this repo usually take **10–15 minutes**. A successful build is normal even when Actions deploy times out in `deployment_queued`.

### If the site looks stale after a push

1. Check **Settings → Pages** build status. Wait for `built`, not just the GitHub Actions check.
2. Do **not** re-run `pages-build-deployment` while a legacy build is in progress.
3. If no build is running, trigger one manually:
   ```bash
   gh api --method POST repos/SigilForge/veildaemon/pages/builds
   ```
4. Hard refresh the browser (or open a private window).
5. Confirm `operator/index.html` references the expected `?v=` cache string.

### Emergency fallback

Workflow `Deploy Pages` exists for manual recovery, but GitHub currently caps `actions/deploy-pages` polling at 10 minutes. Prefer the legacy rebuild command above unless Actions Pages is the only configured source.

## Replace links if needed
Open `index.html` and search for these button labels:

- Access VeilCorp Archives -> https://wiki.veildaemon.app/
- Open Case Files -> https://play.veildaemon.app/
- Begin Operator Intake -> https://relic.veildaemon.app/
- Archive Index -> https://wiki.veildaemon.app/wiki/Main_Page

## Files

- `index.html` — page content
- `styles.css` — layout/visual styling
- `assets/background.jpg` — full-page art
- `assets/veilcorp-avatar.png` — circular seal
- `CNAME` — tells GitHub Pages the custom domain is `veildaemon.app`


## Primary Feed Embed

The homepage creates the Primary Feed iframe only after the visitor opens the viewer. It uses YouTube's privacy-enhanced host:

`https://www.youtube-nocookie.com/embed/videoseries?list=PLEoIdLPqOjeuJaD74EtiQWXScSqVtXJh4`

To change the playlist later, replace the `data-youtube-playlist` value in `index.html`. Keep iframe creation interaction-gated in `script.js`.

## Debrief API

`https://veildaemon.app/play-report/` is served by GitHub Pages, so the report buttons call the Vercel API through:

`https://api.veildaemon.app`

Assign `api.veildaemon.app` to the Vercel project that deploys this repository, then point that DNS record at Vercel. The form still accepts an override for testing:

`https://veildaemon.app/play-report/?api=https://your-vercel-deployment.vercel.app`
