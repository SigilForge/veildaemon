const { recordIntakeCompletion } = require("../lib/intakeStatsStore");
const { json } = require("../lib/reportsStore");

const allowedEvents = new Set([
  "intake_opened",
  "intake_completed",
  "route_opened",
]);

function readLimitedBody(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Payload too large."));
        req.destroy();
        return;
      }

      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeText(value, maxLength = 80) {
  if (typeof value !== "string") return "";
  return value.replace(/[^\w .:/?#&=-]/g, "").slice(0, maxLength);
}

function cleanPayload(input) {
  const body = input && typeof input === "object" ? input : {};
  const event = safeText(body.event, 40);

  if (!allowedEvents.has(event)) {
    throw new Error("Observation event rejected.");
  }

  return {
    event,
    routeType: safeText(body.routeType, 40),
    path: safeText(body.path, 120),
    referrerHost: safeText(body.referrerHost, 120),
    primaryFrequency: safeText(body.primaryFrequency, 40),
    observerClassification: safeText(body.observerClassification, 60),
    attentionStatus: safeText(body.attentionStatus, 40),
    accessLevel: safeText(body.accessLevel, 40),
    filesReviewed: Math.max(0, Math.min(Number(body.filesReviewed) || 0, 99)),
    commandLayerClearance: safeText(body.commandLayerClearance, 40),
    utmSource: safeText(body.utmSource, 60),
    utmMedium: safeText(body.utmMedium, 60),
    utmCampaign: safeText(body.utmCampaign, 60),
    utmContent: safeText(body.utmContent, 60),
    intakeRoute: safeText(body.intakeRoute, 20),
    reclassified: body.reclassified === true,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const rawBody = await readLimitedBody(req);
    const payload = cleanPayload(rawBody ? JSON.parse(rawBody) : {});
    const entry = {
      marker: "VEILDAEMON_OBSERVER_EVENT",
      receivedAt: new Date().toISOString(),
      ...payload,
    };

    console.log(JSON.stringify(entry));

    if (payload.event === "intake_completed") {
      try {
        await recordIntakeCompletion(payload, new Date(entry.receivedAt));
      } catch (error) {
        // The client never waits on the counter; a store outage only loses the count.
        console.error(JSON.stringify({ marker: "VEILDAEMON_INTAKE_STATS_ERROR", error: error.message }));
      }
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message });
  }
};
