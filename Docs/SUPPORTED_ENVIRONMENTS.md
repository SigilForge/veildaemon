# Supported Environments

VeilDaemon currently supports a small set of explicit runtime surfaces. Optional local tools can exist beside them, but they must not become default test or publication dependencies.

## Public Static Surface

- Host: GitHub Pages for `veildaemon.app`.
- Source: repo-root static files, `operator/`, `debrief/`, `studio/`, `rights/`, and related browser assets.
- Validation: `npm run check` and `npm run browser:check`.
- Serverless API calls from production static pages must target `https://api.veildaemon.app` unless the page is running on localhost or a non-production preview origin.

## Vercel API Surface

- Host: Vercel project serving `api.veildaemon.app`.
- Source: repo-root `api/` functions and root `vercel.json`.
- Validation depends on the route being changed; repository state alone is not deployment proof.

## Python Package Surface

- Package: `veildaemon/`.
- Default headless imports must not require desktop UI packages.
- `veildaemon-chat` is a desktop entry point and requires `tkinter` only when launching the UI.
- Root Python validation uses `./veildaemon/.venv/bin/python -m pytest -ra`.

## Creator Rights Surface

- Creator Rights publication authority stays inside this repository's rights, license, policy, and delivery surfaces.
- Forge, Relay, StreamDaemon, or any future service may receive integration events, but no service receives authority to publish, license, or waive Creator Rights material.
- Paid digital delivery must remain private-bucket and server-verified; browser-addressable files are not purchase verification.

## Optional Local Surfaces

- Relay's local AI call path is a desktop/local operator feature. Hardened remote or mobile use for social-post rewriting is not part of current default support.
- Legacy StreamDaemon plugin smoke is opt-in with `VD_ENABLE_LEGACY_STREAMDAEMON_PLUGIN=1`.
- Forge live IPC smoke is opt-in with `VD_ENABLE_FORGE_LIVE_SMOKE=1`.
- Docker may be used for local isolation, but this repository's default checks do not require Docker.

## Archived Or Legacy Expectations

- `/play-report/` is a legacy route that sends customers to the debrief surface.
- Browser tests should assert the visible supported destination and current copy, not old Studio inventory assumptions.
