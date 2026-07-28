/**
 * Single source of Creator Rights product Account chrome for static surfaces.
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
  appOrigin: "https://app.veildaemon.app",
  createPath: "/rights/create",
  registerLabel: "Register product",
  registryPath: "/registry/",
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
  const { accountLabel, createPath, registerLabel, registryPath, studioOverview, appOrigin } =
    CREATOR_RIGHTS_PRODUCT_NAV;
  return (
    `<header class="site-header" data-product="creator-rights">` +
    `<a class="brand" href="${registryPath}">` +
    `<img src="/studio/assets/brand/sigilforge-emblem-256.webp?v=20260724-sigilforge1" alt="SigilForge Studios">` +
    `<span><strong>SIGILFORGE</strong><small>RIGHTS</small></span></a>` +
    `<nav aria-label="Creator Rights">` +
    `<a href="${registryPath}">Registry</a>` +
    `<a href="${studioOverview}">Overview</a>` +
    `<a href="${rightsAccountHref()}" target="_blank" rel="noopener noreferrer">${accountLabel}</a>` +
    `<a class="nav-cta" href="${appOrigin}${createPath}" target="_blank" rel="noopener noreferrer">${registerLabel}</a>` +
    `</nav></header>`
  );
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
    const hasCurrentRegisterAction = html.includes(`>${CREATOR_RIGHTS_PRODUCT_NAV.registerLabel}</a>`);
    if (hasProductHeader && hasCurrentRegisterAction) continue;
    missing += 1;
    if (checkOnly) continue;
    if (hasProductHeader) {
      html = html.replace(/<header class="site-header" data-product="creator-rights">[\s\S]*?<\/header>/, header);
    } else {
      html = html.replace(/<body[^>]*>/, (open) => `${open}${header}`);
    }
    fs.writeFileSync(file, html);
    updated += 1;
  }
  return { files: files.length, missing, updated };
}

function ensureStudioCreatorRights({ checkOnly = false } = {}) {
  const file = path.join(root, "studio/creator-rights/index.html");
  let html = fs.readFileSync(file, "utf8");
  const accountAnchor = rightsAccountAnchorHtml();
  const registerAnchor = `<a class="nav-cta" href="${CREATOR_RIGHTS_PRODUCT_NAV.appOrigin}${CREATOR_RIGHTS_PRODUCT_NAV.createPath}" target="_blank" rel="noopener noreferrer">${CREATOR_RIGHTS_PRODUCT_NAV.registerLabel}</a>`;
  const hasCorrect =
    html.includes(rightsAccountHref()) &&
    html.includes(`>${CREATOR_RIGHTS_PRODUCT_NAV.accountLabel}</a>`) &&
    html.includes(`>${CREATOR_RIGHTS_PRODUCT_NAV.registerLabel}</a>`);
  if (hasCorrect && html.includes('data-product="creator-rights"')) {
    return { ok: true, updated: false };
  }
  if (checkOnly) return { ok: false, updated: false };
  // Strip old app CTAs then insert current product actions before Contact.
  html = html.replace(
    /<a class="nav-cta" href="https:\/\/app\.veildaemon\.app\/account(?:\/rights)?"[^>]*>[^<]*<\/a>/g,
    ""
  );
  html = html.replace(
    /<a class="nav-cta" href="https:\/\/app\.veildaemon\.app\/rights\/create"[^>]*>[^<]*<\/a>/g,
    ""
  );
  html = html.replace(
    /(<a class="nav-cta" href="(?:mailto:|\/studio\/about\/)[^"]*"[^>]*>Contact<\/a>)/,
    `${accountAnchor}${registerAnchor}$1`
  );
  if (!html.includes('data-product="creator-rights"')) {
    html = html.replace('<header class="site-header">', '<header class="site-header" data-product="creator-rights">');
  }
  fs.writeFileSync(file, html);
  return { ok: true, updated: true };
}

function ensureRegistryHeader({ checkOnly = false } = {}) {
  const file = path.join(root, "registry/index.html");
  let html = fs.readFileSync(file, "utf8");
  const header = rightsStaticHeaderHtml();
  const hasProductHeader = html.includes('data-product="creator-rights"');
  const hasCurrentRegisterAction = html.includes(`>${CREATOR_RIGHTS_PRODUCT_NAV.registerLabel}</a>`);
  if (hasProductHeader && hasCurrentRegisterAction) {
    return { ok: true, updated: false };
  }
  if (checkOnly) return { ok: false, updated: false };
  if (hasProductHeader) {
    html = html.replace(/<header class="site-header" data-product="creator-rights">[\s\S]*?<\/header>/, header);
  } else {
    html = html.replace(/<body[^>]*>/, (open) => `${open}${header}`);
  }
  fs.writeFileSync(file, html);
  return { ok: true, updated: true };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const checkOnly = process.argv.includes("--check");
  const staticResult = ensureStaticHeaders({ checkOnly });
  const registryResult = ensureRegistryHeader({ checkOnly });
  const studioResult = ensureStudioCreatorRights({ checkOnly });

  console.log(
    JSON.stringify(
      {
        accountHref: rightsAccountHref(),
        label: CREATOR_RIGHTS_PRODUCT_NAV.accountLabel,
        static: staticResult,
        registry: registryResult,
        studio: studioResult,
        checkOnly,
      },
      null,
      2
    )
  );

  if (checkOnly && (staticResult.missing > 0 || !registryResult.ok || !studioResult.ok)) {
    process.exit(1);
  }
}
