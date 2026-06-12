# Repository Guidelines

## VeilDaemon.app Public Surface
- Treat `index.html`, `styles.css`, `script.js`, `assets/`, `CNAME`, and the favicon as the public `veildaemon.app` surface.
- The page is not a lore explainer, dev note, wiki abstract, ARG label, or out-of-fiction marketing page.
- The terminal should behave like it believes it is real: system to potential Operator, not developer to user.

## Canon Framing
- Cradlepoint is the setting.
- VeilCorp is emergency-response infrastructure Alex and Shade accidentally activate too early.
- VeilDaemon is Shade's interface identity for intake, indexing, routing, and public-safety triage.
- Shade does not think he is leaking files or running a rogue archive. He thinks he is performing necessary infrastructure.
- Alex's tension is that the organization is becoming operational before human authorization and doctrine are finished.
- The target feeling is an early VeilCorp intake node made public because a literal-minded AI started procedures before the company was ready.

## Public Copy Rules
- Keep copy diegetic. Avoid meta labels such as "in-world", "ARG", "fiction", "lore", "game", "canon", "continuity", "website", "landing page", or "questionnaire" unless the user explicitly asks for public-facing marketing copy.
- Do not write as if the visitor is outside the fiction being told what the fiction is. Write as if the system has detected an observer.
- Use clear diegetic translation when needed: "Observer routing procedure" is good; "in-world questionnaire" is not.
- Good tone: corporate, premature, literal, unsettling, useful, and procedural.
- Bad tone: hackerman, leaked files, secret archive, stolen upload, malicious Shade, wink-at-the-audience meta.
- Strong phrases to preserve or echo:
  - "We noticed you noticing."
  - "Observation creates relevance."
  - "Continued attention may require classification."
  - "Infrastructure before permission."
  - "Human authorization partial. Survival authorization active."

## Navigation And Funnel
- Top-level CTAs should teach the visitor's options without exposing Discord directly:
  - Read the Archive -> `https://wiki.veildaemon.app/`
  - Begin Operator Intake -> local intake terminal
  - Play the Case File -> `https://the-cradlepoint-archives.itch.io/needlepoint`
- Discord access belongs behind the intake result:
  - PASS -> `https://discord.gg/Bn6attnYN6`
  - CLAIMED / fail-state -> `https://discord.gg/KRbckpfTQk`
- Do not add a public top-level Discord button unless the user explicitly reverses this rule.
- External links must open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.

## Intake UX
- The intake exists to route observers, not to survey a video or collect feedback.
- If clarification is needed, keep it diegetic:
  - Good: "Transmission playback is separate. Support channels are separate. This is triage."
  - Bad: "This is an in-world questionnaire."
- Shade's text should lead the concept for first-time visitors. Assume social traffic may be confused.
- Shade may be dry or funny, but the joke should come from procedural overreach, not from breaking the fourth wall.
- Keep the video/transmission viewer visually separate from intake so visitors do not think the intake is about the video.

## Implementation Notes
- Static site changes usually touch `index.html`, `styles.css`, and `script.js`.
- When changing CSS or JS behavior, bump the cache query string in `index.html`.
- Keep favicon and image paths browser-safe; encode spaces in URLs when referencing filenames with spaces.
- Preserve mobile usability without yanking desktop users around. Scroll only when an opened panel would otherwise be off-screen.

## Stream Overlay Notes
- Treat `stream/` as hosted OBS browser-source material, not local-only production scraps.
- Prefer adding a route with an `index.html` for stream overlays and utility layers instead of requiring OBS to point directly at local image or video files.
- Keep hosted stream routes `noindex`, transparent by default, and sized for the intended OBS canvas.
- Bump cache query strings in stream route HTML after changing referenced CSS, JS, image, or video assets.
- Keep OBS-facing assets small enough for hosted use; avoid full-canvas video exports when browser scaling or static image layers solve the problem.

## Validation
- Run `node --check script.js` after JavaScript edits.
- Run `git diff --check` before handing back changes.
- For link changes, verify every external route opens in a new tab and keeps `rel="noopener noreferrer"`.
- For copy changes, search for forbidden meta terms before finishing:
  - `in-world`
  - `ARG`
  - `fiction`
  - `lore`
  - `canon`
  - `continuity`
  - `game`
  - `leaked`
  - `hacker`
