import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { rightsStaticFooterHtml, rightsStaticHeaderHtml } from "./creator-rights-product-nav.mjs";

const root = process.cwd();
const rightsDir = path.join(root, "rights");
const styleVersion = "20260729-rights-wrap1";
const qrAssetVersion = "20260728-qr-webp1";
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

const fallbackLicense = {
  id: "proprietary",
  name: "Proprietary / all rights reserved",
  shortName: "Proprietary",
  spdxId: null,
  url: "https://www.copyright.gov/help/faq/",
  summary: "No reuse rights are granted unless a separate notice, agreement, or license says otherwise.",
};

const sfrDeclaration = {
  id: "sfr",
  name: "SigilForge Rights Framework",
  shortName: "SFR",
  version: "1.0",
  summary:
    "Defines the Creator Rights Record behavior: provenance metadata, verification state, AI permissions, evidence package semantics, artifact status, and machine-readable rights information.",
  supplementalNotice: "This framework supplements the selected copyright license. It does not replace or modify that license.",
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

function verificationLabel(level) {
  return {
    declared: "Declared",
    surface_verified: "Surface verified",
    artifact_verified: "Artifact verified",
    signed: "Signed",
  }[level] || "Declared";
}

function verificationClaim(level) {
  return {
    declared: "This record was published by an authenticated account.",
    surface_verified: "This authenticated account demonstrated control of the referenced publication surface.",
    artifact_verified: "The recorded artifact matched the listed fingerprint.",
    signed: "The record or artifact was cryptographically signed.",
  }[level] || "This record was published by an authenticated account.";
}

function verificationPanel(record) {
  const verification = record.verification || { level: "declared", methods: [], evidence: [] };
  const methodChips = (verification.methods || [])
    .map((method) => `<span class="proof-chip">${sentence(method).replace(/_/g, " ")}</span>`)
    .join("");
  const evidenceRows = (verification.evidence || [])
    .map((item) => {
      const label = item.method === "isbn" ? "ISBN evidence" : titleCase(item.method);
      const value = [item.status, item.target, item.verifiedAt ? compactDate(item.verifiedAt.slice(0, 10)) : ""].filter(Boolean).join(" · ");
      return `<div><dt>${sentence(label)}</dt><dd>${sentence(value)}</dd></div>`;
    })
    .join("");
  return `
        <article class="panel rights-verification-panel">
          <p class="panel-kicker">Verification</p>
          <h2>${verificationLabel(verification.level)}</h2>
          <p class="muted">${sentence(verification.statement || verificationClaim(verification.level))}</p>
          ${methodChips ? `<div class="proof-row">${methodChips}</div>` : ""}
          ${evidenceRows ? `<dl class="rights-facts">${evidenceRows}</dl>` : ""}
        </article>`;
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

function copyrightLicenseFor(record) {
  return record.copyrightLicense || fallbackLicense;
}

function registryFrameworkFor(record) {
  return record.registryFramework || sfrDeclaration;
}

function licenseStackHtml(record) {
  const license = copyrightLicenseFor(record);
  const framework = registryFrameworkFor(record);
  return `
          <div class="license-stack">
            <div>
              <span>Primary License</span>
              <strong>${sentence(license.name)}</strong>
              ${license.spdxId ? `<small>${sentence(license.spdxId)}</small>` : ""}
            </div>
            <div>
              <span>Registry Framework</span>
              <strong>${sentence(`${framework.shortName} v${framework.version}`)}</strong>
              <small>Record semantics and machine-readable posture</small>
            </div>
            <div>
              <span>AI Permissions</span>
              <strong>Creator-defined</strong>
              <small>Structured separately below</small>
            </div>
          </div>`;
}

function licenseCompositionHtml(record) {
  const license = copyrightLicenseFor(record);
  const framework = registryFrameworkFor(record);
  return `
      <section class="section-block">
        <div class="section-heading">
          <p class="eyebrow">License composition</p>
          <h2>Primary license and supplemental declarations.</h2>
        </div>
        <div class="grid license-composition-public">
          <article class="panel">
            <p class="panel-kicker">Primary License</p>
            <h2>${sentence(license.name)}</h2>
            <p class="muted">${sentence(license.summary)}</p>
            <dl class="rights-facts compact-facts">
              <div><dt>SPDX</dt><dd>${sentence(license.spdxId || "Not applicable")}</dd></div>
              <div><dt>License URL</dt><dd><a href="${sentence(license.url)}" target="_blank" rel="noopener noreferrer">${sentence(license.url)}</a></dd></div>
            </dl>
          </article>
          <article class="panel">
            <p class="panel-kicker">Registry Framework</p>
            <h2>${sentence(`${framework.name} (${framework.shortName}) v${framework.version}`)}</h2>
            <p class="muted">${sentence(framework.summary)}</p>
            <p class="notice">${sentence(framework.supplementalNotice)}</p>
          </article>
        </div>
      </section>`;
}

function qrModelFor(url) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const quietZone = 4;
  const qrSize = qr.modules.size;
  const viewSize = qrSize + quietZone * 2;
  const modules = [];

  for (let y = 0; y < qrSize; y += 1) {
    for (let x = 0; x < qrSize; x += 1) {
      if (!qr.modules.data[y * qrSize + x]) continue;
      modules.push(`<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>`);
    }
  }

  const svg = (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${escapeHtml(url)}">` +
    `<rect width="${viewSize}" height="${viewSize}" fill="#fff"/>` +
    `<g fill="#000">${modules.join("")}</g>` +
    `</svg>`
  );

  return { svg, viewSize };
}

async function writeQrWebpFor(url, outputPath) {
  const modulePixels = 20;
  const { svg, viewSize } = qrModelFor(url);
  const pixelSize = viewSize * modulePixels;

  await sharp(Buffer.from(svg))
    .resize(pixelSize, pixelSize, { kernel: "nearest" })
    .webp({ lossless: true, quality: 100, effort: 6 })
    .toFile(outputPath);

  return pixelSize;
}

async function recordBody(record, { licenseRoute = false } = {}) {
  const slug = record.publicRecordUrl.split("/").filter(Boolean).pop();
  const stableUrl = `${publicOrigin}${recordPath(slug).replace(/\/$/, "")}`;
  const qrPixelSize = qrModelFor(stableUrl).viewSize * 20;
  const qrImagePath = `${recordPath(slug)}record-qr.webp?v=${qrAssetVersion}`;
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
            <div><dt>Verification</dt><dd>${verificationLabel(record.verification?.level)}</dd></div>
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
          ${licenseStackHtml(record)}
          <div class="toolbar">${projectAction(record)}${sourceAction(record)}</div>
        </article>

        <aside class="panel rights-qr-panel">
          <p class="panel-kicker">Stable record URL</p>
          <div class="rights-qr"><img src="${qrImagePath}" alt="QR code for ${escapeHtml(stableUrl)}" width="${qrPixelSize}" height="${qrPixelSize}" loading="eager" decoding="async"></div>
          <p class="muted">${escapeHtml(stableUrl)}</p>
          <div class="toolbar">
            <a class="button secondary" href="${recordJsonPath(slug)}">JSON</a>
            <a class="button secondary" href="${recordPath(slug)}">Record</a>
            <a class="button secondary" href="${licensePath(slug)}">License</a>
          </div>
        </aside>
      </section>

      ${licenseCompositionHtml(record)}

      <section class="section-block rights-permissions-section">
        <div class="section-heading">
          <p class="eyebrow">AI permissions</p>
          <h2>Machine-readable terms, translated for humans.</h2>
        </div>
        <p>${sentence(record.permissionsSummary)}</p>
        <div class="permission-grid">${permissionRows(record)}</div>
      </section>

      <section class="section-block grid rights-support-grid">
        ${verificationPanel(record)}
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
  <script src="https://analytics.ahrefs.com/analytics.js" data-key="S+lLE7cqoR0zD/Mvx39AJg" async></script>
</head>
<body class="subpage page-shell">
  <a class="skip-link" href="#main">Skip to content</a>
  ${rightsStaticHeaderHtml()}
  ${body}
  ${rightsStaticFooterHtml()}
</body>
</html>`;
}

function cleanGeneratedHtml(html) {
  return html.replace(/[ \t]+$/gm, "");
}

const files = (await fs.readdir(rightsDir))
  .filter((file) => file.endsWith(".json") && file !== "creator-rights-record.schema.json" && file !== "verification-projection.json")
  .sort();

for (const file of files) {
  const record = JSON.parse(await fs.readFile(path.join(rightsDir, file), "utf8"));
  const slug = file.replace(/\.json$/, "");
  const dir = path.join(rightsDir, slug);
  const licenseDir = path.join(dir, "license");
  await fs.mkdir(licenseDir, { recursive: true });
  const canonical = `${publicOrigin}${recordPath(slug)}`;
  await writeQrWebpFor(canonical.replace(/\/$/, ""), path.join(dir, "record-qr.webp"));
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
