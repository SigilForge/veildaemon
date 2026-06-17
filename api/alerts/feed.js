const { json, recentAlerts } = require("../_alertQueue");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const result = await recentAlerts({
      count: req.query && req.query.count,
      since: req.query && req.query.since,
    });
    return json(res, 200, {
      ok: true,
      alerts: result.alerts,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
};
