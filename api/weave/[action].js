/**
 * Weave / Thread / Clue API — the campaign-continuity layer above the Cell/Operation lobby
 * model (see api/cell/[action].js for that). A new sibling file, not more routes crammed into
 * api/cell/[action].js: this concern shares none of that file's per-Operation CAS-merge/
 * debounce/Realtime-chat machinery, and keeping it separate makes the Handler-only-vs-
 * Operator-visible RLS split -- the single most safety-critical property of this feature --
 * visually obvious at the file level.
 *
 * Hierarchy: Cell 1:N Weave 1:N Needlepoint 1:N Operation (see
 * 20260803140000_cell_operations_needlepoint_id.sql -- there is no cell_operations.weave_id
 * column; a Weave is always reached by joining through needlepoint_id).
 *
 * Confidentiality (all RLS-enforced, not just app-code discipline):
 *   - weaves, threads, cell_entities: Handler-only, including SELECT. Never lobby-wide.
 *   - needlepoints, weave_clues: Handler-only until an explicit published_at is set, then
 *     also readable by seated Operators (needlepoints_select / weave_clues_select).
 *   - promote-thread/update-thread never write a cell_events row, even a bare id -- weaves/
 *     threads are Handler-only-select, so there is no safe partial disclosure. clue_published
 *     and weave_completed DO write one (weave_completed carries only a bare weaveId an
 *     Operator token can't resolve to anything; clue_published is safe since weave_clues is
 *     already Operator-visible once published).
 *
 * Routes (all under /api/weave/<action>):
 *   POST create-weave            { cellId, title, summary? }                          [Handler]
 *   GET  list-weaves             ?cellId=                                             [Handler]
 *   POST update-weave            { cellId, weaveId, patch:{title?,summary?,status?} } [Handler]
 *   POST create-needlepoint      { cellId, weaveId, templateId?, title }               [Handler]
 *   GET  list-needlepoints       ?cellId=&weaveId=                          [Handler or Operator, RLS-filtered]
 *   POST publish-needlepoint     { cellId, weaveId, needlepointId }                    [Handler]
 *   GET  list-needlepoint-operations ?cellId=&needlepointId=                [Handler or Operator]
 *   POST create-cell-entity      { cellId, kind, name, description? }                  [Handler]
 *   GET  list-cell-entities      ?cellId=                                             [Handler]
 *   POST update-cell-entity      { cellId, entityId, patch:{...} }                     [Handler]
 *   POST promote-thread          { cellId, weaveId, kind, title, notes?, status?,
 *                                   relationships?, entityId?, sourceOperationId?, sourceRef? } [Handler]
 *   GET  list-threads            ?cellId=&weaveId=                                    [Handler]
 *   POST update-thread           { cellId, weaveId, threadId, patch:{...} }            [Handler]
 *   POST create-clue              { cellId, weaveId, threadId, title, body,
 *                                   sourceOperationId?, sourceNeedlepointId?, sourceRef?, publish? } [Handler]
 *   POST publish-clue-draft      { cellId, weaveId, clueId }                           [Handler]
 *   POST update-clue-draft       { cellId, weaveId, clueId, patch:{...} }              [Handler]
 *   GET  list-clues              ?cellId=&weaveId=                          [Handler or Operator, RLS-filtered]
 *   POST link-thread-operation   { cellId, threadId, operationId, note? }              [Handler]
 *   POST unlink-thread-operation { cellId, threadId, operationId }                     [Handler]
 *   GET  list-operation-threads  ?cellId=&operationId=                                [Handler]
 */

const {
  json,
  readJsonBody,
  getBearerToken,
  getAuthedUser,
  restAsUser,
  restJson,
} = require("../../lib/cellSync");

const MAX_CAS_ATTEMPTS = 5;

function fail(res, status, message) {
  return json(res, status, { ok: false, error: message });
}

/** Matches api/cell/[action].js's own local insertEvent exactly -- not shared via
 * lib/cellSync.js, following this codebase's existing convention of file-local helpers. */
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

function queryParam(req, key) {
  if (req.query && req.query[key] !== undefined) return String(req.query[key]);
  const url = new URL(req.url || "", "http://localhost");
  return url.searchParams.get(key) || "";
}

// --- Ownership helpers, `{ thing, error: {status, message} }` shape, matching
// api/cell/[action].js's fetchOwnedCell/fetchOperation exactly. ---

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

/** weaves_select's RLS is Handler-only, so this already can't return a row for a non-owning
 * Handler -- the userId isn't even part of the filter (cell_id ownership is what RLS checks
 * via is_session_handler); the cellId filter here is just cross-Cell-mismatch protection. */
async function fetchOwnedWeave(token, cellId, weaveId) {
  const response = await restAsUser(token, `/weaves?id=eq.${weaveId}&cell_id=eq.${cellId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Weave." } };
  const rows = await restJson(response);
  const weave = rows && rows[0];
  if (!weave) return { error: { status: 404, message: "Weave not found, or does not belong to this Cell." } };
  return { weave };
}

async function fetchNeedlepoint(token, cellId, needlepointId) {
  const response = await restAsUser(token, `/needlepoints?id=eq.${needlepointId}&cell_id=eq.${cellId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Needlepoint." } };
  const rows = await restJson(response);
  const needlepoint = rows && rows[0];
  if (!needlepoint) return { error: { status: 400, message: "Needlepoint not found, or does not belong to this Cell." } };
  return { needlepoint };
}

async function fetchThread(token, cellId, threadId) {
  const response = await restAsUser(token, `/threads?id=eq.${threadId}&cell_id=eq.${cellId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Thread." } };
  const rows = await restJson(response);
  const thread = rows && rows[0];
  if (!thread) return { error: { status: 404, message: "Thread not found, or does not belong to this Cell." } };
  return { thread };
}

async function fetchCellEntity(token, cellId, entityId) {
  const response = await restAsUser(token, `/cell_entities?id=eq.${entityId}&cell_id=eq.${cellId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Cell Entity." } };
  const rows = await restJson(response);
  const entity = rows && rows[0];
  if (!entity) return { error: { status: 400, message: "Cell Entity not found, or does not belong to this Cell." } };
  return { entity };
}

async function fetchOperation(token, cellId, operationId) {
  const response = await restAsUser(token, `/cell_operations?id=eq.${operationId}&cell_id=eq.${cellId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Operation." } };
  const rows = await restJson(response);
  const operation = rows && rows[0];
  if (!operation) return { error: { status: 400, message: "Operation not found, or does not belong to this Cell." } };
  return { operation };
}

async function fetchClue(token, cellId, clueId) {
  const response = await restAsUser(token, `/weave_clues?id=eq.${clueId}&cell_id=eq.${cellId}&select=*`);
  if (!response.ok) return { error: { status: response.status, message: "Could not read Clue." } };
  const rows = await restJson(response);
  const clue = rows && rows[0];
  if (!clue) return { error: { status: 404, message: "Clue not found, or does not belong to this Cell." } };
  return { clue };
}

/** One CAS PATCH attempt on `?id=eq.<id>&state_version=eq.<currentVersion>` -- callers loop
 * this up to MAX_CAS_ATTEMPTS, re-fetching the row on a lost race, exactly mirroring
 * handleSyncOperation's own pattern in api/cell/[action].js. */
async function casPatchOnce(token, resourcePath, id, currentVersion, patchBody) {
  return restAsUser(token, `${resourcePath}?id=eq.${id}&state_version=eq.${currentVersion}`, {
    method: "PATCH",
    body: { ...patchBody, state_version: currentVersion + 1 },
  });
}

// --- Weave ---

async function handleCreateWeave(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");
  const title = String(body.title || "").trim().slice(0, 120);
  if (!title) return fail(res, 400, "title is required.");
  const summary = String(body.summary || "").slice(0, 2000);

  const { error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);

  const insertRes = await restAsUser(auth.token, "/weaves", {
    method: "POST",
    body: { cell_id: cellId, title, summary, status: "planned", created_by: auth.user.id },
  });
  if (!insertRes.ok) {
    const insertError = (await restJson(insertRes)) || {};
    return fail(res, insertRes.status, insertError.message || "Could not create Weave.");
  }
  const weave = (await restJson(insertRes))[0];
  return json(res, 200, { ok: true, weave });
}

async function handleListWeaves(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const cellId = queryParam(req, "cellId");
  if (!cellId) return fail(res, 400, "cellId is required.");
  const response = await restAsUser(auth.token, `/weaves?cell_id=eq.${cellId}&select=*&order=updated_at.desc`);
  if (!response.ok) return fail(res, response.status, "Could not list Weaves.");
  const weaves = await restJson(response);
  return json(res, 200, { ok: true, weaves: weaves || [] });
}

async function handleUpdateWeave(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const weaveId = String(body.weaveId || "").trim();
  if (!cellId || !weaveId) return fail(res, 400, "cellId and weaveId are required.");
  const patch = body.patch && typeof body.patch === "object" ? body.patch : {};

  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt += 1) {
    const { weave, error } = await fetchOwnedWeave(auth.token, cellId, weaveId);
    if (error) return fail(res, error.status, error.message);

    const columnPatch = {};
    if (typeof patch.title === "string") columnPatch.title = patch.title.trim().slice(0, 120);
    if (typeof patch.summary === "string") columnPatch.summary = patch.summary.slice(0, 2000);
    if (typeof patch.status === "string") {
      columnPatch.status = patch.status;
      if (patch.status === "completed") columnPatch.completed_at = new Date().toISOString();
      if (patch.status === "archived") columnPatch.archived_at = new Date().toISOString();
    }
    if (!Object.keys(columnPatch).length) return json(res, 200, { ok: true, weave });

    const writeRes = await casPatchOnce(auth.token, "/weaves", weave.id, weave.state_version, columnPatch);
    if (!writeRes.ok) return fail(res, writeRes.status, "Could not update Weave.");
    const written = await restJson(writeRes);
    if (written && written.length) {
      const updated = written[0];
      // The one deliberate cell_events row for this file: a bare weaveId, un-resolvable by an
      // Operator token since weaves_select is Handler-only -- see the file header comment.
      if (patch.status === "completed") {
        await insertEvent(auth.token, {
          cellId, operationId: null, eventType: "handler_update",
          actorUserId: auth.user.id, actorRole: "handler", senderName: "",
          eventBody: { kind: "weave_completed", weaveId },
        });
      }
      return json(res, 200, { ok: true, weave: updated });
    }
    // Lost the CAS race -- reread and retry.
  }
  return fail(res, 409, "Too many concurrent writers for this Weave.");
}

// --- Needlepoint ---

async function handleCreateNeedlepoint(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const weaveId = String(body.weaveId || "").trim();
  if (!cellId || !weaveId) return fail(res, 400, "cellId and weaveId are required.");
  const title = String(body.title || "").trim().slice(0, 160);
  if (!title) return fail(res, 400, "title is required.");
  const templateIdRaw = body.templateId == null ? null : String(body.templateId).trim().slice(0, 120);
  const templateId = templateIdRaw || null;

  const { error } = await fetchOwnedWeave(auth.token, cellId, weaveId);
  if (error) return fail(res, error.status, error.message);

  const insertRes = await restAsUser(auth.token, "/needlepoints", {
    method: "POST",
    body: { cell_id: cellId, weave_id: weaveId, template_id: templateId, title, created_by: auth.user.id },
  });
  if (!insertRes.ok) {
    const insertError = (await restJson(insertRes)) || {};
    return fail(res, insertRes.status, insertError.message || "Could not create Needlepoint.");
  }
  const needlepoint = (await restJson(insertRes))[0];
  return json(res, 200, { ok: true, needlepoint });
}

async function handleListNeedlepoints(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const cellId = queryParam(req, "cellId");
  const weaveId = queryParam(req, "weaveId");
  if (!cellId || !weaveId) return fail(res, 400, "cellId and weaveId are required.");
  const response = await restAsUser(
    auth.token,
    `/needlepoints?cell_id=eq.${cellId}&weave_id=eq.${weaveId}&select=*&order=updated_at.desc`,
  );
  if (!response.ok) return fail(res, response.status, "Could not list Needlepoints.");
  const needlepoints = await restJson(response);
  return json(res, 200, { ok: true, needlepoints: needlepoints || [] });
}

async function handlePublishNeedlepoint(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const needlepointId = String(body.needlepointId || "").trim();
  if (!cellId || !needlepointId) return fail(res, 400, "cellId and needlepointId are required.");

  const { needlepoint, error } = await fetchNeedlepoint(auth.token, cellId, needlepointId);
  if (error) return fail(res, error.status, error.message);
  if (needlepoint.published_at) return json(res, 200, { ok: true, needlepoint });

  const writeRes = await restAsUser(auth.token, `/needlepoints?id=eq.${needlepointId}`, {
    method: "PATCH",
    body: { published_at: new Date().toISOString() },
  });
  if (!writeRes.ok) return fail(res, writeRes.status, "Could not publish Needlepoint.");
  const written = await restJson(writeRes);
  return json(res, 200, { ok: true, needlepoint: written && written[0] });
}

async function handleListNeedlepointOperations(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const cellId = queryParam(req, "cellId");
  const needlepointId = queryParam(req, "needlepointId");
  if (!cellId || !needlepointId) return fail(res, 400, "cellId and needlepointId are required.");
  // cell_operations_select's own RLS (lobby-wide) is what actually scopes this -- unaffected
  // by the Needlepoint's own publish state, since these rows are already independently
  // visible to a seated Operator via the existing policy.
  const response = await restAsUser(
    auth.token,
    `/cell_operations?cell_id=eq.${cellId}&needlepoint_id=eq.${needlepointId}&select=*&order=sequence.desc`,
  );
  if (!response.ok) return fail(res, response.status, "Could not list Operations.");
  const operations = await restJson(response);
  return json(res, 200, { ok: true, operations: operations || [] });
}

// --- Cell Entities ---

async function handleCreateCellEntity(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  if (!cellId) return fail(res, 400, "cellId is required.");
  const name = String(body.name || "").trim().slice(0, 120);
  if (!name) return fail(res, 400, "name is required.");
  const kind = ["npc", "entity", "zone"].includes(body.kind) ? body.kind : "npc";
  const description = String(body.description || "").slice(0, 2000);

  const { error } = await fetchOwnedCell(auth.token, auth.user.id, cellId);
  if (error) return fail(res, error.status, error.message);

  const insertRes = await restAsUser(auth.token, "/cell_entities", {
    method: "POST",
    body: { cell_id: cellId, kind, name, description, created_by: auth.user.id },
  });
  if (!insertRes.ok) {
    const insertError = (await restJson(insertRes)) || {};
    return fail(res, insertRes.status, insertError.message || "Could not create Cell Entity.");
  }
  const entity = (await restJson(insertRes))[0];
  return json(res, 200, { ok: true, entity });
}

async function handleListCellEntities(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const cellId = queryParam(req, "cellId");
  if (!cellId) return fail(res, 400, "cellId is required.");
  const response = await restAsUser(auth.token, `/cell_entities?cell_id=eq.${cellId}&select=*&order=name.asc`);
  if (!response.ok) return fail(res, response.status, "Could not list Cell Entities.");
  const entities = await restJson(response);
  return json(res, 200, { ok: true, entities: entities || [] });
}

async function handleUpdateCellEntity(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const entityId = String(body.entityId || "").trim();
  if (!cellId || !entityId) return fail(res, 400, "cellId and entityId are required.");
  const patch = body.patch && typeof body.patch === "object" ? body.patch : {};

  const { error } = await fetchCellEntity(auth.token, cellId, entityId);
  if (error) return fail(res, error.status, error.message);

  const columnPatch = {};
  if (typeof patch.name === "string") columnPatch.name = patch.name.trim().slice(0, 120);
  if (typeof patch.description === "string") columnPatch.description = patch.description.slice(0, 2000);
  if (["npc", "entity", "zone"].includes(patch.kind)) columnPatch.kind = patch.kind;
  if (!Object.keys(columnPatch).length) return fail(res, 400, "No fields to update.");

  const writeRes = await restAsUser(auth.token, `/cell_entities?id=eq.${entityId}`, {
    method: "PATCH",
    body: columnPatch,
  });
  if (!writeRes.ok) return fail(res, writeRes.status, "Could not update Cell Entity.");
  const written = await restJson(writeRes);
  return json(res, 200, { ok: true, entity: written && written[0] });
}

// --- Thread ---

async function handlePromoteThread(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const weaveId = String(body.weaveId || "").trim();
  if (!cellId || !weaveId) return fail(res, 400, "cellId and weaveId are required.");
  const title = String(body.title || "").trim().slice(0, 120);
  if (!title) return fail(res, 400, "title is required.");
  const kindOptions = ["clue", "npc_entity", "faction_pressure", "consequence", "evidence", "discovery", "question"];
  const kind = kindOptions.includes(body.kind) ? body.kind : "evidence";
  const statusOptions = ["active", "confirmed", "suspected", "contaminated", "rerouted", "resolved"];
  const status = statusOptions.includes(body.status) ? body.status : "active";
  const notes = String(body.notes || "").slice(0, 4000);
  const relationships = Array.isArray(body.relationships) ? body.relationships.slice(0, 40) : [];
  const sourceOperationId = body.sourceOperationId ? String(body.sourceOperationId).trim() : null;
  const sourceRef = String(body.sourceRef || "").slice(0, 120);

  const { error: weaveError } = await fetchOwnedWeave(auth.token, cellId, weaveId);
  if (weaveError) return fail(res, weaveError.status, weaveError.message);

  let entityId = null;
  if (body.entityId) {
    const { entity, error: entityError } = await fetchCellEntity(auth.token, cellId, String(body.entityId).trim());
    if (entityError) return fail(res, entityError.status, entityError.message);
    entityId = entity.id;
  }

  const insertRes = await restAsUser(auth.token, "/threads", {
    method: "POST",
    body: {
      cell_id: cellId, weave_id: weaveId, kind, status, title, notes, relationships,
      entity_id: entityId, source_operation_id: sourceOperationId, source_ref: sourceRef,
      created_by: auth.user.id,
    },
  });
  if (!insertRes.ok) {
    const insertError = (await restJson(insertRes)) || {};
    return fail(res, insertRes.status, insertError.message || "Could not promote Thread.");
  }
  const thread = (await restJson(insertRes))[0];
  // No cell_events row -- see file header comment on Thread confidentiality.
  return json(res, 200, { ok: true, thread });
}

async function handleListThreads(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const cellId = queryParam(req, "cellId");
  const weaveId = queryParam(req, "weaveId");
  if (!cellId || !weaveId) return fail(res, 400, "cellId and weaveId are required.");
  const response = await restAsUser(
    auth.token,
    `/threads?cell_id=eq.${cellId}&weave_id=eq.${weaveId}&select=*&order=updated_at.desc`,
  );
  if (!response.ok) return fail(res, response.status, "Could not list Threads.");
  const threads = await restJson(response);
  return json(res, 200, { ok: true, threads: threads || [] });
}

async function handleUpdateThread(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const weaveId = String(body.weaveId || "").trim();
  const threadId = String(body.threadId || "").trim();
  if (!cellId || !weaveId || !threadId) return fail(res, 400, "cellId, weaveId, and threadId are required.");
  const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
  const statusOptions = ["active", "confirmed", "suspected", "contaminated", "rerouted", "resolved"];
  const kindOptions = ["clue", "npc_entity", "faction_pressure", "consequence", "evidence", "discovery", "question"];

  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt += 1) {
    const { thread, error } = await fetchThread(auth.token, cellId, threadId);
    if (error) return fail(res, error.status, error.message);
    if (thread.weave_id !== weaveId) return fail(res, 400, "Thread does not belong to this Weave.");

    const columnPatch = {};
    if (typeof patch.title === "string") columnPatch.title = patch.title.trim().slice(0, 120);
    if (typeof patch.notes === "string") columnPatch.notes = patch.notes.slice(0, 4000);
    if (statusOptions.includes(patch.status)) {
      columnPatch.status = patch.status;
      if (patch.status === "resolved") columnPatch.resolved_at = new Date().toISOString();
    }
    if (kindOptions.includes(patch.kind)) columnPatch.kind = patch.kind;
    if (Array.isArray(patch.relationships)) columnPatch.relationships = patch.relationships.slice(0, 40);
    if (!Object.keys(columnPatch).length) return json(res, 200, { ok: true, thread });

    const writeRes = await casPatchOnce(auth.token, "/threads", thread.id, thread.state_version, columnPatch);
    if (!writeRes.ok) return fail(res, writeRes.status, "Could not update Thread.");
    const written = await restJson(writeRes);
    if (written && written.length) return json(res, 200, { ok: true, thread: written[0] });
    // Lost the CAS race -- reread and retry.
  }
  return fail(res, 409, "Too many concurrent writers for this Thread.");
}

// --- Clue ---

async function handleCreateClue(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const weaveId = String(body.weaveId || "").trim();
  const threadId = String(body.threadId || "").trim();
  if (!cellId || !weaveId || !threadId) return fail(res, 400, "cellId, weaveId, and threadId are required.");
  const title = String(body.title || "").trim().slice(0, 120);
  if (!title) return fail(res, 400, "title is required.");
  const clueBody = String(body.body || "").slice(0, 4000);
  const publish = Boolean(body.publish);

  const { thread, error: threadError } = await fetchThread(auth.token, cellId, threadId);
  if (threadError) return fail(res, threadError.status, threadError.message);
  if (thread.weave_id !== weaveId) return fail(res, 400, "Thread does not belong to this Weave.");

  let sourceOperationId = null;
  if (body.sourceOperationId) {
    const { operation, error: opError } = await fetchOperation(auth.token, cellId, String(body.sourceOperationId).trim());
    if (opError) return fail(res, opError.status, opError.message);
    sourceOperationId = operation.id;
  }
  let sourceNeedlepointId = null;
  if (body.sourceNeedlepointId) {
    const { needlepoint, error: npError } = await fetchNeedlepoint(auth.token, cellId, String(body.sourceNeedlepointId).trim());
    if (npError) return fail(res, npError.status, npError.message);
    sourceNeedlepointId = needlepoint.id;
  }
  const sourceRef = body.sourceRef && typeof body.sourceRef === "object" ? body.sourceRef : null;

  const insertRes = await restAsUser(auth.token, "/weave_clues", {
    method: "POST",
    body: {
      cell_id: cellId, weave_id: weaveId, thread_id: threadId, title, body: clueBody,
      source_operation_id: sourceOperationId, source_needlepoint_id: sourceNeedlepointId, source_ref: sourceRef,
      published_at: publish ? new Date().toISOString() : null,
      created_by: auth.user.id,
    },
  });
  if (!insertRes.ok) {
    const insertError = (await restJson(insertRes)) || {};
    return fail(res, insertRes.status, insertError.message || "Could not create Clue.");
  }
  const clue = (await restJson(insertRes))[0];
  if (publish) {
    await insertEvent(auth.token, {
      cellId, operationId: null, eventType: "handler_update",
      actorUserId: auth.user.id, actorRole: "handler", senderName: "",
      eventBody: { kind: "clue_published", weaveId, clueId: clue.id, title: clue.title },
    });
  }
  return json(res, 200, { ok: true, clue });
}

async function handlePublishClueDraft(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const weaveId = String(body.weaveId || "").trim();
  const clueId = String(body.clueId || "").trim();
  if (!cellId || !weaveId || !clueId) return fail(res, 400, "cellId, weaveId, and clueId are required.");

  const { clue, error } = await fetchClue(auth.token, cellId, clueId);
  if (error) return fail(res, error.status, error.message);
  if (clue.weave_id !== weaveId) return fail(res, 400, "Clue does not belong to this Weave.");
  if (clue.published_at) return json(res, 200, { ok: true, clue });

  const writeRes = await restAsUser(auth.token, `/weave_clues?id=eq.${clueId}`, {
    method: "PATCH",
    body: { published_at: new Date().toISOString() },
  });
  if (!writeRes.ok) return fail(res, writeRes.status, "Could not publish Clue.");
  const written = await restJson(writeRes);
  const updated = written && written[0];
  await insertEvent(auth.token, {
    cellId, operationId: null, eventType: "handler_update",
    actorUserId: auth.user.id, actorRole: "handler", senderName: "",
    eventBody: { kind: "clue_published", weaveId, clueId, title: updated && updated.title },
  });
  return json(res, 200, { ok: true, clue: updated });
}

async function handleUpdateClueDraft(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const weaveId = String(body.weaveId || "").trim();
  const clueId = String(body.clueId || "").trim();
  if (!cellId || !weaveId || !clueId) return fail(res, 400, "cellId, weaveId, and clueId are required.");
  const patch = body.patch && typeof body.patch === "object" ? body.patch : {};

  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt += 1) {
    const { clue, error } = await fetchClue(auth.token, cellId, clueId);
    if (error) return fail(res, error.status, error.message);
    if (clue.weave_id !== weaveId) return fail(res, 400, "Clue does not belong to this Weave.");
    // Published Clues are immutable text, matching the sheet-baseline "immutable legal
    // record" precedent -- editing published claims after the fact is a different,
    // not-requested feature.
    if (clue.published_at) return fail(res, 400, "Cannot edit a Clue that has already been published.");

    const columnPatch = {};
    if (typeof patch.title === "string") columnPatch.title = patch.title.trim().slice(0, 120);
    if (typeof patch.body === "string") columnPatch.body = patch.body.slice(0, 4000);
    if (patch.sourceOperationId !== undefined) {
      columnPatch.source_operation_id = patch.sourceOperationId ? String(patch.sourceOperationId).trim() : null;
    }
    if (patch.sourceNeedlepointId !== undefined) {
      columnPatch.source_needlepoint_id = patch.sourceNeedlepointId ? String(patch.sourceNeedlepointId).trim() : null;
    }
    if (patch.sourceRef !== undefined) {
      columnPatch.source_ref = patch.sourceRef && typeof patch.sourceRef === "object" ? patch.sourceRef : null;
    }
    if (!Object.keys(columnPatch).length) return json(res, 200, { ok: true, clue });

    const writeRes = await casPatchOnce(auth.token, "/weave_clues", clue.id, clue.state_version, columnPatch);
    if (!writeRes.ok) return fail(res, writeRes.status, "Could not update Clue draft.");
    const written = await restJson(writeRes);
    if (written && written.length) return json(res, 200, { ok: true, clue: written[0] });
    // Lost the CAS race -- reread and retry.
  }
  return fail(res, 409, "Too many concurrent writers for this Clue.");
}

async function handleListClues(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const cellId = queryParam(req, "cellId");
  const weaveId = queryParam(req, "weaveId");
  if (!cellId || !weaveId) return fail(res, 400, "cellId and weaveId are required.");
  // RLS alone determines what's returned (Handler: draft+published; Operator: published
  // only) -- explicit select list, never thread_id, keeping "publishing never exposes the
  // Thread" true regardless of who's asking.
  const response = await restAsUser(
    auth.token,
    `/weave_clues?cell_id=eq.${cellId}&weave_id=eq.${weaveId}` +
      `&select=id,weave_id,title,body,source_operation_id,source_needlepoint_id,source_ref,published_at` +
      `&order=published_at.desc.nullslast`,
  );
  if (!response.ok) return fail(res, response.status, "Could not list Clues.");
  const clues = await restJson(response);
  return json(res, 200, { ok: true, clues: clues || [] });
}

// --- Thread <-> Operation links ---

async function handleLinkThreadOperation(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const threadId = String(body.threadId || "").trim();
  const operationId = String(body.operationId || "").trim();
  if (!cellId || !threadId || !operationId) return fail(res, 400, "cellId, threadId, and operationId are required.");
  const note = String(body.note || "").slice(0, 500);

  const { error: threadError } = await fetchThread(auth.token, cellId, threadId);
  if (threadError) return fail(res, threadError.status, threadError.message);
  const { error: opError } = await fetchOperation(auth.token, cellId, operationId);
  if (opError) return fail(res, opError.status, opError.message);

  const writeRes = await restAsUser(auth.token, "/thread_operation_links?on_conflict=thread_id,operation_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { thread_id: threadId, operation_id: operationId, cell_id: cellId, note, created_by: auth.user.id },
  });
  if (!writeRes.ok) {
    const writeError = (await restJson(writeRes)) || {};
    return fail(res, writeRes.status, writeError.message || "Could not link Thread to Operation.");
  }
  const link = (await restJson(writeRes))[0];
  return json(res, 200, { ok: true, link });
}

async function handleUnlinkThreadOperation(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const body = await readJsonBody(req);
  const cellId = String(body.cellId || "").trim();
  const threadId = String(body.threadId || "").trim();
  const operationId = String(body.operationId || "").trim();
  if (!cellId || !threadId || !operationId) return fail(res, 400, "cellId, threadId, and operationId are required.");

  const writeRes = await restAsUser(
    auth.token,
    `/thread_operation_links?thread_id=eq.${threadId}&operation_id=eq.${operationId}&cell_id=eq.${cellId}`,
    { method: "DELETE", prefer: "return=minimal" },
  );
  if (!writeRes.ok) return fail(res, writeRes.status, "Could not unlink Thread from Operation.");
  return json(res, 200, { ok: true });
}

async function handleListOperationThreads(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Use GET.");
  const auth = await requireUser(req, res);
  if (!auth) return;
  const cellId = queryParam(req, "cellId");
  const operationId = queryParam(req, "operationId");
  if (!cellId || !operationId) return fail(res, 400, "cellId and operationId are required.");
  // Single FK path (thread_id) between the two tables -- no !constraint disambiguation
  // needed. RLS on both thread_operation_links and threads independently double-gates this.
  const response = await restAsUser(
    auth.token,
    `/thread_operation_links?cell_id=eq.${cellId}&operation_id=eq.${operationId}&select=note,created_at,thread:threads(*)`,
  );
  if (!response.ok) return fail(res, response.status, "Could not list Operation Threads.");
  const links = await restJson(response);
  return json(res, 200, { ok: true, links: links || [] });
}

module.exports = async function handler(req, res) {
  try {
    const action = routeAction(req);
    if (action === "create-weave") return await handleCreateWeave(req, res);
    if (action === "list-weaves") return await handleListWeaves(req, res);
    if (action === "update-weave") return await handleUpdateWeave(req, res);
    if (action === "create-needlepoint") return await handleCreateNeedlepoint(req, res);
    if (action === "list-needlepoints") return await handleListNeedlepoints(req, res);
    if (action === "publish-needlepoint") return await handlePublishNeedlepoint(req, res);
    if (action === "list-needlepoint-operations") return await handleListNeedlepointOperations(req, res);
    if (action === "create-cell-entity") return await handleCreateCellEntity(req, res);
    if (action === "list-cell-entities") return await handleListCellEntities(req, res);
    if (action === "update-cell-entity") return await handleUpdateCellEntity(req, res);
    if (action === "promote-thread") return await handlePromoteThread(req, res);
    if (action === "list-threads") return await handleListThreads(req, res);
    if (action === "update-thread") return await handleUpdateThread(req, res);
    if (action === "create-clue") return await handleCreateClue(req, res);
    if (action === "publish-clue-draft") return await handlePublishClueDraft(req, res);
    if (action === "update-clue-draft") return await handleUpdateClueDraft(req, res);
    if (action === "list-clues") return await handleListClues(req, res);
    if (action === "link-thread-operation") return await handleLinkThreadOperation(req, res);
    if (action === "unlink-thread-operation") return await handleUnlinkThreadOperation(req, res);
    if (action === "list-operation-threads") return await handleListOperationThreads(req, res);
    return fail(res, 404, "Unknown Weave route.");
  } catch (error) {
    return fail(res, error.statusCode || 500, error.message || "Weave request failed.");
  }
};
