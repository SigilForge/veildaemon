const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;

const missing = [
  ["TWITCH_CLIENT_ID", TWITCH_CLIENT_ID],
  ["TWITCH_CLIENT_SECRET", TWITCH_CLIENT_SECRET],
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

async function listSubscriptions(token) {
  const subscriptions = [];
  let cursor = "";

  do {
    const params = new URLSearchParams();
    if (cursor) params.set("after", cursor);

    const url = `https://api.twitch.tv/helix/eventsub/subscriptions${params.size ? `?${params}` : ""}`;
    const payload = await requestJson(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": TWITCH_CLIENT_ID,
      },
    });

    subscriptions.push(...(Array.isArray(payload.data) ? payload.data : []));
    cursor = payload.pagination && payload.pagination.cursor ? payload.pagination.cursor : "";
  } while (cursor);

  return subscriptions;
}

function callbackUrl(subscription) {
  const transport = subscription.transport || {};
  return transport.callback || "";
}

try {
  const token = await getAppToken();
  const subscriptions = await listSubscriptions(token);
  const rows = subscriptions.map((subscription) => ({
    type: subscription.type || "",
    version: subscription.version || "",
    status: subscription.status || "",
    created_at: subscription.created_at || "",
    callback: callbackUrl(subscription),
  }));

  if (rows.length === 0) {
    console.log("No EventSub subscriptions found for this Twitch app.");
  } else {
    console.table(rows);
  }
} catch (error) {
  console.error(`Unable to list EventSub subscriptions: ${error.message}`);
  process.exit(1);
}
