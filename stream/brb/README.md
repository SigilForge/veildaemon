# VEILCORP BRB Overlay

Use these two hosted sources as separate OBS layers:

- Looping VP9 WebM background: `/stream/brb/background/`
- Transparent animated overlay: `/stream/brb/`

Set both sources to the native `1938x811` canvas, preserve their aspect ratio, and let OBS composite them. Non-uniform source transforms will turn CSS circles into ovals and break registration.

Use `stream/brb/preview.html` to inspect the same two hosted layers registered together.

Rebuild the background derivative after changing the WebP master:

```sh
npm run stream:brb:build
```

Verify the media metadata, route separation, circular pulse geometry, and painted-dot registration:

```sh
npm run stream:brb:check
```

Canvas reference: `1938x811`.
