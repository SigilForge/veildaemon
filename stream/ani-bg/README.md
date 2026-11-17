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

## Rebuild the Rain Loops

The original 70/80/90 `*-screen-frame.mp4` clips contain 145 frames at 24 FPS
(6.042 seconds) and do **not** loop cleanly at the source boundary. The hosted
OBS cutouts now use a cyclic 36-frame (1.5-second) overlap: discard the opening
36 frames, then cross-dissolve the end of the source clip against those opening
frames. The last blended frame naturally leads into the first retained source
frame, without a fade to black or reversing falling rain. Each loop is 109
frames (4.542 seconds) at the original 1472 x 608 native video resolution.

Run from the Veildaemon repository root:

```bash
python3 stream/ani-bg/build_loops.py
python3 stream/ani-bg/verify_loops.py
```

`build_loops.py` reproduces all three WebMs from the checked-in MP4 sources
and the respective 3440 x 1440 grayscale screen masks. Masks are nearest-neighbor
resized before alpha merging; the monitor opening stays unblended. Output is
silent VP9 with alpha and uses atomic file replacement after frame-count and
alpha-mode verification. `verify_loops.py` checks the seam against the original,
confirms that motion remains natural across the join, and checks the hard
transparent/opaque screen mask (allowing only 1-2-level VP9 rounding noise).
After rebuilding, version the video URL query in all three HTML routes.
