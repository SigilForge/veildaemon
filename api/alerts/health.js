const { json, queueDiagnostics } = require("../_alertQueue");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    return json(res, 200, {
      ok: true,
      service: "alerts",
      diagnostics: await queueDiagnostics(),
    });
  } catch (error) {
    return json(res, 500, { ok: false, service: "alerts", error: error.message });
  }
};
