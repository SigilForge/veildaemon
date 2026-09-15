const { json } = require("../../lib/alertQueue");
const { registryPayload } = require("../../lib/creatorRightsRegistry");

function queryFor(req) {
  return req.query || Object.fromEntries(new URL(req.url || "/", "https://api.veildaemon.app").searchParams);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const query = queryFor(req);
  if (query.resource === "creator-rights-registry") {
    try {
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
      return json(res, 200, await registryPayload(query));
    } catch (error) {
      res.setHeader("Cache-Control", "no-store");
      return json(res, error.statusCode || 500, {
        ok: false,
        error: error.message || "Creator Rights registry unavailable.",
      });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  return json(res, 200, {
    ok: true,
    supabaseUrl,
    supabaseAnonKey,
  });
};
