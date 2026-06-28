const { json } = require("../lib/alertQueue");

const routeEnv = {
  "operator-dream": "DISCORD_OPERATOR_DREAM_URL",
  "operator-silence": "DISCORD_OPERATOR_SILENCE_URL",
  "operator-hunger": "DISCORD_OPERATOR_HUNGER_URL",
  "operator-stillness": "DISCORD_OPERATOR_STILLNESS_URL",
  "operator-empyrean": "DISCORD_OPERATOR_EMPYREAN_URL",
  "operator-becoming": "DISCORD_OPERATOR_BECOMING_URL",
  "triage-dream": "DISCORD_TRIAGE_DREAM_URL",
  "triage-silence": "DISCORD_TRIAGE_SILENCE_URL",
  "triage-hunger": "DISCORD_TRIAGE_HUNGER_URL",
  "triage-stillness": "DISCORD_TRIAGE_STILLNESS_URL",
  "triage-empyrean": "DISCORD_TRIAGE_EMPYREAN_URL",
  "triage-becoming": "DISCORD_TRIAGE_BECOMING_URL",
  threadbreaker: "DISCORD_THREADBREAKER_URL",
};

function cleanRouteKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z-]/g, "").slice(0, 40);
}

function decodePart(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function decryptRouteValue(value) {
  if (!value.startsWith("vd1:")) return value;

  const secret = process.env.DISCORD_ROUTE_SECRET || "";
  if (!secret) return "";

  const [, ivPart, tagPart, dataPart] = value.split(":");
  if (!ivPart || !tagPart || !dataPart) return "";

  try {
    const crypto = require("crypto");
    const key = decodePart(secret);
    if (key.length !== 32) return "";

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, decodePart(ivPart));
    decipher.setAuthTag(decodePart(tagPart));
    return Buffer.concat([decipher.update(decodePart(dataPart)), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function routeTarget(key) {
  const envName = routeEnv[key];
  if (!envName) return "";
  const target = decryptRouteValue(process.env[envName] || "");
  if (/^https:\/\/discord\.gg\/[a-z0-9-]+$/i.test(target)) {
    return target;
  }

  return "";
}

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    return json(res, 204, {});
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const query = req.query || Object.fromEntries(new URL(req.url || "/", "https://veildaemon.app").searchParams);
  const key = cleanRouteKey(query.key);
  const target = routeTarget(key);

  if (!target) {
    return json(res, 404, {
      ok: false,
      error: "Route unavailable.",
    });
  }

  res.statusCode = 302;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", target);
  res.end();
};
