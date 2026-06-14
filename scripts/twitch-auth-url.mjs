const { TWITCH_CLIENT_ID, TWITCH_REDIRECT_URI } = process.env;

const REQUIRED_SCOPES = [
  "moderator:read:followers",
  "channel:read:subscriptions",
  "bits:read",
  "channel:read:hype_train",
];

const missing = [
  ["TWITCH_CLIENT_ID", TWITCH_CLIENT_ID],
  ["TWITCH_REDIRECT_URI", TWITCH_REDIRECT_URI],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error(`Missing environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const params = new URLSearchParams({
  client_id: TWITCH_CLIENT_ID,
  redirect_uri: TWITCH_REDIRECT_URI,
  response_type: "code",
  scope: REQUIRED_SCOPES.join(" "),
  force_verify: "true",
});

console.log("Open this URL while logged in as the broadcaster account:");
console.log(`https://id.twitch.tv/oauth2/authorize?${params}`);
console.log("");
console.log("After approval, copy the returned code into TWITCH_AUTH_CODE or pass it as:");
console.log("npm run twitch:auth-code -- YOUR_RETURNED_CODE");
