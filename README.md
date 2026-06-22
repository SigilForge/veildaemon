# VeilDaemon

VeilDaemon is the public Operator interface for the Cradlepoint universe: intake, local character records, Needlepoint play support, anomaly reporting, debrief collection, and archive-facing tools for VeilCorp continuity operations.

The public surface is a static VeilCorp intake node with local-first Operator tooling and Vercel-backed review channels where server-side routing is required.

## Public Surfaces

- `index.html`, `styles.css`, `script.js`: primary public intake surface.
- `operator/`: local Operator record, field tracking, anomaly log, and import/export controls.
- `debrief/`: Needlepoint debrief intake with redaction review.
- `recovered-operator-reports/`: approved public recovery index.
- `updates/`: system notices and visible development history.
- `admin/`: private review and operations surfaces.
- `api/`: Vercel functions for alerts, reports, anomalies, and Twitch EventSub.

## Operating Notes

- The public site should stay diegetic and procedural.
- Repository access is intentionally tertiary on the public page.
- Local Operator records stay in browser storage unless an Operator authorizes transfer.
- Debriefs and anomaly volunteer copies require explicit transfer paths and review before public recovery.

## Development

```bash
npm run check
npm run browser:check
```

The current Node target is declared in `package.json`.
