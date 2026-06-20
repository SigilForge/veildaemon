const {
  buildStats,
  createReport,
  generatePublicDraft,
  json,
  publicReport,
  readBody,
  readReports,
  reportBackend,
  requireReportAdmin,
  sanitizePublicDraft,
  writeReports,
} = require("../../lib/reportsStore");

function routeAction(req) {
  if (req.query && typeof req.query.action === "string") {
    return req.query.action;
  }

  const path = String(req.url || "").split("?")[0];
  return path.split("/").filter(Boolean).pop() || "";
}

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

async function handlePreview(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const rawBody = await readBody(req);
  const input = rawBody ? JSON.parse(rawBody) : {};
  const report = createReport(input, []);
  const publicDraft = sanitizePublicDraft(report.publicDraft, report);
  return json(res, 200, { ok: true, publicDraft });
}

async function handleSubmit(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

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
}

async function handlePublic(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

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
}

async function handleAdmin(req, res) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  if (!requireReportAdmin(req, res)) return undefined;

  if (req.method === "GET") {
    const reports = await readReports();
    res.setHeader("Cache-Control", "no-store");
    return json(res, 200, {
      ok: true,
      reports: reports.map(adminReport),
    });
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
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, PATCH, OPTIONS");
    return json(res, 204, {});
  }

  try {
    const action = routeAction(req);
    if (action === "preview") return await handlePreview(req, res);
    if (action === "submit") return await handleSubmit(req, res);
    if (action === "public") return await handlePublic(req, res);
    if (action === "admin") return await handleAdmin(req, res);

    return json(res, 404, { ok: false, error: "Report route not found." });
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message });
  }
};
