const crypto = require("node:crypto");
const { WEEK_TIMEZONE, isoWeekChicago, parseIsoWeek, previousWeek } = require("../lib/intakeAttribution");
const { readWeekStats } = require("../lib/intakeStatsStore");
const { json, reportBackend } = require("../lib/reportsStore");

const MAX_WEEKS = 12;

function getBearerToken(req) {
  const header = (req.headers && req.headers.authorization) || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function tokenMatches(supplied, expected) {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;
  const url = new URL(req.url || "/", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

async function weekPayload(descriptor) {
  return {
    week: descriptor.week,
    weekStart: descriptor.weekStart,
    weekEnd: descriptor.weekEnd,
    ...(await readWeekStats(descriptor.week)),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    return json(res, 204, {});
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  res.setHeader("Cache-Control", "no-store");

  const expected = process.env.INTAKE_STATS_TOKEN || "";
  if (!expected) {
    return json(res, 503, { ok: false, error: "Stats token is not configured." });
  }

  if (!tokenMatches(getBearerToken(req), expected)) {
    return json(res, 401, { ok: false, error: "Stats token rejected." });
  }

  const query = readQuery(req);
  const descriptor = query.week ? parseIsoWeek(String(query.week)) : isoWeekChicago(new Date());
  if (!descriptor) {
    return json(res, 400, { ok: false, error: "week must look like 2026-W41." });
  }

  const common = {
    ok: true,
    timezone: WEEK_TIMEZONE,
    backend: reportBackend(),
    generatedAt: new Date().toISOString(),
  };

  try {
    if (query.weeks !== undefined) {
      const count = Number(query.weeks);
      if (!Number.isInteger(count) || count < 1 || count > MAX_WEEKS) {
        return json(res, 400, { ok: false, error: `weeks must be an integer from 1 to ${MAX_WEEKS}.` });
      }

      const descriptors = [descriptor];
      while (descriptors.length < count) {
        descriptors.push(previousWeek(descriptors[descriptors.length - 1].week));
      }

      const weeks = [];
      for (const entry of descriptors) {
        weeks.push(await weekPayload(entry));
      }
      return json(res, 200, { ...common, weeks });
    }

    return json(res, 200, { ...common, ...(await weekPayload(descriptor)) });
  } catch (error) {
    console.error(JSON.stringify({ marker: "VEILDAEMON_INTAKE_STATS_ERROR", error: error.message }));
    return json(res, 502, { ok: false, error: "Intake stats store unavailable." });
  }
};
