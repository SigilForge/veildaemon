# VEILDAEMON.APP deploy notes

This is a static GitHub Pages site. No build step. Upload the files as-is.

## Replace links if needed
Open `index.html` and search for these button labels:

- Access VeilCorp Archives -> https://wiki.veildaemon.app/
- Open Case Files -> https://the-cradlepoint-archives.itch.io/needlepoint
- Begin Operator Intake -> https://veilborn.carrd.co/
- Archive Index -> https://wiki.veildaemon.app/wiki/Main_Page

## Files

- `index.html` — page content
- `styles.css` — layout/visual styling
- `assets/background.jpg` — full-page art
- `assets/veilcorp-avatar.png` — circular seal
- `CNAME` — tells GitHub Pages the custom domain is `veildaemon.app`


## Primary Feed Embed

The homepage embeds the Primary Feed playlist using:

`https://www.youtube.com/embed/videoseries?list=PLEoIdLPqOjeuJaD74EtiQWXScSqVtXJh4`

To change the playlist later, replace the playlist ID in `index.html`.
