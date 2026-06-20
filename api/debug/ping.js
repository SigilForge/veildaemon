const { json } = require("../../lib/alertQueue");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  return json(res, 200, {
    ok: true,
    marker: "PRIMAL_GLASS_TAP",
    time: new Date().toISOString(),
  });
};
