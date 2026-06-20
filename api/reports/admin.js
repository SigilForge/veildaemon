const {
  generatePublicDraft,
  json,
  readBody,
  readReports,
  requireReportAdmin,
  sanitizePublicDraft,
  writeReports,
} = require("../_reportsStore");

function adminReport(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt || "",
    status: record.status,
    role: record.role,
    needlepoint: record.needlepoint,
    playerCount: record.playerCount,
    bestMoment: record.bestMoment,
    confusingRule: record.confusingRule,
    improve: record.improve,
    fullFeedback: record.fullFeedback,
    handle: record.handle,
    email: record.email,
    consentPublic: record.consentPublic,
    publicDraftApproved: Boolean(record.publicDraftApproved),
    submitterApprovedDraft: record.submitterApprovedDraft || null,
    publicDraft: record.publicDraft || generatePublicDraft(record),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, PATCH, OPTIONS");
    return json(res, 204, {});
  }

  if (!requireReportAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const reports = await readReports();
      res.setHeader("Cache-Control", "no-store");
      return json(res, 200, {
        ok: true,
        reports: reports.map(adminReport),
      });
    }

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "GET, PATCH");
      return json(res, 405, { ok: false, error: "Method not allowed." });
    }

    const rawBody = await readBody(req);
    const input = rawBody ? JSON.parse(rawBody) : {};
    const reports = await readReports();
    const index = reports.findIndex((report) => report.id === input.id);

    if (index < 0) {
      return json(res, 404, { ok: false, error: "Report not found." });
    }

    const record = reports[index];
    if (input.action === "draft") {
      record.publicDraft = sanitizePublicDraft(input.publicDraft, record);
      record.updatedAt = new Date().toISOString();
    } else if (input.action === "approve") {
      if (!record.consentPublic || !record.publicDraftApproved) {
        return json(res, 409, {
          ok: false,
          error: "Submitter redaction approval was not granted for this report.",
        });
      }

      record.publicDraft = sanitizePublicDraft(input.publicDraft || record.publicDraft, record);
      record.status = "approved";
      record.publishedAt = new Date().toISOString();
      record.updatedAt = record.publishedAt;
    } else if (input.action === "reject") {
      record.status = "rejected";
      record.updatedAt = new Date().toISOString();
    } else if (input.action === "review") {
      record.status = "under_review";
      record.updatedAt = new Date().toISOString();
    } else {
      return json(res, 400, { ok: false, error: "Unknown report action." });
    }

    reports[index] = record;
    await writeReports(reports);
    return json(res, 200, { ok: true, report: adminReport(record) });
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message });
  }
};
