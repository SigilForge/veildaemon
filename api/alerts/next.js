const { dequeue, json } = require("../_alertQueue");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const count = req.query && req.query.count ? req.query.count : 1;
    const alerts = await dequeue(count);
    return json(res, 200, { ok: true, alerts });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
};
