import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, createCipheriv } from 'node:crypto';

// Shim Deno.serve/env in Node; exercise the actual deployed handler source.
const routes = new Map([
  ['operator-dream', 'DISCORD_OPERATOR_DREAM_URL'],
  ['operator-silence', 'DISCORD_OPERATOR_SILENCE_URL'],
  ['operator-hunger', 'DISCORD_OPERATOR_HUNGER_URL'],
  ['operator-stillness', 'DISCORD_OPERATOR_STILLNESS_URL'],
  ['operator-empyrean', 'DISCORD_OPERATOR_EMPYREAN_URL'],
  ['operator-becoming', 'DISCORD_OPERATOR_BECOMING_URL'],
  ['triage-dream', 'DISCORD_TRIAGE_DREAM_URL'],
  ['triage-silence', 'DISCORD_TRIAGE_SILENCE_URL'],
  ['triage-hunger', 'DISCORD_TRIAGE_HUNGER_URL'],
  ['triage-stillness', 'DISCORD_TRIAGE_STILLNESS_URL'],
  ['triage-empyrean', 'DISCORD_TRIAGE_EMPYREAN_URL'],
  ['triage-becoming', 'DISCORD_TRIAGE_BECOMING_URL'],
  ['threadbreaker', 'DISCORD_THREADBREAKER_URL'],
]);
const secrets = {};
for (const [route, name] of routes) secrets[name] = `https://discord.gg/test-${route}`;
let handler;
globalThis.Deno = {
  env: { get: (name) => secrets[name] },
  serve: (callback) => { handler = callback; },
};
const sourcePath = new URL('../supabase/functions/discord-route/index.ts', import.meta.url);
const tmpPath = join(tmpdir(), `vd-discord-test-${process.pid}.mjs`);
writeFileSync(tmpPath, readFileSync(sourcePath, 'utf8'));
await import(pathToFileURL(tmpPath).href);
assert.equal(typeof handler, 'function');

let checks = 0;
function request(key, method = 'GET', origin = 'https://veildaemon.app') {
  return new Request(`https://example.supabase.co/functions/v1/discord-route?key=${encodeURIComponent(key)}`, {
    method,
    headers: { origin },
  });
}
for (const [route, variable] of routes) {
  const res = await handler(request(route));
  assert.equal(res.status, 200, `${route} status`);
  assert.deepEqual(await res.json(), { url: secrets[variable] }, `${route} payload`);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://veildaemon.app');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  checks++;
}
for (const key of ['bogus', '', 'operator-not-a-frequency', 'OPERATOR-DREAM-INVALID']) {
  const res = await handler(request(key));
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { ok: false, error: 'Route unavailable.' });
  checks++;
}
let res = await handler(request('operator-dream', 'POST'));
assert.equal(res.status, 405);
assert.equal(res.headers.get('allow'), 'GET, OPTIONS');
checks++;
res = await handler(request('operator-dream', 'OPTIONS'));
assert.equal(res.status, 204);
checks++;
res = await handler(request('operator-dream', 'GET', 'https://www.veildaemon.app'));
assert.equal(res.headers.get('access-control-allow-origin'), 'https://www.veildaemon.app');
checks++;
res = await handler(request('operator-dream', 'GET', 'https://evil.example'));
assert.notEqual(res.headers.get('access-control-allow-origin'), 'https://evil.example');
checks++;
secrets.DISCORD_OPERATOR_DREAM_URL = 'https://evil.example/path';
res = await handler(request('operator-dream'));
assert.equal(res.status, 404);
checks++;
secrets.DISCORD_OPERATOR_DREAM_URL = '';
res = await handler(request('operator-dream'));
assert.equal(res.status, 404);
checks++;
const key = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const plaintext = 'https://discord.gg/encrypted-test';
const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
const tag = cipher.getAuthTag();
secrets.DISCORD_ROUTE_SECRET = key.toString('base64url');
secrets.DISCORD_OPERATOR_DREAM_URL = `vd1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
res = await handler(request('operator-dream'));
assert.equal(res.status, 200);
assert.deepEqual(await res.json(), { url: plaintext });
checks++;
secrets.DISCORD_ROUTE_SECRET = 'invalid';
res = await handler(request('operator-dream'));
assert.equal(res.status, 404);
checks++;
const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
assert.ok(!script.includes('https://discord.gg/') && !script.includes('https://discord.com/invite/'), 'client must not ship invites');
console.log(`PASS ${checks} Edge Function cases + no-client-invite check`);
