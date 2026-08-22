# Forge stream-bridge host glue (Stage 4F.2)

Narrow adapter from **this repo** (`/home/nox/projects/veildaemon`) into
VeilForge’s local AF_UNIX stream bridge (4F.1). No Forge runtime import.

## Path

```text
EventSub / admin enqueue
→ lib/alertQueue.enqueue (createAlert)
→ lib/forgeStreamBridge.notifyForgeFromAlert  (fail-open)
→ AF_UNIX length-prefixed JSON (schema_version 1)
→ VeilForge StreamBridgeHandler
→ overlay_commands + pending_actions
→ alert.forge / alert.forgeOverlay attached
→ existing alert queue + OBS overlay poll (unchanged when Forge down)
```

## Env

| Variable | Purpose |
| --- | --- |
| `VEIL_STREAM_BRIDGE_SOCKET` | Unix socket path (Forge server) |
| `VEIL_STREAM_BRIDGE_TOKEN` | Shared auth token |
| `VEIL_STREAM_BRIDGE_ENABLED` | Optional; default on when socket+token set |
| `VEIL_STREAM_BRIDGE_TIMEOUT_MS` | Request timeout (default 2000) |

## Contracts

- Same framing as `veil_agents.core.stream` (4-byte BE length + JSON).
- Stable ids: `esub-{twitchMessageId}` when EventSub provides message id.
- Bounded backoff on failure; **no offline queue**.
- In-flight drop if a push is already running (`in_flight`).
- Unknown / down Forge → alert still enqueues; `record.forge.status` records skip/error.
- `pending_actions` are proposals only — never executed by this adapter.

## Commands

```bash
# syntax check
npm run check

# unit + optional live round-trip (spawns Forge if ../veilforge exists)
npm run test:forge-bridge

# manual smoke against a running Forge StreamBridgeServer
export VEIL_STREAM_BRIDGE_SOCKET=…
export VEIL_STREAM_BRIDGE_TOKEN=…
npm run smoke:forge-bridge
```

## Files

- `lib/forgeStreamBridge.js` — client
- `lib/alertQueue.js` — enqueue hook
- `scripts/smoke-forge-stream-bridge.mjs` — live smoke
- `tests/unit/test_forge_stream_bridge.js` — unit + optional IPC

## Not in 4F.2

- Viewer memory greetings (4F.3)
- Clip / OBS / moderation execution (4F.4–4F.6)
- Merging VeilDaemon and VeilForge processes
