const { json } = require("../../lib/alertQueue");

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    return json(res, 204, {});
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed." });
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
