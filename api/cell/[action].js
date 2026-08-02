/**
 * Cell/Live-Link Bearer-token API — the cross-device transport for the SAME deliberate
 * Cell sync contract cell-sync.js already implements same-device via localStorage +
 * BroadcastChannel. Called from the static site (veildaemon.app) using the Supabase
 * access token window.VeilAuth already holds client-side (see lib/cellSync.js's header
 * comment for the full auth-model rationale).
 *
 * Routes (all under /api/cell/<action>):
 *   POST create-session  { needlepoint, mission, maxOperators }              [Handler]
 *   POST join            { joinCode, displayName, designation }             [Operator]
 *   GET  state           ?session=<id>                            [Handler or Operator]
 *   POST publish         operator: { sessionId, patch }
 *                         handler:  { sessionId, seatPatches: [{seatId, patch}] }
 *   POST leave           { sessionId }                                      [Operator]
 *
 * live_state on each session_operator_state row is a flat, ever-merging record shaped
 * like cell-sync.js's own operator-send / handler-projection objects (harmBoxes,
 * stability, loadDeltas, actionEconomy, actionSpend, recoveryResolution, voidMarks,
 * breachPoints, trackLines, handlerNote, ...) — never VeilLink's own separate LiveState
 * type, so a new mechanic never needs "a home" invented for it twice.
 */

const {
  json,
  readJsonBody,
  getBearerToken,
  getAuthedUser,
  restAsUser,
  restAsService,
  restJson,
  generateJoinCode,
  normalizeSeatCap,
} = require("../../lib/cellSync");

const MAX_LIVE_STATE_BYTES = 8000;
const MAX_CAS_ATTEMPTS = 5;

function fail(res, status, message) {
  return json(res, status, { ok: false, error: message });
}

async function requireUser(req, res) {
  const token = getBearerToken(req);
  const user = await getAuthedUser(token);
  if (!user) {
    fail(res, 401, "Authentication required.");
    return null;
  }
  return { token, user };
}

function routeAction(req) {
  if (req.query && typeof req.query.action === "string") return req.query.action;
  const path = String(req.url || "").split("?")[0];
  return path.split("/").filter(Boolean).pop() || "";
}

function sanitizePatch(patch) {
  const raw = patch && typeof patch === "object" ? patch : {};
  const size = Buffer.byteLength(JSON.stringify(raw), "utf8");
  if (size > MAX_LIVE_STATE_BYTES) {
    const error = new Error("Sync payload too large.");
    error.statusCode = 413;
    throw error;
  }
  return raw;
}

async function handleCreateSession(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const needlepoint = String(body.needlepoint || "").slice(0, 120);
  const mission = String(body.mission || "").slice(0, 200);
  const maxOperators = normalizeSeatCap(body.maxOperators);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateJoinCode();
    const response = await restAsUser(auth.token, "/handler_sessions", {
      method: "POST",
      body: {
        handler_user_id: auth.user.id,
        join_code: code,
        needlepoint,
        mission,
        max_operators: maxOperators,
      },
    });
    if (response.ok) {
      const rows = await restJson(response);
      return json(res, 200, { ok: true, session: rows && rows[0] });
    }
    const error = (await restJson(response)) || {};
    if (error.code !== "23505") {
      return fail(res, response.status, error.message || "Could not create Cell.");
    }
    // join_code unique violation -- try another code
  }
  return fail(res, 500, "Could not allocate a Cell Code.");
}

async function findOperatorProfile(auth, displayName) {
  const response = await restAsUser(
    auth.token,
    `/operator_profiles?owner_user_id=eq.${auth.user.id}&display_name=eq.${encodeURIComponent(displayName)}&select=*&limit=1`,
  );
  if (!response.ok) return null;
  const rows = await restJson(response);
  return (rows && rows[0]) || null;
}

async function createOperatorProfile(auth, displayName, designation) {
  const response = await restAsUser(auth.token, "/operator_profiles", {
    method: "POST",
    body: { owner_user_id: auth.user.id, display_name: displayName, designation },
  });
  if (!response.ok) return null;
  const rows = await restJson(response);
  return (rows && rows[0]) || null;
}

async function handleJoin(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const code = String(body.joinCode || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (code.length !== 6) return fail(res, 400, "Cell Code must be 6 characters.");
  const displayName = String(body.displayName || "Operator").trim().slice(0, 80) || "Operator";
  const designation = String(body.designation || "").trim().slice(0, 40);

  // Service-role lookup: an unseated Operator can't SELECT handler_sessions by code
  // under RLS yet -- this is the one deliberate, narrow exception (see lib/cellSync.js).
  const sessionRes = await restAsService(`/handler_sessions?join_code=eq.${code}&status=eq.open&select=*`);
  if (!sessionRes.ok) return fail(res, 502, "Could not resolve Cell Code.");
  const sessionRows = await restJson(sessionRes);
  const session = sessionRows && sessionRows[0];
  if (!session) return fail(res, 404, "No open Cell for that code.");

  if (session.max_operators != null) {
    const countRes = await restAsService(
      `/session_operator_state?session_id=eq.${session.id}&left_at=is.null&select=id`,
      { headers: { Prefer: "count=exact" }, method: "GET" },
    );
    const range = countRes.headers.get("content-range") || "";
    const count = Number(range.split("/")[1] || 0);
    if (Number.isFinite(count) && count >= session.max_operators) {
      return fail(res, 409, `Cell is full (Handler set a ${session.max_operators}-Operator cap).`);
    }
  }

  let profile = await findOperatorProfile(auth, displayName);
  if (!profile) profile = await createOperatorProfile(auth, displayName, designation);
  if (!profile) return fail(res, 500, "Could not resolve Operator identity.");

  const existingRes = await restAsUser(
    auth.token,
    `/session_operator_state?session_id=eq.${session.id}&operator_profile_id=eq.${profile.id}&select=*`,
  );
  const existingRows = existingRes.ok ? await restJson(existingRes) : null;
  const existing = existingRows && existingRows[0];

  if (existing && !existing.left_at) {
    return json(res, 200, { ok: true, session, seat: existing, profile });
  }

  // Identity stub, not a real send: sourceId/name/operatorKey only, deliberately no
  // harmBoxes/stability/sentAt. This is what lets the Handler's seat-matching (matches by
  // sourceId/name against a prior Operator send -- see pushHandlerProjections in
  // cell-sync-remote.js) find this seat from the moment of joining, instead of silently
  // finding nothing until the Operator's first deliberate Send to Cell. The absence of
  // sentAt is also the signal the Handler-visible seat roster uses to distinguish "joined,
  // no real state yet" from "has actually sent."
  const identityKey = designation || displayName;
  const joinIdentityStub = { operatorSend: { sourceId: identityKey, name: displayName, operatorKey: identityKey } };

  const seatRes = existing
    ? await restAsUser(auth.token, `/session_operator_state?id=eq.${existing.id}`, {
        method: "PATCH",
        body: { left_at: null, live_state: joinIdentityStub, last_mutated_by: auth.user.id },
      })
    : await restAsUser(auth.token, "/session_operator_state", {
        method: "POST",
        body: {
          session_id: session.id,
          operator_profile_id: profile.id,
          owner_user_id: auth.user.id,
          live_state: joinIdentityStub,
          last_mutated_by: auth.user.id,
        },
      });

  if (!seatRes.ok) {
    const error = (await restJson(seatRes)) || {};
    return fail(res, seatRes.status, error.message || "Could not join Cell.");
  }
  const seatRows = await restJson(seatRes);
  return json(res, 200, { ok: true, session, seat: seatRows && seatRows[0], profile });
}

async function handleState(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const sessionId = String((req.query && req.query.session) || "").trim();
  if (!sessionId) return fail(res, 400, "session is required.");

  const sessionRes = await restAsUser(auth.token, `/handler_sessions?id=eq.${sessionId}&select=*`);
  if (!sessionRes.ok) return fail(res, sessionRes.status, "Could not read Cell.");
  const sessionRows = await restJson(sessionRes);
  const session = sessionRows && sessionRows[0];
  if (!session) return fail(res, 404, "Cell not found or not visible to this account.");

  // RLS naturally scopes this: the Handler's own token sees every active seat,
  // an Operator's token only ever sees their own row. Embeds operator_profiles so the
  // Handler can see WHO has joined (display_name/designation) independent of whether
  // live_state carries anything yet -- see 20260802070000's Handler-visibility policy.
  //
  // left_at=is.null only applies for the Handler's own multi-seat roster view (so departed
  // Operators drop out of the live list) -- an Operator reading their OWN seat must see it
  // regardless of left_at. Archive Session's handleClose sets left_at on every seat as part
  // of closing the Cell, in the SAME action that delivers the final archive projection
  // (session-end rewards among them); filtering those out here would mean an Operator's
  // very next Pull Handler -- the one that's supposed to retrieve exactly that delivery --
  // finds zero seats and silently never receives it.
  const isHandler = session.handler_user_id === auth.user.id;
  const seatsRes = await restAsUser(
    auth.token,
    `/session_operator_state?session_id=eq.${sessionId}${isHandler ? "&left_at=is.null" : ""}&select=*,operator_profiles(display_name,designation)`,
  );
  if (!seatsRes.ok) return fail(res, seatsRes.status, "Could not read seats.");
  const seats = (await restJson(seatsRes)) || [];
  return json(res, 200, { ok: true, session, seats });
}

/**
 * Compare-and-swap merge of `patch` into one bucket of a seat's live_state. Ports
 * state.ts's applyStatePatch retry loop. `live_state` mirrors the local Cell bus's own
 * two-sided shape -- { operatorSend: {...}, handlerProjection: {...} } -- rather than one
 * flat blob, so freshness/authority logic that already treats Operator sends and Handler
 * projections as distinct, comparably-timestamped things (isHandlerProjectionFresh,
 * late/future-round handling in cell-sync.js) keeps working unchanged for the remote case.
 */
async function casPatchSeat(token, seatId, bucket, patch, actorUserId, actorRole) {
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt += 1) {
    const readRes = await restAsUser(token, `/session_operator_state?id=eq.${seatId}&left_at=is.null&select=*`);
    if (!readRes.ok) return { ok: false, status: readRes.status, error: "Could not read seat." };
    const rows = await restJson(readRes);
    const row = rows && rows[0];
    if (!row) return { ok: false, status: 404, error: "Seat not found or already left." };

    const before = row.live_state && typeof row.live_state === "object" ? row.live_state : {};
    const beforeBucket = before[bucket] && typeof before[bucket] === "object" ? before[bucket] : {};
    const afterBucket = { ...beforeBucket, ...patch };
    const after = { ...before, [bucket]: afterBucket };
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return { ok: true, row, diffCount: 0 };
    }

    const writeRes = await restAsUser(
      token,
      `/session_operator_state?id=eq.${seatId}&state_version=eq.${row.state_version}`,
      {
        method: "PATCH",
        body: {
          live_state: after,
          state_version: row.state_version + 1,
          last_mutated_by: actorUserId,
          last_mutated_at: new Date().toISOString(),
        },
      },
    );
    if (!writeRes.ok) return { ok: false, status: writeRes.status, error: "Could not write seat." };
    const written = await restJson(writeRes);
    if (written && written.length) {
      await restAsUser(token, "/session_mutations", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          session_id: row.session_id,
          session_operator_state_id: seatId,
          actor_user_id: actorUserId,
          actor_role: actorRole,
          field_path: Object.keys(patch).join(","),
          old_value: before,
          new_value: after,
        },
      });
      return { ok: true, row: written[0], diffCount: Object.keys(patch).length };
    }
    // Lost the compare-and-swap race -- reread and retry with the fresh row.
  }
  return { ok: false, status: 409, error: "Too many concurrent writers for this seat." };
}

async function handlePublish(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) return fail(res, 400, "sessionId is required.");

  const sessionRes = await restAsUser(auth.token, `/handler_sessions?id=eq.${sessionId}&select=*`);
  if (!sessionRes.ok) return fail(res, sessionRes.status, "Could not read Cell.");
  const sessionRows = await restJson(sessionRes);
  const session = sessionRows && sessionRows[0];
  if (!session) return fail(res, 404, "Cell not found or not visible to this account.");
  if (session.status !== "open") return fail(res, 400, "Cell is closed.");
  const isHandler = session.handler_user_id === auth.user.id;

  if (isHandler) {
    const seatPatches = Array.isArray(body.seatPatches) ? body.seatPatches : [];
    if (!seatPatches.length) return fail(res, 400, "seatPatches must be a non-empty array.");
    const results = [];
    for (const entry of seatPatches.slice(0, 32)) {
      const seatId = String(entry && entry.seatId || "").trim();
      if (!seatId) continue;
      const patch = sanitizePatch(entry.patch);
      const result = await casPatchSeat(auth.token, seatId, "handlerProjection", patch, auth.user.id, "handler");
      results.push({ seatId, ...result });
    }
    return json(res, 200, { ok: true, results });
  }

  // Operator: only ever patches their own seat.
  const seatRes = await restAsUser(
    auth.token,
    `/session_operator_state?session_id=eq.${sessionId}&owner_user_id=eq.${auth.user.id}&left_at=is.null&select=id`,
  );
  if (!seatRes.ok) return fail(res, seatRes.status, "Could not find your seat.");
  const seatRows = await restJson(seatRes);
  const seat = seatRows && seatRows[0];
  if (!seat) return fail(res, 404, "You are not seated in this Cell.");

  const patch = sanitizePatch(body.patch);
  const result = await casPatchSeat(auth.token, seat.id, "operatorSend", patch, auth.user.id, "operator");
  if (!result.ok) return fail(res, result.status || 500, result.error || "Could not sync.");
  return json(res, 200, { ok: true, seat: result.row });
}

async function handleLeave(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) return fail(res, 400, "sessionId is required.");

  const response = await restAsUser(
    auth.token,
    `/session_operator_state?session_id=eq.${sessionId}&owner_user_id=eq.${auth.user.id}&left_at=is.null`,
    { method: "PATCH", body: { left_at: new Date().toISOString() } },
  );
  if (!response.ok) return fail(res, response.status, "Could not leave Cell.");
  const rows = await restJson(response);
  return json(res, 200, { ok: true, seat: rows && rows[0] });
}

/**
 * Handler-only: closes the Cell. Reward-granting (Void/Breach bonuses, Ontology/
 * Background/Case unlocks) has no Handler UI yet even for same-device play -- this
 * mirrors what End Pressure Round/Sync Cell/Archive Session already do today: the
 * Handler's own console is the source of truth for each seat's final Harm/Stability/
 * Void/Breach, sent as an ordinary "archive" publish (see handlePublish) before this
 * call. close() itself only marks the session/seats closed -- it does not compute or
 * invent award numbers.
 */
async function handleClose(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) return fail(res, 400, "sessionId is required.");

  const sessionRes = await restAsUser(
    auth.token,
    `/handler_sessions?id=eq.${sessionId}&handler_user_id=eq.${auth.user.id}&select=*`,
  );
  if (!sessionRes.ok) return fail(res, sessionRes.status, "Could not read Cell.");
  const sessionRows = await restJson(sessionRes);
  const session = sessionRows && sessionRows[0];
  if (!session) return fail(res, 404, "Cell not found or not owned by this account.");
  if (session.status === "closed") return json(res, 200, { ok: true, session, seats: [] });

  const seatsRes = await restAsUser(auth.token, `/session_operator_state?session_id=eq.${sessionId}&left_at=is.null&select=*`);
  const seats = seatsRes.ok ? (await restJson(seatsRes)) || [] : [];
  const closedAt = new Date().toISOString();

  for (const seat of seats) {
    await restAsUser(auth.token, `/session_operator_state?id=eq.${seat.id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { left_at: closedAt },
    });
  }

  const closeRes = await restAsUser(auth.token, `/handler_sessions?id=eq.${sessionId}`, {
    method: "PATCH",
    body: { status: "closed", closed_at: closedAt, one_shot: Boolean(body.oneShot) },
  });
  if (!closeRes.ok) return fail(res, closeRes.status, "Could not close Cell.");
  const closedRows = await restJson(closeRes);
  return json(res, 200, { ok: true, session: closedRows && closedRows[0], seats });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 204, {});
  }
  try {
    const action = routeAction(req);
    if (action === "create-session") return await handleCreateSession(req, res);
    if (action === "join") return await handleJoin(req, res);
    if (action === "state") return await handleState(req, res);
    if (action === "publish") return await handlePublish(req, res);
    if (action === "leave") return await handleLeave(req, res);
    if (action === "close") return await handleClose(req, res);
    return fail(res, 404, "Unknown Cell route.");
  } catch (error) {
    return fail(res, error.statusCode || 500, error.message || "Cell sync request failed.");
  }
};
