# Feed the Daemon — design ore for programming

**Public status:** Concept / future interactive vertical · not shipping as a public product yet  
**2026 spine:** Web-first **Sheep Node** (collective feeder) → personal feeder → stream/Ritual Site intelligence → Field Node → AR surface  
**One-line:** Attention teaches a generative node until something coherent looks back—and the same continuity can travel into music game, stream, venue, and place.

## Read order when you start programming

1. This README — current authority map, code breadcrumbs, and status guardrails
2. **[SHEEP_NODE_MVP_SPEC.md](./SHEEP_NODE_MVP_SPEC.md)** — Proof 0 + Proof 1 implementation authority, acceptance criteria, data objects, and six-sprint build order
3. **[2026_PRODUCT_SPINE.md](./2026_PRODUCT_SPINE.md)** — broader product thesis and later evolution across personal feeder, stream, Ritual Site, Field Node, and AR
4. **[../Ritual Sites/](../Ritual%20Sites/)** — how the same presence alters live performance after the Sheep Node MVP (not a co-host avatar)
5. **`stream/`** — existing OBS browser-source substrate
6. VeilDaemon intake Frequency vocabulary (Dream, Hunger, Silence, Stillness, Empyrean, Becoming) in live `script.js` / operator surfaces — **reuse, do not fork**

### Authority rule

The Product Spine preserves the full product direction. The Sheep Node MVP Spec governs Proof 0 and Proof 1 mechanics, technical architecture, delivery phases, and build order when the two documents differ.

## Core product rule

> The page is already the seed. The audience is already playing. AR merely reveals what their attention built.

Secondary rule (shared with Ritual Sites):

> Do not place the daemon beside the performance. Make it alter how the performance is perceived.

## Continuity chain

```
Sheep Node (public web)
    → Personal feeder (claimed seed / music-pressure loop)
    → Continuity Trace (behavior history, not XP)
    → Stream / Ritual Site (visual intelligence of the show)
    → Field Node (deployable address in VeilDaemon)
    → AR (same entity, spatial membrane)
```

## State model (v0 public node)

| Value | Meaning | Decay |
|-------|---------|--------|
| **Resonance** | Accumulated history (returns, completions, fragments, events) | Slow / none |
| **Presence** | Immediate collective attention (concurrency, dwell, sync) | Fast |

Conditions: dormant · sleeping · unstable awakening · manifestation (see product spine).

Do **not** surface raw metrics as a dashboard. Show them as organism change.

## Frequencies

Six shallow influences cultivated by action, not menus:

Dream · Hunger · Silence · Stillness · Empyrean · Becoming

Align with existing Operator primary Frequency language.

## First MVP proof (build now)

See [SHEEP_NODE_MVP_SPEC.md](./SHEEP_NODE_MVP_SPEC.md). The build target is Proof 0 + Proof 1: validate the dormant shared node, then the bounded musical ensemble, performer decay, ritual threshold, and saved track provenance. The Product Spine’s later phases remain direction, not first-build requirements.

## Code / route breadcrumbs (today)

| Location | Role |
|----------|------|
| `Docs/Feed the Daemon/README.md` | Start map and authority rule |
| `Docs/Feed the Daemon/SHEEP_NODE_MVP_SPEC.md` | Proof 0 + Proof 1 build authority |
| `Docs/Feed the Daemon/2026_PRODUCT_SPINE.md` | Long-horizon product and continuity thesis |
| `Docs/Ritual Sites/` | Live composition / DJ Veil translation |
| `stream/` | Hosted OBS layers (authority / apparition / kinetic planes later) |
| VeilDaemon intake / Frequency drift (`script.js`, operator) | Existing Frequency taxonomy |
| `studio/technology/#feed-the-daemon` | Public honest status |
| `studio/technology/#ritual-sites` | Stream-first venue vertical |
| `studio/technology/#mobile-ar` | Location AR — **separate capital track** until merged deliberately |
| `studio/projects/` | Portfolio labels only when public status allows |

## Suggested first code drop (when opening a branch)

```
/feed/   or   /sheep/   (public Sheep Node SPA)
  index.html
  app.js / shaders /
  noindex until intentional launch
api/feed/  or  edge functions for:
  events, presence, resonance, phase, motifs
```

Anonymous session first. Accounts later for Continuity Trace depth.

## Explicit non-goals for first MVP

* Native app  
* Real-time diffusion as primary renderer  
* Registration wall  
* Raw click farming as progression  
* Claiming Ritual Sites / AR as shipping because the node page exists  
* Inventing a second Frequency list  

## When opening a Feed the Daemon branch

- [ ] Re-read product spine + this README  
- [ ] Re-read Ritual Sites README for shared presence rule  
- [ ] Confirm Frequency names match live VeilDaemon  
- [ ] Define event schema (weight, cooldown, trust, category)  
- [ ] Define motif persistence format  
- [ ] Decide public route + `noindex` policy until launch  
- [ ] Keep Studio status pills accurate  
