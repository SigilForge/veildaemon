# VEILCORP Glyph Static

Hosted OBS browser-source layer that uses the flickering glyph static video as intermittent ripple bands instead of a full-frame overlay.

- Route: `/stream/glyph-static/`
- OBS browser-source size: `3440 x 1440`
- Uses `assets/glyph-static-slower.mp4` as a dark ripple carrier plus `assets/glyph-static-slower-keyed.webm` for bright keyed glyph/static details.
- Place it above the scene content for weird signal bleed, or above `/stream/vhs/` for a stronger haunted-transfer look.
- Tune source opacity in OBS if the default CSS opacity is too strong.
