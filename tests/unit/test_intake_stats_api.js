const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");

for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "INTAKE_STATS_TOKEN"]) {
  delete process.env[name];
}

const observe = require("../../api/observe");
const intakeStats = require("../../api/intake-stats");
const { isoWeekChicago } = require("../../lib/intakeAttribution");
const store = require("../../lib/intakeStatsStore");

function fakeRequest({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function fakeResponse() {
  const res = {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
    },
    end(chunk = "") {
      res.body = String(chunk);
    },
  };
  return res;
}

async function call(handler, options) {
  const res = fakeResponse();
  await handler(fakeRequest(options), res);
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : null };
}

function observePost(payload) {
  return call(observe, { method: "POST", url: "/api/observe", body: JSON.stringify(payload) });
}

const completion = {
  event: "intake_completed",
  primaryFrequency: "Dream",
  observerClassification: "POTENTIAL OPERATOR",
  utmSource: "bsky",
  utmMedium: "social",
  utmCampaign: "oct-drop",
  intakeRoute: "operator",
  reclassified: false,
};

test("observe counts completions and intake-stats returns aggregates only", async () => {
  store.resetMemoryStore();

  for (let index = 0; index < 3; index += 1) {
    assert.equal((await observePost(completion)).status, 200);
  }
  assert.equal((await observePost({ ...completion, observerClassification: "ROOT ACCESS", utmSource: "newsletter", primaryFrequency: "Static", intakeRoute: "vip", reclassified: "yes" })).status, 200);
  assert.equal((await observePost({ event: "intake_opened", utmSource: "bsky" })).status, 200);
  assert.equal((await observePost({ ...completion, reclassified: true, intakeRoute: "triage", observerClassification: "CLAIMED" })).status, 200);

  const week = isoWeekChicago(new Date()).week;
  const url = `/api/intake-stats?week=${week}`;

  assert.equal((await call(intakeStats, { url })).status, 503);

  process.env.INTAKE_STATS_TOKEN = "scorecard-token";
  try {
    assert.equal((await call(intakeStats, { url, headers: { authorization: "Bearer wrong" } })).status, 401);
    assert.equal((await call(intakeStats, { url })).status, 401);

    const auth = { authorization: "Bearer scorecard-token" };
    const response = await call(intakeStats, { url, headers: auth });
    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["access-control-allow-origin"], "*");

    const stats = response.json;
    assert.equal(stats.week, week);
    assert.equal(stats.timezone, "America/Chicago");
    assert.equal(stats.backend, "memory");
    assert.equal(stats.total, 5);
    assert.equal(stats.reclassified, 1);
    assert.deepEqual(stats.bySource, { bluesky: 4, x: 0, threads: 0, instagram: 0, facebook: 0, mastodon: 0, patreon: 0, youtube: 0, site: 1 });
    assert.deepEqual(stats.byRoute, { operator: 3, triage: 1 });
    assert.equal(stats.byClassification["POTENTIAL OPERATOR"], 3);
    assert.equal(stats.byClassification.CLAIMED, 1);
    assert.equal(stats.byClassification["ROOT ACCESS"], undefined);
    assert.equal(stats.byFrequency.Dream, 4);
    assert.deepEqual(stats.byMedium, { social: 5 });
    assert.deepEqual(stats.byCampaign, { "oct-drop": 5 });
    assert.deepEqual(stats.byContent, {});
    assert.equal(JSON.stringify(stats).includes("completedAt"), false);

    const otherWeek = await call(intakeStats, { url: "/api/intake-stats?week=2020-W01", headers: auth });
    assert.equal(otherWeek.json.total, 0);
    assert.equal(Object.keys(otherWeek.json.bySource).length, 9);

    const trailing = await call(intakeStats, { url: `${url}&weeks=3`, headers: auth });
    assert.equal(trailing.status, 200);
    assert.equal(trailing.json.weeks.length, 3);
    assert.equal(trailing.json.weeks[0].week, week);
    assert.equal(trailing.json.weeks[0].total, 5);
    assert.equal(trailing.json.weeks[1].total, 0);

    assert.equal((await call(intakeStats, { url: "/api/intake-stats?week=2026-41", headers: auth })).status, 400);
    assert.equal((await call(intakeStats, { url: `${url}&weeks=13`, headers: auth })).status, 400);
    assert.equal((await call(intakeStats, { url: "/api/intake-stats?week=2026-W41", headers: auth, method: "POST" })).status, 405);
  } finally {
    delete process.env.INTAKE_STATS_TOKEN;
  }
});

test("observe accepts text/plain beacons and answers CORS preflight", async () => {
  const preflight = await call(observe, { method: "OPTIONS", url: "/api/observe" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], "*");

  const statsPreflight = await call(intakeStats, { method: "OPTIONS", url: "/api/intake-stats" });
  assert.equal(statsPreflight.status, 204);

  const posted = await call(observe, {
    method: "POST",
    url: "/api/observe",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(completion),
  });
  assert.equal(posted.status, 200);
  assert.equal(posted.headers["access-control-allow-origin"], "*");

  assert.equal((await observePost({ event: "intake_deleted" })).status, 400);
});

test("upstash backend increments counters in one pipeline and parses HGETALL", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example/";
  process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token";
  global.fetch = async (url, init) => {
    const commands = JSON.parse(init.body);
    calls.push({ url, init, commands });
    const results = commands.map((command) =>
      command[0] === "HGETALL"
        ? { result: ["total", "7", "source:x", "2", "route:triage", "1", "campaign:oct-drop", "4"] }
        : { result: 1 },
    );
    return { ok: true, json: async () => results };
  };

  try {
    const receivedAt = new Date("2026-10-06T21:00:00Z");
    const { week } = await store.recordIntakeCompletion({ ...completion, utmSource: "twitter", reclassified: true }, receivedAt);
    assert.equal(week, "2026-W41");
    assert.equal(calls[0].url, "https://redis.example/pipeline");
    assert.equal(calls[0].init.headers.Authorization, "Bearer redis-token");

    const commands = calls[0].commands;
    const key = "veildaemon:intake-stats:v1:2026-W41";
    const incremented = commands.filter((command) => command[0] === "HINCRBY").map((command) => {
      assert.equal(command[1], key);
      return command[2];
    });
    assert.deepEqual(incremented.sort(), [
      "campaign:oct-drop",
      "class:POTENTIAL OPERATOR",
      "freq:Dream",
      "medium:social",
      "reclassified",
      "route:operator",
      "source:x",
      "total",
    ]);

    const pushed = commands.find((command) => command[0] === "LPUSH");
    assert.equal(pushed[1], "veildaemon:intake-completions:v1:2026-W41");
    assert.equal(JSON.parse(pushed[2]).source, "x");
    assert.deepEqual(commands.find((command) => command[0] === "LTRIM").slice(2), ["0", "4999"]);
    assert.equal(commands.filter((command) => command[0] === "EXPIRE").length, 2);

    const stats = await store.readWeekStats("2026-W41");
    assert.equal(stats.total, 7);
    assert.equal(stats.bySource.x, 2);
    assert.equal(stats.bySource.bluesky, 0);
    assert.equal(stats.byRoute.triage, 1);
    assert.deepEqual(stats.byCampaign, { "oct-drop": 4 });
  } finally {
    global.fetch = originalFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});

test("a store outage does not fail the observe beacon", async () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  const logged = [];
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token";
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  console.error = (line) => logged.push(line);

  try {
    assert.equal((await observePost(completion)).status, 200);
    assert.match(logged.join("\n"), /VEILDAEMON_INTAKE_STATS_ERROR/);
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});
