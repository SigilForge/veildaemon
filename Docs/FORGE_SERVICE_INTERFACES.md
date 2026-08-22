# Future Forge Service Interfaces

This note names the service boundary before Forge coupling grows. It documents the interface shape VeilDaemon can support later without making Forge a default dependency now.

## Current Boundary

- `lib/forgeStreamBridge.js` is the existing server-side bridge.
- Default behavior must remain local/offline-safe when Forge is disabled, missing, or unavailable.
- The live Forge IPC smoke is opt-in with `VD_ENABLE_FORGE_LIVE_SMOKE=1`.

## Interface Requirements

Future Forge-facing calls should define:

- Schema version and event type.
- Required authentication material and where it is read from.
- Timeout behavior.
- Retry conditions and maximum attempts.
- Fallback behavior when the service is disabled, misconfigured, unavailable, or returns malformed output.
- Worst-case number of external calls triggered by one user action.
- Tests for disabled, misconfigured, unavailable, malformed, and accepted responses.

## Authority Boundaries

- VeilDaemon may emit events or request derived service work.
- Forge must not become a browser-side privileged local service.
- Forge must not become a required dependency for default public-surface checks.
- Forge must not receive Creator Rights publication, license, waiver, or paid-delivery authority.

## Non-Goals

- No shared process runtime.
- No importing Forge internals from browser code.
- No hidden live service dependency inside unit tests.
- No mobile Relay/social rewrite requirement until hardened remote use is designed explicitly.
