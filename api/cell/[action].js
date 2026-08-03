/**
 * Cell/Live-Link Bearer-token API — the cross-device transport for the SAME deliberate
 * Cell sync contract cell-sync.js already implements same-device via localStorage +
 * BroadcastChannel. Called from the static site (veildaemon.app) using the Supabase
 * access token window.VeilAuth already holds client-side (see lib/cellSync.js's header
 * comment for the full auth-model rationale).
 *
 * Cradlepoint Cell Lobby Model: Cell / Operation / Seat presence are three separate
 * lifecycles that must never impersonate each other (see supabase/migrations/
 * 20260802090000_cell_status_and_seat_status_enums.sql onward, and the architecture plan
 * this pass was built from). Concretely:
 *   - handler_sessions.status (cell_status: open/active_operation/post_operation/closed)
 *     is the LOBBY. Closing it is a separate Handler action (close-cell) from anything
 *     that happens to an Operation, and it never touches a seat row.
 *   - cell_operations.status (operation_status: preparing/active/resolving/suspended/
 *     archived) is the GAME. Archiving one preserves history, delivers final projections,
 *     and moves the Cell to post_operation -- it never disconnects or evicts a seat.
 *   - session_operator_state.seat_status (joined/left/removed) is PRESENCE. Only an
 *     Operator's own explicit `leave` or the Handler's explicit `remove-seat` ever moves a
 *     seat away from 'joined'. CONNECTED/DISCONNECTED are deliberately never persisted here
 *     at all -- they're derived client-side from a Supabase Realtime Presence channel, so a
 *     dropped socket can never write a lobby-membership fact.
 *
 * Routes (all under /api/cell/<action>):
 *   POST create-session          { needlepoint, mission, maxOperators, handlerDisplayName } [Handler]
 *   POST join                    { joinCode, displayName, designation }               [Operator]
 *   GET  state                   ?session=<id>&since=<ISO timestamp>          [Handler or Operator]
 *   POST publish                 operator: { sessionId, patch }
 *                                 handler:  { sessionId, seatPatches: [{seatId, patch}] }
 *   POST leave                   { sessionId }                                        [Operator]
 *   POST remove-seat             { cellId, seatId, reason }                           [Handler]
 *   POST start-operation         { cellId, needlepointId, mission }                   [Handler]
 *   POST sync-operation          { cellId, patch: {sceneState?,clueState?,npcState?,rewardState?} } [Handler]
 *   POST advance-round           { cellId, phase? }                                   [Handler]
 *   POST suspend-operation       { cellId }                                           [Handler]
 *   POST resume-operation        { cellId }                                           [Handler]
 *   POST archive-operation       { cellId, oneShot }                                  [Handler]
 *   POST publish-operation-baseline { operationId, seatId, sheet }                    [Operator]
 *   GET  operation-baseline      ?operationId=<id>&seatId=<id>              [Handler or owning Operator]
 *   POST send-chat               { cellId, text }                          [Handler or Operator]
 *   POST save-cell               { cellId }                                           [Handler]
 *   POST export-snapshot         { cellId }                                           [Handler]
 *   POST import-snapshot         { snapshot, confirmOverwrite }                       [Handler]
 *   POST close-cell              { cellId }                                           [Handler]
 *   GET  list                    (no params -- every Cell the caller owns)              [Handler]
 *   POST rename-cell             { cellId, cellName }                                 [Handler]
 *   GET  operations-history      ?cellId=<id>                              [Handler or Operator]
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
  computeChecksum,
  rewardStateUnresolved,
  realtimeBroadcast,
} = require("../../lib/cellSync");
const crypto = require("crypto");

const MAX_LIVE_STATE_BYTES = 8000;
const MAX_CAS_ATTEMPTS = 5;
const MAX_CHAT_TEXT_BYTES = 2000;
const SCHEMA_VERSION = 1;
const NON_ARCHIVED_OPERATION_STATUSES = ["preparing", "active", "resolving", "suspended"];

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

/** Fetches a Cell, scoped to the caller's own token, 404ing if not visible under RLS. */
async function fetchCell(token, cellId) {
  const response = await restAsUser(token, `/handler_sessions?id=eq.${cellId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Cell." } };
  const rows = await restJson(response);
  const session = rows && rows[0];
  if (!session) return { error: { status: 404, message: "Cell not found or not visible to this account." } };
  return { session };
}

/** Fetches a Cell the caller must own as Handler, 404ing otherwise -- matches handleClose's
 * existing pattern of baking ownership into the WHERE clause rather than fetch-then-compare. */
async function fetchOwnedCell(token, userId, cellId) {
  const response = await restAsUser(
    token,
    `/handler_sessions?id=eq.${cellId}&handler_user_id=eq.${userId}&select=*`,
  );
  if (!response.ok) return { error: { status: response.status, message: "Could not read Cell." } };
  const rows = await restJson(response);
  const session = rows && rows[0];
  if (!session) return { error: { status: 404, message: "Cell not found or not owned by this account." } };
  return { session };
}

async function fetchOperation(token, operationId) {
  const response = await restAsUser(token, `/cell_operations?id=eq.${operationId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Operation." } };
  const rows = await restJson(response);
  const operation = rows && rows[0];
  if (!operation) return { error: { status: 404, message: "Operation not found." } };
  return { operation };
}

/** Fetches a Needlepoint the caller must own as Handler (needlepoints_select's RLS is
 * Handler-only until published, so this already can't return a row for a non-owning Handler),
 * scoped to the given Cell -- 404s on a cross-Cell Needlepoint rather than silently ignoring
 * the mismatch. Used only by handleStartOperation; see api/weave/[action].js for the fuller
 * Needlepoint CRUD surface (this file stays focused on the Cell/Operation/Seat lobby model). */
async function fetchNeedlepoint(token, cellId, needlepointId) {
  const response = await restAsUser(token, `/needlepoints?id=eq.${needlepointId}&cell_id=eq.${cellId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Needlepoint." } };
  const rows = await restJson(response);
  const needlepoint = rows && rows[0];
  if (!needlepoint) return { error: { status: 400, message: "Needlepoint not found, or does not belong to this Cell." } };
  return { needlepoint };
}

async function handleCreateSession(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const needlepoint = String(body.needlepoint || "").slice(0, 120);
  const mission = String(body.mission || "").slice(0, 200);
  const maxOperators = normalizeSeatCap(body.maxOperators);
  const handlerDisplayName = String(body.handlerDisplayName || "Handler").trim().slice(0, 80) || "Handler";
  // Handler-facing Cell label ("Monday Group") -- distinct from handlerDisplayName (the
  // Handler's own chat sender name) and needlepoint (a scenario id). Falls back to the
  // needlepoint text, then a generic per-code label, matching the migration's own backfill.
  const cellName = String(body.cellName || needlepoint || "").trim().slice(0, 120);

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
        handler_display_name: handlerDisplayName,
        cell_name: cellName || `Untitled Cell — ${code}`,
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
  // A Cell only accepts new joins while it's not closed -- OPEN/ACTIVE_OPERATION/
  // POST_OPERATION can all still be joined (a recurring table's new player can join
  // between Operations too).
  const sessionRes = await restAsService(`/handler_sessions?join_code=eq.${code}&status=neq.closed&select=*`);
  if (!sessionRes.ok) return fail(res, 502, "Could not resolve Cell Code.");
  const sessionRows = await restJson(sessionRes);
  const session = sessionRows && sessionRows[0];
  if (!session) return fail(res, 404, "No open Cell for that code.");

  if (session.max_operators != null) {
    const countRes = await restAsService(
      `/session_operator_state?session_id=eq.${session.id}&seat_status=eq.joined&select=id`,
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

  if (existing && existing.seat_status === "joined") {
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
        body: {
          left_at: null,
          seat_status: "joined",
          removed_by: null,
          removed_reason: null,
          live_state: joinIdentityStub,
          last_mutated_by: auth.user.id,
        },
      })
    : await restAsUser(auth.token, "/session_operator_state", {
        method: "POST",
        body: {
          session_id: session.id,
          operator_profile_id: profile.id,
          owner_user_id: auth.user.id,
          seat_status: "joined",
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
  const since = String((req.query && req.query.since) || "").trim();

  const { session, error } = await fetchCell(auth.token, sessionId);
  if (error) return fail(res, error.status, error.message);

  // RLS naturally scopes this: the Handler's own token sees every joined seat, an
  // Operator's token only ever sees their own row (is_session_operator's seat_status='joined'
  // filter -- see migration 20260802120000). seat_status=eq.joined only applies for the
  // Handler's own multi-seat roster view (so left/removed seats drop out of the live
  // roster list) -- an Operator reading their OWN seat is scoped by RLS alone, regardless
  // of seat_status, since a departed Operator's own audit/history read is a separate
  // concern from the Handler's live roster.
  const isHandler = session.handler_user_id === auth.user.id;
  const seatsRes = await restAsUser(
    auth.token,
    `/session_operator_state?session_id=eq.${sessionId}${isHandler ? "&seat_status=eq.joined" : ""}&select=*,operator_profiles(display_name,designation)`,
  );
  if (!seatsRes.ok) return fail(res, seatsRes.status, "Could not read seats.");
  const seats = (await restJson(seatsRes)) || [];

  let operation = null;
  if (session.active_operation_id) {
    // Embeds the Needlepoint's own weave_id/title -- single FK path (needlepoint_id), no
    // disambiguation needed. RLS on the embedded needlepoints row applies independently: an
    // Operator only gets a non-null `needlepoint` here once the Handler has published it
    // (needlepoints_select), which is what lets operator.js derive "this Operation's Weave"
    // to fetch published Clues for, without a dedicated lookup endpoint.
    const opRes = await restAsUser(
      auth.token,
      `/cell_operations?id=eq.${session.active_operation_id}&select=*,needlepoint:needlepoints(weave_id,title,published_at)`,
    );
    if (opRes.ok) {
      const opRows = await restJson(opRes);
      operation = (opRows && opRows[0]) || null;
    }
  }

  let latestCheckpoint = null;
  const checkpointRes = await restAsUser(
    auth.token,
    `/cell_checkpoints?cell_id=eq.${sessionId}&select=id,operation_id,revision,reason,created_at&order=revision.desc&limit=1`,
  );
  if (checkpointRes.ok) {
    const rows = await restJson(checkpointRes);
    latestCheckpoint = (rows && rows[0]) || null;
  }

  const eventsFilter = since
    ? `&created_at=gt.${encodeURIComponent(since)}&order=created_at.asc&limit=200`
    : `&order=created_at.desc&limit=50`;
  const eventsRes = await restAsUser(auth.token, `/cell_events?cell_id=eq.${sessionId}${eventsFilter}`);
  let recentEvents = eventsRes.ok ? (await restJson(eventsRes)) || [] : [];
  if (!since) recentEvents = recentEvents.slice().reverse();

  return json(res, 200, { ok: true, session, seats, operation, latestCheckpoint, recentEvents });
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
    const readRes = await restAsUser(token, `/session_operator_state?id=eq.${seatId}&seat_status=eq.joined&select=*`);
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

  const { session, error } = await fetchCell(auth.token, sessionId);
  if (error) return fail(res, error.status, error.message);
  if (session.status === "closed") return fail(res, 400, "Cell is closed.");
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
    `/session_operator_state?session_id=eq.${sessionId}&owner_user_id=eq.${auth.user.id}&seat_status=eq.joined&select=id`,
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
    `/session_operator_state?session_id=eq.${sessionId}&owner_user_id=eq.${auth.user.id}&seat_status=eq.joined`,
    { method: "PATCH", body: { left_at: new Date().toISOString(), seat_status: "left" } },
  );
  if (!response.ok) return fail(res, response.status, "Could not leave Cell.");
  const rows = await restJson(response);
  return json(res, 200, { ok: true, seat: rows && rows[0] });
}

/** Handler-only: removes a seated Operator from the Cell. Distinct from `leave` (that
 * Operator's own voluntary departure) -- both land on the same seat_status='left'-adjacent
 * outcome ('removed' here) but with a real audit trail (removed_by/removed_reason) of who
 * ended the seat and why, which a plain left_at timestamp alone could never distinguish. */
async function handleRemoveSeat(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const seatId = String(body.seatId || "").trim();
  if (!cellId || !seatId) return fail(res, 400, "cellId and seatId are required.");
  const reason = String(body.reason || "").trim().slice(0, 300);

  const { error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);

  const response = await restAsUser(
    auth.token,
    `/session_operator_state?id=eq.${seatId}&session_id=eq.${cellId}&seat_status=eq.joined`,
    {
      method: "PATCH",
      body: {
        left_at: new Date().toISOString(),
        seat_status: "removed",
        removed_by: auth.user.id,
        removed_reason: reason,
      },
    },
  );
  if (!response.ok) return fail(res, response.status, "Could not remove seat.");
  const rows = await restJson(response);
  const seat = rows && rows[0];
  if (!seat) return fail(res, 404, "Seat not found or already departed.");
  return json(res, 200, { ok: true, seat });
}

/** Handler-only: starts a new Operation in this Cell. The partial unique index
 * cell_operations_single_active_idx (only one non-archived Operation per Cell) is the real
 * enforcement -- the status check here is a friendlier pre-check, not the sole guard. */
async function handleStartOperation(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  if (session.status === "closed") return fail(res, 400, "Cell is closed.");
  if (session.status === "active_operation") {
    return fail(res, 409, "An Operation is already active in this Cell -- archive it before starting another.");
  }

  // needlepointId is required -- the free-text needlepoint field this used to accept is
  // retired (see 20260803140000_cell_operations_needlepoint_id.sql): every Operation belongs
  // to exactly one durable Needlepoint now, no code path left that starts one without.
  const needlepointId = String(body.needlepointId || "").trim();
  if (!needlepointId) return fail(res, 400, "needlepointId is required.");
  const { needlepoint, error: needlepointError } = await fetchNeedlepoint(auth.token, cellId, needlepointId);
  if (needlepointError) return fail(res, needlepointError.status, needlepointError.message);
  const mission = String(body.mission || "").slice(0, 200);

  const seqRes = await restAsUser(
    auth.token,
    `/cell_operations?cell_id=eq.${cellId}&select=sequence&order=sequence.desc&limit=1`,
  );
  const seqRows = seqRes.ok ? await restJson(seqRes) : null;
  const nextSequence = ((seqRows && seqRows[0] && seqRows[0].sequence) || 0) + 1;

  const now = new Date().toISOString();
  const insertRes = await restAsUser(auth.token, "/cell_operations", {
    method: "POST",
    body: {
      cell_id: cellId,
      sequence: nextSequence,
      needlepoint_id: needlepointId,
      mission,
      status: "active",
      started_at: now,
      created_by: auth.user.id,
    },
  });
  if (!insertRes.ok) {
    const insertError = (await restJson(insertRes)) || {};
    if (insertError.code === "23505") {
      return fail(res, 409, "An Operation is already active in this Cell -- archive it before starting another.");
    }
    return fail(res, insertRes.status, insertError.message || "Could not start Operation.");
  }
  const operation = (await restJson(insertRes))[0];

  const cellRes = await restAsUser(auth.token, `/handler_sessions?id=eq.${cellId}`, {
    method: "PATCH",
    body: { status: "active_operation", active_operation_id: operation.id },
  });
  if (!cellRes.ok) return fail(res, cellRes.status, "Operation created but could not update Cell status.");
  const cellRows = await restJson(cellRes);

  // Auto-publish the Needlepoint the moment play actually begins -- the natural reveal
  // point (see needlepoints_select's RLS: an Operator can't see it, even its title, until
  // published_at is set). Best-effort/non-blocking: a Handler who wants an earlier reveal
  // already has publish-needlepoint (api/weave/[action].js) for that, and a failure here
  // must never block Operation creation itself.
  if (!needlepoint.published_at) {
    await restAsUser(auth.token, `/needlepoints?id=eq.${needlepointId}`, {
      method: "PATCH",
      body: { published_at: now },
    }).catch(() => {});
  }

  // Chat's topic is scoped by (cellId, operationId) -- a seated Operator has no other live
  // signal that a new Operation (and therefore a new chat topic) just began, since they never
  // call start-operation themselves. Reuses the already-live cell_events Realtime subscription
  // (Cell-wide, not Operation-scoped, so reachable regardless of which topic a client is
  // currently on) rather than inventing a separate lifecycle broadcast channel -- same
  // handler_update/body.kind convention suspend/resume already use above.
  await insertEvent(auth.token, {
    cellId, operationId: operation.id, eventType: "handler_update",
    actorUserId: auth.user.id, actorRole: "handler", senderName: session.handler_display_name,
    eventBody: { kind: "operation_started", operationId: operation.id },
  });

  return json(res, 200, { ok: true, operation, session: cellRows && cellRows[0] });
}

/** Handler-only: CAS-merges Handler-authored shared Operation state (scene/clue/npc/reward)
 * into cell_operations -- the server-side authoritative home that never existed before this
 * pass (this state previously lived only in the Handler's own browser localStorage, which is
 * exactly why a Cell could never be reopened from a fresh browser session). */
async function handleSyncOperation(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  if (!session.active_operation_id) return fail(res, 404, "No Operation to sync.");

  const patch = sanitizePatch(body.patch);
  const allowedKeys = ["sceneState", "clueState", "npcState", "rewardState"];
  const columnFor = { sceneState: "scene_state", clueState: "clue_state", npcState: "npc_state", rewardState: "reward_state" };

  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt += 1) {
    const { operation, error: opError } = await fetchOperation(auth.token, session.active_operation_id);
    if (opError) return fail(res, opError.status, opError.message);
    if (operation.status === "archived") return fail(res, 400, "Operation is archived and immutable.");

    const columnPatch = {};
    for (const key of allowedKeys) {
      if (!(key in patch)) continue;
      const column = columnFor[key];
      const before = operation[column] && typeof operation[column] === "object" ? operation[column] : {};
      columnPatch[column] = { ...before, ...patch[key] };
    }
    // round is a direct scalar SET (mirrors the Handler's existing local pressureRound
    // counter exactly), not a merged object -- there is no "before" to shallow-merge into.
    if (Number.isFinite(Number(patch.round))) {
      columnPatch.round = Math.max(0, Math.floor(Number(patch.round)));
    }
    if (!Object.keys(columnPatch).length) return json(res, 200, { ok: true, operation });

    const writeRes = await restAsUser(
      auth.token,
      `/cell_operations?id=eq.${operation.id}&state_version=eq.${operation.state_version}`,
      { method: "PATCH", body: { ...columnPatch, state_version: operation.state_version + 1 } },
    );
    if (!writeRes.ok) return fail(res, writeRes.status, "Could not sync Operation.");
    const written = await restJson(writeRes);
    if (written && written.length) return json(res, 200, { ok: true, operation: written[0] });
    // Lost the CAS race -- reread and retry.
  }
  return fail(res, 409, "Too many concurrent writers for this Operation.");
}

async function insertEvent(token, { cellId, operationId, eventType, actorUserId, actorRole, senderName, eventBody }) {
  await restAsUser(token, "/cell_events", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      cell_id: cellId,
      operation_id: operationId || null,
      event_type: eventType,
      actor_user_id: actorUserId,
      actor_role: actorRole,
      sender_name: senderName || "",
      body: eventBody || {},
    },
  });
}

async function handleAdvanceRound(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  if (!session.active_operation_id) return fail(res, 404, "No active Operation.");
  const { operation, error: opError } = await fetchOperation(auth.token, session.active_operation_id);
  if (opError) return fail(res, opError.status, opError.message);
  if (!NON_ARCHIVED_OPERATION_STATUSES.includes(operation.status) || operation.status === "suspended") {
    return fail(res, 409, `Cannot advance round while Operation is ${operation.status}.`);
  }

  const nextRound = (operation.round || 0) + 1;
  const phase = body.phase === "resolving" || body.phase === "active" ? body.phase : null;
  const nextStatus = operation.status === "preparing" ? "active" : (phase || operation.status);
  const patch = { round: nextRound, status: nextStatus, state_version: operation.state_version + 1 };
  if (nextStatus === "resolving" && operation.status !== "resolving") patch.resolving_at = new Date().toISOString();

  const writeRes = await restAsUser(auth.token, `/cell_operations?id=eq.${operation.id}`, { method: "PATCH", body: patch });
  if (!writeRes.ok) return fail(res, writeRes.status, "Could not advance round.");
  const updated = (await restJson(writeRes))[0];

  await insertEvent(auth.token, {
    cellId, operationId: operation.id, eventType: "round_advanced",
    actorUserId: auth.user.id, actorRole: "handler", senderName: session.handler_display_name,
    eventBody: { round: nextRound },
  });

  return json(res, 200, { ok: true, operation: updated });
}

/** Builds the exact checkpoint/export JSON contract (schemaVersion/cellId/operationId/
 * revision/createdAt/createdBy/previousSnapshotId/checksum/cell/operation/roster/
 * eventCursor -- verbatim field names, non-negotiable) and writes it as an immutable
 * cell_checkpoints row. Shared by save-cell, suspend-operation, archive-operation, and
 * export-snapshot -- they differ only in `reason` and whether a status transition
 * accompanies the write. */
async function writeCheckpoint(token, userId, session, operation, reason) {
  const seatsRes = await restAsUser(
    token,
    `/session_operator_state?session_id=eq.${session.id}&select=id,operator_profile_id,owner_user_id,seat_status,operator_profiles(display_name,designation)`,
  );
  const seats = seatsRes.ok ? (await restJson(seatsRes)) || [] : [];
  const roster = seats.map((seat) => ({
    seatId: seat.id,
    operatorProfileId: seat.operator_profile_id,
    displayName: (seat.operator_profiles && seat.operator_profiles.display_name) || "",
    designation: (seat.operator_profiles && seat.operator_profiles.designation) || "",
    seatStatus: seat.seat_status,
    ownerUserId: seat.owner_user_id,
  }));

  const lastEventRes = await restAsUser(
    token,
    `/cell_events?cell_id=eq.${session.id}&select=id,created_at&order=created_at.desc&limit=1`,
  );
  const lastEventRows = lastEventRes.ok ? await restJson(lastEventRes) : null;
  const lastEvent = lastEventRows && lastEventRows[0];

  const priorRes = await restAsUser(
    token,
    `/cell_checkpoints?cell_id=eq.${session.id}&select=id,revision&order=revision.desc&limit=1`,
  );
  const priorRows = priorRes.ok ? await restJson(priorRes) : null;
  const prior = priorRows && priorRows[0];

  const payloadWithoutChecksum = {
    schemaVersion: SCHEMA_VERSION,
    cellId: session.id,
    operationId: operation ? operation.id : null,
    revision: (prior && prior.revision ? prior.revision : 0) + 1,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    previousSnapshotId: (prior && prior.id) || null,
    cell: {
      id: session.id, joinCode: session.join_code, handlerUserId: session.handler_user_id,
      handlerDisplayName: session.handler_display_name, status: session.status,
      activeOperationId: session.active_operation_id, createdAt: session.created_at,
    },
    operation: operation ? {
      id: operation.id, sequence: operation.sequence, needlepoint: operation.needlepoint,
      mission: operation.mission, status: operation.status, round: operation.round,
      sceneState: operation.scene_state, clueState: operation.clue_state, npcState: operation.npc_state,
      rewardState: operation.reward_state, startedAt: operation.started_at,
      suspendedAt: operation.suspended_at, archivedAt: operation.archived_at,
    } : null,
    roster,
    eventCursor: lastEvent ? { lastEventId: lastEvent.id, lastEventAt: lastEvent.created_at } : null,
  };
  const checksum = computeChecksum(payloadWithoutChecksum);
  const payload = { ...payloadWithoutChecksum, checksum };

  const insertRes = await restAsUser(token, "/cell_checkpoints", {
    method: "POST",
    body: {
      cell_id: session.id,
      operation_id: operation ? operation.id : null,
      revision: payload.revision,
      reason,
      previous_snapshot_id: payload.previousSnapshotId,
      checksum,
      payload,
      created_by: userId,
    },
  });
  if (!insertRes.ok) {
    const error = (await restJson(insertRes)) || {};
    const wrapped = new Error(error.message || "Could not write checkpoint.");
    wrapped.statusCode = insertRes.status;
    throw wrapped;
  }
  const row = (await restJson(insertRes))[0];
  return { row, payload };
}

async function handleSuspendOperation(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  if (!session.active_operation_id) return fail(res, 404, "No active Operation.");
  const { operation, error: opError } = await fetchOperation(auth.token, session.active_operation_id);
  if (opError) return fail(res, opError.status, opError.message);
  if (operation.status !== "active" && operation.status !== "resolving") {
    return fail(res, 409, `Cannot suspend an Operation that is ${operation.status}.`);
  }

  let checkpoint;
  try {
    checkpoint = await writeCheckpoint(auth.token, auth.user.id, session, operation, "suspend_operation");
  } catch (checkpointError) {
    return fail(res, checkpointError.statusCode || 500, checkpointError.message);
  }

  const writeRes = await restAsUser(auth.token, `/cell_operations?id=eq.${operation.id}`, {
    method: "PATCH",
    body: { status: "suspended", suspended_at: new Date().toISOString() },
  });
  if (!writeRes.ok) return fail(res, writeRes.status, "Could not suspend Operation.");
  const updated = (await restJson(writeRes))[0];

  await insertEvent(auth.token, {
    cellId, operationId: operation.id, eventType: "handler_update",
    actorUserId: auth.user.id, actorRole: "handler", senderName: session.handler_display_name,
    eventBody: { kind: "operation_suspended" },
  });

  return json(res, 200, { ok: true, operation: updated, checkpoint: { id: checkpoint.row.id, revision: checkpoint.payload.revision } });
}

async function handleResumeOperation(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  if (!session.active_operation_id) return fail(res, 404, "No Operation to resume.");
  const { operation, error: opError } = await fetchOperation(auth.token, session.active_operation_id);
  if (opError) return fail(res, opError.status, opError.message);
  if (operation.status !== "suspended") return fail(res, 409, `Cannot resume an Operation that is ${operation.status}.`);

  const writeRes = await restAsUser(auth.token, `/cell_operations?id=eq.${operation.id}`, {
    method: "PATCH",
    body: { status: "active" },
  });
  if (!writeRes.ok) return fail(res, writeRes.status, "Could not resume Operation.");
  const updated = (await restJson(writeRes))[0];

  await insertEvent(auth.token, {
    cellId, operationId: operation.id, eventType: "handler_update",
    actorUserId: auth.user.id, actorRole: "handler", senderName: session.handler_display_name,
    eventBody: { kind: "operation_resumed" },
  });

  return json(res, 200, { ok: true, operation: updated });
}

async function handleArchiveOperation(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  if (!session.active_operation_id) return fail(res, 404, "No Operation to archive.");
  const { operation, error: opError } = await fetchOperation(auth.token, session.active_operation_id);
  if (opError) return fail(res, opError.status, opError.message);

  if (operation.status === "archived") {
    return json(res, 200, { ok: true, operation, session, alreadyArchived: true });
  }
  if (rewardStateUnresolved(operation.reward_state)) {
    return fail(res, 409, "Resolve session-end rewards (Mark/Scar, clue, trust) for every seated Operator before archiving.");
  }

  let checkpoint;
  try {
    checkpoint = await writeCheckpoint(auth.token, auth.user.id, session, operation, "archive_operation");
  } catch (checkpointError) {
    return fail(res, checkpointError.statusCode || 500, checkpointError.message);
  }

  const archivedAt = new Date().toISOString();
  const opWriteRes = await restAsUser(auth.token, `/cell_operations?id=eq.${operation.id}`, {
    method: "PATCH",
    body: {
      status: "archived",
      archived_at: archivedAt,
      final_snapshot_id: checkpoint.row.id,
      one_shot: Boolean(body.oneShot),
    },
  });
  if (!opWriteRes.ok) return fail(res, opWriteRes.status, "Could not archive Operation.");
  const updatedOperation = (await restJson(opWriteRes))[0];

  // Cell moves to POST_OPERATION -- seats are never touched here, by design. active_operation_id
  // is deliberately left pointing at the now-archived Operation (not cleared) so `state`'s
  // `operation` field keeps surfacing its final data for reward-review/history during
  // POST_OPERATION; start-operation overwrites it once a new Operation begins.
  const cellWriteRes = await restAsUser(auth.token, `/handler_sessions?id=eq.${cellId}`, {
    method: "PATCH",
    body: { status: "post_operation" },
  });
  if (!cellWriteRes.ok) return fail(res, cellWriteRes.status, "Operation archived but could not update Cell status.");
  const updatedSession = (await restJson(cellWriteRes))[0];

  await insertEvent(auth.token, {
    cellId, operationId: operation.id, eventType: "operation_archived",
    actorUserId: auth.user.id, actorRole: "handler", senderName: session.handler_display_name,
    eventBody: { operationId: operation.id },
  });

  return json(res, 200, {
    ok: true, operation: updatedOperation, session: updatedSession,
    checkpoint: { id: checkpoint.row.id, revision: checkpoint.payload.revision },
  });
}

/** Operator-only: publishes their complete sheet as this Operation's immutable legal
 * baseline. One-shot per (operation_id, seat_id) -- the unique constraint plus the absence
 * of any update/delete RLS policy is what makes this immutable in the literal sense, not an
 * application convention nobody happens to violate. */
async function handlePublishOperationBaseline(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const operationId = String(body.operationId || "").trim();
  const seatId = String(body.seatId || "").trim();
  if (!operationId || !seatId) return fail(res, 400, "operationId and seatId are required.");
  const sheet = body.sheet && typeof body.sheet === "object" ? body.sheet : null;
  if (!sheet) return fail(res, 400, "sheet is required.");

  const seatRes = await restAsUser(
    auth.token,
    `/session_operator_state?id=eq.${seatId}&owner_user_id=eq.${auth.user.id}&select=id,operator_profile_id`,
  );
  if (!seatRes.ok) return fail(res, seatRes.status, "Could not read seat.");
  const seatRows = await restJson(seatRes);
  const seat = seatRows && seatRows[0];
  if (!seat) return fail(res, 404, "Seat not found or not owned by this account.");

  const checksum = computeChecksum(sheet);
  const insertRes = await restAsUser(auth.token, "/cell_operation_baselines", {
    method: "POST",
    body: {
      operation_id: operationId,
      seat_id: seatId,
      operator_profile_id: seat.operator_profile_id,
      owner_user_id: auth.user.id,
      sheet,
      checksum,
    },
  });
  if (!insertRes.ok) {
    const insertError = (await restJson(insertRes)) || {};
    if (insertError.code === "23505") {
      return fail(res, 409, "A baseline has already been published for this Operation -- baselines are immutable.");
    }
    return fail(res, insertRes.status, insertError.message || "Could not publish baseline.");
  }
  const baseline = (await restJson(insertRes))[0];
  return json(res, 200, { ok: true, baseline });
}

/** GET, Handler or the owning Operator: reads a seat's complete legal sheet for a given
 * Operation. A plain authenticated database read -- works identically whether that Operator
 * is connected, disconnected, or has left, since nothing about it depends on a live
 * connection. */
async function handleOperationBaseline(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const operationId = String((req.query && req.query.operationId) || "").trim();
  const seatId = String((req.query && req.query.seatId) || "").trim();
  if (!operationId || !seatId) return fail(res, 400, "operationId and seatId are required.");

  const response = await restAsUser(
    auth.token,
    `/cell_operation_baselines?operation_id=eq.${operationId}&seat_id=eq.${seatId}&select=*`,
  );
  if (!response.ok) return fail(res, response.status, "Could not read baseline.");
  const rows = await restJson(response);
  const baseline = rows && rows[0];
  if (!baseline) return fail(res, 404, "No baseline published for this seat yet.");
  return json(res, 200, { ok: true, baseline });
}

async function handleSendChat(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");
  const text = String(body.text || "").trim().slice(0, MAX_CHAT_TEXT_BYTES);
  if (!text) return fail(res, 400, "Message text is required.");

  const { session, error } = await fetchCell(auth.token, cellId);
  if (error) return fail(res, error.status, error.message);
  if (session.status === "closed") return fail(res, 400, "Chat is read-only once the Cell is closed.");

  const isHandler = session.handler_user_id === auth.user.id;
  let senderName;
  let actorRole;
  if (isHandler) {
    senderName = session.handler_display_name;
    actorRole = "handler";
  } else {
    const seatRes = await restAsUser(
      auth.token,
      `/session_operator_state?session_id=eq.${cellId}&owner_user_id=eq.${auth.user.id}&seat_status=eq.joined&select=id,operator_profiles(display_name,designation)`,
    );
    const seatRows = seatRes.ok ? await restJson(seatRes) : null;
    const seat = seatRows && seatRows[0];
    if (!seat) return fail(res, 403, "You are not seated in this Cell.");
    const profile = seat.operator_profiles || {};
    senderName = profile.display_name || profile.designation || "Operator";
    actorRole = "operator";
  }

  // Chat is ephemeral to the current Operation, not durable campaign history (see
  // 20260803100000_cell_events_chat_type_deprecated.sql) -- no cell_events row, no
  // Postgres write of any kind for chat content. Delivery is a Realtime Broadcast on a
  // topic scoped by cellId+operationId, so a new Operation (or archiving this one) makes
  // the old topic unreachable without anything needing to be explicitly deleted. `id` is
  // assigned SERVER-side (never client-supplied) so a client can never grief peers' id-keyed
  // dedup maps by reusing an observed message's id.
  const operationId = session.active_operation_id || null;
  const message = {
    id: crypto.randomUUID(),
    cellId,
    operationId,
    senderName,
    actorRole,
    text,
    createdAt: new Date().toISOString(),
  };
  const topic = `cell-chat:${cellId}:${operationId || "lobby"}`;
  await realtimeBroadcast(topic, "chat-message", message);
  return json(res, 200, { ok: true, message });
}

async function handleSaveCell(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  let operation = null;
  if (session.active_operation_id) {
    const opResult = await fetchOperation(auth.token, session.active_operation_id);
    if (!opResult.error) operation = opResult.operation;
  }

  try {
    const checkpoint = await writeCheckpoint(auth.token, auth.user.id, session, operation, "save_cell");
    return json(res, 200, { ok: true, checkpoint: { id: checkpoint.row.id, revision: checkpoint.payload.revision, createdAt: checkpoint.payload.createdAt } });
  } catch (checkpointError) {
    return fail(res, checkpointError.statusCode || 500, checkpointError.message);
  }
}

async function handleExportSnapshot(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  let operation = null;
  if (session.active_operation_id) {
    const opResult = await fetchOperation(auth.token, session.active_operation_id);
    if (!opResult.error) operation = opResult.operation;
  }

  try {
    const checkpoint = await writeCheckpoint(auth.token, auth.user.id, session, operation, "export");
    return json(res, 200, { ok: true, snapshot: checkpoint.payload });
  } catch (checkpointError) {
    return fail(res, checkpointError.statusCode || 500, checkpointError.message);
  }
}

/** Validates and restores a Cell/Operation snapshot. Always creates a brand-new Cell +
 * Operation with fresh id/join_code, UNLESS the caller already owns the snapshot's cellId
 * and explicitly passes confirmOverwrite -- never silently claims or mutates a Cell the
 * caller doesn't already own. Never fabricates session_operator_state rows -- roster entries
 * restore as plain reference data only; real Operators reattach only by actually rejoining
 * (their existing operator_profiles match on display_name, so the same account rejoining
 * under the same name already reclaims its identity via the ordinary `join` flow). */
async function handleImportSnapshot(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const snapshot = body.snapshot && typeof body.snapshot === "object" ? body.snapshot : null;
  if (!snapshot) return fail(res, 400, "snapshot is required.");
  if (snapshot.schemaVersion !== SCHEMA_VERSION) return fail(res, 400, `Unsupported snapshot schemaVersion ${snapshot.schemaVersion}.`);

  const { checksum: _omit, ...payloadWithoutChecksum } = snapshot;
  const recomputed = computeChecksum(payloadWithoutChecksum);
  if (recomputed !== snapshot.checksum) {
    return fail(res, 400, "Snapshot checksum does not match -- the file may be corrupted or tampered with.");
  }

  let targetCellId = null;
  if (snapshot.cellId) {
    const existing = await fetchOwnedCell(auth.token, auth.user.id, snapshot.cellId);
    if (!existing.error) {
      if (!body.confirmOverwrite) {
        return fail(res, 409, "A Cell with this ID already exists under your account. Pass confirmOverwrite to proceed.");
      }
      targetCellId = snapshot.cellId;
    }
  }

  let cellRow;
  if (!targetCellId) {
    let created = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateJoinCode();
      const createRes = await restAsUser(auth.token, "/handler_sessions", {
        method: "POST",
        body: {
          handler_user_id: auth.user.id,
          join_code: code,
          status: snapshot.cell && snapshot.cell.status ? snapshot.cell.status : "open",
          handler_display_name: (snapshot.cell && snapshot.cell.handlerDisplayName) || "Handler",
        },
      });
      if (createRes.ok) {
        created = (await restJson(createRes))[0];
        break;
      }
      const createError = (await restJson(createRes)) || {};
      if (createError.code !== "23505") return fail(res, createRes.status, createError.message || "Could not create Cell.");
    }
    if (!created) return fail(res, 500, "Could not allocate a Cell Code.");
    cellRow = created;
  } else {
    const rows = await restJson(await restAsUser(auth.token, `/handler_sessions?id=eq.${targetCellId}&select=*`));
    cellRow = rows && rows[0];
  }

  let operationRow = null;
  if (snapshot.operation) {
    const seqRes = await restAsUser(auth.token, `/cell_operations?cell_id=eq.${cellRow.id}&select=sequence&order=sequence.desc&limit=1`);
    const seqRows = seqRes.ok ? await restJson(seqRes) : null;
    const nextSequence = ((seqRows && seqRows[0] && seqRows[0].sequence) || 0) + 1;
    const opInsertRes = await restAsUser(auth.token, "/cell_operations", {
      method: "POST",
      body: {
        cell_id: cellRow.id,
        sequence: nextSequence,
        needlepoint: snapshot.operation.needlepoint || "",
        mission: snapshot.operation.mission || "",
        status: snapshot.operation.status || "preparing",
        round: snapshot.operation.round || 0,
        scene_state: snapshot.operation.sceneState || {},
        clue_state: snapshot.operation.clueState || {},
        npc_state: snapshot.operation.npcState || {},
        reward_state: snapshot.operation.rewardState || {},
        created_by: auth.user.id,
      },
    });
    if (opInsertRes.ok) {
      operationRow = (await restJson(opInsertRes))[0];
      await restAsUser(auth.token, `/handler_sessions?id=eq.${cellRow.id}`, {
        method: "PATCH",
        body: { active_operation_id: operationRow.id },
      });
    }
  }

  return json(res, 200, {
    ok: true,
    cell: cellRow,
    operation: operationRow,
    roster: Array.isArray(snapshot.roster) ? snapshot.roster : [],
  });
}

/**
 * Handler-only: closes the Cell. This is the LOBBY-ending action, entirely separate from
 * anything that happens to an Operation -- it refuses outright if a non-archived Operation
 * still exists (archive-operation must run first), and it never touches a seat row. left_at/
 * seat_status mean "this participant actually left the lobby", a fact about ONE seat decided
 * by that Operator (or the Handler's remove-seat) -- closing the Cell is a fact about the
 * ROOM and must never be forced onto every seat just because the room is done for good.
 */
async function handleCloseCell(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || body.sessionId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const { session, error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);
  if (session.status === "closed") return json(res, 200, { ok: true, session, seats: [] });

  if (session.active_operation_id) {
    const { operation, error: opError } = await fetchOperation(auth.token, session.active_operation_id);
    if (!opError && operation.status !== "archived") {
      return fail(res, 409, "Archive the current Operation before closing the Cell.");
    }
  }

  const seatsRes = await restAsUser(auth.token, `/session_operator_state?session_id=eq.${cellId}&seat_status=eq.joined&select=*`);
  const seats = seatsRes.ok ? (await restJson(seatsRes)) || [] : [];
  const closedAt = new Date().toISOString();

  const closeRes = await restAsUser(auth.token, `/handler_sessions?id=eq.${cellId}`, {
    method: "PATCH",
    body: { status: "closed", closed_at: closedAt },
  });
  if (!closeRes.ok) return fail(res, closeRes.status, "Could not close Cell.");
  const closedRows = await restJson(closeRes);
  return json(res, 200, { ok: true, session: closedRows && closedRows[0], seats });
}

/**
 * Handler-only, account-scoped (no cellId): lists every Cell the caller owns, for the Cells
 * dashboard. Two REST round-trips total regardless of Cell count -- no N+1. RLS already
 * makes `handler_user_id=eq.<uid>` safe and correct (handler_sessions_select's first
 * disjunct); no service-role bypass, no new policy.
 */
async function handleListCells(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;

  const cellsRes = await restAsUser(
    auth.token,
    `/handler_sessions?handler_user_id=eq.${auth.user.id}` +
      `&select=id,cell_name,join_code,status,max_operators,active_operation_id,handler_display_name,` +
      `created_at,updated_at,closed_at,` +
      `cell_operations!handler_sessions_active_operation_id_fkey(id,sequence,status,round,reward_state,started_at,suspended_at,archived_at,updated_at)` +
      `&order=updated_at.desc`,
  );
  if (!cellsRes.ok) return fail(res, cellsRes.status, "Could not list Cells.");
  const cells = (await restJson(cellsRes)) || [];

  const ids = cells.map((c) => c.id);
  const seatedCounts = {};
  if (ids.length) {
    const idList = ids.join(",");
    const countsRes = await restAsUser(
      auth.token,
      `/session_operator_state?session_id=in.(${idList})&seat_status=eq.joined&select=session_id`,
    );
    if (countsRes.ok) {
      const rows = (await restJson(countsRes)) || [];
      rows.forEach((row) => {
        seatedCounts[row.session_id] = (seatedCounts[row.session_id] || 0) + 1;
      });
    }
  }

  const results = cells.map((cell) => {
    const operation = Array.isArray(cell.cell_operations) ? cell.cell_operations[0] : cell.cell_operations;
    return {
      id: cell.id,
      cellName: cell.cell_name,
      joinCode: cell.join_code,
      status: cell.status,
      maxOperators: cell.max_operators,
      handlerDisplayName: cell.handler_display_name,
      createdAt: cell.created_at,
      updatedAt: cell.updated_at,
      closedAt: cell.closed_at,
      seatedCount: seatedCounts[cell.id] || 0,
      operation: operation
        ? {
            id: operation.id,
            sequence: operation.sequence,
            status: operation.status,
            round: operation.round,
            startedAt: operation.started_at,
            suspendedAt: operation.suspended_at,
            archivedAt: operation.archived_at,
            unresolvedRewards: rewardStateUnresolved(operation.reward_state),
          }
        : null,
    };
  });
  return json(res, 200, { ok: true, cells: results });
}

async function handleRenameCell(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");
  const cellName = String(body.cellName || "").trim().slice(0, 120);
  if (!cellName) return fail(res, 400, "cellName is required.");

  const { error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);

  const writeRes = await restAsUser(auth.token, `/handler_sessions?id=eq.${cellId}`, {
    method: "PATCH",
    body: { cell_name: cellName },
  });
  if (!writeRes.ok) return fail(res, writeRes.status, "Could not rename Cell.");
  const rows = await restJson(writeRes);
  return json(res, 200, { ok: true, session: rows && rows[0] });
}

/** Handler or seated Operator: lists a Cell's archived Operations (its prior-session
 * history). RLS (cell_operations_select) already permits this for either role; this action
 * exists purely for Bearer-token transport consistency with the rest of this file. */
async function handleOperationsHistory(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const cellId = String((req.query && req.query.cellId) || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");

  const opsRes = await restAsUser(
    auth.token,
    `/cell_operations?cell_id=eq.${cellId}&status=eq.archived&select=id,sequence,needlepoint,mission,round,started_at,archived_at,final_snapshot_id&order=sequence.desc`,
  );
  if (!opsRes.ok) return fail(res, opsRes.status, "Could not read Operation history.");
  const operations = (await restJson(opsRes)) || [];
  return json(res, 200, { ok: true, operations });
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
    if (action === "remove-seat") return await handleRemoveSeat(req, res);
    if (action === "start-operation") return await handleStartOperation(req, res);
    if (action === "sync-operation") return await handleSyncOperation(req, res);
    if (action === "advance-round") return await handleAdvanceRound(req, res);
    if (action === "suspend-operation") return await handleSuspendOperation(req, res);
    if (action === "resume-operation") return await handleResumeOperation(req, res);
    if (action === "archive-operation") return await handleArchiveOperation(req, res);
    if (action === "publish-operation-baseline") return await handlePublishOperationBaseline(req, res);
    if (action === "operation-baseline") return await handleOperationBaseline(req, res);
    if (action === "send-chat") return await handleSendChat(req, res);
    if (action === "save-cell") return await handleSaveCell(req, res);
    if (action === "export-snapshot") return await handleExportSnapshot(req, res);
    if (action === "import-snapshot") return await handleImportSnapshot(req, res);
    if (action === "close-cell") return await handleCloseCell(req, res);
    if (action === "list") return await handleListCells(req, res);
    if (action === "rename-cell") return await handleRenameCell(req, res);
    if (action === "operations-history") return await handleOperationsHistory(req, res);
    return fail(res, 404, "Unknown Cell route.");
  } catch (error) {
    return fail(res, error.statusCode || 500, error.message || "Cell sync request failed.");
  }
};
