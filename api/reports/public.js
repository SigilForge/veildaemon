const {
  buildStats,
  json,
  publicReport,
  readReports,
} = require("../_reportsStore");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const reports = await readReports();
    const publicReports = reports
      .filter((report) => report.status === "approved" && report.consentPublic && report.publicDraftApproved)
      .map(publicReport)
      .sort((first, second) => Date.parse(second.publishedAt || "") - Date.parse(first.publishedAt || ""));

    res.setHeader("Cache-Control", "public, max-age=60");
    return json(res, 200, {
      ok: true,
      stats: buildStats(reports),
      reports: publicReports,
    });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
};
