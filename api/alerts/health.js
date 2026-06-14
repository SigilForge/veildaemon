const { json, queueDiagnostics } = require("../_alertQueue");

function matchingEnvKeys() {
  return Object.keys(process.env)
    .filter((key) => /(UPSTASH|REDIS|KV|ALERT|TWITCH)/i.test(key))
    .sort();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    return json(res, 200, {
      ok: true,
      service: "alerts",
      runtime: {
        nodeEnv: process.env.NODE_ENV || "",
        vercelEnv: process.env.VERCEL_ENV || "",
      },
      detectedEnvKeys: matchingEnvKeys(),
      diagnostics: await queueDiagnostics(),
    });
  } catch (error) {
    return json(res, 500, { ok: false, service: "alerts", error: error.message });
  }
};
