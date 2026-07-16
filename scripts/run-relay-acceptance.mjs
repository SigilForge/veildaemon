import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const root = process.cwd();
const fixture = JSON.parse(await readFile("tests/fixtures/relay/ca-001.json", "utf8"));
const artifactPath = "artifacts/relay-acceptance/latest.json";
const fixtureSourceSha256 = "b82df9a696a4c10f985d6951dd57cdc078c109869bc3cfbdd1f34ff7800d18d8";
const relevantFiles = [
  "studio/relay/AGENTS.md", "references/relay-architecture.md", "studio/relay/index.html",
  "studio/relay/relay.js", "scripts/relay-local-bridge.mjs", "api/character.js",
  "deploy/relay-vercel/vercel.json", "scripts/prepare-relay-vercel.sh",
  "tests/fixtures/relay/ca-001.json", "scripts/run-relay-acceptance.mjs"
];

async function fingerprint() {
  const hash = createHash("sha256");
  for (const file of relevantFiles) hash.update(file).update("\0").update(await readFile(file)).update("\0");
  return hash.digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function complete(text, platform) {
  const value = String(text || "").trim();
  assert(value.length >= 70, `${platform}: implausibly short draft (${value.length})`);
  assert(value.length <= fixture.platformLimits[platform], `${platform}: ${value.length}/${fixture.platformLimits[platform]} characters`);
  assert(!value.includes("…") && !/(^|[^.])\.\.\./.test(value), `${platform}: ellipsis/cutoff marker`);
  assert(!fixture.knownBadEndings.some((ending) => value.endsWith(ending)), `${platform}: known fragment ending`);
  assert(/[.!?][\”\"']?$/.test(value), `${platform}: unresolved ending`);
  const lower = value.toLowerCase();
  for (const [claim, terms] of Object.entries(fixture.requiredConcepts)) {
    assert(terms.some((term) => lower.includes(term)), `${platform}: missing ${claim} portion of central thought`);
  }
  return { characters: value.length, ownershipAndTrust: true, ending: value.slice(-48) };
}

function validateResult(payload, label) {
  assert(payload?.status === "ok", `${label}: status was not ok`);
  assert(payload?.engine === "ollama", `${label}: wrong engine ${payload?.engine}`);
  assert(payload?.model === "hermes4:14b", `${label}: wrong model ${payload?.model}`);
  const result = payload.result;
  assert(result && typeof result.masterDraft === "string", `${label}: missing structured result`);
  assert(result.validation?.voiceMatch >= fixture.minimumVoiceMatch, `${label}: weak voice match`);
  assert(result.validation?.sourceFidelity >= fixture.minimumSourceFidelity, `${label}: weak source fidelity`);
  assert(Array.isArray(result.validation?.warnings) && result.validation.warnings.length === 0, `${label}: validation warnings`);
  const platforms = {};
  for (const platform of Object.keys(fixture.platformLimits)) platforms[platform] = complete(result.platformDrafts?.[platform], `${label}/${platform}`);
  return { engine: payload.engine, model: payload.model, validation: result.validation, platforms };
}

function messages() {
  return [
    { role: "system", content: "You are Shade, a dry procedural emergency-response intelligence. Return only the required JSON. Preserve the complete source claim in every platform draft; rewrite to fit and never truncate." },
    { role: "user", content: `SOURCE\n${fixture.source}\n\nWrite a complete in-character master plus X <=500 chars, Threads <=420, Bluesky <=240, and Mastodon <=440. Every platform output must resolve both parts of the central thought: loss of ownership/control through licenses and physical-media removal, and legal resource extraction eroding trust. No hashtags, links, placeholders, ellipses, invented facts, or clipped endings. Internally reject and rewrite any incomplete output before returning the schema.` }
  ];
}

async function directRuns() {
  const results = [];
  for (let index = 1; index <= 5; index += 1) {
    const started = Date.now();
    const response = await fetch("http://127.0.0.1:4174/api/character", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Relay-Request": "character-v1", Origin: "http://127.0.0.1:4174" },
      body: JSON.stringify({ messages: messages() })
    });
    const payload = await response.json().catch(() => ({}));
    assert(response.ok, `direct ${index}: HTTP ${response.status} ${payload?.error || ""}`);
    results.push({ run: index, elapsedMs: Date.now() - started, ...validateResult(payload, `direct ${index}`) });
    console.log(`direct ${index}/5 passed`);
  }
  return results;
}

async function uiRuns() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (let index = 1; index <= 5; index += 1) {
      const page = await browser.newPage();
      const started = Date.now();
      await page.goto("http://127.0.0.1:4174/studio/relay/", { waitUntil: "domcontentloaded" });
      await page.locator("#source-text").fill(fixture.source);
      await page.locator("#character").selectOption(fixture.persona);
      await page.getByRole("button", { name: "Generate social package" }).click();
      await page.locator('[data-platform="x"] .variant-copy').waitFor({ state: "visible", timeout: 360_000 });
      const platforms = {};
      for (const platform of Object.keys(fixture.platformLimits)) {
        const value = await page.locator(`[data-platform="${platform}"] .variant-copy`).inputValue();
        platforms[platform] = complete(value, `ui ${index}/${platform}`);
      }
      const status = await page.locator("#persona-validation-score").textContent().catch(() => "");
      assert(!/weak|failed|warning/i.test(status || ""), `ui ${index}: weak character validation: ${status}`);
      results.push({ run: index, elapsedMs: Date.now() - started, engine: "ollama", platforms, validationSummary: status?.trim() });
      await page.close();
      console.log(`ui ${index}/5 passed`);
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function staticChecks() {
  const [html, relay, bridge, architecture, contract, prepare, pagesWorkflow] = await Promise.all([
    readFile("studio/relay/index.html", "utf8"), readFile("studio/relay/relay.js", "utf8"),
    readFile("scripts/relay-local-bridge.mjs", "utf8"), readFile("references/relay-architecture.md", "utf8"), readFile("studio/relay/AGENTS.md", "utf8"),
    readFile("scripts/prepare-relay-vercel.sh", "utf8"), readFile(".github/workflows/deploy-pages.yml", "utf8").catch(() => "")
  ]);
  assert(createHash("sha256").update(fixture.source).digest("hex") === fixtureSourceSha256, "CA-001 source fixture changed");
  assert(html.includes("Local Ollama (default)") && html.includes("Hosted OpenAI (backup)"), "UI engine labels drifted");
  assert(relay.includes("http://127.0.0.1:4174/api/character"), "browser local bridge contract drifted");
  assert((bridge.match(/think:/g) || []).length >= 3, "bridge attempt declaration is no longer three");
  assert(relay.includes("attempt < 2"), "browser package-attempt declaration drifted");
  assert(architecture.includes("six-inference worst case"), "worst-case inference count is unreported");
  assert(prepare.includes("deploy/relay-vercel"), "Vercel prepare source drifted");
  assert(contract.includes("knoxmortis-projects/veildaemon-relay") && contract.includes("https://relay.veildaemon.app"), "production deployment target drifted");
  assert(!pagesWorkflow.includes("studio/relay"), "GitHub Pages unexpectedly includes Relay");
  const hosted = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "tests/browser/studio.spec.js", "-g", "RelayDaemon standalone Vercel project|hosted character endpoint makes one bounded"], { cwd: root, encoding: "utf8", timeout: 120_000 });
  assert(hosted.status === 0, `hosted contract checks failed\n${hosted.stdout}\n${hosted.stderr}`);
  return { localDefaultLabel: true, hostedFallbackLabel: true, pagesExcluded: true, productionProject: "knoxmortis-projects/veildaemon-relay", hostedContractTests: "passed", successfulUiInferenceCalls: 1, worstCaseUiInferenceCalls: 6 };
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
  artifact.directRuns = await directRuns();
  artifact.uiRuns = await uiRuns();
  artifact.success = true;
} catch (error) {
  artifact.failure = error instanceof Error ? error.message : String(error);
} finally {
  await mkdir("artifacts/relay-acceptance", { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
}
if (!artifact.success) throw new Error(`${artifact.failure}\nEvidence written to ${artifactPath}`);
console.log(`Relay acceptance passed: 5 direct + 5 UI runs. Evidence: ${artifactPath}`);
