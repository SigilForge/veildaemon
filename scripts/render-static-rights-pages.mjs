import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { rightsStaticHeaderHtml } from "./creator-rights-product-nav.mjs";

const root = process.cwd();
const rightsDir = path.join(root, "rights");
const styleVersion = "20260728-rights-full1";
const publicOrigin = "https://veildaemon.app";
const appOrigin = "https://app.veildaemon.app";

const permissionLabels = {
  allowed: "Allowed",
  prohibited: "Prohibited",
  license_required: "License Required",
  research_only: "Research Only",
  case_by_case: "Case by Case",
  custom_terms: "Custom Terms",
  not_specified: "Not Specified",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sentence(value) {
  return escapeHtml(value || "Not specified");
}

function labelForKey(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());
}

function displayDate(value) {
  if (!value) return "Not specified";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

function compactDate(value) {
  if (!value) return "Not specified";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { timeZone: "UTC" });
}

function titleCase(value) {
  return String(value || "other")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function recordPath(slug) {
  return `/rights/${slug}/`;
}

function recordJsonPath(slug) {
  return `/rights/${slug}.json`;
}

function licensePath(slug) {
  return `/rights/${slug}/license/`;
}

function sourceAction(record) {
  if (record.publicRecordUrl?.includes("the-anchor-and-the-glitch")) {
    return `<a class="button secondary" href="${appOrigin}/book-one" target="_blank" rel="noopener noreferrer">Buy publication</a>`;
  }
  if (!record.publicRecordUrl) return "";
  return "";
}

function projectAction(record) {
  const source = {
    "the-anchor-and-the-glitch": "/studio/shelf/book-one/",
    "cradlepoint-operator-core": "/operator/",
    veilforge: "/studio/technology/",
    veildaemon: "/studio/technology/",
  }[record.publicRecordUrl?.split("/").filter(Boolean).pop()] || "/studio/shelf/";
  return `<a class="button secondary" href="${source}">View project</a>`;
}

function permissionRows(record) {
  const rows = Object.entries(record.permissions || {}).map(([key, value]) => (
    `<div class="permission-row"><span>${escapeHtml(labelForKey(key))}</span><strong>${escapeHtml(permissionLabels[value] || titleCase(value))}</strong></div>`
  ));
  rows.push(
    `<div class="permission-row"><span>Human commercial license</span><strong>${escapeHtml(permissionLabels.case_by_case)}</strong></div>`
  );
  return rows.join("");
}

async function qrSvgFor(url) {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: {
      dark: "#e5dac7",
      light: "#111314",
    },
  });
  return svg.replace(/^<\?xml[^>]*>\s*/, "");
}

async function recordBody(record, { licenseRoute = false } = {}) {
  const slug = record.publicRecordUrl.split("/").filter(Boolean).pop();
  const stableUrl = `${publicOrigin}${recordPath(slug).replace(/\/$/, "")}`;
  const qrSvg = await qrSvgFor(stableUrl);
  const publicationDate = displayDate(record.publicationDate);
  const compactPublication = compactDate(record.publicationDate);
  const fingerprint = record.fileFingerprint;
  const titlePrefix = licenseRoute ? "License inquiry" : "Creator Rights Record";

  return `
    <main id="main" class="rights-static-record">
      <section class="sub-hero text-only rights-full-hero">
        <div>
          <p class="eyebrow">${titlePrefix}</p>
          <h1>${escapeHtml(record.title)}</h1>
          <p>${sentence(record.permissionsSummary)}</p>
          <dl class="record-meta-row">
            <div><dt>Record ID</dt><dd>${sentence(record.recordId)}</dd></div>
            <div><dt>Published</dt><dd>${escapeHtml(compactPublication)}</dd></div>
            <div><dt>Status</dt><dd>Verified Publication Record</dd></div>
            <div><dt>Version</dt><dd>1</dd></div>
          </dl>
          <div class="proof-row">
            <span class="proof-chip status-chip">Active Record</span>
            <span class="proof-chip">${sentence(record.workTypeLabel)}</span>
            <span class="proof-chip">${sentence(record.categoryLabel)}</span>
            <span class="proof-chip">${sentence(record.availabilityLabel)}</span>
            <span class="proof-chip">${sentence(record.workVersion)}</span>
          </div>
        </div>
      </section>

      <section class="section-block rights-record-grid">
        <article class="panel">
          <p class="panel-kicker">Declared position</p>
          <h2>${sentence(record.rightsHolder)}</h2>
          <dl class="rights-facts">
            <div><dt>Creator</dt><dd>${sentence(record.creator)}</dd></div>
            <div><dt>Work type</dt><dd>${sentence(record.workTypeLabel)}</dd></div>
            <div><dt>Category</dt><dd>${sentence(record.categoryLabel)}</dd></div>
            <div><dt>Recorded</dt><dd>${escapeHtml(compactPublication)}</dd></div>
            <div><dt>Publication</dt><dd>${escapeHtml(compactPublication)}</dd></div>
            <div><dt>Availability</dt><dd>${sentence(record.availabilityLabel)}</dd></div>
            <div><dt>Identifier</dt><dd>${sentence(record.recordId)}</dd></div>
          </dl>
          <p>${sentence(record.copyrightNotice)}</p>
          <p>${sentence(record.permissionsSummary)}</p>
          <div class="toolbar">${projectAction(record)}${sourceAction(record)}</div>
        </article>

        <aside class="panel rights-qr-panel">
          <p class="panel-kicker">Stable record URL</p>
          <div class="rights-qr">${qrSvg}</div>
          <p class="muted">${escapeHtml(stableUrl)}</p>
          <div class="toolbar">
            <a class="button secondary" href="${recordJsonPath(slug)}">JSON</a>
            <a class="button secondary" href="${recordPath(slug)}">Record</a>
            <a class="button secondary" href="${licensePath(slug)}">License</a>
          </div>
        </aside>
      </section>

      <section class="section-block rights-permissions-section">
        <div class="section-heading">
          <p class="eyebrow">AI permissions</p>
          <h2>Machine-readable terms, translated for humans.</h2>
        </div>
        <p>${sentence(record.permissionsSummary)}</p>
        <div class="permission-grid">${permissionRows(record)}</div>
      </section>

      <section class="section-block grid rights-support-grid">
        <article class="panel">
          <p class="panel-kicker">Revision history</p>
          <h2>Version 1</h2>
          <p class="muted">Published ${escapeHtml(publicationDate)}. Initial immutable snapshot; updates create a new version rather than rewriting this one.</p>
        </article>
        <article class="panel">
          <p class="panel-kicker">Fingerprint</p>
          <h2>${fingerprint ? "File hash recorded" : "No file hash on this record"}</h2>
          <p class="muted">${fingerprint ? `SHA-256 ${escapeHtml(fingerprint.value)}` : "A creator may associate a SHA-256 fingerprint with a record. The hash proves association with the record at the listed time, not authorship."}</p>
        </article>
        <article class="panel">
          <p class="panel-kicker">Licensing</p>
          <h2>${licenseRoute ? "Inquiry route" : "Request a license"}</h2>
          <p class="muted">Use this route for commercial, research, dataset, adaptation, or AI-use requests. Public inquiry storage is not enabled on static examples yet.</p>
          <a class="button secondary" href="${licensePath(slug)}">Request a license</a>
        </article>
      </section>

      ${licenseRoute ? `
      <section class="section-block rights-license-intake">
        <p class="eyebrow">License inquiry</p>
        <h2>Request shape</h2>
        <div class="gate-list">
          <article><h3>Use case</h3><p>Commercial, research, dataset, adaptation, localization, or AI-use licensing.</p></article>
          <article><h3>Review status</h3><p>Static public intake is not enabled yet. No private contact address is exposed from this record.</p></article>
          <article><h3>Required context</h3><p>Requester identity, intended use, distribution plan, duration, dataset scope, and budget range.</p></article>
          <article><h3>Record anchor</h3><p><a href="${recordPath(slug)}">View the permanent record</a> · <a href="${recordJsonPath(slug)}">JSON metadata</a></p></article>
        </div>
      </section>` : ""}

      <p class="notice">${sentence(record.disclaimer)}</p>
    </main>`;
}

function pageShell({ title, description, canonical, noindex = false, body }) {
  const ogImage = `${publicOrigin}/assets/social/creator-rights-record-og.webp?v=20260727-rights3`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${noindex ? '<meta name="robots" content="noindex,follow">' : ""}
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="SigilForge Studios">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta name="theme-color" content="#070a0b">
  <link rel="stylesheet" href="/studio/studio.css?v=${styleVersion}">
</head>
<body class="subpage page-shell">
  ${rightsStaticHeaderHtml()}
  ${body}
</body>
</html>`;
}

function cleanGeneratedHtml(html) {
  return html.replace(/[ \t]+$/gm, "");
}

const files = (await fs.readdir(rightsDir))
  .filter((file) => file.endsWith(".json") && file !== "creator-rights-record.schema.json")
  .sort();

for (const file of files) {
  const record = JSON.parse(await fs.readFile(path.join(rightsDir, file), "utf8"));
  const slug = file.replace(/\.json$/, "");
  const dir = path.join(rightsDir, slug);
  const licenseDir = path.join(dir, "license");
  await fs.mkdir(licenseDir, { recursive: true });
  const canonical = `${publicOrigin}${recordPath(slug)}`;
  const recordHtml = pageShell({
    title: `${record.title} Rights, Copyright and AI Use Record`,
    description: `View the declared copyright, licensing terms, AI permissions, stable URL, revision history, fingerprint status, and recorded version for ${record.title}.`,
    canonical,
    body: await recordBody(record),
  });
  const licenseHtml = pageShell({
    title: `License Inquiry - ${record.title}`,
    description: `Review the full rights record and licensing request context for ${record.title}.`,
    canonical: `${publicOrigin}${licensePath(slug)}`,
    noindex: true,
    body: await recordBody(record, { licenseRoute: true }),
  });
  await fs.writeFile(path.join(dir, "index.html"), cleanGeneratedHtml(recordHtml));
  await fs.writeFile(path.join(licenseDir, "index.html"), cleanGeneratedHtml(licenseHtml));
}

console.log(`Rendered ${files.length} rights records and license pages.`);
