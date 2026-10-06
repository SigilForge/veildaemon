const { redisEnv, reportBackend } = require("./reportsStore");
const { INTAKE_SOURCES, cleanUtmTag, isoWeekChicago, normalizeUtmSource } = require("./intakeAttribution");

const STATS_KEY_PREFIX = "veildaemon:intake-stats:v1:";
const COMPLETIONS_KEY_PREFIX = "veildaemon:intake-completions:v1:";
const MAX_COMPLETIONS_PER_WEEK = 5000;
const KEY_TTL_SECONDS = 400 * 24 * 60 * 60;

const CLASSIFICATIONS = [
  "POTENTIAL OPERATOR",
  "OBSERVER",
  "CIVILIAN SIGNAL",
  "UNAUTHORIZED BUT USEFUL",
  "MISROUTED ASSET",
  "CLAIMED",
];
const FREQUENCIES = ["Dream", "Silence", "Hunger", "Stillness", "Empyrean", "Becoming"];
const INTAKE_ROUTES = ["operator", "triage"];

const memoryStats = new Map();
const memoryCompletions = new Map();

function oneOf(value, allowed) {
  return allowed.includes(value) ? value : "";
}

// Server-side re-normalization: the client payload is untrusted, so every
// field is mapped back onto a known enum or a cleaned tag before counting.
function completionRecord(payload, receivedAt) {
  return {
    completedAt: receivedAt.toISOString(),
    source: normalizeUtmSource(payload.utmSource),
    medium: cleanUtmTag(payload.utmMedium),
    campaign: cleanUtmTag(payload.utmCampaign),
    content: cleanUtmTag(payload.utmContent),
    classification: oneOf(payload.observerClassification, CLASSIFICATIONS),
    frequency: oneOf(payload.primaryFrequency, FREQUENCIES),
    intakeRoute: oneOf(payload.intakeRoute, INTAKE_ROUTES),
    reclassified: payload.reclassified === true,
  };
}

function counterFields(record) {
  const fields = ["total", `source:${record.source}`];
  if (record.reclassified) fields.push("reclassified");
  if (record.intakeRoute) fields.push(`route:${record.intakeRoute}`);
  if (record.classification) fields.push(`class:${record.classification}`);
  if (record.frequency) fields.push(`freq:${record.frequency}`);
  if (record.medium) fields.push(`medium:${record.medium}`);
  if (record.campaign) fields.push(`campaign:${record.campaign}`);
  if (record.content) fields.push(`content:${record.content}`);
  return fields;
}

async function redisPipeline(commands) {
  const { url, token } = redisEnv();
  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`Intake stats command failed with ${response.status}`);
  }

  const results = await response.json();
  const failed = Array.isArray(results) ? results.find((entry) => entry && entry.error) : null;
  if (failed) {
    throw new Error(`Intake stats command failed: ${failed.error}`);
  }

  return results.map((entry) => entry.result);
}

async function recordIntakeCompletion(payload, receivedAt = new Date()) {
  const { week } = isoWeekChicago(receivedAt);
  const record = completionRecord(payload || {}, receivedAt);
  const fields = counterFields(record);

  if (reportBackend() === "upstash") {
    const statsKey = `${STATS_KEY_PREFIX}${week}`;
    const completionsKey = `${COMPLETIONS_KEY_PREFIX}${week}`;
    await redisPipeline([
      ...fields.map((field) => ["HINCRBY", statsKey, field, "1"]),
      ["LPUSH", completionsKey, JSON.stringify(record)],
      ["LTRIM", completionsKey, "0", String(MAX_COMPLETIONS_PER_WEEK - 1)],
      ["EXPIRE", statsKey, String(KEY_TTL_SECONDS)],
      ["EXPIRE", completionsKey, String(KEY_TTL_SECONDS)],
    ]);
  } else {
    const counters = memoryStats.get(week) || {};
    fields.forEach((field) => {
      counters[field] = (counters[field] || 0) + 1;
    });
    memoryStats.set(week, counters);

    const completions = memoryCompletions.get(week) || [];
    completions.unshift(record);
    memoryCompletions.set(week, completions.slice(0, MAX_COMPLETIONS_PER_WEEK));
  }

  return { week, record };
}

async function readWeekCounters(week) {
  if (reportBackend() === "upstash") {
    const [flat] = await redisPipeline([["HGETALL", `${STATS_KEY_PREFIX}${week}`]]);
    const counters = {};
    for (let index = 0; Array.isArray(flat) && index < flat.length; index += 2) {
      counters[flat[index]] = Number(flat[index + 1]) || 0;
    }
    return counters;
  }

  return { ...(memoryStats.get(week) || {}) };
}

function prefixed(counters, prefix, seedKeys = []) {
  const result = {};
  seedKeys.forEach((key) => {
    result[key] = 0;
  });
  Object.keys(counters).forEach((field) => {
    if (field.startsWith(prefix)) {
      result[field.slice(prefix.length)] = counters[field];
    }
  });
  return result;
}

// Aggregate-only view of one week. Per-completion records are never returned.
async function readWeekStats(week) {
  const counters = await readWeekCounters(week);
  return {
    total: counters.total || 0,
    reclassified: counters.reclassified || 0,
    bySource: prefixed(counters, "source:", INTAKE_SOURCES),
    byRoute: prefixed(counters, "route:", INTAKE_ROUTES),
    byClassification: prefixed(counters, "class:", CLASSIFICATIONS),
    byFrequency: prefixed(counters, "freq:", FREQUENCIES),
    byMedium: prefixed(counters, "medium:"),
    byCampaign: prefixed(counters, "campaign:"),
    byContent: prefixed(counters, "content:"),
  };
}

function resetMemoryStore() {
  memoryStats.clear();
  memoryCompletions.clear();
}

module.exports = {
  CLASSIFICATIONS,
  FREQUENCIES,
  INTAKE_ROUTES,
  readWeekStats,
  recordIntakeCompletion,
  resetMemoryStore,
};
