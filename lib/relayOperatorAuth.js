/**
 * Hosted RelayDaemon operator identity.
 * VeilLink/Supabase issues the session. Only Knoxmortis is admitted.
 * Same-origin x-relay-request remains CSRF protection, not identity.
 */
const DEFAULT_OPERATOR_EMAILS = ["j.donavon.love@gmail.com"];
const DEFAULT_OPERATOR_HANDLES = ["knoxmortis"];

function operatorError(code, statusCode) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function allowlists(env = process.env) {
  const emails = splitList(env.RELAY_OPERATOR_EMAILS);
  const handles = splitList(env.RELAY_OPERATOR_HANDLES);
  const userIds = splitList(env.RELAY_OPERATOR_USER_IDS);
  return {
    emails: emails.length ? emails : DEFAULT_OPERATOR_EMAILS.slice(),
    handles: handles.length ? handles : DEFAULT_OPERATOR_HANDLES.slice(),
    userIds,
  };
}

function githubHandle(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  for (const identity of identities) {
    if (String(identity?.provider || "").toLowerCase() !== "github") continue;
    const data = identity.identity_data || {};
    const handle = data.user_name || data.preferred_username || data.login || "";
    if (handle) return String(handle).toLowerCase();
  }
  const meta = user?.user_metadata || {};
  return String(meta.user_name || meta.preferred_username || meta.user_handle || "").toLowerCase();
}

function isRelayOperator(user, env = process.env) {
  if (!user || typeof user !== "object") return false;
  const lists = allowlists(env);
  const email = String(user.email || "").trim().toLowerCase();
  const userId = String(user.id || "").trim().toLowerCase();
  const handle = githubHandle(user);
  if (email && lists.emails.includes(email)) return true;
  if (userId && lists.userIds.includes(userId)) return true;
  if (handle && lists.handles.includes(handle)) return true;
  return false;
}

function bearerToken(req) {
  const header = String(req?.headers?.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function supabaseUrl(env = process.env) {
  return String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
}

function anonKey(env = process.env) {
  return String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "");
}

async function fetchSupabaseUser(token, env = process.env) {
  if (!token) return null;
  const url = supabaseUrl(env);
  const key = anonKey(env);
  if (!url || !key) throw operatorError("OPERATOR_AUTH_UNAVAILABLE", 503);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: key },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && user.id ? user : null;
}

function createOperatorAuth(options = {}) {
  const env = options.env || process.env;
  const lookup = options.fetchUser || fetchSupabaseUser;

  async function requireOperator(req) {
    if (req?.relayOperator) {
      if (!isRelayOperator(req.relayOperator, env)) throw operatorError("OPERATOR_FORBIDDEN", 403);
      return { id: req.relayOperator.id || "injected", email: req.relayOperator.email || "" };
    }
    const token = bearerToken(req);
    if (!token) throw operatorError("UNAUTHORIZED", 401);
    const user = await lookup(token, env);
    if (!user) throw operatorError("UNAUTHORIZED", 401);
    if (!isRelayOperator(user, env)) throw operatorError("OPERATOR_FORBIDDEN", 403);
    return { id: user.id, email: user.email || "" };
  }

  return { requireOperator, isRelayOperator, allowlists };
}

async function requireRelayOperator(req, options = {}) {
  return createOperatorAuth(options).requireOperator(req);
}

module.exports = {
  DEFAULT_OPERATOR_EMAILS,
  DEFAULT_OPERATOR_HANDLES,
  allowlists,
  isRelayOperator,
  githubHandle,
  bearerToken,
  createOperatorAuth,
  requireRelayOperator,
};
