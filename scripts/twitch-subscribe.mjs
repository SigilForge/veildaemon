const {
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_BROADCASTER_USER_ID,
  TWITCH_MODERATOR_USER_ID,
  TWITCH_EVENTSUB_SECRET,
  TWITCH_EVENTSUB_CALLBACK,
} = process.env;

const required = {
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_BROADCASTER_USER_ID,
  TWITCH_EVENTSUB_SECRET,
  TWITCH_EVENTSUB_CALLBACK,
};

const missing = Object.entries(required)
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

async function getAppToken() {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const payload = await requestJson(`https://id.twitch.tv/oauth2/token?${params}`, {
    method: "POST",
  });
  return payload.access_token;
}

function subscriptionPlans() {
  const broadcaster = TWITCH_BROADCASTER_USER_ID;
  const moderator = TWITCH_MODERATOR_USER_ID || TWITCH_BROADCASTER_USER_ID;

  return [
    {
      type: "channel.follow",
      version: "2",
      condition: { broadcaster_user_id: broadcaster, moderator_user_id: moderator },
    },
    {
      type: "channel.subscribe",
      version: "1",
      condition: { broadcaster_user_id: broadcaster },
    },
    {
      type: "channel.subscription.message",
      version: "1",
      condition: { broadcaster_user_id: broadcaster },
    },
    {
      type: "channel.subscription.gift",
      version: "1",
      condition: { broadcaster_user_id: broadcaster },
    },
    {
      type: "channel.raid",
      version: "1",
      condition: { to_broadcaster_user_id: broadcaster },
    },
    {
      type: "channel.cheer",
      version: "1",
      condition: { broadcaster_user_id: broadcaster },
    },
    {
      type: "channel.hype_train.begin",
      version: "2",
      condition: { broadcaster_user_id: broadcaster },
    },
    {
      type: "channel.hype_train.progress",
      version: "2",
      condition: { broadcaster_user_id: broadcaster },
    },
    {
      type: "channel.hype_train.end",
      version: "2",
      condition: { broadcaster_user_id: broadcaster },
    },
  ];
}

async function createSubscription(token, plan) {
  return requestJson("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": TWITCH_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...plan,
      transport: {
        method: "webhook",
        callback: TWITCH_EVENTSUB_CALLBACK,
        secret: TWITCH_EVENTSUB_SECRET,
      },
    }),
  });
}

const token = await getAppToken();
const results = [];

for (const plan of subscriptionPlans()) {
  try {
    const result = await createSubscription(token, plan);
    results.push({
      type: plan.type,
      version: plan.version,
      ok: true,
      status: result.data && result.data[0] && result.data[0].status,
    });
  } catch (error) {
    results.push({
      type: plan.type,
      version: plan.version,
      ok: false,
      error: error.message,
    });
  }
}

console.table(results);
