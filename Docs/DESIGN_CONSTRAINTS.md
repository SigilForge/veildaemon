# VeilDaemon Site Design Constraints

Plain-language guardrails for UI work on `veildaemon.app`. Read this before adding panels, trackers, or new operator/handler controls. The goal is to keep at-table surfaces **compact, scannable, and hierarchy-correct** so one mechanic does not eat the sheet.

Canon and rules live in Cradlepoint books. Presentation pressure contracts live in `presentation-pressure.js`. This file is **layout and interaction only**.

---

## Site map (where design applies)

| Surface | Entry | Primary CSS | Role |
| --- | --- | --- | --- |
| Public intake | `/index.html` | `styles.css` | Diegetic terminal, observer routing |
| Operator node | `/operator/` | `operator/operator.css` | Player at-table sheet |
| Handler console | `/handler/` | `handler/handler.css` | GM modules (cases, clocks, clues, …) |
| Handler live | `/handler/live/` | `handler.css` + `live-flow.css` | One-screen session dashboard |
| Debrief / reports / play routes | respective `index.html` | `styles.css` (+ local) | Branch terminals on shared chrome |
| Admin | `/admin/` | `admin/style.css` | Internal tooling; grid background variant |
| Stream overlays | `/stream/**` | per-route CSS | Transparent OBS layers; `noindex` |

Shared chrome: monospace stack, dark `#050709` base, cyan accent, scanline/noise overlay, `min-width: 0` + `overflow-wrap: anywhere` on interactive nodes.

---

## Visual tokens (do not invent new palettes per feature)

```css
--bg: #050709
--text: #e6fff7 / #e7fff8
--muted: #8ca7a1 / #94aaa5
--cyan: #66ffdc          /* labels, kickers, active chrome */
--purple: #b954ff        /* hot emphasis, lotus, seals */
--danger / --red         /* harm, undo, destructive */
--line: rgba(137–138, 255, 218, .14–.32)
```

- **Cyan filled pips** = stability / neutral charge / default fill.
- **Purple fills** = lotus / mythic emphasis.
- **Danger fills** = harm.
- **Hunger / sanguine pressure** = purple→red→white-hot escalation (`hunger-pips`), not cyan. Cyan reads as “resource gained.”

Typography scale for at-table controls:

| Element | Size | Notes |
| --- | --- | --- |
| `kicker` | ~`.62–.65rem` | uppercase, `.12–.14em` tracking |
| `card-label` | `.65rem` | section title inside a card |
| Tracker label / count | `.64rem` | `pip-header` |
| Derived band / condition | `.64rem` | `pip-derived`, right column |
| Readout / helper copy | `.6–.7rem` | muted; never body-copy size |

---

## Layout primitives

### Public / branch terminals

- `.shell` → `.terminal` (max ~980px intake, wider on report surfaces).
- Sections are **panels**, not full pages. Padding uses `clamp()`; do not add new full-width hero blocks to operator/handler.

### Operator sheet (`operator/index.html`)

- **One active module** via `module-panel` + `data-module-panel` tabs.
- **Sheet grid** (`.sheet-grid`): `repeat(auto-fit, minmax(min(100%, 320px), 1fr))`, gap `.9rem`.
- **Wide rows** span `grid-column: 1 / -1` — use for strips that must read as one band (Harm & Stability, case strip).
- **Sheet cards** (`.sheet-card`): padding `.9rem`, light border — default container for roll dock, skills, notes.
- **Condition strips** (`.condition-strip`): same full width, padding `.85rem` — for tracker clusters, not prose essays.

### Handler

- `.handler-shell` max ~1440px.
- `.panel` + `.panel-heading` + `.field-grid` for module forms.
- **Live dashboard** uses `.live-flow-grid` three-column layout; side columns hold pressure/trigger trays; center holds clock. Do not add a fourth “mega column” without collapsing something else.

---

## At-table hierarchy (Operator)

The Operator sheet is optimized for **the next thirty seconds at the table**. Order of visual priority:

1. **Identity / case strip** — who, needlepoint, frequency, void/breach chips.
2. **Harm & Stability trackers** — always visible, always compact.
3. **Presentation pressure** — same row family as harm/stability when ontology applies.
4. **Action roll** — primary action.
5. **Everything else** — attributes, misfire, skills, notes, frequency tab.

**Rule:** New pressure mechanics slot into layer 2–3. They do not get their own full-width card above the roll dock unless explicitly requested.

---

## Tracker pattern (canonical)

Harm, Stability, and Presentation pressure all use **`line-tracker`**:

```
[Label  count] [pip pip pip …] [derived band] [(+/- hidden on mobile)]
```

Reference implementation: `operator/operator.js` → `renderTrackerBoard()`, styles in `operator/operator.css` (`.tracker-board`, `.line-tracker`, `.pip-header`, `.line-pips`, `.pip-derived`).

| Property | Value | Why |
| --- | --- | --- |
| Row min-height | ~`2.8rem` | One line at table |
| Row padding | `.3rem .45rem` | Tight |
| Board gap | `.45rem` | Tight vertical stack |
| Board columns | `1fr` only | **Always** stack tracker rows; never 2–3 column auto-fit |
| Pip columns | fixed `0.46rem` + `width: max-content` | Prevents full-width pip stretch on narrow viewports |
| Pips | fixed aspect ~`2.2/1`, small gaps | Glanceable, not touch-target bloated |

Handler read-only trackers mirror this in `.handler-line-tracker` (slightly tighter; pips non-interactive).

### DO

- Add a third tracker row for ontology pressure inside `#tracker-board`.
- Put table-facing **cue / risk / condition prose** in a **collapsed** `<details>` drawer (`.pressure-readout-layer`) under the board.
- Keep numeric track as the **primary control** (clickable pips).
- Show derived band in `pip-derived` (short label only).

### DON'T (presentation-pressure lesson)

- Do **not** spawn a second `condition-strip` / `sheet-card` for the same mechanic.
- Do **not** make **Coherence State** or **Saturated** a dropdown/checkbox the size of a primary control.
- Do **not** stack cue + risk + condition + at-max + flags as always-visible paragraphs — that is a lore card, not a tracker.
- Do **not** use cyan hunger fills.
- Do **not** give presentation pressure larger padding/margins than harm/stability.

---

## Presentation pressure UI model

Registry: `presentation-pressure.js`. UI must respect three layers:

| Layer | What | UI treatment |
| --- | --- | --- |
| **Pressure track** | Numeric 0–6 load | `line-tracker` pips + count |
| **Operating condition** | Derived state (Hungry, Saturated, …) | `pip-derived` and/or readout line; flags in collapsed details |
| **Fiction cue / risk** | Table-facing symptom | Collapsed readout; summary line when closed |

`presentationPressureView()` is the render API. **Extend the tracker row + readout drawer**, not a new panel type.

Sanguine intake flags and condition override belong in **advanced/collapsed** UI only (`pressure-readout-flags`, `pressure-readout-override`).

---

## Details / drawers / secondary copy

Use `<details>` for anything that is **helpful at table but not needed every roll**:

- Roll guide (already on roll dock)
- Presentation table readout
- Frequency reference drawers
- Handler clock notes

Closed state must still communicate something (`summary` one line, muted `.6rem`). Open state uses `.62–.7rem` muted lines, not new card chrome.

---

## Forms and controls

- Operator forms: `.console-form` labels are uppercase cyan `.67rem`.
- Full-width fields: `grid-column: 1 / -1` only when necessary (textareas, button rows).
- **Segmented / band controls** for attention, stability band, misfire severity — not duplicate tracker UIs.
- Page edit lock + creation mode gate build-defining fields; do not bypass with always-enabled selects.

---

## Handler live constraints

- **Scene consequences**, **Attention/Aftermath**, **Primary clock**, **Case clock**, and **Collapse/Rewrite** stay separate fields and panels (see `Veildaemon/AGENTS.md`).
- Trigger preview applies pressure visibly; no silent sheet mutation.
- Operator risk strip: one-line summaries (`handlerSummaryText`), not paragraph tooltips.
- Secondary clock mounts **under** primary in center column when enabled — do not widen the grid for it.

---

## Stream / admin / public intake

- **Stream:** transparent background, fixed canvas intent, `noindex`, minimal DOM for OBS CPU.
- **Admin:** same tokens, optional grid background; still monospace.
- **Public intake:** diegetic copy only (see `Veildaemon/AGENTS.md`); no operator-style tracker boards on intake.

---

## Responsive breakpoints (operator)

- `@media (max-width: 900px)`: tracker board and `line-tracker` go single column; pip `+/-` controls hidden (tap pips only).
- `@media (max-width: 560px)`: shell padding tightens; console nav scrolls horizontally.

New tracker UI must survive both breakpoints without introducing horizontal scroll on the sheet.

---

## Web images

- **Display on the web = WebP.** `<img>`, CSS backgrounds, and Studio art paint WebP, not PNG/JPEG.
- PNG/JPEG may remain as masters or press download originals only.
- Convert with `npm run webp -- path/to/image.png` or `node scripts/ensure-webp.mjs`.
- `npm run webp:check` fails if HTML/CSS still points display URLs at PNG/JPEG (download links ignored).

## Agent checklist (before shipping UI)

1. **Does this belong in an existing strip?** (Harm & Stability, case strip, handler panel, trigger tray)
2. **Is the numeric track one `line-tracker` row?** If not, justify in PR/commit message.
3. **Is prose hidden by default?** Cues, risks, notes → `<details>` or handler preview panel.
4. **Is the primary control the track, not a status picker?**
5. **Same margins as neighbors?** Compare padding to `.condition-strip` / `.line-tracker`, not `.sheet-card` essay blocks.
6. **Bump cache query** on touched CSS/JS in HTML.
7. **Web display images are WebP** (not PNG/JPEG in `src` / `url()`).
7. **Run** `npm run check` and `npm run browser:check` in `Veildaemon/`.

---

## File pointers

| Concern | File |
| --- | --- |
| Operator trackers + readout | `operator/operator.js`, `operator/operator.css` |
| Presentation contract | `presentation-pressure.js` |
| Handler live layout | `handler/live/index.html`, `handler/live/live-flow.css` |
| Handler tracker mount | `handler/handler.css` (`.handler-line-tracker`) |
| Shared public chrome | `styles.css` |
| Surface nav / drawers | `surface-nav.js` |
| Browser tests for operator/handler UI | `tests/browser/*.spec.js` |

---

## Revision note

Created after presentation pressure briefly shipped as a full-width “Sanguine Pressure” card with coherence dropdown as the visual focus. Correct pattern: **third tracker row + collapsed readout** inside Harm & Stability.