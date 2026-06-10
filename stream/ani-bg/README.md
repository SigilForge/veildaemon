# VEILCORP Ani BG Cutouts

Hosted OBS browser-source routes:

- `/stream/ani-bg/70/`
- `/stream/ani-bg/80/`
- `/stream/ani-bg/85/`
- `/stream/ani-bg/90/`

Each route plays a silent looping WebM with the monitor screen removed from the frames.

Use `3440 x 1440` for all four routes. The player fills the browser-source canvas directly and uses the still PNG alpha as a browser mask, so the room, bezel, and lamp remain opaque while only the monitor screen is transparent.
