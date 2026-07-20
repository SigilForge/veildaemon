#!/usr/bin/env node
/**
 * Convert studio/relay/personas/*.yaml → *.json for browser fetch.
 * YAML is the authoring source of truth.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "studio/relay/personas");

function yamlToJson(yamlText) {
  const py = `
import sys, json, yaml
data = yaml.safe_load(sys.stdin.read())
print(json.dumps(data, ensure_ascii=False, indent=2))
`;
  const result = spawnSync("python3", ["-c", py], {
    input: yamlText,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "yaml convert failed");
  }
  return result.stdout;
}

mkdirSync(DIR, { recursive: true });
const files = readdirSync(DIR).filter((name) => name.endsWith(".yaml"));
if (!files.length) {
  console.error("No persona YAML files found in", DIR);
  process.exit(1);
}

const index = [];
for (const file of files) {
  const yamlText = readFileSync(join(DIR, file), "utf8");
  const jsonText = yamlToJson(yamlText);
  const data = JSON.parse(jsonText);
  if (!data.id || !data.name) throw new Error(`${file} missing id/name`);
  const outName = `${data.id}.json`;
  writeFileSync(join(DIR, outName), `${jsonText.trim()}\n`);
  index.push({
    id: data.id,
    name: data.name,
    era: data.era || "",
    signature: data.signature || "",
  });
  console.log("synced", file, "→", outName);
}

index.sort((a, b) => a.name.localeCompare(b.name));
// Preferred cast order for the dropdown
const order = [
  "cathy-holloway",
  "wednesday",
  "diana-vale",
  "kira-silverwood",
  "alex-shade",
  "shade",
  "agnes-marlowe",
  "mira",
  "kaelyn",
  "maslow",
  "father-samiel",
];
index.sort((a, b) => {
  const ai = order.indexOf(a.id);
  const bi = order.indexOf(b.id);
  if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
});

writeFileSync(join(DIR, "index.json"), `${JSON.stringify({ personas: index }, null, 2)}\n`);
console.log("wrote index.json with", index.length, "personas");
