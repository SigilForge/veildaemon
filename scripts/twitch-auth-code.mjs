const {
  TWITCH_AUTH_CODE,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_REDIRECT_URI,
} = process.env;

const REQUIRED_SCOPES = [
  "moderator:read:followers",
  "channel:read:subscriptions",
  "bits:read",
  "channel:read:hype_train",
];

const authCode = process.argv[2] || TWITCH_AUTH_CODE;

const missing = [
  ["TWITCH_CLIENT_ID", TWITCH_CLIENT_ID],
  ["TWITCH_CLIENT_SECRET", TWITCH_CLIENT_SECRET],
  ["TWITCH_REDIRECT_URI", TWITCH_REDIRECT_URI],
  ["TWITCH_AUTH_CODE", authCode],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error(`Missing environment variable(s): ${missing.join(", ")}`);
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

try {
  const tokenPayload = await exchangeCode();
  const validation = await validateToken(tokenPayload.access_token);
  const grantedScopes = Array.isArray(validation.scopes) ? validation.scopes : [];
  const missingScopes = REQUIRED_SCOPES.filter((scope) => !grantedScopes.includes(scope));

  console.log("Twitch broadcaster authorization validated.");
  console.log(`Login: ${validation.login || "unknown"}`);
  console.log(`User ID: ${validation.user_id || "unknown"}`);
  console.log(`Client ID: ${validation.client_id || "unknown"}`);
  console.log(`Required scopes granted: ${missingScopes.length === 0 ? "true" : "false"}`);
  console.log(`Granted scopes: ${grantedScopes.sort().join(", ") || "none"}`);

  if (missingScopes.length) {
    console.error(`Missing required scope(s): ${missingScopes.join(", ")}`);
    process.exit(1);
  }

  console.log("No token values printed. The Twitch app authorization is now attached to this broadcaster grant.");
} catch (error) {
  console.error(`Twitch authorization failed: ${error.message}`);
  process.exit(1);
}
