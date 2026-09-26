import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import "../studio/relay/platform-policy.js";

// Single source of truth for platform generation limits (shared with studio/relay/relay.js).
const POLICY = globalThis.RelayPlatformPolicy;
if (!POLICY?.platforms) throw new Error("studio/relay/platform-policy.js did not load");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.RELAY_PORT || "4174", 10);
const OLLAMA_CHAT_URL = process.env.RELAY_OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
// Default engine: VeilForge's heavy prose/RP model (its xlarge_model_id slot), the role match for
// Relay's character-voice generation. hermes4:14b is retired.
const OLLAMA_MODEL = process.env.RELAY_OLLAMA_MODEL || "hf.co/zerofata/MS3.2-PaintedFantasy-v4.1-24B-GGUF:Q5_K_M";
// Thinking is explicit per model:
//   off              — never request reasoning (PaintedFantasy: capabilities are completion + tools only)
//   low|medium|high  — reasoning level, only for a model whose Ollama capabilities include "thinking"
//   auto             — omit the field and take Ollama/model defaults; only when deliberately chosen
// The bridge refuses to start if a level is requested for a model without the thinking capability.
// How long Ollama keeps the model resident after a Relay request or preload. Short by default so a
// 24B model does not hold GPU/host memory for half an hour after Relay goes idle.
const OLLAMA_KEEP_ALIVE = String(process.env.RELAY_OLLAMA_KEEP_ALIVE || "5m").trim();
if (!/^(-1|0|\d+(\.\d+)?(ms|s|m|h)?)$/.test(OLLAMA_KEEP_ALIVE)) {
  console.error(`RELAY_OLLAMA_KEEP_ALIVE must be an Ollama duration such as 5m, 90s, 0, or -1 (got "${OLLAMA_KEEP_ALIVE}")`);
  process.exit(1);
}
// Editor (copy editor behind the writer): compresses/fixes only the platform lanes that break policy.
// The writer cannot hit character budgets from prose instructions; the editor gets runtime-derived word
// budgets, and the runtime's character count stays the only authority. See studio/relay/AGENTS.md.
const EDITOR_MODEL = process.env.RELAY_EDITOR_MODEL || "qwen3.5:9b";
const EDITOR_NUM_CTX = 8_192; // constant so the editor model loads once
const EDITOR_ROUNDS = 3;
const EDITOR_SAFETY = 0.9;
const THINKING_MODES = new Set(["off", "low", "medium", "high", "auto"]);
const OLLAMA_THINKING = String(process.env.RELAY_OLLAMA_THINKING || "off").trim().toLowerCase();
if (!THINKING_MODES.has(OLLAMA_THINKING)) {
  console.error(`RELAY_OLLAMA_THINKING must be one of ${[...THINKING_MODES].join(", ")} (got "${OLLAMA_THINKING}")`);
  process.exit(1);
}
const ALLOWED_ORIGINS = new Set([
  `http://${HOST}:${PORT}`,
  `http://localhost:${PORT}`,
  "https://veildaemon-relay-knoxmortis-knoxmortis-projects.vercel.app",
  "https://relay.veildaemon.app",
  ...(process.env.RELAY_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean),
]);
const MAX_BODY_BYTES = 60_000;
const CHARACTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["masterDraft", "whatChanges", "whyItMatters", "platformDrafts", "validation"],
  properties: {
    masterDraft: { type: "string" },
    whatChanges: { type: "array", items: { type: "string" } },
    whyItMatters: { type: "array", items: { type: "string" } },
    platformDrafts: {
      type: "object",
      additionalProperties: false,
      required: ["x", "threads", "bluesky", "mastodon"],
      properties: {
        x: { type: "string" },
        threads: { type: "string" },
        bluesky: { type: "string" },
        mastodon: { type: "string" },
      },
    },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["voiceMatch", "sourceFidelity", "canonSafe", "knowledgeBoundarySafe", "characterMarkers", "warnings"],
      properties: {
        voiceMatch: { type: "number", minimum: 0, maximum: 1 },
        sourceFidelity: { type: "number", minimum: 0, maximum: 1 },
        canonSafe: { type: "boolean" },
        knowledgeBoundarySafe: { type: "boolean" },
        characterMarkers: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
      },
    },
  },
};
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".wasm": "application/wasm", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8" };

function json(res, status, body) {
  res.writeHead(status, { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("INPUT_TOO_LARGE"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) throw new Error("INVALID_REQUEST");
  let chars = 0;
  const messages = value.map((message) => {
    if (!message || !["system", "user"].includes(message.role) || typeof message.content !== "string") throw new Error("INVALID_REQUEST");
    chars += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (chars > 48_000) throw new Error("INPUT_TOO_LARGE");
  return messages;
}

function invalidOutput(detail, metadata = {}) {
  return Object.assign(new Error("OLLAMA_INVALID_OUTPUT"), { detail, ...metadata });
}

function countGraphemes(value) {
  return [...String(value || "")].length;
}

const VERSION_DOT = "\uE000";

function protectVersionDots(value) {
  return String(value || "").replace(/(\d)\.(\d)/g, `$1${VERSION_DOT}$2`);
}

function unprotectVersionDots(value) {
  return String(value || "").split(VERSION_DOT).join(".");
}

function splitSentences(value) {
  // Protect 5.6 so "5." is not treated as a sentence end (creates "5." + "6?").
  const protectedText = protectVersionDots(String(value || "").replace(/\s+/g, " ").trim());
  return protectedText
    .split(/(?<=[.!?])\s+/)
    .map((part) => unprotectVersionDots(part.trim()))
    .filter(Boolean);
}

function sentenceKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Models often emit "5. 6" / "5.\n6" / "5. 6?" when they mean "5.6". */
function repairVersionNumbers(value) {
  let text = String(value || "");
  for (let i = 0; i < 6; i += 1) {
    const next = text
      .replace(/(\d)\.\s*[\r\n]+\s*(\d)/g, "$1.$2")
      .replace(/(\d)\.\s+(\d)/g, "$1.$2")
      .replace(/\b(\d)\.\s*(?:\n\s*)+(\d)([?!,;:]?)/g, "$1.$2$3");
    if (next === text) break;
    text = next;
  }
  text = text.replace(/\b([Vv])\s+(\d+\.\d+(?:\.\d+)*)\b/g, "$1$2");
  text = text.replace(/\b([Vv])(\d)\s*\.\s*(\d)/g, "$1$2.$3");
  return text;
}

function repairBrokenQuotes(value) {
  let text = String(value || "");
  text = text.replace(/(["“])([^"“”\n]{1,220}[.!?…])\s*\n\n+([A-Z“"][^"“”\n]{1,220}[.!?…])(["”])?/g, (match, open, first, second, close) => {
    const end = close || (open === "“" ? "”" : '"');
    return `${open}${first} ${second}${end}`;
  });
  text = text.replace(/(["“])([^"“”\n]{1,220}[.!?…])\s*\n\n+(["“])([^"“”\n]{1,220}[.!?…])(["”])/g, "$1$2 $4$5");
  return text;
}

function formatCleanse(value) {
  return repairVersionNumbers(String(value || "").replace(/\s+/g, " ").trim().replace(/\n{3,}/g, "\n\n"));
}

/** Strip mid-stream sentence loops only — never delete mid-sentence n-grams (that amputates endings). */
function collapseSelfLoops(value) {
  const sentences = splitSentences(repairBrokenQuotes(repairVersionNumbers(value)));
  const kept = [];
  const seen = new Set();
  for (const sentence of sentences) {
    const key = sentenceKey(sentence);
    if (!key || key.split(" ").length < 3) {
      kept.push(sentence);
      continue;
    }
    if (seen.has(key)) continue;
    const tokens = key.split(" ");
    if (tokens.length >= 8) {
      const tokenSet = new Set(tokens);
      const near = [...seen].some((prior) => {
        const priorTokens = prior.split(" ");
        if (priorTokens.length < 8) return false;
        if (Math.abs(priorTokens.length - tokens.length) > 3) return false;
        const overlap = priorTokens.filter((token) => tokenSet.has(token)).length;
        return overlap / Math.max(priorTokens.length, tokens.length) >= 0.9;
      });
      if (near) continue;
    }
    seen.add(key);
    kept.push(sentence);
  }
  return formatCleanse(kept.join(" "));
}

/**
 * Lossless normalization only: whitespace, "5. 6" -> "5.6", rejoined broken quotes, and removal of
 * verbatim repeated sentences (self-loops). Never drops sentences to fit a length and never trims an
 * unfinished ending — those are policy violations that the model must rewrite.
 */
/**
 * Deterministic, word-preserving punctuation repair for quoted elisions (sources quote transmissions as
 * "Ownership is deprecated... Access is sufficient..."): an ellipsis that ends a sentence becomes a period, a
 * leading one inside a quotation is dropped, and a pause between words becomes an em dash. No word is added
 * or removed; only a trailing ellipsis remains, and that is an unfinished-ending violation.
 */
function repairEllipses(value) {
  return value
    .replace(/\.{4,}/g, ".") // "...." is an ellipsis plus a period: the sentence ends
    .replace(/(["“])\s*(?:\.\.\.|…)\s*/g, "$1")
    .replace(/\s*(?:\.\.\.|…)(["”])/g, ".$1")
    .replace(/\s*(?:\.\.\.|…)\s+(?=["“]?[A-Z])/g, ". ")
    // A remaining pause between words becomes an em dash; a trailing one stays (it is an unfinished ending).
    .replace(/\s*(?:\.\.\.|…)\s*(?=[\p{L}\p{N}"“])/gu, " — ")
    // Before a closing single quote it ends the sentence; before other punctuation (",", ")", a fourth dot) it
    // is redundant and dropped.
    .replace(/\s*(?:\.\.\.|…)(['’])/g, ".$1")
    .replace(/\s*(?:\.\.\.|…)(?=[.,;:!?)\]])/g, "");
}

function normalizeDraft(value) {
  return collapseSelfLoops(repairEllipses(String(value || "").replace(/\s+/g, " ").trim()));
}

/** Terminal punctuation, no ellipsis/dash cutoff, no dangling function word. One sentence is fine. */
function endsCleanly(value) {
  const clean = String(value || "").trim();
  if (/(…|\.\.\.|—|-)["”']?$/.test(clean)) return false;
  if (!/[.!?]["”']?$/.test(clean)) return false;
  const lastCore = (splitSentences(clean).pop() || "").replace(/[.!?…"”']+/g, "").trim();
  return !/\b(and|but|or|the|a|an|to|of|with|for|that|which|who|when|while|because|so|then)\s*$/i.test(lastCore);
}

function hasEllipsis(value) {
  return /…|\.\.\./.test(String(value || ""));
}

// Mechanical lane checks the runtime owns: length, ending, ellipsis. Returns violations; never edits text.
function laneViolations(key, rule, text) {
  const violations = [];
  if (typeof text !== "string") return [{ field: key, label: rule.label, problem: "missing", length: 0, max: rule.max }];
  const length = countGraphemes(text);
  if (length > rule.max) violations.push({ field: key, label: rule.label, problem: "over_limit", length, max: rule.max });
  else if (length < (rule.floor ?? 40)) violations.push({ field: key, label: rule.label, problem: "too_short", length, max: rule.max, floor: rule.floor ?? 40 });
  if (!endsCleanly(text)) violations.push({ field: key, label: rule.label, problem: "unfinished_ending", length, max: rule.max });
  if (hasEllipsis(text)) violations.push({ field: key, label: rule.label, problem: "ellipsis", length, max: rule.max });
  return violations;
}

function policyViolation(violations) {
  return invalidOutput("policy_violation", { violations });
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_nested) {
      return null;
    }
  }
}

function validateResult(value) {
  if (!value || typeof value !== "object") throw invalidOutput("result_not_object");
  const violations = [];
  const masterDraft = normalizeDraft(value.masterDraft);
  if (countGraphemes(masterDraft) < 40) throw invalidOutput("master_draft_length", { draftLength: countGraphemes(masterDraft) });
  if (countGraphemes(masterDraft) > 8_000) violations.push({ field: "masterDraft", problem: "too_long", length: countGraphemes(masterDraft), max: 8_000 });
  if (!endsCleanly(masterDraft)) violations.push({ field: "masterDraft", problem: "unfinished_ending", length: countGraphemes(masterDraft) });
  const platformDrafts = value.platformDrafts;
  if (!platformDrafts || typeof platformDrafts !== "object") throw invalidOutput("platform_drafts_missing");
  const normalizedPlatforms = {};
  const lanes = [];
  for (const [key, rule] of Object.entries(POLICY.platforms)) {
    const draft = platformDrafts[key];
    const clean = typeof draft === "string" ? normalizeDraft(draft) : draft;
    lanes.push(...laneViolations(key, rule, clean));
    normalizedPlatforms[key] = typeof clean === "string" ? clean : "";
  }
  // The writer declares both halves of the central thought; the runtime grounds each group in the master (an
  // empty group is a writer failure, retried by the writer's own ladder) and enforces them on every lane.
  const concepts = conceptGroups(masterDraft, value);
  const ungrounded = Object.keys(concepts).filter((group) => !concepts[group].length);
  if (ungrounded.length) throw invalidOutput("concept_groups_ungrounded", { groups: ungrounded });
  for (const [key, rule] of Object.entries(POLICY.platforms)) {
    if (rule.longForm || lanes.some((v) => v.field === key)) continue;
    const missing = missingGroups(normalizedPlatforms[key], concepts);
    if (missing.length) lanes.push({ field: key, label: rule.label, problem: "concept_dropped", missingGroups: missing, length: countGraphemes(normalizedPlatforms[key]), max: rule.max });
  }
  // Master problems go back to the writer; lane problems go to the editor (returned, not thrown).
  if (violations.length) throw policyViolation([...violations, ...lanes]);
  const validation = value.validation;
  if (!validation || typeof validation !== "object") throw invalidOutput("validation_missing");
  const normalizedValidation = { ...validation };
  for (const key of ["voiceMatch", "sourceFidelity"]) {
    const score = typeof validation[key] === "string" ? Number.parseFloat(validation[key]) : validation[key];
    if (!Number.isFinite(score) || score < 0 || score > 100) throw invalidOutput(`validation_score_${key}`);
    normalizedValidation[key] = score > 1 ? score / 100 : score;
  }
  for (const key of ["canonSafe", "knowledgeBoundarySafe"]) if (typeof validation[key] !== "boolean") throw invalidOutput(`validation_boolean_${key}`);
  for (const key of ["characterMarkers", "warnings"]) {
    let list = validation[key];
    // Local models sometimes emit a string or object here; coerce rather than fail a good draft.
    if (!Array.isArray(list)) list = typeof list === "string" && list.trim() ? [list.trim()] : [];
    list = list.filter((item) => typeof item === "string").slice(0, 12);
    if (list.some((item) => typeof item !== "string")) throw invalidOutput(`validation_array_${key}`);
    normalizedValidation[key] = list;
  }
  return { result: { masterDraft, platformDrafts: normalizedPlatforms, validation: normalizedValidation }, laneViolations: lanes, concepts };
}

const OLLAMA_ATTEMPTS = [
  // First try uses the configured thinking mode (off for PaintedFantasy), with room for the JSON payload.
  { think: "configured", temperature: 0.25, num_ctx: 16_384, num_predict: 10_240 },
  // Reasoning can burn the budget (done_reason=length, empty content), so fallbacks never think.
  { think: "off", temperature: 0.2, num_ctx: 16_384, num_predict: 6_144 },
  { think: "off", temperature: 0.1, num_ctx: 16_384, num_predict: 6_144 },
];

// Ollama "think" field for an attempt: false (off), a level string, or omitted (auto).
function thinkField(attemptThink) {
  const mode = attemptThink === "configured" ? OLLAMA_THINKING : "off";
  if (mode === "auto") return {};
  return { think: mode === "off" ? false : mode };
}

async function requestOllamaOnce(messages, attempt) {
  const { think, temperature, num_ctx, num_predict } = attempt;
  const response = await fetch(OLLAMA_CHAT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(240_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      ...thinkField(think),
      format: CHARACTER_SCHEMA,
      keep_alive: OLLAMA_KEEP_ALIVE,
      messages,
      options: { temperature, num_ctx, num_predict },
    }),
  });
  if (!response.ok) throw Object.assign(new Error("OLLAMA_FAILED"), { status: response.status });
  const payload = await response.json();
  const content = String(payload.message?.content || "");
  const thinking = String(payload.message?.thinking || "");
  const parsed = extractJsonObject(content) || extractJsonObject(thinking);
  if (!parsed) {
    throw Object.assign(invalidOutput(content ? "invalid_json" : "empty_content"), {
      contentLength: content.length,
      thinkingLength: thinking.length,
      doneReason: payload.done_reason || null,
      hasThinking: Boolean(thinking),
      think,
    });
  }
  try {
    return validateResult(parsed);
  } catch (error) {
    // Keep the rejected JSON so the next attempt can rewrite it against the specific violations.
    if (error?.violations) error.previousContent = content || JSON.stringify(parsed);
    throw error;
  }
}

/** Authoritative platform policy, generated from the shared map, added after the caller's system prompt. */
function withPolicy(messages) {
  const policy = {
    role: "system",
    content: [
      "RELAY PLATFORM POLICY (authoritative; overrides any other length guidance).",
      "Count characters, not words. Post bodies only; no hashtags in JSON.",
      POLICY.promptLines(),
      "A platform draft over its hard max is rejected and must be rewritten shorter as a complete thought.",
      "Never truncate, never stop mid-sentence, never end with an ellipsis or dash.",
      "Use no ellipses anywhere in platform drafts, including inside quotations.",
      "The central thought has two halves; declare short anchors (a word or two-word phrase) for each, copied from your masterDraft:",
      "- whatChanges: 1-3 anchors for what is happening or being lost.",
      "- whyItMatters: 1-3 anchors for why it matters or what it costs.",
      "Every Threads, Bluesky, and Mastodon draft must contain at least one anchor from each group.",
    ].join("\n"),
  };
  const firstUser = messages.findIndex((message) => message.role !== "system");
  const at = firstUser < 0 ? messages.length : firstUser;
  return [...messages.slice(0, at), policy, ...messages.slice(at)];
}

function describeViolation(v) {
  const name = v.label || v.field;
  if (v.problem === "over_limit") return `${name}: ${v.length} characters; hard max ${v.max}. Rewrite it to ${v.targetMin ? `~${v.targetMin}–` : "at most "}${v.max} characters.`;
  if (v.problem === "too_short") return `${name}: ${v.length} characters; too short. Rewrite it to ~${v.targetMin}–${v.max} characters.`;
  if (v.problem === "too_long") return `${name}: ${v.length} characters; maximum ${v.max}. Rewrite it shorter.`;
  if (v.problem === "missing") return `${name}: missing. Write it (hard max ${v.max}).`;
  return `${name}: does not end on a complete thought. Rewrite the ending as a finished sentence.`;
}

/** Feedback turn for the next attempt: the rejected JSON plus the exact violations to rewrite. */
function rewriteTurn(baseMessages, error) {
  return [
    ...baseMessages,
    { role: "assistant", content: error.previousContent },
    {
      role: "user",
      content: [
        "Your previous JSON violated the Relay platform policy:",
        ...error.violations.map((v) => `- ${describeViolation(v)}`),
        "Return the complete JSON again. Rewrite each affected draft so it satisfies the policy as a complete, faithful thought.",
        "Do not truncate, cut mid-sentence, or add ellipses. Keep drafts that were already valid unless they must change.",
      ].join("\n"),
    },
  ];
}

const wordCount = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;

/** Runtime calculator: shrink the word budget in proportion to the measured character overshoot. */
function wordRange(rule, text, safety = EDITOR_SAFETY) {
  const target = rule.editTarget ?? rule.max - 10;
  const max = Math.max(8, Math.floor(wordCount(text) * (target / Math.max(1, countGraphemes(text))) * safety));
  // targetChars is the character count the budget aims at (for evidence only; the hard max stays the judge).
  return { min: Math.max(6, Math.floor(max * 0.8)), max, targetChars: Math.round(target * safety) };
}

const EDITOR_CANDIDATES = 3;
const SURFACE_PROBLEMS = new Set(["ellipsis", "unfinished_ending"]);

/** Human-readable rejection reason fed back to the editor (accumulated, so rounds never oscillate). */
function rejectionReason(v) {
  if (v.problem === "over_limit") return `too long (${v.length} characters; the hard limit is ${v.max})`;
  if (v.problem === "too_short") return `too short (${v.length} characters; the minimum is ${v.floor})`;
  if (v.problem === "unfinished_ending") return "ended on an unfinished sentence";
  if (v.problem === "ellipsis") return "contained an ellipsis";
  if (v.problem === "missing") return "was empty";
  if (v.problem === "concept_dropped") return `dropped the ${v.missingGroups.map(groupLabel).join(" and the ")} half of the central thought`;
  if (v.problem === "edit_scope_exceeded") return `rewrote the post instead of fixing punctuation (${v.previous} -> ${v.length} characters)`;
  if (v.problem === "meaning_changed") return `changed the meaning: ${v.issue}`;
  return v.problem;
}

const groupLabel = (group) => (group === "whatChanges" ? "what-changes" : "why-it-matters");

function editorInstruction(key, rule, lane, concepts) {
  const lines = [`${rule.label} (key "${key}"): return ${lane.count} candidate${lane.count > 1 ? "s" : ""}, each a complete rewrite of the WRITER'S DRAFT below.`];
  if (lane.surfaceOnly) {
    lines.push(`- Fix only this: ${[...new Set(lane.initial.map(rejectionReason))].join("; ")}. Keep every other word; use complete punctuation instead of an ellipsis.`);
  } else {
    if (concepts) lines.push(`- Keep both halves of the central thought: at least one of (${concepts.whatChanges.join(", ")}) for what changes, and at least one of (${concepts.whyItMatters.join(", ")}) for why it matters.`);
    if (lane.budget) lines.push(`- Each candidate: ${lane.budget.min}–${lane.budget.max} words${rule.maxSentences ? `, at most ${rule.maxSentences} sentences` : ""}. The runtime counts characters; the hard limit is ${rule.max}.`);
    else lines.push(`- Each candidate must stay under the hard limit of ${rule.max} characters${lane.initial.some((v) => v.problem === "too_short") ? `, and be longer than ${rule.floor ?? 40} characters` : ""}.`);
    if (lane.initial.some((v) => SURFACE_PROBLEMS.has(v.problem))) lines.push("- End on a complete sentence; no ellipses.");
  }
  const omitted = [...new Set(lane.last.filter((v) => v.problem === "concept_dropped").flatMap((v) => v.missingGroups))];
  for (const group of omitted) lines.push(`- The previous version omitted the ${groupLabel(group)} half. Keep at least one of: ${concepts[group].join(", ")}. Keep the accepted meaning and stay under ${rule.max} characters.`);
  if (lane.history.length) lines.push(`- Earlier candidates were rejected because they: ${lane.history.join("; ")}. Do not repeat those mistakes.`);
  lines.push(lane.base ? `WRITER'S DRAFT:\n${lane.base}` : "WRITER'S DRAFT: (none; write it from the master draft)");
  return lines.join("\n");
}

function parseFailure(error) {
  if (error?.detail === "editor_invalid_json") return {};
  throw error;
}

async function editorChat(messages, schema, numPredict, temperature = 0.3) {
  const response = await fetch(OLLAMA_CHAT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EDITOR_MODEL, stream: false, think: false, format: schema, keep_alive: OLLAMA_KEEP_ALIVE, messages, options: { temperature, num_ctx: EDITOR_NUM_CTX, num_predict: numPredict } }),
  });
  if (!response.ok) throw Object.assign(new Error("OLLAMA_FAILED"), { status: response.status, detail: "editor" });
  const parsed = extractJsonObject((await response.json()).message?.content || "");
  if (!parsed) throw invalidOutput("editor_invalid_json");
  return parsed;
}

const EDITOR_SYSTEM = [
  "You are the copy editor for a character-voice social package. Keep the character's voice, stance, and vocabulary as written.",
  "Preserve the central claims, and preserve actor/object relationships and causal claims exactly: who does what to whom, and why.",
  "Do not invent new actions, conclusions, imperatives, or facts. Do not generalize into a summary.",
  "No hashtags, links, or ellipses anywhere. End every post on a complete sentence.",
  "You obey word and sentence ranges. Return only the required JSON.",
].join(" ");

// Verifier role: reports coded, quoted evidence only. It never returns a verdict; the runtime grounds each
// claim against the actual texts and applies policy. The question is deliberately narrow: semantic mutation,
// not editing (rephrasing, reordering, and dropping detail are not differences).
const FIDELITY_CODES = Object.freeze({
  actor_changed: "a different actor now performs an action (who did it changed)",
  object_changed: "an action now lands on a different target (to whom or to what changed)",
  causal_claim_changed: "a cause-and-effect relationship is reversed or attributed to a different cause",
  invented_action: "a material action or event that the source does not contain",
  invented_conclusion: "a material conclusion that the source does not draw",
  new_imperative: "an instruction to the reader that the source does not give",
});
const CHANGED_CODES = new Set(["actor_changed", "object_changed", "causal_claim_changed"]);
const CLAIM_SCHEMA = { type: "object", additionalProperties: false, required: ["subject", "relation", "object"], properties: { subject: { type: "string" }, relation: { type: "string" }, object: { type: "string" } } };
/** Two noun phrases name the same thing when either one's content words mostly cover the other's. */
const sameReferent = (a, b) => Math.max(coverage(a, b), coverage(b, a)) >= 0.5;
const FIDELITY_SYSTEM = [
  "You are a verifier. You compare rewritten social posts with their source and report semantic mutations as evidence.",
  "Ask only: did the rewrite change who did what to whom, reverse or reattribute a cause, or add a material claim, action, or instruction that the source does not contain?",
  "Editing is not a mutation: rephrasing, reordering, merging sentences, summarizing, and dropping detail are all fine. Anything stated anywhere in the source is not invented.",
  "Codes: " + Object.entries(FIDELITY_CODES).map(([code, meaning]) => `${code} = ${meaning}`).join("; ") + ".",
  "Point at one claim per entry: rewriteQuote is the single clause that carries the mutation (at most 15 words), never a whole post or paragraph.",
  "For each mutation give rewriteQuote (copied exactly from the rewrite) and sourceQuote (copied exactly from the source passage it mutates, or empty for an invented item).",
  "For actor_changed, object_changed, and causal_claim_changed also give the claim as structure on both sides: rewriteClaim and sourceClaim, each {subject, relation, object} (for a causal claim, subject is the cause and object is the effect).",
  "Report an empty list when there are none. You do not decide whether a post passes. Return only the required JSON.",
].join(" ");

const STOPWORDS = new Set("the a an and or but of to in on at by for with from as is are was were be been it its this that these those than then there their they them he his she her you your we our not no into over only just all any".split(" "));
const normText = (value) => String(value || "").toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, " ").trim();
const stem = (word) => (word.length > 4 ? word.replace(/(?:ing|ed|es|s|ly)$/, "") : word);
const contentWords = (value) => normText(value).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)).map(stem);
/** Share of the quote's content words present in the text (1 for an exact normalized substring). */
function coverage(quote, text) {
  if (normText(quote) && normText(text).includes(normText(quote))) return 1;
  const words = contentWords(quote);
  if (!words.length) return 0;
  const vocabulary = new Set(contentWords(text));
  return words.filter((w) => vocabulary.has(w)).length / words.length;
}

/**
 * The two halves of the central thought, as declared by the writer. An anchor is kept only when grounded (every
 * content word appears in the master); at most three per group. Never read from a fixture.
 */
const CONCEPT_GROUPS = ["whatChanges", "whyItMatters"];
function conceptGroups(master, value) {
  return Object.fromEntries(CONCEPT_GROUPS.map((group) => [group, [...new Set((Array.isArray(value?.[group]) ? value[group] : [])
    .filter((anchor) => typeof anchor === "string")
    .map((anchor) => normText(anchor))
    .filter((anchor) => anchor && anchor.split(" ").length <= 3 && contentWords(anchor).length && coverage(anchor, master) === 1))].slice(0, 3)]));
}
/** An anchor is present when its head (last content word: "false steward" -> steward) is; a group is kept when any anchor is. */
const hasAnchor = (words, anchor) => words.has(contentWords(anchor).at(-1));
const missingGroups = (text, groups) => { const words = new Set(contentWords(text)); return CONCEPT_GROUPS.filter((group) => !groups[group].some((anchor) => hasAnchor(words, anchor))); };

/** Clauses the runtime judges independently (sentence, semicolon, colon, dash, and comma boundaries). */
const clauses = (value) => String(value || "").split(/[.;:!?,—–]+|\s-\s/).map((c) => c.trim()).filter((c) => contentWords(c).length >= 3);
/** An "invented" claim is real only if at least one of its clauses is substantially absent from the master. */
const inventedClause = (quote, master) => (clauses(quote).length ? clauses(quote) : [quote]).some((c) => coverage(c, master) < 0.6);

/** Runtime admission of verifier evidence. Returns the admitted differences, or null when the evidence is unusable. */
function admitEvidence(differences, rewrite, master) {
  if (!Array.isArray(differences) || !differences.every((d) => Object.hasOwn(FIDELITY_CODES, d?.code) && typeof d.rewriteQuote === "string")) return null;
  const admitted = [];
  let dismissed = 0;
  for (const d of differences) {
    const inRewrite = coverage(d.rewriteQuote, rewrite) >= 0.8;
    // A mutation must point at real text on both sides, and the verifier's own structure must show a different
    // subject or object; matching structures are its own evidence that nothing changed (paraphrase).
    const grounded = CHANGED_CODES.has(d.code)
      ? inRewrite && coverage(d.sourceQuote, master) >= 0.8
        && Boolean(d.rewriteClaim && d.sourceClaim)
        && (!sameReferent(d.rewriteClaim.subject, d.sourceClaim.subject) || !sameReferent(d.rewriteClaim.object, d.sourceClaim.object))
      : inRewrite && inventedClause(d.rewriteQuote, master); // judged clause by clause; content already in the master is not invented
    if (grounded) admitted.push(d);
    else dismissed += 1;
  }
  return { admitted, dismissed };
}

/**
 * Writer -> editor -> ruler. Only lanes that break policy are edited. Every round rewrites from the WRITER'S
 * draft (a failed edit is never the next base; its rejection reasons accumulate instead). The editor proposes
 * several candidates per lane in one call; the runtime measures each, the verifier reports evidence on every
 * mechanically valid one in one call, and the runtime keeps the longest clean candidate. Never clips.
 * Round 1 edits every failing lane in one combined call; rounds 2-3 give each still-failing lane its own
 * focused call. Ceiling: round 1 = 2 calls; rounds 2-3 = up to 4 lane calls + 1 verify each = 12 editor calls.
 */
async function editLanes(result, initialViolations, concepts) {
  const platformDrafts = { ...result.platformDrafts };
  const lanes = {};
  for (const v of initialViolations) {
    const lane = (lanes[v.field] ||= { base: result.platformDrafts[v.field] || "", initial: [], history: [], last: [] });
    lane.initial.push(v);
  }
  for (const [k, lane] of Object.entries(lanes)) {
    const rule = POLICY.platforms[k];
    lane.surfaceOnly = Boolean(lane.base) && lane.initial.every((v) => SURFACE_PROBLEMS.has(v.problem));
    lane.count = lane.surfaceOnly ? 1 : EDITOR_CANDIDATES;
    // Every rewrite gets a runtime word range from the writer's draft, so a lane sent in for a missing concept is
    // not compressed by reflex; an under-filled draft scales up toward the target the same way.
    lane.budget = lane.base && !rule.longForm ? wordRange(rule, lane.base) : null;
    lane.last = lane.initial;
  }
  // candidates: per-candidate budget evidence (requested words vs. returned words and characters), no draft text.
  const meta = { model: EDITOR_MODEL, rounds: 0, calls: 0, dismissedEvidence: 0, concepts, lanesEdited: Object.keys(lanes), candidates: [] };
  let pending = Object.keys(lanes);
  for (let round = 1; round <= EDITOR_ROUNDS && pending.length; round += 1) {
    meta.rounds = round;
    // Round 1 is one combined call; later rounds give each still-failing lane its own focused call.
    // Unparseable editor/verifier output is a failed round (fail closed, retried), not an immediate 502.
    const edited = {};
    for (const group of round === 1 ? [pending] : pending.map((k) => [k])) {
      const numPredict = Math.min(4_096, 400 + group.reduce((sum, k) => sum + (POLICY.platforms[k].longForm ? Math.ceil(countGraphemes(lanes[k].base) / 2.5) : 150 * lanes[k].count), 0));
      Object.assign(edited, await editorChat([
        { role: "system", content: EDITOR_SYSTEM },
        { role: "user", content: `MASTER DRAFT (meaning authority):\n${result.masterDraft}\n\nREWRITE ${group.length > 1 ? "THESE POSTS" : "THIS POST"}:\n\n${group.map((k) => editorInstruction(k, POLICY.platforms[k], lanes[k], POLICY.platforms[k].longForm ? null : concepts)).join("\n\n")}\n\nReturn JSON with only ${group.length > 1 ? "these keys" : "this key"} (${group.join(", ")}), each an array of candidate strings.` },
      ], { type: "object", additionalProperties: false, required: group, properties: Object.fromEntries(group.map((k) => [k, { type: "array", items: { type: "string" } }])) }, numPredict).catch(parseFailure));
      meta.calls += 1;
    }

    // Ruler: measure every candidate; keep the mechanically valid ones for the verifier.
    const valid = []; // { k, id, text }
    for (const k of pending) {
      const rule = POLICY.platforms[k];
      const lane = lanes[k];
      const candidates = (Array.isArray(edited[k]) ? edited[k] : typeof edited[k] === "string" ? [edited[k]] : []).filter((c) => typeof c === "string").slice(0, lane.count);
      const requested = lane.budget ? { ...lane.budget } : null; // the budget this round's brief sent
      for (const raw of candidates) {
        const words = wordCount(normalizeDraft(raw));
        meta.candidates.push({
          round, lane: k,
          requestedWords: requested ? `${requested.min}-${requested.max}` : null,
          returnedWords: words,
          targetChars: requested?.targetChars ?? null,
          returnedChars: countGraphemes(normalizeDraft(raw)),
          wordRatio: requested ? Math.round((words / requested.max) * 100) / 100 : null,
        });
      }
      const rejected = [];
      candidates.forEach((raw, index) => {
        const text = normalizeDraft(raw);
        const problems = laneViolations(k, rule, text);
        if (!problems.length && lane.surfaceOnly && Math.abs(countGraphemes(text) - countGraphemes(lane.base)) > countGraphemes(lane.base) * 0.15) {
          problems.push({ field: k, label: rule.label, problem: "edit_scope_exceeded", length: countGraphemes(text), max: rule.max, previous: countGraphemes(lane.base) });
        }
        if (!problems.length && !rule.longForm && missingGroups(text, concepts).length) {
          problems.push({ field: k, label: rule.label, problem: "concept_dropped", missingGroups: missingGroups(text, concepts), length: countGraphemes(text), max: rule.max });
        }
        if (problems.length) rejected.push(...problems);
        else valid.push({ k, id: `${k}_${index + 1}`, text });
      });
      if (!candidates.length) rejected.push({ field: k, label: rule.label, problem: "missing", length: 0, max: rule.max });
      lane.last = rejected;
      // Tighten the word budget from the measured overshoot of the rejected long candidates.
      for (const v of rejected.filter((v) => v.problem === "over_limit")) {
        const text = candidates.map(normalizeDraft).find((c) => countGraphemes(c) === v.length);
        if (text && lane.budget) {
          const tighter = wordRange(rule, text, 0.8); // a measured overshoot means the editor runs long: tighten harder
          if (tighter.max < lane.budget.max) lane.budget = tighter;
        }
      }
    }

    // Verifier: evidence on every valid candidate in one call. Runtime: longest clean candidate per lane wins.
    const accepted = new Set();
    if (valid.length) {
      const ids = valid.map((c) => c.id);
      const evidence = await editorChat([
        { role: "system", content: FIDELITY_SYSTEM },
        { role: "user", content: `SOURCE (master draft):\n${result.masterDraft}\n\n${valid.map((c) => `${POLICY.platforms[c.k].label} (key "${c.id}") REWRITE:\n${c.text}`).join("\n\n")}\n\nFor each key, list the semantic mutations in the REWRITE relative to the SOURCE. Return JSON: {key: {differences: [{code, rewriteQuote, sourceQuote, rewriteClaim?, sourceClaim?}]}}.` },
      ], { type: "object", additionalProperties: false, required: ids, properties: Object.fromEntries(ids.map((id) => [id, { type: "object", additionalProperties: false, required: ["differences"], properties: { differences: { type: "array", items: { type: "object", additionalProperties: false, required: ["code", "rewriteQuote", "sourceQuote"], properties: { code: { type: "string", enum: Object.keys(FIDELITY_CODES) }, rewriteQuote: { type: "string" }, sourceQuote: { type: "string" }, rewriteClaim: CLAIM_SCHEMA, sourceClaim: CLAIM_SCHEMA } } } } }])) }, Math.min(4_096, 400 * ids.length), 0).catch(parseFailure);
      meta.calls += 1;
      // Any admitted (grounded) mutation rejects the candidate; ungrounded claims are dismissed and counted;
      // missing or malformed evidence rejects it (fail closed).
      for (const c of valid) {
        const verdict = admitEvidence(evidence?.[c.id]?.differences, c.text, result.masterDraft);
        if (verdict) meta.dismissedEvidence += verdict.dismissed;
        if (verdict && !verdict.admitted.length) {
          // Several clean candidates: keep the one that uses the lane best (longest legal text).
          if (!accepted.has(c.k) || countGraphemes(c.text) > countGraphemes(platformDrafts[c.k])) platformDrafts[c.k] = c.text;
          accepted.add(c.k);
          continue;
        }
        const issue = verdict
          ? verdict.admitted.map((d) => `${d.code}: "${d.rewriteQuote.slice(0, 120)}"${d.sourceQuote ? ` (source: "${d.sourceQuote.slice(0, 120)}")` : ""}`).join("; ")
          : "verifier returned no usable evidence";
        lanes[c.k].last.push({ field: c.k, label: POLICY.platforms[c.k].label, problem: "meaning_changed", codes: verdict ? verdict.admitted.map((d) => d.code) : ["verifier_invalid"], issue: issue.slice(0, 400), length: countGraphemes(c.text), max: POLICY.platforms[c.k].max });
      }
    }
    for (const k of pending) {
      if (accepted.has(k)) continue;
      const lane = lanes[k];
      for (const reason of lane.last.map(rejectionReason)) if (!lane.history.includes(reason)) lane.history.push(reason);
      lane.history = lane.history.slice(-6);
    }
    pending = pending.filter((k) => !accepted.has(k));
    console.warn("RelayDaemon editor candidates", { round, budget: meta.candidates.filter((c) => c.round === round).map((c) => `${c.lane}: asked ${c.requestedWords ?? "-"}w/${c.targetChars ?? "-"}c got ${c.returnedWords}w/${c.returnedChars}c x${c.wordRatio ?? "-"}`).join(" | ") });
    console.warn("RelayDaemon editor round", { round, accepted: [...accepted], dismissedEvidence: meta.dismissedEvidence, remaining: pending.map((k) => `${k}: ${lanes[k].last.map(({ problem, codes, missingGroups: missing, length }) => `${problem}${codes ? `(${codes.join(",")})` : ""}${missing ? `[${missing.join(",")}]` : ""}@${length}`).join(" ")}`).join(" | ") || "none" });
  }
  if (pending.length) {
    const failures = pending.flatMap((k) => lanes[k].last.length ? lanes[k].last : lanes[k].initial);
    // Structural evidence only (never draft text): the failed response still says what the editor did and why.
    throw Object.assign(policyViolation(failures), { editor: { ...meta, failures: failures.map(({ field, problem, length, max, codes, missingGroups: missing }) => ({ field, problem, length, max, ...(codes && { codes }), ...(missing && { missingGroups: missing }) })) } });
  }
  return { result: { ...result, platformDrafts }, editor: meta };
}

async function requestOllamaCharacter(messages) {
  const baseMessages = withPolicy(messages);
  let turnMessages = baseMessages;
  let lastError = null;
  let written = null;
  for (let index = 0; index < OLLAMA_ATTEMPTS.length; index += 1) {
    const attempt = OLLAMA_ATTEMPTS[index];
    try {
      written = await requestOllamaOnce(turnMessages, attempt);
      if (index > 0) console.warn("RelayDaemon Ollama character recovered after retry", { attempt: index, think: attempt.think, temperature: attempt.temperature });
      break;
    } catch (error) {
      lastError = error;
      const retryable = error?.message === "OLLAMA_INVALID_OUTPUT" || error?.message === "OLLAMA_FAILED";
      console.warn("RelayDaemon Ollama character attempt failed", {
        attempt: index,
        think: attempt.think,
        temperature: attempt.temperature,
        code: error?.message || "UNKNOWN",
        detail: error?.detail || null,
        draftLength: error?.draftLength ?? null,
        contentLength: error?.contentLength ?? null,
        thinkingLength: error?.thinkingLength ?? null,
        doneReason: error?.doneReason || null,
        hasThinking: error?.hasThinking || false,
        // Structural only (field, problem, length, max); never draft content.
        violations: error?.violations?.map(({ field, problem, length, max }) => ({ field, problem, length, max })) || null,
        retrying: retryable && index < OLLAMA_ATTEMPTS.length - 1,
      });
      if (!retryable || index >= OLLAMA_ATTEMPTS.length - 1) break;
      // Policy violations are rewritten on the next existing attempt; other failures retry the original turn.
      turnMessages = error?.violations && error.previousContent ? rewriteTurn(baseMessages, error) : baseMessages;
    }
  }
  if (!written) throw lastError || invalidOutput("exhausted_retries");
  console.warn("RelayDaemon writer package", { concepts: `whatChanges: ${written.concepts.whatChanges.join(", ")} | whyItMatters: ${written.concepts.whyItMatters.join(", ")}`, laneViolations: written.laneViolations.map((v) => `${v.field}:${v.problem}@${v.length}`).join(" ") || "none" });
  if (!written.laneViolations.length) return { result: written.result, editor: { model: EDITOR_MODEL, rounds: 0, calls: 0, dismissedEvidence: 0, concepts: written.concepts, lanesEdited: [] } };
  // Outside the writer's ladder: lane failures never rerun the writer; editor exhaustion is final.
  return editLanes(written.result, written.laneViolations, written.concepts);
}

function authorizedOrigin(req) {
  if (req.headers["x-relay-request"] !== "character-v1") return false;
  const origin = String(req.headers.origin || "");
  return ALLOWED_ORIGINS.has(origin);
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (!ALLOWED_ORIGINS.has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Relay-Request");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Vary", "Origin");
  return true;
}

async function ollamaStatus(res, warm = false) {
  try {
    const response = warm
      ? await fetch(new URL("/api/generate", new URL(OLLAMA_CHAT_URL)), {
          method: "POST",
          signal: AbortSignal.timeout(240_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt: "", stream: false, keep_alive: OLLAMA_KEEP_ALIVE, options: { num_ctx: 16_384 } }),
        })
      : await fetch(new URL("/api/tags", new URL(OLLAMA_CHAT_URL)), { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error("OLLAMA_UNAVAILABLE");
    return json(res, 200, { status: "ok", engine: "ollama", model: OLLAMA_MODEL, thinking: OLLAMA_THINKING, warmed: warm });
  } catch (_error) {
    return json(res, 503, { status: "error", error: "OLLAMA_UNAVAILABLE", model: OLLAMA_MODEL, thinking: OLLAMA_THINKING });
  }
}

async function character(req, res, warm = false) {
  if (req.method === "OPTIONS") {
    if (!applyCors(req, res)) return json(res, 403, { status: "error", error: "ORIGIN_NOT_ALLOWED" });
    res.writeHead(204, { "Cache-Control": "no-store" });
    return res.end();
  }
  applyCors(req, res);
  if (req.method === "GET") return ollamaStatus(res, warm);
  if (req.method !== "POST") return json(res, 405, { status: "error", error: "METHOD_NOT_ALLOWED" });
  if (!authorizedOrigin(req)) return json(res, 401, { status: "error", error: "UNAUTHORIZED" });
  try {
    const body = JSON.parse((await readBody(req)) || "{}");
    const messages = validateMessages(body.messages);
    const { result, editor } = await requestOllamaCharacter(messages);
    return json(res, 200, { status: "ok", engine: "ollama", model: OLLAMA_MODEL, thinking: OLLAMA_THINKING, editor, result });
  } catch (error) {
    const code = error?.name === "TimeoutError" ? "OLLAMA_TIMEOUT" : ["INPUT_TOO_LARGE", "INVALID_REQUEST", "OLLAMA_FAILED"].includes(error?.message) ? error.message : "OLLAMA_INVALID_OUTPUT";
    console.warn("RelayDaemon Ollama character request failed", {
      code,
      detail: error?.detail || null,
      status: error?.status || null,
      contentLength: error?.contentLength || null,
      thinkingLength: error?.thinkingLength || null,
      draftLength: error?.draftLength ?? null,
      endsEllipsis: error?.endsEllipsis || false,
      doneReason: error?.doneReason || null,
      hasThinking: error?.hasThinking || false,
    });
    return json(res, code === "INPUT_TOO_LARGE" ? 413 : code === "INVALID_REQUEST" ? 400 : 502, { status: "error", error: code, ...(error?.editor && { editor: error.editor }) });
  }
}

// The bridge serves only the public Studio tree. Everything else in the repo (local env files, scripts,
// artifacts) is unreachable, however the path is spelled or encoded.
const STATIC_ROOT = resolve(ROOT, "studio");
const insideStaticRoot = (path, root = STATIC_ROOT) => path === root || path.startsWith(`${root}${sep}`);

function staticPath(pathname) {
  if (pathname === "/") return resolve(STATIC_ROOT, "relay/index.html");
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (_error) {
    return null; // malformed percent-encoding
  }
  if (decoded.includes("\0")) return null;
  const path = resolve(ROOT, decoded.replace(/^[/\\]+/, ""));
  return insideStaticRoot(path) ? path : null;
}

async function serveStatic(pathname, res) {
  let path = staticPath(pathname);
  if (!path) return json(res, 404, { status: "error", error: "NOT_FOUND" });
  try {
    let info = await stat(path);
    // A directory URL (e.g. /studio/relay/) serves its index.html, so the page's relative assets resolve.
    if (info.isDirectory()) {
      path = join(path, "index.html");
      info = await stat(path);
    }
    if (!info.isFile()) throw new Error("NOT_FILE");
    // Symlinks must not lead out of the Studio tree either.
    if (!insideStaticRoot(await realpath(path), await realpath(STATIC_ROOT))) throw new Error("OUTSIDE_ROOT");
    res.writeHead(200, { "Cache-Control": "no-store", "Content-Type": MIME[extname(path).toLowerCase()] || "application/octet-stream", "X-Robots-Tag": "noindex, nofollow" });
    createReadStream(path).pipe(res);
  } catch (_error) {
    json(res, 404, { status: "error", error: "NOT_FOUND" });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/api/character") return character(req, res, url.searchParams.get("warm") === "1");
  return serveStatic(url.pathname, res);
});

// Fail fast on a thinking/capability mismatch instead of discovering it as OLLAMA_FAILED mid-generation.
async function checkModelCapabilities() {
  try {
    const response = await fetch(new URL("/api/show", new URL(OLLAMA_CHAT_URL)), {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL }),
    });
    if (!response.ok) {
      console.error(`Ollama model ${OLLAMA_MODEL} is not available (HTTP ${response.status}); install it rather than substituting another model.`);
      process.exit(1);
    }
    const capabilities = (await response.json()).capabilities || [];
    if (["low", "medium", "high"].includes(OLLAMA_THINKING) && !capabilities.includes("thinking")) {
      console.error(`RELAY_OLLAMA_THINKING=${OLLAMA_THINKING} but ${OLLAMA_MODEL} has no "thinking" capability (${capabilities.join(", ")}). Use off.`);
      process.exit(1);
    }
    const editor = await fetch(new URL("/api/show", new URL(OLLAMA_CHAT_URL)), { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: EDITOR_MODEL }) });
    if (!editor.ok) {
      console.error(`Editor model ${EDITOR_MODEL} is not available (HTTP ${editor.status}); install it rather than substituting another model.`);
      process.exit(1);
    }
    return capabilities;
  } catch (error) {
    console.warn(`Could not read Ollama capabilities (${error?.message || error}); starting with thinking=${OLLAMA_THINKING}.`);
    return null;
  }
}

const capabilities = await checkModelCapabilities();
server.listen(PORT, HOST, () => {
  console.log(`RelayDaemon local bridge: http://${HOST}:${PORT}/`);
  console.log(`Editor model: ${EDITOR_MODEL} (thinking: off; rounds: ${EDITOR_ROUNDS})`);
  console.log(`Ollama model: ${OLLAMA_MODEL} (thinking: ${OLLAMA_THINKING}; keep_alive: ${OLLAMA_KEEP_ALIVE}${capabilities ? `; capabilities: ${capabilities.join(", ")}` : ""})`);
});
