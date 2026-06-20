const {
  createReport,
  json,
  readBody,
  sanitizePublicDraft,
} = require("../_reportsStore");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const rawBody = await readBody(req);
    const input = rawBody ? JSON.parse(rawBody) : {};
    const report = createReport(input, []);
    const publicDraft = sanitizePublicDraft(report.publicDraft, report);
    return json(res, 200, { ok: true, publicDraft });
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message });
  }
};
