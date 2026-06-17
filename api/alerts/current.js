const { currentAlert, json } = require("../_alertQueue");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const result = await currentAlert({
      holdMs: req.query && req.query.holdMs,
    });
    return json(res, 200, {
      ok: true,
      alert: result.alert,
      currentId: result.currentId,
      expiresAt: result.expiresAt,
      promoted: result.promoted,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
};
