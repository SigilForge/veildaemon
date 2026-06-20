const {
  createReport,
  json,
  readBody,
  readReports,
  reportBackend,
  writeReports,
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
    const reports = await readReports();
    const report = createReport(input, reports);
    report.publicDraft = { ...report.publicDraft, reportId: report.id };
    reports.unshift(report);
    await writeReports(reports);

    console.log(JSON.stringify({
      marker: "VEILCORP_AFTER_ACTION_REPORT",
      id: report.id,
      receivedAt: report.createdAt,
      consentPublic: report.consentPublic,
      backend: reportBackend(),
    }));

    return json(res, 200, {
      ok: true,
      id: report.id,
      status: report.status,
      consentPublic: report.consentPublic,
      publicDraftApproved: report.publicDraftApproved,
    });
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message });
  }
};
