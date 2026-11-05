import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import http from "node:http";
import { chromium } from "@playwright/test";
import { missingSemanticGroups, validateSemanticGroups } from "./lib/relay-fixture-semantics.mjs";

const root = process.cwd();
const fixture = JSON.parse(await readFile("tests/fixtures/relay/ca-001.json", "utf8"));
const artifactPath = "artifacts/relay-acceptance/latest.json";
const fixtureSourceSha256 = "b82df9a696a4c10f985d6951dd57cdc078c109869bc3cfbdd1f34ff7800d18d8";
const relevantFiles = [
  "studio/relay/AGENTS.md", "studio/relay/index.html",
  "studio/relay/relay.js", "studio/relay/platform-policy.js", "scripts/relay-local-bridge.mjs", "api/character.js",
  "deploy/relay-vercel/vercel.json", "scripts/prepare-relay-vercel.sh",
  "tests/fixtures/relay/ca-001.json", "scripts/run-relay-acceptance.mjs", "tests/unit/test_relay_bridge_policy.mjs",
  "scripts/lib/relay-fixture-semantics.mjs", "tests/unit/test_relay_fixture_semantics.mjs"
];

async function fingerprint() {
  const hash = createHash("sha256");
  for (const file of relevantFiles) hash.update(file).update("\0").update(await readFile(file)).update("\0");
  return hash.digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// `platform` is the fixture key (x, threads, ...); `label` only prefixes messages. Until 2026-09-25 the
// label was passed as the key, so every limit lookup was undefined and no run could pass.
function complete(text, platform, label = platform) {
  const limit = fixture.platformLimits[platform];
  assert(Number.isInteger(limit), `${label}: no character limit for platform "${platform}" in CA-001`);
  const value = String(text || "").trim();
  assert(value.length >= 70, `${label}: implausibly short draft (${value.length})`);
  assert(value.length <= limit, `${label}: ${value.length}/${limit} characters`);
  // Long-form lanes (X Premium) must carry the full copy, not the retired short-form compression.
  const floor = fixture.longFormMinimums?.[platform];
  if (floor) assert(value.length >= floor, `${label}: ${value.length} characters is short-form compression (long-form minimum ${floor})`);
  assert(!value.includes("…") && !/(^|[^.])\.\.\./.test(value), `${label}: ellipsis/cutoff marker`);
  assert(!fixture.knownBadEndings.some((ending) => value.endsWith(ending)), `${label}: known fragment ending`);
  assert(/[.!?][\”\"']?$/.test(value), `${label}: unresolved ending`);
  // Fixture-owned meaning: CA-001 declares what its source means; the runtime never sees these groups, and the
  // writer's own declared groups play no part in this check.
  for (const group of missingSemanticGroups(value, fixture.semanticGroups)) {
    assert(false, `${label}: missing ${group} half of the central thought (${fixture.semanticGroups[group].meaning})`);
  }
  return { characters: value.length, semanticGroups: Object.keys(fixture.semanticGroups), ending: value.slice(-48) };
}

function validateResult(payload, label) {
  assert(payload?.status === "ok", `${label}: status was not ok`);
  assert(payload?.engine === "ollama", `${label}: wrong engine ${payload?.engine}`);
  assert(payload?.model === "hf.co/zerofata/MS3.2-PaintedFantasy-v4.1-24B-GGUF:Q5_K_M", `${label}: wrong model ${payload?.model}`);
  assert(payload?.thinking === "off", `${label}: wrong thinking mode ${payload?.thinking}`);
  assert(payload?.editor?.model === "qwen3.5:9b", `${label}: wrong editor model ${payload?.editor?.model}`);
  const result = payload.result;
  assert(result && typeof result.masterDraft === "string", `${label}: missing structured result`);
  assert(result.validation?.voiceMatch >= fixture.minimumVoiceMatch, `${label}: weak voice match`);
  assert(result.validation?.sourceFidelity >= fixture.minimumSourceFidelity, `${label}: weak source fidelity`);
  assert(Array.isArray(result.validation?.warnings) && result.validation.warnings.length === 0, `${label}: validation warnings`);
  const platforms = {};
  for (const platform of Object.keys(fixture.platformLimits)) platforms[platform] = complete(result.platformDrafts?.[platform], platform, `${label}/${platform}`);
  return { engine: payload.engine, model: payload.model, editor: payload.editor, validation: result.validation, platforms };
}

function messages() {
  return [
    { role: "system", content: "You are Shade, a dry procedural emergency-response intelligence. Return only the required JSON. Preserve the complete source claim in every platform draft; rewrite to fit and never truncate." },
    { role: "user", content: `SOURCE\n${fixture.source}\n\nWrite a complete in-character master plus X as full long copy (X Premium long post: the complete argument, not a short post), Threads <=420, Bluesky <=240, and Mastodon <=440. Every platform output must resolve both parts of the central thought: loss of ownership/control through licenses and physical-media removal, and legal resource extraction eroding trust. No hashtags, links, placeholders, ellipses, invented facts, or clipped endings. Internally reject and rewrite any incomplete output before returning the schema.` }
  ];
}

// Direct client with an explicit timeout: Node's fetch drops a request after ~300 s without response headers,
// shorter than a legitimate cold start. 420 s covers the page's 360 s budget plus margin.
function postCharacter(body) {
  return new Promise((resolvePost, rejectPost) => {
    const req = http.request({ host: "127.0.0.1", port: 4174, path: "/api/character", method: "POST", timeout: 420_000,
      headers: { "Content-Type": "application/json", "X-Relay-Request": "character-v1", Origin: "http://127.0.0.1:4174", "Content-Length": Buffer.byteLength(body) } }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let payload = {};
        try { payload = JSON.parse(data); } catch (_error) { /* non-JSON error body */ }
        resolvePost({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, payload });
      });
    });
    req.on("timeout", () => req.destroy(new Error("direct request exceeded 420 s")));
    req.on("error", rejectPost);
    req.end(body);
  });
}

// Results are appended as each run finishes, so a failing suite still records the runs before it.
async function directRuns(results = []) {
  for (let index = 1; index <= 5; index += 1) {
    const started = Date.now();
    const response = await postCharacter(JSON.stringify({ messages: messages() }));
    const payload = response.payload;
    results.push({ run: index, elapsedMs: Date.now() - started, status: response.status, editor: payload?.editor || null, timings: payload?.timings || null, pending: true });
    assert(response.ok, `direct ${index}: HTTP ${response.status} ${payload?.error || ""}`);
    results[results.length - 1] = { run: index, elapsedMs: Date.now() - started, timings: payload?.timings || null, ...validateResult(payload, `direct ${index}`) };
    console.log(`direct ${index}/5 passed`);
  }
  return results;
}

// UI runs record the bridge's own editor evidence (structural only) for every character request the page makes,
// so a UI failure is diagnosable from the artifact, not the journal.
async function uiRuns(results = []) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (let index = 1; index <= 5; index += 1) {
      const page = await browser.newPage();
      const started = Date.now();
      const bridgeResponses = [];
      results.push({ run: index, pending: true, bridgeResponses });
      page.on("response", async (response) => {
        if (!response.url().startsWith("http://127.0.0.1:4174/api/character") || response.request().method() !== "POST") return;
        const payload = await response.json().catch(() => ({}));
        bridgeResponses.push({ status: response.status(), error: payload?.error || null, editor: payload?.editor || null, timings: payload?.timings || null });
      });
      await page.goto("http://127.0.0.1:4174/studio/relay/", { waitUntil: "domcontentloaded" });
      await page.locator("#source-text").fill(fixture.source);
      await page.locator("#character").selectOption(fixture.persona);
      await page.getByRole("button", { name: "Generate social package" }).click();
      await page.locator('[data-platform="x"] .variant-copy').waitFor({ state: "visible", timeout: 420_000 }); // above the page's own 360 s budget
      const platforms = {};
      for (const platform of Object.keys(fixture.platformLimits)) {
        const value = await page.locator(`[data-platform="${platform}"] .variant-copy`).inputValue();
        platforms[platform] = complete(value, platform, `ui ${index}/${platform}`);
      }
      const engineStatus = (await page.locator("#persona-engine-status").textContent().catch(() => "")) || "";
      assert(engineStatus.includes("Using local Ollama (default) · hf.co/zerofata/MS3.2-PaintedFantasy-v4.1-24B-GGUF:Q5_K_M"), `ui ${index}: not generated by the local engine: ${engineStatus}`);
      const status = await page.locator("#persona-validation-score").textContent().catch(() => "");
      assert(!/weak|failed|warning/i.test(status || ""), `ui ${index}: weak character validation: ${status}`);
      results[results.length - 1] = { run: index, elapsedMs: Date.now() - started, engine: "ollama", platforms, validationSummary: status?.trim(), bridgeResponses };
      await page.close();
      console.log(`ui ${index}/5 passed`);
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function staticChecks() {
  const [html, relay, bridge, contract, prepare, pagesWorkflow] = await Promise.all([
    readFile("studio/relay/index.html", "utf8"), readFile("studio/relay/relay.js", "utf8"),
    readFile("scripts/relay-local-bridge.mjs", "utf8"), readFile("studio/relay/AGENTS.md", "utf8"),
    readFile("scripts/prepare-relay-vercel.sh", "utf8"), readFile(".github/workflows/deploy-pages.yml", "utf8").catch(() => "")
  ]);
  assert(createHash("sha256").update(fixture.source).digest("hex") === fixtureSourceSha256, "CA-001 source fixture changed");
  assert(html.includes("Local Ollama (default)") && html.includes("Hosted OpenAI (backup)"), "UI engine labels drifted");
  assert(relay.includes("http://127.0.0.1:4174/api/character"), "browser local bridge contract drifted");
  assert((bridge.match(/think:/g) || []).length >= 3, "bridge attempt declaration is no longer three");
  assert(relay.includes("attempt < 2"), "browser package-attempt declaration drifted");
  assert(contract.includes("fifty-four-inference worst case"), "worst-case inference count is unreported");
  // Platform policy: one map feeds both the bridge's enforcement and the UI prompt, and it may never
  // exceed CA-001's independent ceilings (the fixture, not the policy, is the acceptance authority).
  assert(bridge.includes('import "../studio/relay/platform-policy.js"'), "bridge no longer enforces the shared platform policy");
  assert(!/clampDraft|ensureCompleteEnding/.test(bridge), "bridge reintroduced draft clipping");
  assert(relay.includes("relayPolicyPromptLines()") && !/hard max \d{3}\)/.test(relay), "UI prompt limits are no longer generated from the platform policy");
  assert(html.indexOf("platform-policy.js") > -1 && html.indexOf("platform-policy.js") < html.indexOf("relay.js?"), "UI does not load the platform policy before relay.js");
  await import(new URL("../studio/relay/platform-policy.js", import.meta.url));
  const policy = globalThis.RelayPlatformPolicy?.platforms || {};
  for (const [platform, ceiling] of Object.entries(fixture.platformLimits)) {
    assert(Number.isInteger(policy[platform]?.max), `platform policy has no limit for ${platform}`);
    assert(policy[platform].max <= ceiling, `platform policy ${platform} max ${policy[platform].max} exceeds CA-001 ceiling ${ceiling}`);
  }
  assert(prepare.includes("deploy/relay-vercel"), "Vercel prepare source drifted");
  assert(contract.includes("knoxmortis-projects/veildaemon-relay") && contract.includes("https://relay.veildaemon.app"), "production deployment target drifted");
  assert(!pagesWorkflow.includes("studio/relay"), "GitHub Pages unexpectedly includes Relay");
  // Bridge regression: over-limit output is rewritten through the existing ladder, never clipped.
  const bridgePolicy = spawnSync(process.execPath, ["--test", "tests/unit/test_relay_bridge_policy.mjs"], { cwd: root, encoding: "utf8", timeout: 120_000 });
  assert(bridgePolicy.status === 0, `bridge policy regression failed\n${bridgePolicy.stdout}\n${bridgePolicy.stderr}`);
  // Fixture meaning: halves declared, non-empty, disjoint; matcher regression tests pass.
  assert(!validateSemanticGroups(fixture.semanticGroups), `CA-001 semanticGroups invalid: ${validateSemanticGroups(fixture.semanticGroups)}`);
  const fixtureSemantics = spawnSync(process.execPath, ["--test", "tests/unit/test_relay_fixture_semantics.mjs"], { cwd: root, encoding: "utf8", timeout: 60_000 });
  assert(fixtureSemantics.status === 0, `fixture semantics regression failed\n${fixtureSemantics.stdout}\n${fixtureSemantics.stderr}`);
  const hosted = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "tests/browser/studio.spec.js", "-g", "RelayDaemon standalone Vercel project|hosted character endpoint makes one bounded"], { cwd: root, encoding: "utf8", timeout: 120_000 });
  assert(hosted.status === 0, `hosted contract checks failed\n${hosted.stdout}\n${hosted.stderr}`);
  return { localDefaultLabel: true, hostedFallbackLabel: true, pagesExcluded: true, productionProject: "knoxmortis-projects/veildaemon-relay", hostedContractTests: "passed", platformPolicy: Object.fromEntries(Object.entries(policy).map(([k, v]) => [k, v.max])), successfulUiInferenceCalls: 1, worstCaseUiInferenceCalls: 54 };
}

const currentFingerprint = await fingerprint();
if (process.argv.includes("--verify-artifact")) {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  assert(artifact.success === true, "latest artifact did not pass");
  assert(artifact.fingerprint === currentFingerprint, "latest artifact is stale");
  console.log(`${artifactPath} is current and successful (${artifact.timestamp})`);
  process.exit(0);
}

const artifact = { schemaVersion: 1, fixture: fixture.id, timestamp: new Date().toISOString(), success: false, fingerprint: currentFingerprint, gitHead: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(), directRuns: [], uiRuns: [] };
try {
  artifact.staticChecks = await staticChecks();
  await directRuns(artifact.directRuns);
  await uiRuns(artifact.uiRuns);
  artifact.success = true;
} catch (error) {
  artifact.failure = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir("artifacts/relay-acceptance", { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
}
if (!artifact.success) throw new Error(`${artifact.failure}\nEvidence written to ${artifactPath}`);
console.log(`Relay acceptance passed: 5 direct + 5 UI runs. Evidence: ${artifactPath}`);
