import "./load-local-env.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REDIRECT_URI =
  process.env.TWITCH_REDIRECT_URI || "http://localhost:3000/twitch/callback";
const TWITCH_AUTH_CODE = process.env.TWITCH_AUTH_CODE;
const EXPECTED_BOT_LOGIN = String(process.env.TWITCH_BOT_LOGIN || "sigilforge").toLowerCase();

const REQUIRED_SCOPES = [
  "chat:read",
  "moderator:read:followers",
  "channel:read:subscriptions",
  "bits:read",
  "channel:read:hype_train",
];

const authCode = process.argv[2] || TWITCH_AUTH_CODE;

const missing = [
  ["TWITCH_CLIENT_ID", TWITCH_CLIENT_ID],
  ["TWITCH_CLIENT_SECRET", TWITCH_CLIENT_SECRET],
  ["TWITCH_AUTH_CODE", authCode],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error(`Missing environment variable(s): ${missing.join(", ")}`);
  console.error("Scripts load .env.local automatically. Need CLIENT_ID + CLIENT_SECRET there.");
  console.error("Pass the OAuth code: npm run twitch:auth-code -- YOUR_CODE");
  process.exit(1);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function exchangeCode() {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    code: authCode,
    grant_type: "authorization_code",
    redirect_uri: TWITCH_REDIRECT_URI,
  });

  return requestJson("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
}

async function validateToken(accessToken) {
  return requestJson("https://id.twitch.tv/oauth2/validate", {
    headers: {
      Authorization: `OAuth ${accessToken}`,
    },
  });
}

function upsertEnvLocal(updates) {
  const envPath = path.join(root, ".env.local");
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const lines = text ? text.split(/\r?\n/) : [];
  const seen = new Set();

  const next = lines.map((line) => {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) return line;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      seen.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, `${next.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n")}\n`, "utf8");
}

try {
  const tokenPayload = await exchangeCode();
  const validation = await validateToken(tokenPayload.access_token);
  const grantedScopes = Array.isArray(validation.scopes) ? validation.scopes : [];
  const missingScopes = REQUIRED_SCOPES.filter((scope) => !grantedScopes.includes(scope));
  const login = String(validation.login || "").toLowerCase();

  console.log("Twitch user authorization validated.");
  console.log(`Login: ${validation.login || "unknown"}`);
  console.log(`User ID: ${validation.user_id || "unknown"}`);
  console.log(`Client ID: ${validation.client_id || "unknown"}`);
  console.log(`Required scopes granted: ${missingScopes.length === 0 ? "true" : "false"}`);
  console.log(`Granted scopes: ${grantedScopes.sort().join(", ") || "none"}`);

  if (login && login !== EXPECTED_BOT_LOGIN) {
    console.error(
      `Refusing to store tokens: expected bot login "${EXPECTED_BOT_LOGIN}" but got "${validation.login}".`,
    );
    console.error("");
    console.error("That OAuth code is already spent (single-use). Do NOT re-run auth-code with it.");
    console.error("Next steps:");
    console.error("  1. Browser: log OUT of Twitch (or use a private/incognito window).");
    console.error("  2. Log IN as SigilForge (not VeilCorpNode).");
    console.error("  3. npm run twitch:auth-url");
    console.error("  4. Open the NEW url, approve, copy the NEW ?code= from the redirect.");
    console.error("  5. npm run twitch:auth-code -- THAT_NEW_CODE");
    console.error("");
    console.error("Broadcaster tokens were NOT written to .env.local (safety). Alerts unchanged.");
    process.exit(1);
  }

  if (missingScopes.length) {
    console.error(`Missing required scope(s): ${missingScopes.join(", ")}`);
    process.exit(1);
  }

  // Persist bot tokens locally — never print them.
  upsertEnvLocal({
    TWITCH_BOT_ACCESS_TOKEN: tokenPayload.access_token || "",
    TWITCH_BOT_REFRESH_TOKEN: tokenPayload.refresh_token || "",
    TWITCH_BOT_SCOPES: grantedScopes.join(" "),
    TWITCH_BOT_USER_ID: String(validation.user_id || process.env.TWITCH_BOT_USER_ID || ""),
    TWITCH_BOT_LOGIN: String(validation.login || process.env.TWITCH_BOT_LOGIN || "sigilforge"),
    TWITCH_REDIRECT_URI,
  });

  console.log("Bot tokens written to .env.local (TWITCH_BOT_ACCESS_TOKEN / REFRESH). Values not printed.");
  console.log("EventSub alerts are unaffected (separate app webhook path).");
} catch (error) {
  console.error(`Twitch authorization failed: ${error.message}`);
  process.exit(1);
}
