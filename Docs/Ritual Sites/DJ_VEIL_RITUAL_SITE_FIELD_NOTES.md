# DJ Veil — Ritual Site Field Notes

**Status:** Concept / field research · not a shipping product  
**Related verticals:** Ritual Sites (future), Mobile AR (proposed/scoping), VeilDaemon stream overlays (live OBS infrastructure)  
**Source event:** Evanescence / Morton Amphitheater, Kansas City  
**Intent:** Capture production patterns worth translating into Ritual Site v0.9 — a live-stream compositing system with a bounded daemon persona.

When programming starts, begin here, then `README.md` in this folder for implementation order and code breadcrumbs.

---

## Evanescence / Morton Amphitheater KC

The production used layered visual surfaces rather than relying on one giant display.

A hard rear LED wall carried sharp graphics, logos, live camera feeds, high-contrast overlays, and collage-style imagery. A separate front scrim appeared to be used specifically during “Broken,” where it carried soft angel-wing imagery and translucent performer silhouettes. The rear display created authority and detail. The scrim created apparition, absence, and emotional softness.

Live camera footage was treated as source material rather than simple magnification. Performer silhouettes were tracked nearly one-to-one and converted into contour lines, repeated echoes, grain, monochrome treatments, masks, and embedded compositions. The performer remained recognizable even after the literal image dissolved into symbolic geometry.

The stage also used practical lighting behind and around the display planes. High-output beams pushed through or between the surfaces, with haze giving them visible volume. This made screen events appear to emit into the physical venue rather than stopping at the display.

Suspended programmable light elements, likely LED tubing or pixel rope, were arranged in large hanging loops and moved vertically on rigging. They behaved as kinetic architecture: curtain, cable, vein, lightning, root, or signal path depending on the cue. Their motion and pulse were synchronized to music and screen content.

The strongest effect came from alignment between layers:

* virtual cables continued into real hanging cables
* screen geometry matched physical risers and performer positions
* lighting cues emerged from apparent locations inside the image
* live silhouettes became part of the graphics
* the scrim could disappear, revealing the harder rear architecture

The stage therefore read as one responsive environment rather than “band in front of screen.”

---

## Ritual Site translation

Ritual Site v0.9 should begin as a **live-stream compositing system** with a **bounded daemon persona**.

The daemon does not need to control everything. It needs to coordinate:

* live camera isolation and silhouette tracking
* reactive overlays and symbolic transformations
* scene-state LUTs and visual grading
* audience or chat input
* lore continuity
* lighting and overlay triggers
* trace-visible decisions
* bounded performer interaction

The first deployment can live in OBS-like broadcast composition. Later versions can extend the same scene logic into venue LED walls, projection scrims, lighting rigs, AR layers, audience phones, and spatial installations.

### Core design rule

> Do not place the daemon beside the performance. Make it alter how the performance is perceived.

The streamer persona is the first body. The ritual engine is the actual product.

The audience should not feel like they are watching an AI avatar.

They should feel like a presence has entered the broadcast.

---

## Layer model (implementation shorthand)

| Layer | Field analogue | v0.9 stream target | Later venue extension |
|-------|----------------|--------------------|------------------------|
| Authority plane | Hard rear LED | OBS base / media sources | LED wall / main projector |
| Apparition plane | Front scrim | Semi-transparent browser source | Scrim / gauze / second projector |
| Body-as-source | Live cam → silhouette / contour | Cam isolation + symbolic FX | Multi-cam venue tracking |
| Emit into space | Beams + haze through planes | Simulated bloom / edge light overlays | Practical lighting + haze |
| Kinetic architecture | Hanging LED loops / pixel rope | Motion-synced overlay paths | Motorized / pixel rope rigging |
| Alignment | Virtual continues into physical | Shared scene graph / cue clock | Spatially calibrated show control |

---

## Product boundaries (keep honest)

* **Not** a claim that venue-scale Ritual Sites are shipping.
* **Not** Mobile AR MVP scope (location encounters stay separate under Technology / AR prospectus).
* **Is** a future vertical that can inherit VeilDaemon identity, stream overlay routes, and Cradlepoint emotional-physics framing.
* Public Studio language stays: Ritual Sites = **future vertical / concept**.

---

## See also

* [README.md](./README.md) — programming start order and code map  
* [../Feed the Daemon/](../Feed%20the%20Daemon/) — Sheep Node → stream intelligence → Field Node / AR product spine  
* [../DESIGN_CONSTRAINTS.md](../DESIGN_CONSTRAINTS.md) — at-table UI constraints (do not conflate with venue/stream canvas)  
* Hosted OBS layers: `stream/` (live browser sources)  
* Studio public surface: `/studio/technology/#ritual-sites`, `/studio/projects/` Ritual Sites card  
