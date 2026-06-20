const memoryReports = [];
const REPORTS_KEY = "veildaemon:after-action-reports";
const MAX_REPORTS = 500;

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Report payload exceeds intake limit."));
        req.destroy();
        return;
      }

      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function requireReportAdmin(req, res) {
  const expected = process.env.REPORT_ADMIN_TOKEN || process.env.ALERT_ADMIN_TOKEN;
  if (!expected) {
    json(res, 503, { ok: false, error: "Report admin token is not configured." });
    return false;
  }

  const supplied = getBearerToken(req) || req.headers["x-report-admin-token"];
  if (supplied !== expected) {
    json(res, 401, { ok: false, error: "Report admin token rejected." });
    return false;
  }

  return true;
}

function redisEnv() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  return {
    url: upstashUrl || kvUrl || "",
    token: upstashToken || kvToken || "",
  };
}

function reportBackend() {
  const redis = redisEnv();
  return redis.url && redis.token ? "upstash" : "memory";
}

async function redisCommand(command) {
  const { url, token } = redisEnv();
  if (!url || !token) return null;

  const response = await fetch(`${url.replace(/\/$/, "")}/${command.map(encodeURIComponent).join("/")}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Report store command failed with ${response.status}`);
  }

  const payload = await response.json();
  return payload.result;
}

async function readReports() {
  if (reportBackend() === "upstash") {
    const stored = await redisCommand(["GET", REPORTS_KEY]);
    return stored ? JSON.parse(stored) : [];
  }

  return memoryReports;
}

async function writeReports(reports) {
  const nextReports = reports.slice(0, MAX_REPORTS);
  if (reportBackend() === "upstash") {
    await redisCommand(["SET", REPORTS_KEY, JSON.stringify(nextReports)]);
    return;
  }

  memoryReports.splice(0, memoryReports.length, ...nextReports);
}

function safeString(value, maxLength = 1000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function safeChoice(value, allowed, fallback = "") {
  const clean = safeString(value, 60).toLowerCase();
  return allowed.includes(clean) ? clean : fallback;
}

function safeCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return "";
  return String(Math.max(1, Math.min(Math.round(count), 12)));
}

function normalizeNeedlepoint(value) {
  const clean = safeString(value, 80);
  return clean || "Unspecified";
}

function makeReportId(existing) {
  const nextNumber = existing.length + 1;
  return `013F-${String(nextNumber).padStart(3, "0")}`;
}

function createReport(input, existing) {
  const body = input && typeof input === "object" ? input : {};
  const role = safeChoice(body.role, ["read", "played", "gmd"], "read");
  const publicDraft = sanitizePublicDraft(body.publicDraft, {
    role,
    needlepoint: normalizeNeedlepoint(body.needlepoint),
    playerCount: safeCount(body.playerCount),
    bestMoment: safeString(body.bestMoment, 1200),
    confusingRule: safeString(body.confusingRule, 1200),
    improve: safeString(body.improve, 1200),
    fullFeedback: safeString(body.fullFeedback, 5000),
  });
  const publicDraftApproved = Boolean(body.publicDraftApproved);
  const consentPublic = Boolean(body.consentPublic) && publicDraftApproved;
  const now = new Date().toISOString();

  return {
    id: makeReportId(existing),
    createdAt: now,
    updatedAt: now,
    status: "under_review",
    role,
    needlepoint: normalizeNeedlepoint(body.needlepoint),
    playerCount: safeCount(body.playerCount),
    bestMoment: safeString(body.bestMoment, 1200),
    confusingRule: safeString(body.confusingRule, 1200),
    improve: safeString(body.improve, 1200),
    fullFeedback: safeString(body.fullFeedback, 5000),
    handle: safeString(body.handle, 120),
    email: safeString(body.email, 180),
    consentPublic,
    publicDraftApproved,
    submitterApprovedDraft: publicDraftApproved ? publicDraft : null,
    publicDraft,
  };
}

function redactSensitiveText(text) {
  return safeString(text, 5000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED]")
    .replace(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[REDACTED]")
    .replace(/\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Trail|Trl|Place|Pl)\b/gi, "[REDACTED]")
    .replace(/\b(?:Apartment|Apt|Suite|Ste|Unit)\s*[#A-Za-z0-9-]+\b/gi, "[REDACTED]")
    .replace(/\b[A-Z][a-z]+,\s+(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/g, "[REDACTED]")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, "[REDACTED]");
}

function toArchiveStatement(report) {
  const parts = [
    report.bestMoment ? `Strong response recorded: ${report.bestMoment}` : "",
    report.confusingRule ? `Calibration required: ${report.confusingRule}` : "",
    report.improve ? `Improvement request preserved: ${report.improve}` : "",
    report.fullFeedback ? report.fullFeedback : "",
  ].filter(Boolean);

  const merged = redactSensitiveText(parts.join(" "));
  const clipped = merged.length > 520 ? `${merged.slice(0, 517)}...` : merged;
  return clipped || "No recoverable statement preserved.";
}

function displayRole(role) {
  if (role === "gmd") return "GM";
  if (role === "played") return "PLAYER";
  return "READER";
}

function generatePublicDraft(report) {
  const operatorCount = report.playerCount || "REDACTED";
  const statement = toArchiveStatement(report);

  return {
    identity: "REDACTED",
    location: "REDACTED",
    role: displayRole(report.role),
    operatorCount,
    needlepoint: redactSensitiveText(report.needlepoint || "UNSPECIFIED").toUpperCase(),
    status: "COMPLETED",
    recoveredStatement: statement,
    archiveNote: "Useful field report. Low contamination risk. Approved for public recovery index.",
  };
}

function sanitizePublicDraft(input, sourceReport) {
  const draft = input && typeof input === "object" ? input : {};
  const generated = generatePublicDraft(sourceReport || {});

  return {
    identity: "REDACTED",
    location: "REDACTED",
    role: redactSensitiveText(safeString(draft.role, 80) || generated.role).toUpperCase(),
    operatorCount: redactSensitiveText(safeString(draft.operatorCount, 40) || generated.operatorCount),
    needlepoint: redactSensitiveText(safeString(draft.needlepoint, 120) || generated.needlepoint).toUpperCase(),
    status: redactSensitiveText(safeString(draft.status, 80) || generated.status).toUpperCase(),
    recoveredStatement: redactSensitiveText(safeString(draft.recoveredStatement, 1200) || generated.recoveredStatement),
    archiveNote: redactSensitiveText(safeString(draft.archiveNote, 600) || generated.archiveNote),
  };
}

function publicReport(record) {
  const draft = sanitizePublicDraft(record.publicDraft, record);
  return {
    id: record.id,
    publishedAt: record.publishedAt || record.updatedAt || record.createdAt,
    ...draft,
  };
}

function buildStats(reports) {
  const approved = reports.filter((report) => report.status === "approved" && report.consentPublic && report.publicDraftApproved).length;
  return {
    recoveredReports: reports.length,
    approvedForPublication: approved,
    containmentRestricted: reports.filter((report) => report.status === "rejected" && report.consentPublic && report.publicDraftApproved).length,
    underReview: reports.filter((report) => report.status === "under_review").length,
    redactedBeyondRecovery: reports.filter((report) => report.status === "rejected" && (!report.consentPublic || !report.publicDraftApproved)).length,
  };
}

module.exports = {
  buildStats,
  createReport,
  generatePublicDraft,
  json,
  publicReport,
  readBody,
  readReports,
  redactSensitiveText,
  reportBackend,
  requireReportAdmin,
  sanitizePublicDraft,
  writeReports,
};
