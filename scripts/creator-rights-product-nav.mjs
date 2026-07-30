/**
 * Single source of Creator Rights product chrome for static surfaces.
 * Keep in sync with veillink/lib/rights/product-nav.ts
 *
 * Usage:
 *   node scripts/creator-rights-product-nav.mjs
 *   node scripts/creator-rights-product-nav.mjs --check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** @type {const} */
export const CREATOR_RIGHTS_PRODUCT_NAV = {
  accountLabel: "Account",
  accountPath: "/account/rights",
  advisorPath: "/rights/advisor",
  advisorLabel: "Try Free Advisor",
  appOrigin: "https://app.veildaemon.app",
  createPath: "/rights/create",
  createLabel: "Preserve record",
  registryPath: "/registry/",
  resourcesPath: "/studio/creator-rights/resources/",
  resourcesLabel: "Toolkit",
  studioOverview: "/studio/creator-rights/",
};

export function rightsAccountHref() {
  return `${CREATOR_RIGHTS_PRODUCT_NAV.appOrigin}${CREATOR_RIGHTS_PRODUCT_NAV.accountPath}`;
}

export function rightsAccountAnchorHtml(className = "nav-cta") {
  const { accountLabel } = CREATOR_RIGHTS_PRODUCT_NAV;
  return `<a class="${className}" href="${rightsAccountHref()}" target="_blank" rel="noopener noreferrer">${accountLabel}</a>`;
}

export function rightsStaticHeaderHtml() {
  const { advisorPath, advisorLabel, registryPath, resourcesPath, resourcesLabel, studioOverview, appOrigin } =
    CREATOR_RIGHTS_PRODUCT_NAV;
  return (
    `<header class="site-header" data-product="creator-rights">` +
    `<a class="brand" href="${registryPath}">` +
    `<img src="/studio/assets/brand/sigilforge-emblem-256.webp?v=20260724-sigilforge1" alt="SigilForge Studios">` +
    `<span><strong>SIGILFORGE</strong><small>RIGHTS</small></span></a>` +
    `<nav aria-label="Creator Rights">` +
    `<a href="${registryPath}">Registry</a>` +
    `<a href="${studioOverview}">Overview</a>` +
    `<a href="${resourcesPath}">${resourcesLabel}</a>` +
    `<a href="${rightsAccountHref()}" target="_blank" rel="noopener noreferrer">Account</a>` +
    `<a class="nav-cta" href="${appOrigin}${advisorPath}" target="_blank" rel="noopener noreferrer">${advisorLabel}</a>` +
    `</nav></header>`
  );
}

export function rightsStaticFooterHtml() {
  const { appOrigin, advisorPath, advisorLabel, createPath, createLabel, resourcesPath, studioOverview } = CREATOR_RIGHTS_PRODUCT_NAV;
  return `<footer class="site-footer" data-product="creator-rights">` +
    `<div class="footer-top">` +
    `<div class="footer-brand"><img src="/studio/assets/brand/sigilforge-emblem-256.webp?v=20260724-sigilforge1" alt="SigilForge Studios"><span><strong>SIGILFORGE STUDIOS</strong><small>Founder-operated creator rights registry and publishing infrastructure.</small></span></div>` +
    `<div class="footer-cols">` +
    `<nav aria-label="Creator Rights product"><strong>Creator Rights</strong><a href="/registry/">Registry</a><a href="${studioOverview}">Overview</a><a href="${resourcesPath}">Creator Toolkit</a><a href="${appOrigin}${advisorPath}" target="_blank" rel="noopener noreferrer">${advisorLabel}</a><a href="${appOrigin}${createPath}" target="_blank" rel="noopener noreferrer">${createLabel}</a><a href="${rightsAccountHref()}" target="_blank" rel="noopener noreferrer">Account</a></nav>` +
    `<nav aria-label="Studio and legal"><strong>Studio</strong><a href="/studio/">Studio home</a><a href="/studio/shelf/">Shelf</a><a href="/studio/publishing/">Publishing</a><a href="/studio/copyright/">Copyright</a><a href="/studio/about/">Contact</a></nav>` +
    `<nav aria-label="Platform and code"><strong>Platform</strong><a href="/">VeilDaemon</a><a href="https://app.veildaemon.app/" target="_blank" rel="noopener noreferrer">VeilLink</a><a href="https://github.com/SigilForge/veildaemon" target="_blank" rel="noopener noreferrer">GitHub</a><a href="https://wiki.veildaemon.app/" target="_blank" rel="noopener noreferrer">Public wiki</a></nav>` +
    `</div></div>` +
    `<p class="footer-copy">© 2024–2026 J. Donavon Love, under the SigilForge Studios name</p>` +
    `</footer>`;
}

function creatorRightsFooterBlock(html) {
  return html.match(/<footer class="site-footer" data-product="creator-rights">[\s\S]*?<\/footer>/)?.[0] || "";
}

function hasCurrentCreatorRightsFooter(html) {
  const footer = creatorRightsFooterBlock(html);
  return Boolean(footer) &&
    footer.includes(`>${CREATOR_RIGHTS_PRODUCT_NAV.advisorLabel}</a>`) &&
    footer.includes(`>${CREATOR_RIGHTS_PRODUCT_NAV.createLabel}</a>`);
}

function walkRightsHtml(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkRightsHtml(full, out);
    else if (ent.name === "index.html") out.push(full);
  }
  return out;
}

function ensureStaticHeaders({ checkOnly = false } = {}) {
  const header = rightsStaticHeaderHtml();
  const rightsRoot = path.join(root, "rights");
  const files = walkRightsHtml(rightsRoot).filter((file) => file !== path.join(rightsRoot, "index.html"));
  let missing = 0;
  let updated = 0;
  for (const file of files) {
    let html = fs.readFileSync(file, "utf8");
    const hasProductHeader = html.includes('data-product="creator-rights"');
    const hasCurrentRegisterAction = html.includes(`>${CREATOR_RIGHTS_PRODUCT_NAV.advisorLabel}</a>`);
    const hasLegacyTopAccount = /<header class="site-header" data-product="creator-rights">[\s\S]*?https:\/\/app\.veildaemon\.app\/account\/rights[\s\S]*?<\/header>/.test(html);
    if (hasProductHeader && hasCurrentRegisterAction && !hasLegacyTopAccount) continue;
    missing += 1;
    if (checkOnly) continue;
    if (hasProductHeader) {
      html = html.replace(/<header class="site-header" data-product="creator-rights">[\s\S]*?<\/header>/, header);
    } else {
      html = html.replace(/<body[^>]*>/, (open) => `${open}${header}`);
    }
    html = html.split("\n").map((line) => line.trimEnd()).join("\n");
    fs.writeFileSync(file, html);
    updated += 1;
  }
  return { files: files.length, missing, updated };
}

function ensureStaticFooters({ checkOnly = false } = {}) {
  const footer = rightsStaticFooterHtml();
  const rightsRoot = path.join(root, "rights");
  const files = walkRightsHtml(rightsRoot).filter((file) => file !== path.join(rightsRoot, "index.html"));
  let missing = 0;
  let updated = 0;
  for (const file of files) {
    let html = fs.readFileSync(file, "utf8");
    const hasCurrentFooter = hasCurrentCreatorRightsFooter(html);
    if (hasCurrentFooter) continue;
    missing += 1;
    if (checkOnly) continue;
    if (/<footer\b[\s\S]*?<\/footer>/.test(html)) {
      html = html.replace(/<footer\b[\s\S]*?<\/footer>/, footer);
    } else {
      html = html.replace(/\n<\/body>/, `${footer}\n</body>`);
    }
    html = html.split("\n").map((line) => line.trimEnd()).join("\n");
    fs.writeFileSync(file, html);
    updated += 1;
  }
  return { files: files.length, missing, updated };
}

function ensureStudioCreatorRights({ checkOnly = false } = {}) {
  const file = path.join(root, "studio/creator-rights/index.html");
  let html = fs.readFileSync(file, "utf8");
  const header = rightsStaticHeaderHtml();
  const hasCorrect = html.includes(header);
  if (hasCorrect) {
    return { ok: true, updated: false };
  }
  if (checkOnly) return { ok: false, updated: false };
  html = html.replace(/<header class="site-header"(?: data-product="creator-rights")?>[\s\S]*?<\/header>/, header);
  fs.writeFileSync(file, html);
  return { ok: true, updated: true };
}

function ensureRegistryHeader({ checkOnly = false } = {}) {
  const file = path.join(root, "registry/index.html");
  let html = fs.readFileSync(file, "utf8");
  const header = rightsStaticHeaderHtml();
  const hasProductHeader = html.includes('data-product="creator-rights"');
  const hasCurrentRegisterAction = html.includes(`>${CREATOR_RIGHTS_PRODUCT_NAV.advisorLabel}</a>`);
  const hasLegacyTopAccount = /<header class="site-header" data-product="creator-rights">[\s\S]*?https:\/\/app\.veildaemon\.app\/account\/rights[\s\S]*?<\/header>/.test(html);
  if (hasProductHeader && hasCurrentRegisterAction && !hasLegacyTopAccount) {
    return { ok: true, updated: false };
  }
  if (checkOnly) return { ok: false, updated: false };
  if (hasProductHeader) {
    html = html.replace(/<header class="site-header" data-product="creator-rights">[\s\S]*?<\/header>/, header);
  } else {
    html = html.replace(/<body[^>]*>/, (open) => `${open}${header}`);
  }
  html = html.split("\n").map((line) => line.trimEnd()).join("\n");
  fs.writeFileSync(file, html);
  return { ok: true, updated: true };
}

function ensureRegistryFooter({ checkOnly = false } = {}) {
  const file = path.join(root, "registry/index.html");
  let html = fs.readFileSync(file, "utf8");
  const footer = rightsStaticFooterHtml();
  const hasCurrentFooter = hasCurrentCreatorRightsFooter(html);
  if (hasCurrentFooter) return { ok: true, updated: false };
  if (checkOnly) return { ok: false, updated: false };
  if (/<footer\b[\s\S]*?<\/footer>/.test(html)) {
    html = html.replace(/<footer\b[\s\S]*?<\/footer>/, footer);
  } else {
    html = html.replace(/\n<\/body>/, `${footer}\n</body>`);
  }
  html = html.split("\n").map((line) => line.trimEnd()).join("\n");
  fs.writeFileSync(file, html);
  return { ok: true, updated: true };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const checkOnly = process.argv.includes("--check");
  const staticResult = ensureStaticHeaders({ checkOnly });
  const staticFooterResult = ensureStaticFooters({ checkOnly });
  const registryResult = ensureRegistryHeader({ checkOnly });
  const registryFooterResult = ensureRegistryFooter({ checkOnly });
  const studioResult = ensureStudioCreatorRights({ checkOnly });

  console.log(
    JSON.stringify(
      {
        accountHref: rightsAccountHref(),
        label: CREATOR_RIGHTS_PRODUCT_NAV.accountLabel,
        static: staticResult,
        staticFooter: staticFooterResult,
        registry: registryResult,
        registryFooter: registryFooterResult,
        studio: studioResult,
        checkOnly,
      },
      null,
      2
    )
  );

  if (
    checkOnly &&
    (staticResult.missing > 0 ||
      staticFooterResult.missing > 0 ||
      !registryResult.ok ||
      !registryFooterResult.ok ||
      !studioResult.ok)
  ) {
    process.exit(1);
  }
}
