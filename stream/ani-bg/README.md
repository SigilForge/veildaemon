# VEILCORP Ani BG Cutouts

Hosted OBS browser-source routes:

- `/stream/ani-bg/70/`
- `/stream/ani-bg/80/`
- `/stream/ani-bg/90/`

Each route plays a silent looping WebM with the monitor screen removed from the frames.

Use `3440 x 1440` for all three OBS browser-source routes. The player fills the browser-source canvas directly and scales the compact native animation frame to the canvas.

## Cutout Rules

- The transparent screen hole must keep the `3440 x 1440` aspect ratio after scaling to the OBS canvas. Keep the width from the monitor opening, then reduce height and center it vertically.
- Only the screen content area is transparent. The frame, bezel, room, desk, and the unused top/bottom monitor interior stay fully opaque.
- Paint unused monitor interior above and below the transparent screen box black before alpha cutting. Do not leave original desk/stand pixels visible inside the monitor.
- Do not use semi-transparent frame alpha. The rebuilt WebM should have alpha `0` inside the screen box and `255` outside it.
- Encode cutouts from the original `1472 x 608` animation frames and let the browser source scale them to the `3440 x 1440` OBS canvas. Do not export full-canvas alpha videos unless there is a specific visual reason.
- If the right inner bezel needs repair, mirror only a narrow strip from the left silver/white inner bezel line. Do not copy a wide side strip; that pulls in the rainy background.
- The `90%` overlay is a scaled/cropped copy of the clean `80%` cutout so the inner bezel edges stay consistent.
- Bump the query string in each HTML route after rebuilding a WebM so OBS and browser sources reload the new asset.
