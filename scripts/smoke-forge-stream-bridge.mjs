#!/usr/bin/env node
/**
 * Stage 4F.2 live round-trip smoke (VeilDaemon host glue → VeilForge IPC).
 *
 * Requires a running Forge stream-bridge server:
 *   VEIL_STREAM_BRIDGE_TOKEN=… VEIL_STREAM_BRIDGE_SOCKET=…  (Forge side)
 *   same env for this script
 *
 * Usage:
 *   node scripts/smoke-forge-stream-bridge.mjs
 *   node scripts/smoke-forge-stream-bridge.mjs --follow TestViewer
 */

import { createRequire } from "module";
import { randomBytes } from "crypto";

const require = createRequire(import.meta.url);
const bridge = require("../lib/forgeStreamBridge.js");
const { enqueue } = require("../lib/alertQueue.js");

function parseArgs(argv) {
  const args = { user: "SmokeViewer", type: "follow" };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--follow" && argv[i + 1]) {
      args.type = "follow";
      args.user = argv[++i];
    } else if (argv[i] === "--raid" && argv[i + 1]) {
      args.type = "raid";
      args.user = argv[++i];
      args.count = Number(argv[++i] || 3);
    } else if (argv[i] === "--help") {
      args.help = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node scripts/smoke-forge-stream-bridge.mjs [--follow User] [--raid User N]");
    process.exit(0);
  }

  const cfg = bridge.config();
  console.log("bridge.config", {
    enabled: cfg.enabled,
    socketPath: cfg.socketPath,
    tokenConfigured: Boolean(cfg.authToken),
  });

  if (!cfg.enabled || !cfg.socketPath || !cfg.authToken) {
    console.error(
      "FAIL: set VEIL_STREAM_BRIDGE_SOCKET and VEIL_STREAM_BRIDGE_TOKEN (and ensure Forge StreamBridgeServer is listening).",
    );
    process.exit(2);
  }

  const health = await bridge.health();
  console.log("health", { ok: health.ok, status: health.status, error: health.error });
  if (!health.ok) {
    console.error("FAIL: Forge stream-bridge health check failed.");
    process.exit(3);
  }

  const twitchMessageId = `smoke-${randomBytes(8).toString("hex")}`;
  const alert = {
    type: args.type,
    user: args.user,
    count: args.count || 1,
    source: "twitch",
    twitchMessageId,
  };

  const enqueued = await enqueue(alert);
  const record = enqueued.alert;
  console.log("enqueued", {
    id: record.id,
    type: record.type,
    user: record.user,
    twitchMessageId: record.twitchMessageId,
    forge: record.forge,
    forgeOverlay: record.forgeOverlay || null,
  });

  if (!record.forge || record.forge.status === "error" || record.forge.status === "skipped") {
    console.error("FAIL: enqueue did not get a successful Forge ack.", record.forge);
    process.exit(4);
  }

  const overlays = record.forge.overlayCommands || [];
  if (overlays.length !== 1) {
    console.error("FAIL: expected exactly one OverlayCommand, got", overlays.length);
    process.exit(5);
  }

  // Idempotency: same Twitch message id must not double-accept.
  const again = await bridge.pushAlertEvent({
    ...alert,
    id: record.id,
  });
  console.log("duplicate_push", {
    ok: again.ok,
    status: again.status,
    error: again.error,
  });
  if (again.status !== "duplicate" && again.ok !== false) {
    console.error("FAIL: expected duplicate suppression for stable event id.");
    process.exit(6);
  }

  console.log("OK: EventSub-shaped alert → Forge StreamEvent → one OverlayCommand; alerts still enqueued.");
  process.exit(0);
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
