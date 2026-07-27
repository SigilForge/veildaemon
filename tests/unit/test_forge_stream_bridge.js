/**
 * Unit tests for Stage 4F.2 host glue (no Forge process required for pure helpers).
 * Run: node --test tests/unit/test_forge_stream_bridge.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawn } = require("child_process");

const bridge = require("../../lib/forgeStreamBridge");
const { createAlert, enqueue } = require("../../lib/alertQueue");

describe("forgeStreamBridge helpers", () => {
  it("builds stable event ids from twitchMessageId", () => {
    const id = bridge.stableEventId({
      id: "alert-1",
      twitchMessageId: "msg-abc",
      type: "follow",
    });
    assert.equal(id, "esub-msg-abc");
  });

  it("falls back to alert.id", () => {
    const id = bridge.stableEventId({ id: "alert-xyz", type: "raid" });
    assert.equal(id, "alert-xyz");
  });

  it("createAlert preserves twitchMessageId and source", () => {
    const record = createAlert({
      type: "follow",
      user: "Hero420247",
      twitchMessageId: "tw-1",
      source: "twitch",
    });
    assert.equal(record.twitchMessageId, "tw-1");
    assert.equal(record.source, "twitch");
    assert.equal(record.user, "Hero420247");
  });

  it("enqueue remains functional when Forge bridge is disabled", async () => {
    const prevSock = process.env.VEIL_STREAM_BRIDGE_SOCKET;
    const prevTok = process.env.VEIL_STREAM_BRIDGE_TOKEN;
    const prevEn = process.env.VEIL_STREAM_BRIDGE_ENABLED;
    process.env.VEIL_STREAM_BRIDGE_ENABLED = "0";
    delete process.env.VEIL_STREAM_BRIDGE_SOCKET;
    delete process.env.VEIL_STREAM_BRIDGE_TOKEN;
    try {
      const { alert } = await enqueue({
        type: "follow",
        user: "OfflineForge",
        twitchMessageId: `off-${Date.now()}`,
      });
      assert.equal(alert.type, "follow");
      assert.equal(alert.user, "OfflineForge");
      // forge may be skipped/unavailable — alerts still queue
      assert.ok(alert.id);
    } finally {
      if (prevSock === undefined) delete process.env.VEIL_STREAM_BRIDGE_SOCKET;
      else process.env.VEIL_STREAM_BRIDGE_SOCKET = prevSock;
      if (prevTok === undefined) delete process.env.VEIL_STREAM_BRIDGE_TOKEN;
      else process.env.VEIL_STREAM_BRIDGE_TOKEN = prevTok;
      if (prevEn === undefined) delete process.env.VEIL_STREAM_BRIDGE_ENABLED;
      else process.env.VEIL_STREAM_BRIDGE_ENABLED = prevEn;
    }
  });
});

describe("forgeStreamBridge live round-trip (optional)", () => {
  it("pushes one follow through Forge when server is available", async (t) => {
    // Spawn Python StreamBridgeServer if veilforge is present.
    const veilforge = path.resolve(__dirname, "../../../veilforge");
    const py = path.join(veilforge, ".venv/bin/python");
    if (!fs.existsSync(py)) {
      t.skip("VeilForge venv not found — skip live IPC smoke");
      return;
    }

    const sock = path.join(os.tmpdir(), `vd-forge-bridge-${process.pid}.sock`);
    const token = `test-token-${process.pid}`;
    if (fs.existsSync(sock)) fs.unlinkSync(sock);

    const server = spawn(
      py,
      [
        "-c",
        `
from veil_agents.core.stream import StreamBridgeServer, StreamBridgeHandler
from pathlib import Path
import time
h = StreamBridgeHandler(auth_token=${JSON.stringify(token)}, require_auth=True)
s = StreamBridgeServer(socket_path=Path(${JSON.stringify(sock)}), handler=h)
s.start_background()
print("READY", flush=True)
while True:
    time.sleep(0.2)
`,
      ],
      {
        cwd: veilforge,
        env: { ...process.env, PYTHONPATH: path.join(veilforge, "src") },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("server_start_timeout")), 8000);
        server.stdout.on("data", (buf) => {
          if (String(buf).includes("READY")) {
            clearTimeout(timer);
            resolve();
          }
        });
        server.stderr.on("data", (buf) => {
          // keep for debug
          process.stderr.write(buf);
        });
        server.on("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`server_exited:${code}`));
        });
      });

      process.env.VEIL_STREAM_BRIDGE_SOCKET = sock;
      process.env.VEIL_STREAM_BRIDGE_TOKEN = token;
      process.env.VEIL_STREAM_BRIDGE_ENABLED = "1";

      const health = await bridge.health();
      assert.equal(health.ok, true);

      const { alert } = await enqueue({
        type: "follow",
        user: "Hero420247",
        source: "twitch",
        twitchMessageId: `live-${Date.now()}`,
      });
      assert.ok(alert.forge);
      assert.equal(alert.forge.status, "accepted");
      assert.ok(Array.isArray(alert.forge.overlayCommands));
      assert.equal(alert.forge.overlayCommands.length, 1);
      assert.ok(alert.forgeOverlay);
      // pending privileged actions must not auto-execute (empty for simple follow)
      assert.ok(Array.isArray(alert.forge.pendingActions));
    } finally {
      server.kill("SIGTERM");
      try {
        if (fs.existsSync(sock)) fs.unlinkSync(sock);
      } catch (_) {
        /* ignore */
      }
    }
  });
});
