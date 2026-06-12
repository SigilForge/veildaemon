# VEILCORP VHS Signal Filter

Hosted OBS browser-source filter for adding scanlines, noise, chroma drift, and brief tracking correction over the full stream.

- Route: `/stream/vhs/`
- OBS browser-source size: `3440 x 1440`
- Place it above the scene content. Keep it below emergency cards or text that must stay perfectly readable.
- Tune the source opacity in OBS if the filter is too strong for live browsing.
- For heavier signal corruption, stack `/stream/glyph-static/` above or below this source and tune opacity in OBS.
