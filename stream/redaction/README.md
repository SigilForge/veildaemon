# VEILCORP Redaction Overlays

OBS image assets for hiding local interface edges during browser capture.

- `assets/taskbar-redaction-3440x1440.png` is a full `3440 x 1440` transparent canvas with a bottom redaction band. Use this when the source or scene is already built around the ultrawide canvas.
- `assets/taskbar-redaction-strip-3440x132.png` is only the slim bottom rail. Use this when you want to position and scale the cover manually.
- `assets/taskbar-redaction-strip-3440x164.png` keeps the same rail centered in a taller transparent box for easier taskbar coverage.

Place the redaction image above the browser source and below any foreground frame or alert layers.
