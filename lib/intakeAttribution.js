// Shared intake attribution helpers. Loaded as a plain script on the static
// site (window.VeilAttribution) and required by the root API and unit tests,
// so the browser and server normalize UTM tags and weeks identically.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.VeilAttribution = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const INTAKE_SOURCES = ["bluesky", "x", "threads", "instagram", "facebook", "mastodon", "patreon", "youtube", "site"];
  const WEEK_TIMEZONE = "America/Chicago";
  const WEEK_PATTERN = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/;

  const sourceAliases = {
    bluesky: ["bluesky", "bsky", "bsky.app", "bsky.social"],
    x: ["x", "twitter", "x.com", "twitter.com", "t.co"],
    threads: ["threads", "threads.net", "threads.com"],
    instagram: ["instagram", "ig", "insta", "l.instagram.com"],
    facebook: ["facebook", "fb", "m.facebook.com", "l.facebook.com", "meta"],
    mastodon: ["mastodon", "masto", "mstdn", "fediverse"],
    patreon: ["patreon"],
    youtube: ["youtube", "yt", "youtu.be"],
  };

  const aliasLookup = {};
  Object.keys(sourceAliases).forEach((source) => {
    sourceAliases[source].forEach((alias) => {
      aliasLookup[alias] = source;
    });
  });

  function normalizeUtmSource(raw) {
    if (typeof raw !== "string") return "site";
    const clean = raw.trim().toLowerCase().replace(/^@/, "").replace(/^www\./, "");
    if (!clean) return "site";
    if (aliasLookup[clean]) return aliasLookup[clean];

    const stripped = clean.replace(/\.(com|app|net|social)$/, "");
    return aliasLookup[stripped] || "site";
  }

  function cleanUtmTag(raw) {
    if (typeof raw !== "string") return "";
    const clean = raw.trim().toLowerCase();
    if (!clean || clean.length > 40 || !/^[a-z0-9._-]+$/.test(clean)) return "";
    return clean;
  }

  function utcDate(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day));
  }

  function ymd(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
  }

  function chicagoCalendarDate(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: WEEK_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = (type) => Number(parts.find((part) => part.type === type).value);
    return utcDate(value("year"), value("month"), value("day"));
  }

  function isoWeekParts(calendarDate) {
    const isoDay = calendarDate.getUTCDay() || 7;
    const thursday = addDays(calendarDate, 4 - isoDay);
    const isoYear = thursday.getUTCFullYear();
    const yearStart = utcDate(isoYear, 1, 1);
    const week = Math.floor((thursday - yearStart) / 86400000 / 7) + 1;
    return { isoYear, week };
  }

  function weekStartFor(isoYear, week) {
    const jan4 = utcDate(isoYear, 1, 4);
    const mondayOfWeekOne = addDays(jan4, 1 - (jan4.getUTCDay() || 7));
    return addDays(mondayOfWeekOne, (week - 1) * 7);
  }

  function describeWeek(isoYear, week) {
    const start = weekStartFor(isoYear, week);
    return {
      week: `${isoYear}-W${String(week).padStart(2, "0")}`,
      weekStart: ymd(start),
      weekEnd: ymd(addDays(start, 6)),
    };
  }

  // ISO week (Mon–Sun) that `date` falls in, using America/Chicago calendar days.
  function isoWeekChicago(date = new Date()) {
    const { isoYear, week } = isoWeekParts(chicagoCalendarDate(date));
    return describeWeek(isoYear, week);
  }

  // Returns the week descriptor for a "YYYY-Www" label, or null when invalid
  // (including W53 in a year that only has 52 ISO weeks).
  function parseIsoWeek(label) {
    if (typeof label !== "string") return null;
    const match = label.trim().match(WEEK_PATTERN);
    if (!match) return null;
    const isoYear = Number(match[1]);
    const week = Number(match[2]);
    const start = weekStartFor(isoYear, week);
    const check = isoWeekParts(start);
    if (check.isoYear !== isoYear || check.week !== week) return null;
    return describeWeek(isoYear, week);
  }

  function previousWeek(label) {
    const parsed = parseIsoWeek(label);
    if (!parsed) return null;
    const { isoYear, week } = isoWeekParts(addDays(new Date(`${parsed.weekStart}T00:00:00Z`), -7));
    return describeWeek(isoYear, week);
  }

  return {
    INTAKE_SOURCES,
    WEEK_TIMEZONE,
    cleanUtmTag,
    isoWeekChicago,
    normalizeUtmSource,
    parseIsoWeek,
    previousWeek,
  };
});
