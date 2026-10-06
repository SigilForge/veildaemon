const assert = require("node:assert/strict");
const test = require("node:test");

const {
  INTAKE_SOURCES,
  cleanUtmTag,
  isoWeekChicago,
  normalizeUtmSource,
  parseIsoWeek,
  previousWeek,
} = require("../../lib/intakeAttribution");

test("utm_source aliases normalize onto the nine scorecard sources", () => {
  const cases = {
    Twitter: "x",
    "t.co": "x",
    "x.com": "x",
    "bsky.app": "bluesky",
    "www.bsky.app": "bluesky",
    "@Threads": "threads",
    "threads.net": "threads",
    IG: "instagram",
    "l.instagram.com": "instagram",
    fb: "facebook",
    "m.facebook.com": "facebook",
    mstdn: "mastodon",
    "patreon.com": "patreon",
    YouTube: "youtube",
    "youtu.be": "youtube",
    "": "site",
    newsletter: "site",
    "<script>": "site",
  };

  for (const [raw, expected] of Object.entries(cases)) {
    assert.equal(normalizeUtmSource(raw), expected, raw);
  }
  assert.equal(normalizeUtmSource(undefined), "site");
  assert.equal(normalizeUtmSource(42), "site");
  assert.deepEqual(INTAKE_SOURCES, ["bluesky", "x", "threads", "instagram", "facebook", "mastodon", "patreon", "youtube", "site"]);
});

test("utm tag cleaner keeps short slug tags and drops everything else", () => {
  assert.equal(cleanUtmTag("Oct-Drop"), "oct-drop");
  assert.equal(cleanUtmTag(" social "), "social");
  assert.equal(cleanUtmTag("v1.2_final"), "v1.2_final");
  assert.equal(cleanUtmTag("<script>alert(1)</script>"), "");
  assert.equal(cleanUtmTag("has space"), "");
  assert.equal(cleanUtmTag("a".repeat(40)), "a".repeat(40));
  assert.equal(cleanUtmTag("a".repeat(41)), "");
  assert.equal(cleanUtmTag(null), "");
});

test("weeks roll over at Monday 00:00 America/Chicago", () => {
  // Sunday 2026-10-04 23:59:59 CDT is still W40.
  assert.equal(isoWeekChicago(new Date("2026-10-05T04:59:59Z")).week, "2026-W40");
  assert.deepEqual(isoWeekChicago(new Date("2026-10-05T05:00:00Z")), {
    week: "2026-W41",
    weekStart: "2026-10-05",
    weekEnd: "2026-10-11",
  });
});

test("week boundary follows the DST change", () => {
  // DST ends 2026-11-01; Sunday 23:59 CST is 05:59Z on Monday.
  assert.equal(isoWeekChicago(new Date("2026-11-02T05:59:00Z")).week, "2026-W44");
  assert.equal(isoWeekChicago(new Date("2026-11-02T06:00:00Z")).week, "2026-W45");
});

test("ISO year edges", () => {
  assert.equal(isoWeekChicago(new Date("2026-12-31T18:00:00Z")).week, "2026-W53");
  assert.equal(isoWeekChicago(new Date("2027-01-04T06:00:00Z")).week, "2027-W01");
  assert.equal(isoWeekChicago(new Date("2027-01-04T05:59:00Z")).week, "2026-W53");
});

test("parseIsoWeek validates labels", () => {
  assert.deepEqual(parseIsoWeek("2026-W41"), { week: "2026-W41", weekStart: "2026-10-05", weekEnd: "2026-10-11" });
  assert.equal(parseIsoWeek("2026-W53").weekStart, "2026-12-28");
  assert.equal(parseIsoWeek("2027-W53"), null);
  assert.equal(parseIsoWeek("2026-W54"), null);
  assert.equal(parseIsoWeek("2026-W00"), null);
  assert.equal(parseIsoWeek("2026-41"), null);
  assert.equal(parseIsoWeek(undefined), null);
});

test("previousWeek walks back across the year edge", () => {
  assert.equal(previousWeek("2026-W41").week, "2026-W40");
  assert.equal(previousWeek("2027-W01").week, "2026-W53");
});
