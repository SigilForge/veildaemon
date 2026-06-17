const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;

const FAILED_STATUS = "webhook_callback_verification_failed";

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

async function deleteSubscription(token, id) {
  const params = new URLSearchParams({ id });
  const response = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?${params}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": TWITCH_CLIENT_ID,
    },
  });

  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
}

try {
  const token = await getAppToken();
  const subscriptions = await listSubscriptions(token);
  const failed = subscriptions.filter((subscription) => subscription.status === FAILED_STATUS);
  const results = [];

  for (const subscription of failed) {
    try {
      await deleteSubscription(token, subscription.id);
      results.push({
        type: subscription.type || "",
        version: subscription.version || "",
        status: subscription.status || "",
        deleted: true,
      });
    } catch (error) {
      results.push({
        type: subscription.type || "",
        version: subscription.version || "",
        status: subscription.status || "",
        deleted: false,
        error: error.message,
      });
    }
  }

  if (results.length === 0) {
    console.log(`No ${FAILED_STATUS} subscriptions found.`);
  } else {
    console.table(results);
  }
} catch (error) {
  console.error(`Unable to delete failed EventSub subscriptions: ${error.message}`);
  process.exit(1);
}
