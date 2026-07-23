import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputPath = process.argv[process.argv.indexOf("--input") + 1];
if (!inputPath) throw new Error("Usage: npm run relay:publish-news -- --input path/to/relaydaemon-package.json");

const input = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
const draft = input.siteNewsDraft;
if (!draft) throw new Error("This RelayDaemon package does not contain a site-news draft.");
if (draft.approvalStatus !== "approved-for-publication") throw new Error("Site-news writing requires Approved for automatic publication.");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) throw new Error("Invalid news slug.");

const newsRoot = path.join(root, "studio/news");
const dataRoot = path.join(newsRoot, "data");
const entryDir = path.join(newsRoot, draft.slug);
const now = draft.publishedAt || new Date().toISOString();
const entry = { ...draft, publishedAt: now, updatedAt: now, destinations: { ...(draft.destinations || {}), site: { status: "published", url: draft.canonicalUrl } } };
await fs.mkdir(dataRoot, { recursive: true });
await fs.mkdir(entryDir, { recursive: true });
await fs.writeFile(path.join(dataRoot, `${entry.contentId}.json`), `${JSON.stringify(entry, null, 2)}\n`);

const entries = (await fs.readdir(dataRoot)).filter((file) => file.endsWith(".json"));
const records = await Promise.all(entries.map(async (file) => JSON.parse(await fs.readFile(path.join(dataRoot, file), "utf8"))));
records.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

function esc(value = "") { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"); }
function entryPage(record) {
  const voice = record.voice || "Studio";
  const isTransmission = /shade|archive|veilcorp/i.test(`${voice} ${record.category || ""}`);
  const eyebrow = isTransmission ? `Archive Transmission · ${esc(voice)}` : `Studio Dispatch · ${esc(voice)}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(record.title)} | Cradlepoint Studio News</title><meta name="description" content="${esc(record.summary)}"><link rel="canonical" href="https://veildaemon.app${record.canonicalUrl}"><meta property="og:title" content="${esc(record.title)}"><meta property="og:description" content="${esc(record.summary)}"><meta property="og:url" content="https://veildaemon.app${record.canonicalUrl}"><link rel="stylesheet" href="/studio/studio.css?v=20260723-news3"></head><body class="subpage page-shell"><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/studio/"><img src="/studio/assets/brand/cradlepoint-studio-emblem-256.webp?v=20260713-brand2" alt="Cradlepoint Studio"><span><strong>CRADLEPOINT</strong><small>STUDIO</small></span></a><nav aria-label="Primary navigation"><a href="/studio/projects/">Projects</a><a href="/studio/shelf/">Shelf</a><a href="/studio/news/" aria-current="page">News</a><a href="/studio/technology/">Technology</a><a href="/studio/funding/">Funding</a></nav></header><main id="main"><article class="sub-hero text-only"><div><p class="eyebrow">${eyebrow}</p><h1>${esc(record.title)}</h1><p>${esc(record.summary)}</p><p><small>Published ${esc(new Date(record.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))} · ${esc(voice)}</small></p><p><a href="/studio/news/">← Studio News</a></p></div></article><section class="section-block"><div class="news-article-body">${esc(record.body).split("\n\n").map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("")}</div></section></main></body></html>
`;
}
await fs.writeFile(path.join(entryDir, "index.html"), entryPage(entry));

let hubPreserved = false;
try {
  const existingIndex = await fs.readFile(path.join(newsRoot, "index.html"), "utf8");
  hubPreserved = existingIndex.includes("news-hub") || existingIndex.includes("Public development record");
} catch {
  hubPreserved = false;
}

if (!hubPreserved) {
  const cards = records.map((record) => `<article><p class="eyebrow">${esc(record.category || "Studio news")}</p><h2><a href="${esc(record.canonicalUrl)}">${esc(record.title)}</a></h2><p>${esc(record.summary)}</p><small>${esc(record.publishedAt.slice(0, 10))} · ${esc(record.voice)}</small></article>`).join("\n");
  await fs.writeFile(path.join(newsRoot, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio News | Cradlepoint Studio</title><meta name="description" content="Permanent Studio publication record."><link rel="canonical" href="https://veildaemon.app/studio/news/"><link rel="alternate" type="application/rss+xml" href="/studio/news/rss.xml" title="Cradlepoint Studio News"><link rel="stylesheet" href="/studio/studio.css?v=20260723-news3"></head><body class="subpage page-shell"><main class="section-block"><p class="eyebrow">Studio publication record</p><h1>News</h1><div class="gate-list">${cards}</div></main></body></html>\n`);
  const rssItems = records.map((record) => `<item><title>${esc(record.title)}</title><link>https://veildaemon.app${record.canonicalUrl}</link><guid>https://veildaemon.app${record.canonicalUrl}</guid><pubDate>${new Date(record.publishedAt).toUTCString()}</pubDate><description>${esc(record.summary)}</description></item>`).join("");
  await fs.writeFile(path.join(newsRoot, "rss.xml"), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Cradlepoint Studio News</title><link>https://veildaemon.app/studio/news/</link><description>Permanent Studio publication record.</description>${rssItems}</channel></rss>\n`);
} else {
  console.log("Preserved handcrafted studio/news hub (index.html / rss.xml). Add the entry to those files manually.");
}

await fs.writeFile(path.join(newsRoot, "manifest.json"), `${JSON.stringify(records, null, 2)}\n`);

const sitemapPath = path.join(root, "sitemap.xml");
let sitemap = await fs.readFile(sitemapPath, "utf8");
const urls = [`  <url><loc>https://veildaemon.app/studio/news/</loc><lastmod>${now.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`, ...records.map((record) => `  <url><loc>https://veildaemon.app${record.canonicalUrl}</loc><lastmod>${record.updatedAt.slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.55</priority></url>`)].join("\n");
const start = "<!-- relay-news:start -->";
const end = "<!-- relay-news:end -->";
if (!sitemap.includes(start)) sitemap = sitemap.replace("</urlset>", `${start}\n${end}\n</urlset>`);
sitemap = sitemap.replace(new RegExp(`${start}[\\s\\S]*?${end}`), `${start}\n${urls}\n${end}`);
await fs.writeFile(sitemapPath, sitemap);
console.log(`Published ${entry.contentId} → ${entry.canonicalUrl}`);
