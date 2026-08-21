const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildRemoteTurnEnvelope, messagesToUserInput, parseCharacterResult } = require("../../lib/veilforgeRemoteTurn");

describe("VeilForge remote_turn adapter (PR #23)", () => {
  it("builds the Stage 6A envelope without a caller-selected profile", () => {
    const envelope = buildRemoteTurnEnvelope({
      userInput: "hello from phone",
      sessionId: "11111111-1111-4111-8111-111111111111",
      deviceId: "phone-primary",
      mode: "chat",
      requestId: "remote-turn-fixed",
      metadata: {
        source: "veildaemon-relay",
        workspace: "/should/not/be/trusted",
        profile_name: "dev",
        allowed_tools: ["shell"],
      },
    });
    assert.equal(envelope.type, "remote_turn");
    assert.equal(envelope.remote_turn.schema_version, 1);
    assert.equal(envelope.remote_turn.session_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(envelope.remote_turn.device_id, "phone-primary");
    assert.equal(envelope.remote_turn.mode, "chat");
    assert.equal(envelope.remote_turn.user_input, "hello from phone");
    assert.equal(Object.prototype.hasOwnProperty.call(envelope, "profile_name"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(envelope.remote_turn, "profile_name"), false);
    assert.equal(JSON.stringify(envelope).includes("profile_name"), false);
    assert.equal(JSON.stringify(envelope).includes("allowed_tools"), false);
    assert.equal(envelope.remote_turn.metadata.workspace, undefined);
    assert.equal(envelope.remote_turn.metadata.source, "veildaemon-relay");
  });

  it("rejects unknown modes and empty input", () => {
    assert.throws(() => buildRemoteTurnEnvelope({
      userInput: "hi",
      sessionId: "11111111-1111-4111-8111-111111111111",
      deviceId: "home-primary",
      mode: "shell",
    }), /mode_invalid/);
    assert.throws(() => buildRemoteTurnEnvelope({
      userInput: "   ",
      sessionId: "11111111-1111-4111-8111-111111111111",
      deviceId: "home-primary",
    }), /user_input_required/);
  });

  it("turns Relay messages into a single user_input and parses character JSON from response_text", () => {
    const input = messagesToUserInput([
      { role: "system", content: "Return JSON." },
      { role: "user", content: "Write the package." },
    ]);
    assert.match(input, /system: Return JSON/);
    assert.match(input, /user: Write the package/);
    const parsed = parseCharacterResult({
      ok: true,
      response_text: JSON.stringify({
        masterDraft: "They replaced ownership with a license and emptied the shelf. Legal extraction still spends trust.",
        platformDrafts: {
          x: "Ownership became a license and the shelf went empty. Legal extraction still spends trust.",
          threads: "Ownership became a license and the shelf went empty. Legal extraction still spends trust.",
          bluesky: "Ownership is a license now. The shelf is empty. Legal extraction still spends trust.",
          mastodon: "Ownership became a license and physical media left the shelf. Legal extraction still spends the trust it cannot repay.",
        },
        validation: {
          voiceMatch: 0.9,
          sourceFidelity: 0.9,
          canonSafe: true,
          knowledgeBoundarySafe: true,
          characterMarkers: [],
          warnings: [],
        },
      }),
    });
    assert.equal(typeof parsed.masterDraft, "string");
    assert.equal(parsed.platformDrafts.bluesky.includes("license"), true);
  });
});
