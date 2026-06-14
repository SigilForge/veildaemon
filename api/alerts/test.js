const { enqueue, json, readBody, requireAdmin } = require("../_alertQueue");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  if (!requireAdmin(req, res)) return undefined;

  try {
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const result = await enqueue(payload);
    return json(res, 200, {
      ok: true,
      pushed: true,
      alert: result.alert,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message });
  }
};
