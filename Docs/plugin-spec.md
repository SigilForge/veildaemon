# **🜏 VeilDaemon Plugin Specification**

**Version:** 1.0
**Purpose:** Standard for creating modular packs for VeilDaemon—logic, persona, and AR layers.

---

## **Plugin Types**

* **Logic Pack**

  * Defines rules for meltdown detection, grounding rituals, spoon/wick decay, and event triggers.
* **Persona Pack**

  * Defines speech style, tone, glyph palettes, and voice overlays.
* **AR/Visual Pack** *(Premium)*

  * Includes avatars, animated glyph sets, or AR overlays. Requires token authentication.

---

## **General Schema**

```yaml
pack_id: unique_identifier       # Required. Lowercase, no spaces.
name: "Display Name"            # Required.
type: logic | persona | ar       # Required.
version: 1.0                     # Required.
author: "Creator Name or Guild"  # Required.
description: "Short description" # Required.
requires_token: true | false     # Token-gated packs (e.g., AR skins, premium glyph sets).
token_scope: "AR" | null         # Scope for token enforcement (optional).
```

---

### **Logic Pack Fields**

```yaml
thresholds:
  wick_low: 30
  ambient_noise: high
actions:
  - ritual: play_white_noise
  - glyph: 🕯
  - voice_prompt: "Grounding activated. Breathe with me."
```

---

### **Persona Pack Fields**

```yaml
tone: "poetic"
speech_style: "glitching, mythpunk, intimate"
glyph_palette:
  - 🜏
  - 🕯
  - 🛡
voice_profile: "daemon_voice_01"
```

---

### **AR/Visual Pack Fields**

```yaml
assets:
  models:
    - succubus_demon.glb
  animations:
    - glitch_idle.anim
glyph_set: "premium_animated_glyphs"
requires_token: true
token_scope: "AR"
```

---

## **Validation Rules**

* `pack_id`, `type`, and `version` are **mandatory**.
* AR packs **must** set `requires_token: true`.
* Community packs **must not** include malicious code or external injection hooks (verified by loader).
