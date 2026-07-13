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
  - Browse Case Files -> `https://play.veildaemon.app/`
- Discord access belongs behind the intake result:
  - PASS -> `operator-*` route keys resolved by `/api/route`
  - CLAIMED / fail-state -> `triage-*` route keys resolved by `/api/route`
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

## Handler Runtime Templates
- Treat Handler templates as runtime scaffolds, not isolated one-off pages.
- If one template gains a runtime function, deterministic card set, visible target button, clock behavior, or scaffold field, assume the same function should exist across the other shipped scaffolds unless the user explicitly marks it case-specific.
- Do not copy case text between templates. Share the runtime shape and interaction behavior, then author case-specific cards from that case file's pressure grammar.
- Viridian House is the most complete reference scaffold for runtime completeness, but its content is not the default voice for other cases.
- When adding a visible target/control, verify `Custom Campaign`, `VeilCorp Intake`, and `Viridian House` all have deterministic entries so no button falls back to generic text.
- For Handler/live, keep Scene State, Attention/Aftermath, Primary Clock, Case Clock, and Collapse/Rewrite responsibilities separate. They may update together, but they should not share one mislabeled consequence field.

## UI / Layout
- Before changing Operator, Handler, or tracker UI, read `Docs/DESIGN_CONSTRAINTS.md`.
- At-table pressure (Harm, Stability, Presentation) uses compact `line-tracker` rows inside the Harm & Stability strip; prose cues belong in collapsed readouts, not new full-width cards.
- Presentation pressure registry: `presentation-pressure.js`. Presentation is a track + derived condition, not a status-picker dropdown.

## Implementation Notes
- Static site changes usually touch `index.html`, `styles.css`, and `script.js`.
- When changing CSS or JS behavior, bump the cache query string in `index.html`.
- Keep favicon and image paths browser-safe; encode spaces in URLs when referencing filenames with spaces.
- Preserve mobile usability without yanking desktop users around. Scroll only when an opened panel would otherwise be off-screen.

## Web Image Rule (WebP)
- **If it ships on the web for display, it must be WebP.** That includes `<img>`, CSS `background-image`, OG/Twitter preview plates when the platform accepts WebP, and Studio portal/subpage art.
- Keep PNG/JPEG as **source masters** or **download originals** (press kits, logos for print) — not as the bytes the browser paints in layout.
- When adding new art: drop the master (PNG/JPG) next to web assets if needed, then export a WebP for the page and point HTML/CSS at the `.webp`.
- Prefer `scripts/ensure-webp.mjs` (or equivalent sharp conversion) rather than linking raw PNG/JPG for UI.
- Exceptions: favicon `.ico`, SVG (already vector), and intentional binary downloads labeled as PNG/PDF for press.

## Stream Overlay Notes
- Treat `stream/` as hosted OBS browser-source material, not local-only production scraps.
- Prefer adding a route with an `index.html` for stream overlays and utility layers instead of requiring OBS to point directly at local image or video files.
- Keep hosted stream routes `noindex`, transparent by default, and sized for the intended OBS canvas.
- Bump cache query strings in stream route HTML after changing referenced CSS, JS, image, or video assets.
- Keep OBS-facing assets small enough for hosted use; avoid full-canvas video exports when browser scaling or static image layers solve the problem.
- Do not add one-dimensional barcodes to stream overlays or broadcast backplates. A composition may use at most one deliberate, phone-readable QR code when it has a real destination, a designed placement, and does not cover operational overlay content. QR/barcode replacement rules for print, download, or public conversion assets must otherwise exclude `stream/`.
- **Ritual Sites / DJ Veil programming:** design ore lives in `Docs/Ritual Sites/` (field notes + v0.9 stream-compositor thesis). Public Studio status stays **future / concept** until a ship decision. First slice is OBS-like composition that *alters how the performance is perceived*, not a co-host AI avatar.
- **Feed the Daemon programming:** start with `Docs/Feed the Daemon/README.md`. `SHEEP_NODE_MVP_SPEC.md` governs Proof 0 + Proof 1 implementation; `2026_PRODUCT_SPINE.md` governs the broader product thesis and later evolutions. Begins as a public generative node (Resonance/Presence), not a downloadable game that later finds the internet. Cross-links Ritual Sites and Field Node/AR as later membranes of the same continuity.

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
