/*
 * RelayDaemon platform policy: the single source of truth for character-package generation limits.
 *
 * Both the local bridge (scripts/relay-local-bridge.mjs, which enforces `max` in structured-output
 * validation) and the browser (studio/relay/relay.js, which states the targets in its prompt) read this
 * map, so the limits the model is told and the limits the bridge enforces cannot drift apart.
 *
 * `max` is the generation hard maximum for the post body. For constrained platforms it sits below the
 * platform's real ceiling to leave room for hashtags (added outside the JSON). A draft over `max` is
 * invalid: it is rewritten by the model on the next attempt of the existing retry ladder, never clipped
 * or truncated.
 *
 * X is a long-form lane. The account is on X Premium (standing rule: cradlepoint-ttrpg
 * Marketing/Social/PUBLISHING_CONSTRAINTS.md — draft against the Premium allowance, not the free-tier
 * limit), and Premium longer posts allow 25,000 characters, of which the first 280 show in the timeline
 * before "Show more" (help.x.com "About different types of Posts"; @premium, 2024). X therefore gets the
 * full long copy when appropriate; there is no short-form target. The earlier 500/600 X numbers were a
 * stale free-tier assumption, not a platform limit.
 *
 * CA-001 (tests/fixtures/relay/ca-001.json) keeps its own, independent acceptance ceilings so the
 * acceptance gate can still catch drift in this policy.
 *
 * Plain script (no import/export): loaded by <script> in the browser and by `import` in Node, and
 * published as globalThis.RelayPlatformPolicy.
 */
(function (root) {
  const platforms = Object.freeze({
    // minMasterRatio: long-form X must not be compressed below this share of the writer's own master (relative,
    // never an absolute floor; a short master may have a short X). Writer-owned; enforced by the writer's ladder.
    x: Object.freeze({ label: "X", longForm: true, max: 25_000, timelinePreview: 280, minMasterRatio: 0.6 }),
    // floor is stub protection only (a runtime hard minimum), not a fill target; using the lane well is polish.
    // editTarget / maxSentences steer the editor model's word budget; `max` stays the runtime's authority.
    threads: Object.freeze({ label: "Threads", targetMin: 380, floor: 120, max: 400, editTarget: 380, maxSentences: 4 }),
    bluesky: Object.freeze({ label: "Bluesky", targetMin: 180, floor: 100, max: 200, editTarget: 190, maxSentences: 2 }),
    mastodon: Object.freeze({ label: "Mastodon", targetMin: 380, floor: 120, max: 400, editTarget: 380, maxSentences: 4 }),
  });

  function promptLines(indent = "  ") {
    return Object.values(platforms)
      .map((p) => p.longForm
        ? `${indent}- ${p.label} body: full long copy — carry the complete argument, as long as the master when appropriate; do not compress to a short post (hard max ${p.max.toLocaleString("en-US")}; the first ${p.timelinePreview} characters show before "Show more", so open with the hook)`
        : `${indent}- ${p.label} body: ~${p.targetMin}–${p.max} (hard max ${p.max})`)
      .join("\n");
  }

  root.RelayPlatformPolicy = Object.freeze({
    version: "2026-09-26-writer-editor-ruler",
    hashtagBufferChars: 100,
    platforms,
    promptLines,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
