import "./load-local-env.mjs";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_REDIRECT_URI =
  process.env.TWITCH_REDIRECT_URI || "http://localhost:3000/twitch/callback";

// Phase 1 bot: chat read. Add chat:edit for phase 2 posts as SigilForge.
// EventSub follower scope kept for mod-as-bot EventSub use.
const REQUIRED_SCOPES = [
  "chat:read",
  "moderator:read:followers",
  "channel:read:subscriptions",
  "bits:read",
  "channel:read:hype_train",
];

const missing = [
  ["TWITCH_CLIENT_ID", TWITCH_CLIENT_ID],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error(`Missing environment variable(s): ${missing.join(", ")}`);
  console.error("Add them to .env.local (scripts now load that file automatically).");
  console.error("TWITCH_CLIENT_ID = Twitch Developer Console → your app → Client ID");
  console.error(`TWITCH_REDIRECT_URI defaults to: ${TWITCH_REDIRECT_URI}`);
  console.error("Must match an OAuth Redirect URL registered on that Twitch app.");
  process.exit(1);
}

const params = new URLSearchParams({
  client_id: TWITCH_CLIENT_ID,
  redirect_uri: TWITCH_REDIRECT_URI,
  response_type: "code",
  scope: REQUIRED_SCOPES.join(" "),
  force_verify: "true",
});

console.log("Open this URL while logged in as the SigilForge bot account (not VeilCorpNode):");
console.log(`https://id.twitch.tv/oauth2/authorize?${params}`);
console.log("");
console.log(`redirect_uri: ${TWITCH_REDIRECT_URI}`);
console.log(`scopes: ${REQUIRED_SCOPES.join(" ")}`);
console.log("");
console.log("After approval, copy the returned code and run:");
console.log("npm run twitch:auth-code -- YOUR_RETURNED_CODE");
console.log("");
console.log("Note: EventSub alerts do not need this user OAuth; they use the app + webhook secret.");
