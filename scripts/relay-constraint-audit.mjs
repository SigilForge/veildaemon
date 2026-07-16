#!/usr/bin/env node
/**
 * Live constraint audit for RelayDaemon character path.
 * Runs Cathy on Codex 5.6 + CA-001 via the local UI + Ollama bridge,
 * then scores drafts against chat-derived complaints.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Local bridge serves the Relay UI at `/` (not `/studio/relay/`).
const BASE = process.env.RELAY_AUDIT_URL || "http://127.0.0.1:4174/";
const OUT = process.env.RELAY_AUDIT_OUT || "/tmp/relay-constraint-audit.json";
const GEN_TIMEOUT_MS = Number(process.env.RELAY_AUDIT_TIMEOUT_MS || 300_000);

const CODEX_SOURCE = readFileSync("/tmp/codex56-source.txt", "utf8");
const CA001 = JSON.parse(readFileSync(resolve(ROOT, "tests/fixtures/relay/ca-001.json"), "utf8")).source;

const PLATFORM_LIMITS = {
  x: 600,
  threads: 500,
  bluesky: 300,
  mastodon: 500,
  "facebook-personal": 1500,
  patreon: 5000,
  discord: 2000,
  reddit: 40000,
};

function countText(value) {
  return [...String(value || "")].length;
}

function paragraphs(text) {
  return String(text || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function scoreDraft(name, source, pack) {
  const checks = [];
  const pass = (id, ok, detail) => checks.push({ id, ok: Boolean(ok), detail: String(detail || "") });

  const master = pack.masterDraft || "";
  const layer = pack.layer || "";
  const layerKey = pack.layerKey || "";
  const contentClass = pack.contentClass || "";
  const voice = pack.voice || "";
  const platforms = pack.platforms || {};
  const warnings = pack.validationWarnings || [];
  const formMessage = pack.formMessage || "";

  pass("generated", Boolean(master) && !/failed|rejected/i.test(formMessage), formMessage || `master ${countText(master)} chars`);
  pass("observer_not_unit", !/\bversion\s+[\d.]+\s+of\s+me\b/i.test(master)
    && !/\bI(?:'m| am)\s+(?:codex|the unit|a coding agent)\b/i.test(master)
    && !/\bI strapped (?:the )?(?:whole )?filing cabinet\b/i.test(master),
  master.slice(0, 120));
  // Soft observer: first-person ration consumption without external subject is bad on codex sources
  if (/codex|the unit|operational ration/i.test(source)) {
    const selfRation = /\bI (?:ate|consumed|gulped|hoarded)\b[^.!?]{0,40}\b(?:ration|resources)\b/i.test(master)
      && !/\b(the unit|codex|that unit|it)\b/i.test(master);
    pass("observer_ration", !selfRation, selfRation ? "Cathy sounds like she ate the ration" : "ok");
  }
  pass("version_tight", !/\b5\.\s+6\b/.test(master) && !/\b5\.\n\s*6\b/.test(master), (master.match(/5\.\s*6/g) || []).join(" | ") || "no broken 5.6");
  pass("version_present_if_source", !/\b5\.6\b/.test(source) || /\b5\.6\b/.test(master) || /version/i.test(master), "version mention");
  pass("complete_ending", /[.!?…"”']["'”']?$/.test(master.trim()), master.slice(-80));
  pass("no_ellipsis_amputation", !/…$|\.\.\.$/.test(master.trim()), master.slice(-40));
  pass("not_studio_layer", !/studio/i.test(layer) && layerKey !== "studio", `${layer} / ${layerKey} / ${contentClass}`);
  pass("character_voice", /cathy/i.test(voice), voice);
  pass("multi_paragraph", paragraphs(master).length >= 3, `${paragraphs(master).length} paragraphs`);
  pass("not_one_sentence_per_line", (() => {
    const paras = paragraphs(master);
    if (paras.length < 3) return true;
    const singles = paras.filter((p) => !/[.!?].*[.!?]/.test(p) && countText(p) < 160).length;
    return singles / paras.length < 0.55;
  })(), `${paragraphs(master).length} paras, sample: ${paragraphs(master).slice(0, 2).map((p) => p.slice(0, 60)).join(" || ")}`);
  pass("not_wall_only", paragraphs(master).length > 1 || countText(master) < 500, `${paragraphs(master).length} paras`);
  pass("no_sentence_stub_break", !/\bThe task\?\n\n/i.test(master) && !/\bAnd what did Codex do\?\n\n/i.test(master), "stub break check");
  pass("jargon_if_source", !/canonical\s+reproductions/i.test(source) || /canonical\s+reproductions/i.test(master) || !/canonical\s+copies/i.test(master), "jargon");
  pass("no_meta_terms", !/\b(in-world|ARG|fiction|lore|canon|continuity|leaked|hacker)\b/i.test(master), master.match(/\b(in-world|ARG|fiction|lore|canon|continuity|leaked|hacker)\b/i)?.[0] || "clean");
  pass("length_not_teaser", countText(master) >= Math.min(countText(source) * 0.45, 900), `master ${countText(master)} vs source ${countText(source)}`);
  pass("validation_clean", !warnings.length, warnings.join(" | ") || "none");

  // Long-form character lanes must stay in voice — not dump raw field-review / archive shells.
  const patreon = platforms.patreon || "";
  const reddit = platforms.reddit || "";
  if (/codex|field review|operational ration/i.test(source)) {
    pass("patreon_in_voice", !/CODEX 5\.6 FIELD REVIEW|RATING:\s*ONE STAR|CLASSIFICATION:\s*CONTEXT-ADHESIVE/i.test(patreon), patreon.slice(0, 160));
    pass("reddit_in_voice", !/CODEX 5\.6 FIELD REVIEW|RATING:\s*ONE STAR/i.test(reddit), reddit.slice(0, 160));
    pass("facebook_not_hook_split", !/^(Okay, so here's the deal with Codex 5\.6\.)\n\n/i.test(platforms["facebook-personal"] || ""), "first-sentence orphan check");
  }
  if (/VEILCORP ARCHIVES|False Steward|CA-001/i.test(source)) {
    pass("patreon_not_raw_archive", !/^Classification:\s*False Steward/i.test(patreon) && !/VEILCORP ARCHIVES/i.test(patreon), patreon.slice(0, 160));
  }
  pass("master_no_orphan_emdash_para", !/\n\n[—–-]/.test(master), master.match(/\n\n[—–-][^\n]{0,80}/)?.[0] || "ok");

  for (const [id, limit] of Object.entries(PLATFORM_LIMITS)) {
    const copy = platforms[id] || "";
    if (!copy) {
      pass(`platform_${id}_present`, false, "missing");
      continue;
    }
    const len = countText(copy);
    const buffer = 100;
    const soft = Math.max(120, limit - buffer);
    pass(`platform_${id}_under_limit`, len <= limit, `${len}/${limit}`);
    pass(`platform_${id}_not_amputated`, !/…$/.test(copy.trim()), copy.slice(-50));
    // Short lanes should fill near budget for long sources
    if (["x", "threads", "bluesky", "mastodon"].includes(id) && countText(source) > 800) {
      pass(`platform_${id}_near_budget`, len >= soft * 0.55, `${len} vs soft ${soft}`);
    }
    if (["patreon", "facebook-personal", "discord"].includes(id)) {
      pass(`platform_${id}_paragraphs`, paragraphs(copy).length >= 2 || len < 400, `${paragraphs(copy).length} paras, ${len} chars`);
    }
    pass(`platform_${id}_version`, !/\b5\.\s+6\b/.test(copy), (copy.match(/5\.\s*6/g) || []).join(" | ") || "ok");
  }

  const failed = checks.filter((c) => !c.ok);
  return {
    name,
    masterLen: countText(master),
    paragraphCount: paragraphs(master).length,
    layer,
    layerKey,
    contentClass,
    voice,
    formMessage,
    masterPreview: master.slice(0, 500),
    masterTail: master.slice(-350),
    masterFull: master,
    platforms: Object.fromEntries(Object.entries(platforms).map(([k, v]) => [k, { len: countText(v), preview: String(v).slice(0, 220), paras: paragraphs(v).length }])),
    checks,
    passed: checks.filter((c) => c.ok).length,
    total: checks.length,
    failed: failed.map((c) => ({ id: c.id, detail: c.detail })),
  };
}

async function generateOnce(page, source) {
  const apiCaptures = [];
  const onResponse = async (response) => {
    try {
      if (!response.url().includes("/api/character") || response.request().method() !== "POST") return;
      const json = await response.json();
      if (json?.result?.masterDraft) {
        apiCaptures.push({
          engine: json.engine,
          model: json.model,
          masterDraft: json.result.masterDraft,
          platformDrafts: json.result.platformDrafts || {},
          validation: json.result.validation || {},
        });
      }
    } catch (_err) {
      // ignore non-json
    }
  };
  page.on("response", onResponse);

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator("#source-text").fill(source);
  await page.locator("#character").selectOption("cathy-holloway");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Generate social package" }).click();

  const start = Date.now();
  let outcome = "timeout";
  while (Date.now() - start < GEN_TIMEOUT_MS) {
    const busy = await page.locator("#relay-form").getAttribute("aria-busy");
    const msg = (await page.locator("#form-message").innerText().catch(() => "")) || "";
    const reviewVisible = await page.locator("#review-panel").isVisible().catch(() => false);
    if (busy !== "true") {
      if (/destination drafts generated/i.test(msg) || reviewVisible) {
        outcome = "ok";
        break;
      }
      if (/failed|rejected|not generated|Character draft rejected|request failed/i.test(msg)) {
        outcome = "fail";
        break;
      }
    }
    await page.waitForTimeout(1500);
  }

  page.off("response", onResponse);

  const pack = await page.evaluate(() => {
    const platforms = {};
    document.querySelectorAll(".variant-card").forEach((card) => {
      const id = card.dataset.platform;
      const ta = card.querySelector(".variant-copy");
      if (id && ta) platforms[id] = ta.value;
    });
    return {
      formMessage: document.querySelector("#form-message")?.textContent || "",
      layer: document.querySelector("#detected-layer")?.textContent || "",
      layerReason: document.querySelector("#layer-reason")?.textContent || "",
      contentClass: document.querySelector("#detected-class")?.textContent || "",
      voice: document.querySelector("#detected-voice")?.textContent || "",
      voiceReason: document.querySelector("#voice-reason")?.textContent || "",
      validationScore: document.querySelector("#persona-validation-score")?.textContent || "",
      validationDetail: document.querySelector("#persona-validation-detail")?.textContent || "",
      platforms,
    };
  });

  let masterDraft = "";
  let validationWarnings = [];
  let layerKey = "";
  let exportVoice = "";
  let masterSource = "none";

  // Prefer polished master from export package (post formatCleanse / shapeCharacterParagraphs).
  try {
    if (outcome === "ok") {
      await page.locator("#select-all").click();
      const downloadPromise = page.waitForEvent("download", { timeout: 8000 });
      await page.locator("#download-json").click();
      const download = await downloadPromise;
      const path = await download.path();
      if (path) {
        const data = JSON.parse(readFileSync(path, "utf8"));
        masterDraft = data?.interpretation?.character?.masterDraft || "";
        validationWarnings = data?.interpretation?.character?.validation?.warnings || [];
        layerKey = data?.siteNewsDraft?.realityLayer || "";
        exportVoice = data?.siteNewsDraft?.voice || "";
        if (masterDraft) masterSource = "export-json";
      }
    }
  } catch (_err) {
    // fall through
  }

  // Fallback: last API master (pre-polish) — still useful for observer/version checks.
  if (!masterDraft && apiCaptures.length) {
    masterDraft = apiCaptures[apiCaptures.length - 1].masterDraft;
    validationWarnings = apiCaptures[apiCaptures.length - 1].validation?.warnings || [];
    masterSource = "api-raw";
  }

  // Last resort: longest platform body stripped of shells.
  if (!masterDraft) {
    masterDraft = platformsPreferMaster(pack.platforms);
    masterSource = masterDraft ? "platform-proxy" : "none";
  }

  return {
    outcome,
    ...pack,
    masterDraft,
    validationWarnings,
    layerKey,
    exportVoice,
    masterSource,
    apiCaptures: apiCaptures.map((c) => ({
      engine: c.engine,
      model: c.model,
      masterLen: countText(c.masterDraft),
      warnings: c.validation?.warnings || [],
    })),
  };
}

function platformsPreferMaster(platforms) {
  const order = ["patreon", "facebook-personal", "reddit", "discord", "instagram", "linkedin", "mastodon", "x"];
  let best = "";
  for (const id of order) {
    const text = platforms[id] || "";
    // Strip structural shells for patreon/discord
    const body = text
      .replace(/^# Archive log:[^\n]*\n*/i, "")
      .replace(/^\*\*[^*]+\*\*\n*/i, "")
      .replace(/\n*Continue through[\s\S]*$/i, "")
      .replace(/\n*Classification:[\s\S]*$/i, "")
      .replace(/^Title:[^\n]*\n*/i, "")
      .replace(/^Body:\n*/i, "")
      .trim();
    if (countText(body) > countText(best)) best = body;
  }
  return best;
}

async function main() {
  // Preflight bridge
  const warm = await fetch("http://127.0.0.1:4174/api/character?warm=1", {
    headers: { "X-Relay-Request": "character-v1" },
  }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  if (warm.error && !warm.status) {
    console.error("Local bridge not ready:", warm);
    process.exit(2);
  }
  console.log("Bridge warm:", warm);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  const only = (process.env.RELAY_AUDIT_ONLY || "").trim();
  const samples = [
    { name: "codex56-cathy", source: CODEX_SOURCE },
    { name: "ca001-cathy", source: CA001 },
  ].filter((sample) => !only || sample.name === only || sample.name.startsWith(only));

  for (const sample of samples) {
    console.log(`\n=== Generating ${sample.name} (${countText(sample.source)} chars) ===`);
    const started = Date.now();
    try {
      const pack = await generateOnce(page, sample.source);
      const elapsedMs = Date.now() - started;
      console.log(`outcome=${pack.outcome} elapsedMs=${elapsedMs} form=${pack.formMessage}`);
      const scored = scoreDraft(sample.name, sample.source, pack);
      scored.elapsedMs = elapsedMs;
      scored.outcome = pack.outcome;
      scored.masterSource = pack.masterSource;
      scored.apiCaptures = pack.apiCaptures;
      scored.layerReason = pack.layerReason;
      scored.validationScore = pack.validationScore;
      scored.validationDetail = pack.validationDetail;
      results.push(scored);
      console.log(`score ${scored.passed}/${scored.total}`);
      if (scored.failed.length) {
        console.log("FAILED:");
        for (const f of scored.failed) console.log(`  - ${f.id}: ${f.detail.slice(0, 160)}`);
      }
      console.log("--- master preview ---");
      console.log(scored.masterPreview);
      console.log("--- master tail ---");
      console.log(scored.masterTail);
    } catch (error) {
      console.error(sample.name, error);
      results.push({ name: sample.name, error: error.message || String(error), passed: 0, total: 0, failed: [{ id: "exception", detail: error.message }] });
    }
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    warm,
    results,
    totals: {
      samples: results.length,
      checksPassed: results.reduce((n, r) => n + (r.passed || 0), 0),
      checksTotal: results.reduce((n, r) => n + (r.total || 0), 0),
      failedIds: [...new Set(results.flatMap((r) => (r.failed || []).map((f) => f.id)))],
    },
  };
  writeFileSync(OUT, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(`Overall ${summary.totals.checksPassed}/${summary.totals.checksTotal}`);
  if (summary.totals.failedIds.length) {
    console.log("Unique failures:", summary.totals.failedIds.join(", "));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
