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

## VeilCorp QR Assets

Generate permanent static QR assets locally. The generator uses direct URLs only, refuses common short-link hosts, defaults to QR error correction `H`, and writes an editable SVG as the publishing asset.

```bash
npm run qr -- \
  --url "https://veildaemon.app" \
  --title "VEILCORP ARCHIVES" \
  --subtitle "ACCESS NODE // VERIFIED" \
  --node "OPERATOR INTAKE" \
  --clearance "THREADBREAKER" \
  --out "operator-intake"
```

Default output:

```text
public/assets/qr/operator-intake.svg
```

Use the SVG for print, stickers, cards, and any resized asset so the QR modules stay crisp. A PNG can be generated as a local preview only:

```bash
npm run qr -- --url "https://veildaemon.app" --out "operator-intake" --png-preview
```

Useful optional controls:

- `--accent purple|red|white|none`
- `--footer "HUMAN AUTHORIZATION PARTIAL. SURVIVAL AUTHORIZATION ACTIVE."`
- `--logo-svg path/to/logo.svg`
- `--accent-rate 0.025`

Always scan-test the generated asset before publishing or printing.
