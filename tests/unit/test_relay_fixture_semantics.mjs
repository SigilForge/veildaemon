// CA-001's fixture-owned meaning check. The fixture declares what its source means (two halves); the production
// bridge never sees these groups, and the writer's own declared groups cannot make this check pass.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { hasExpression, missingSemanticGroups, validateSemanticGroups } from "../../scripts/lib/relay-fixture-semantics.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/relay/ca-001.json", import.meta.url), "utf8"));
const groups = fixture.semanticGroups;

test("CA-001 declares two non-empty, disjoint halves", () => {
  assert.deepEqual(Object.keys(groups), ["whatChanges", "whyItMatters"]);
  assert.equal(validateSemanticGroups(groups), null);
  assert.match(validateSemanticGroups({ a: { expressions: ["trust"] }, b: { expressions: ["Trust"] } }), /appears in both/);
});

test("a lane carrying only the trust half fails", () => {
  const trustOnly = "The host stopped acting as a steward. Resource extraction now outranks the trust it once earned.";
  assert.deepEqual(missingSemanticGroups(trustOnly, groups), ["whatChanges"]);
});

test("a lane carrying only the ownership half fails", () => {
  const ownershipOnly = "Ownership is being replaced by revocable licenses, and physical media is disappearing from the shelves.";
  assert.deepEqual(missingSemanticGroups(ownershipOnly, groups), ["whyItMatters"]);
});

test("approved equivalents satisfy each half without the historical token", () => {
  // No "ownership", "own", or "trust" anywhere; the same meaning in fixture-approved terms.
  const equivalent = "What you bought is now a revocable grant you merely borrowed, and the stewardship that earned your loyalty has become extraction.";
  assert.ok(!/\bownership\b|\bown\b|\btrust\b/i.test(equivalent));
  assert.deepEqual(missingSemanticGroups(equivalent, groups), []);
});

test("writer-declared groups cannot make CA-001 pass when the fixture meaning is absent", () => {
  // Run 23's shape: the writer filed "false steward", "recurring revenue", and "system collapse" as its halves.
  // A lane built from those keys carries the trust side only; the fixture still requires the ownership change.
  const writerKeysOnly = "The false steward chases recurring revenue while the whole system slides toward collapse.";
  assert.deepEqual(missingSemanticGroups(writerKeysOnly, groups), ["whatChanges"]);
  const writerWeakKeys = "Recurring revenue and system collapse.";
  assert.deepEqual(missingSemanticGroups(writerWeakKeys, groups), ["whatChanges", "whyItMatters"]);
});

test("whole words only: the old substring false-passes are gone", () => {
  // "own" used to match inside these words; "control" inside "remote-controlled" is still a real word boundary.
  for (const word of ["down", "known", "shown", "town", "crown"]) assert.equal(hasExpression(`It went ${word} fast.`, "own"), false, word);
  assert.equal(hasExpression("Players own nothing now.", "own"), true);
  assert.equal(hasExpression("It was trust-based.", "trust"), true, "punctuation is a word boundary");
});
