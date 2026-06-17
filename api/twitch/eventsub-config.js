const { json, requireAdmin } = require("../_alertQueue");

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function eventsubDiagnostics() {
  const callback = process.env.TWITCH_EVENTSUB_CALLBACK || "";
  const secret = process.env.TWITCH_EVENTSUB_SECRET || "";

  return {
    callbackPresent: Boolean(callback),
    callbackLooksLikeUrl: looksLikeUrl(callback),
    secretPresent: Boolean(secret),
    secretLooksLikeUrl: looksLikeUrl(secret),
    secretLength: secret.length,
  };
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  if (!requireAdmin(req, res)) return undefined;

  return json(res, 200, {
    ok: true,
    service: "twitch-eventsub-config",
    diagnostics: eventsubDiagnostics(),
  });
};
