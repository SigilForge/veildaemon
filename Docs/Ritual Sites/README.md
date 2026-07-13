# Ritual Sites — design ore for programming

**Public status:** Future vertical · concept only  
**First product slice (when built):** Ritual Site v0.9 — live-stream compositing with a bounded daemon persona  
**Not:** full venue production package, Mobile AR MVP, or a diegetic AI co-host avatar product

## Read order when you start programming

1. **[DJ_VEIL_RITUAL_SITE_FIELD_NOTES.md](./DJ_VEIL_RITUAL_SITE_FIELD_NOTES.md)** — Evanescence / Morton field notes + translation thesis  
2. This README — implementation map and guardrails  
3. Existing **stream/** OBS routes (what already hosts as browser sources)  
4. **stage/** / stream convo engines only if the daemon needs chat/persona binding (do not invent a floating avatar UI first)

## Core product rule

> Do not place the daemon beside the performance. Make it alter how the performance is perceived.

Audience feeling target: a **presence entered the broadcast**, not “we added an AI character.”

## v0.9 coordination surface (daemon owns the bus, not every device)

Implement as a **scene coordinator** that can emit cues / state, not a monolith that renders the whole show:

| Concern | Notes |
|---------|--------|
| Live camera isolation + silhouette tracking | Body as source material → contour / echo / grain / mask |
| Reactive overlays + symbolic transforms | Browser sources; keep transparent / OBS-friendly |
| Scene-state LUTs / grading | Named states, not freeform “AI art mode” |
| Audience / chat input | Bounded channels; trace-visible decisions |
| Lore continuity | Cradlepoint / VeilDaemon identity — no Systems Metaphysics leaks on public surfaces |
| Lighting / overlay triggers | Cue packets that later map to real fixtures |
| Bounded performer interaction | Explicit affordances; no unbounded agent autonomy on stream |

## Suggested first deployment path

```
OBS (or equivalent) composition
  ├─ authority plane   (hard graphics / logos / high-contrast)
  ├─ apparition plane  (scrim-like translucent browser source)
  ├─ body-as-source    (cam → silhouette / symbolic FX)
  ├─ emit overlays     (beams/bloom as graphics until practical lights exist)
  └─ kinetic paths     (animated cable/loop layers synced to cue clock)
         ▲
         │ cue / state bus
         │
   Ritual Site v0.9 coordinator (daemon persona = bounded presence, not co-host)
```

Later the **same scene logic** extends to: venue LED, projection scrims, lighting rigs, AR layers, audience phones, spatial installs.

## Code and route breadcrumbs (today)

| Location | Role |
|----------|------|
| `stream/` | Hosted OBS browser sources (alerts, starting, brb, glyph-static, …) — **current physical substrate** |
| `stream/*/README.md` | Per-overlay notes; keep `noindex`, transparent default, canvas-sized |
| `AGENTS.md` → Stream Overlay Notes | Working rules for stream routes |
| `veildaemon/apps/stage/` (if present in package tree) | Stage / stream conversation engines — persona binding only when needed |
| `studio/technology/index.html#ritual-sites` | Public honest status label (future) |
| `studio/projects/` Ritual Sites card | Public portfolio label (future · not a live offer) |
| `studio/data-room/public/roadmap-public.*` | Sequencing: Ritual Sites stay long-horizon |

## Explicit non-goals for v0.9

* Do not ship venue control as the first milestone.
* Do not market stream presence as shipping “Ritual Sites product.”
* Do not merge Mobile AR location MVP scope into this track without a separate decision.
* Do not put the daemon as a chat bubble co-host as the primary aesthetic.

## When opening a Ritual Site / AR programming branch

Checklist:

- [ ] Re-read field notes + this README  
- [ ] Inventory which `stream/` overlays can become authority / apparition / kinetic layers  
- [ ] Define a minimal **cue schema** (scene id, plane targets, intensity, duration, trace string)  
- [ ] Define **trace-visible decision** logging (what the presence did, and why it was allowed)  
- [ ] Keep Studio public copy status pills accurate (future / planning / live)  
- [ ] Gate any Handler-only or Systems Metaphysics material off public surfaces  

## Related: Feed the Daemon

The same continuity can originate as a public **Sheep Node** (collective web feeder) and later drive stream/Ritual Site visuals. Product spine:

**`Docs/Feed the Daemon/`**

Shared rule: presence alters perception; daemon is not a mascot or co-host avatar. Sheep Node state (Resonance / Presence / Frequency weights) is a valid **input bus** into Ritual Site cues when that integration ships.

## Related public language

Use Studio wording: **future vertical**, **concept**, **not a live offer**. Internal engineering may say “v0.9 stream compositor” freely; public pages must not upgrade status without a ship decision.
