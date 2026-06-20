const crypto = require("crypto");
const { enqueue, json, readBody } = require("../../lib/alertQueue");

const SIGNATURE_PREFIX = "sha256=";

function verifySignature(req, rawBody) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) return false;

  const messageId = req.headers["twitch-eventsub-message-id"];
  const timestamp = req.headers["twitch-eventsub-message-timestamp"];
  const signature = req.headers["twitch-eventsub-message-signature"];
  if (!messageId || !timestamp || !signature) return false;

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(`${messageId}${timestamp}${rawBody}`)
    .digest("hex");
  const expected = `${SIGNATURE_PREFIX}${hmac}`;
  if (expected.length !== signature.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function numberValue(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mapEvent(subscriptionType, event) {
  switch (subscriptionType) {
    case "channel.follow":
      return {
        type: "follow",
        user: event.user_name || event.user_login,
      };
    case "channel.subscribe":
      return {
        type: "sub",
        user: event.user_name || event.user_login,
      };
    case "channel.subscription.message":
      return {
        type: "resub",
        user: event.user_name || event.user_login,
        months: numberValue(event.cumulative_months || event.duration_months),
      };
    case "channel.subscription.gift":
      return {
        type: "gift_sub",
        user: event.user_name || event.user_login || "Anonymous Support Signal",
        count: numberValue(event.total || event.cumulative_total),
      };
    case "channel.raid":
      return {
        type: "raid",
        user: event.from_broadcaster_user_name || event.from_broadcaster_user_login,
        count: numberValue(event.viewers),
      };
    case "channel.cheer":
      return {
        type: "bits",
        user: event.user_name || event.user_login || "Anonymous Signal",
        count: numberValue(event.bits),
      };
    case "channel.hype_train.begin":
    case "channel.hype_train.progress":
    case "channel.hype_train.end":
      return {
        type: "hype_train",
        soundKey: subscriptionType.replace("channel.", ""),
        user: "Collective Attention",
        level: numberValue(event.level),
      };
    default:
      return {
        type: "follow",
        user: event.user_name || event.user_login || "UnclassifiedObserver",
      };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const rawBody = await readBody(req);
  if (!verifySignature(req, rawBody)) {
    return json(res, 403, { ok: false, error: "EventSub signature rejected." });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    return json(res, 400, { ok: false, error: "Invalid JSON payload." });
  }

  const messageType = req.headers["twitch-eventsub-message-type"];
  if (messageType === "webhook_callback_verification") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end(payload.challenge || "");
  }

  if (messageType === "notification") {
    const subscriptionType = payload.subscription && payload.subscription.type;
    const alert = mapEvent(subscriptionType, payload.event || {});
    alert.source = "twitch";
    alert.twitchMessageId = req.headers["twitch-eventsub-message-id"];
    await enqueue(alert);
    return json(res, 202, { ok: true });
  }

  if (messageType === "revocation") {
    return json(res, 202, { ok: true, revoked: true });
  }

  return json(res, 202, { ok: true, ignored: messageType || "unknown" });
};
