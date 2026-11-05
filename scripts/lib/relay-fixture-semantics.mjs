// Fixture-owned semantic checks for Relay acceptance. A fixture may declare what its own source means; the
// production bridge never sees these groups. Matching is by explicit whole words or phrases on normalized text:
// no hidden stemming and no substrings ("own" does not match "down"), so the test author can audit exactly
// what counts as carrying each half.

export const normalize = (text) => ` ${String(text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/** True when the normalized text contains the expression as whole words. */
export const hasExpression = (text, expression) => normalize(text).includes(normalize(expression));

/** Names of the fixture's semantic groups that the text does not carry. */
export function missingSemanticGroups(text, groups) {
  return Object.entries(groups).filter(([, group]) => !group.expressions.some((expression) => hasExpression(text, expression))).map(([name]) => name);
}

/** Fixture sanity: every group non-empty, and the groups disjoint so one word never satisfies both halves. */
export function validateSemanticGroups(groups) {
  const names = Object.keys(groups || {});
  if (names.length < 2) return "semanticGroups must declare at least two halves";
  for (const name of names) if (!Array.isArray(groups[name].expressions) || !groups[name].expressions.length) return `semanticGroups.${name} has no expressions`;
  const seen = new Map();
  for (const name of names) {
    for (const expression of groups[name].expressions) {
      const key = normalize(expression);
      if (seen.has(key) && seen.get(key) !== name) return `"${expression}" appears in both ${seen.get(key)} and ${name}`;
      seen.set(key, name);
    }
  }
  return null;
}
