# Intake stats: weekly classification count + UTM attribution

Counts completed intake classifications per ISO week and attributes each one to
the landing `utm_source`. Read by the weekly scorecard bot.

## Flow

1. `index.html` loads `lib/intakeAttribution.js` (exposes `window.VeilAttribution`) before `script.js`.
2. On load, `script.js:captureLandingAttribution()` stores `utm_source` (normalized),
   `utm_medium`, `utm_campaign`, `utm_content` in `sessionStorage["veildaemon.attribution.v1"]`.
   The last explicit `utm_source` in the tab wins; untagged navigation keeps the stored value.
   No tag at all means `site`.
3. Every observer event carries `utmSource/utmMedium/utmCampaign/utmContent`. On
   `intake_completed`, `showIntakeResult()` also sends `intakeRoute` (`operator`|`triage`, the
   same decision as the PASS/TRIAGE line) and `reclassified` (a local record already existed).
4. The beacon goes to `https://api.veildaemon.app/api/observe` from `veildaemon.app` (same origin
   elsewhere) as a `text/plain` body, so the cross-origin beacon needs no CORS preflight.
5. `api/observe.js` re-normalizes the payload and calls
   `lib/intakeStatsStore.js:recordIntakeCompletion()`. A store failure is logged
   (`VEILDAEMON_INTAKE_STATS_ERROR`) and the beacon still gets 200.

Only `intake_completed` is counted. No designation, IP, user agent or Discord ID is stored.

## Week rule

ISO weeks, Monday 00:00 → Sunday 23:59:59 **America/Chicago**, labeled `YYYY-Www`. The server
assigns the week from its receive time; client clocks are ignored.

## Endpoint

```
GET https://api.veildaemon.app/api/intake-stats?week=2026-W41
Authorization: Bearer $INTAKE_STATS_TOKEN
```

- `week` defaults to the current Chicago week; a malformed or nonexistent week → 400.
- `weeks=N` (1–12) returns `{ weeks: [...] }` for the requested week and the N−1 before it.
- Token unset in the environment → 503; wrong/missing token → 401. `Cache-Control: no-store`.

```json
{"ok":true,"timezone":"America/Chicago","backend":"upstash","generatedAt":"2026-10-06T21:46:00.000Z",
 "week":"2026-W41","weekStart":"2026-10-05","weekEnd":"2026-10-11",
 "total":37,"reclassified":3,
 "bySource":{"bluesky":12,"x":4,"threads":0,"instagram":3,"facebook":1,"mastodon":2,"patreon":0,"youtube":5,"site":10},
 "byRoute":{"operator":30,"triage":7},
 "byClassification":{"POTENTIAL OPERATOR":14,"OBSERVER":6,"CIVILIAN SIGNAL":8,"UNAUTHORIZED BUT USEFUL":3,"MISROUTED ASSET":2,"CLAIMED":4},
 "byFrequency":{"Dream":10,"Silence":6,"Hunger":5,"Stillness":6,"Empyrean":4,"Becoming":6},
 "byMedium":{"social":30},"byCampaign":{"oct-drop":9},"byContent":{}}
```

`bySource`, `byRoute`, `byClassification` and `byFrequency` are always zero-filled. `total`
includes reclassifications; subtract `reclassified` for first-time intakes only. A payload with an
unknown classification/frequency/route still counts in `total` but not in that breakdown.

```bash
curl -s -H "Authorization: Bearer $INTAKE_STATS_TOKEN" "https://api.veildaemon.app/api/intake-stats?week=2026-W41"
```

## Source normalization

`bluesky` ← bluesky, bsky, bsky.app, bsky.social · `x` ← x, twitter, x.com, twitter.com, t.co ·
`threads` ← threads, threads.net, threads.com · `instagram` ← instagram, ig, insta, l.instagram.com ·
`facebook` ← facebook, fb, m.facebook.com, l.facebook.com, meta · `mastodon` ← mastodon, masto,
mstdn, fediverse · `patreon` · `youtube` ← youtube, yt, youtu.be · anything else → `site`.
Medium/campaign/content keep only `[a-z0-9._-]`, max 40 chars, otherwise dropped.

## Storage (Upstash Redis, same env as reports)

- `veildaemon:intake-stats:v1:<week>` HASH: `total`, `reclassified`, `source:<slug>`,
  `route:<route>`, `class:<classification>`, `freq:<frequency>`, `medium:<tag>`,
  `campaign:<tag>`, `content:<tag>`, incremented with `HINCRBY` in one pipeline call.
- `veildaemon:intake-completions:v1:<week>` LIST: minimal per-completion records, capped at 5000,
  never exposed by the endpoint.
- Both keys expire after 400 days. Without `UPSTASH_REDIS_REST_*`/`KV_REST_API_*` the store falls
  back to per-instance memory (local runs and tests only; counts are lost between instances).

## Deploy checklist

- Vercel project `veildaemon` (Production): set `INTAKE_STATS_TOKEN`; confirm Upstash/KV vars exist.
- Deploy the root API before Pages (the API accepts the old payload too).
- After deploy, finish one intake on `https://veildaemon.app/?utm_source=bluesky` and confirm `total` moves.
- No backfill: before this change the Pages beacon posted to a relative `/api/observe` on GitHub Pages
  and never reached the API.

## Tests

`npm run test:intake-stats` (not part of `npm run push` preflight) and
`npx playwright test tests/browser/intake-attribution.spec.js`.
