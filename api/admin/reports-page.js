const fs = require("fs");
const path = require("path");

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim().split("="))
    .filter((parts) => parts.length === 2)
    .reduce((cookies, [key, value]) => {
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    return res.end("Method not allowed.");
  }

  const expected = process.env.REPORT_ADMIN_TOKEN || process.env.ALERT_ADMIN_TOKEN;
  if (!expected) {
    res.statusCode = 503;
    return res.end("Report admin token is not configured.");
  }

  const supplied = (req.query && req.query.token) || parseCookies(req.headers.cookie).vd_report_admin;
  if (supplied !== expected) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Report console access token required.");
  }

  if (req.query && req.query.token) {
    res.setHeader("Set-Cookie", `vd_report_admin=${encodeURIComponent(expected)}; Path=/admin/reports; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
  }

  const file = path.join(process.cwd(), "admin", "reports", "index.html");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(fs.readFileSync(file, "utf8"));
};
