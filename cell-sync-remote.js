/**
 * Remote-backed transport for the Cell/Live-Link sync contract, mirroring cell-sync.js's
 * shape so operator.js / handler-cell-sync.js / pressure-round.js need only a thin
 * "when connected, also push/pull remotely" hook at their existing deliberate-boundary
 * call sites -- not a rewrite. Talks to api/cell/[action].js on api.veildaemon.app using
 * the Supabase access token window.VeilAuth already holds (see lib/cellSync.js on the
 * server side for the full auth-model rationale).
 *
 * Local cell-sync.js's localStorage bus stays the source of truth for synchronous reads
 * (read(), listOperatorSends(), etc. — those call sites can't become async without
 * touching every caller). This module's job is to keep that local bus's `handler` /
 * `operators` fields in sync with the server on each deliberate pull/push, translating
 * between the server's per-seat { operatorSend, handlerProjection } row shape and the
 * local bus's own two-sided shape.
 */
(function () {
  // Role-scoped, not one shared key -- a single browser/account can legitimately run an
  // Operator tab and a Handler tab side by side (solo testing, or one person doing both).
  // A single key meant whichever role persisted most recently silently overwrote the other's
  // restored connection on reload, so e.g. a Handler-role persist could get read back and
  // restored on the Operator page.
  function connectionStorageKey(role) {
    return `veildaemon.cellConnection.${role === "handler" ? "handler" : "operator"}.v1`;
  }

  function apiBase() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? ""
      : "https://api.veildaemon.app";
  }

  let connection = null; // { sessionId, role: "operator"|"handler", getToken }

  // --- Multi-Cell active context: {handlerId, activeCellId, activeOperationId, generation}.
  // "generation" is bumped every time the ACTIVE Cell or Operation genuinely changes -- any
  // async work (a scheduled debounce flush, a Realtime callback, a checkpoint/baseline read)
  // captures the generation in effect when it started and must discard its result if the
  // generation has since moved on, rather than applying a late result from a Cell/Operation
  // the caller is no longer looking at. See handler-cell-sync.js's switchToCell/
  // scheduleOperationSync for the concrete fix this exists to enable. handlerId is the
  // signed-in Handler's own account id, set once via setActiveHandlerId -- unrelated to any
  // Cell, but namespaces local storage alongside cellId (see handler-state.js).
  let activeContext = { handlerId: null, activeCellId: null, activeOperationId: null, generation: 0 };

  function bumpGeneration(patch) {
    activeContext = { ...activeContext, ...patch, generation: activeContext.generation + 1 };
    return activeContext.generation;
  }
  function setActiveHandlerId(handlerId) {
    activeContext = { ...activeContext, handlerId: handlerId || null };
  }
  function currentGeneration() {
    return activeContext.generation;
  }
  function isCurrentGeneration(g) {
    return g === activeContext.generation;
  }
  function getActiveContext() {
    return { ...activeContext };
  }
  /** Same-Cell Operation transition (start-operation/archive-operation landing) -- bumps
   * generation too, since chat and any Operation-scoped subscription must reset exactly the
   * same way a full Cell switch does. No-ops if the operationId hasn't actually changed. */
  function setActiveOperationId(operationId) {
    const next = operationId || null;
    if (activeContext.activeOperationId === next) return activeContext.generation;
    return bumpGeneration({ activeOperationId: next });
  }

  /** Persists only the non-secret shape (sessionId/role/seatId) -- getToken is a live
   * function (VeilAuth's own session, not a raw token) and is never serialized. */
  function persistConnectionMeta(next) {
    try {
      if (next && next.sessionId && next.role) {
        window.localStorage.setItem(
          connectionStorageKey(next.role),
          JSON.stringify({ sessionId: next.sessionId, role: next.role, seatId: next.seatId || "" }),
        );
      }
    } catch (_error) {
      // Best-effort — a failed persist just means reconnect-on-load won't work this session.
    }
  }

  function readPersistedConnectionMeta(role) {
    try {
      const raw = window.localStorage.getItem(connectionStorageKey(role));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.sessionId && parsed.role === role ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function setConnection(next) {
    connection = next && next.sessionId && next.role && typeof next.getToken === "function" ? next : null;
    if (connection) {
      persistConnectionMeta(connection);
      // Only a genuine Cell change bumps generation -- re-setting the SAME sessionId (e.g.
      // createSession's own pending->confirmed transition) must not invalidate work already
      // scheduled against this same Cell.
      if (activeContext.activeCellId !== connection.sessionId) {
        bumpGeneration({ activeCellId: connection.sessionId, activeOperationId: null });
      }
    }
  }

  function clearConnection() {
    // Clear the role this tab actually held, not a single shared key -- clearing the
    // Operator's own connection must never touch a Handler connection persisted separately
    // (or vice versa), even on the same browser/account.
    const role = connection?.role;
    connection = null;
    bumpGeneration({ activeCellId: null, activeOperationId: null });
    if (role) {
      try {
        window.localStorage.removeItem(connectionStorageKey(role));
      } catch (_error) {
        // Best-effort.
      }
    }
  }

  /** Handler: reattaches to a Cell already owned by the caller ("Resume Cell"), without
   * creating anything new -- neither createSession (makes a new row) nor joinCell (Operator
   * join-code flow, creates a seat) fits this. Must fail closed: never leaves an unowned/
   * nonexistent Cell live in `connection`, since a later reload's restoreConnection() would
   * otherwise silently persist and replay that failure. Ownership is verified via the
   * existing `state` action's RLS-backed 404, and that same response is returned as the
   * caller's first state load rather than a second round-trip. */
  async function attachToCell(getToken, { cellId } = {}) {
    if (!cellId) throw new Error("cellId is required.");
    const prior = connection;
    connection = { sessionId: cellId, role: "handler", getToken }; // tentative, not yet persisted
    try {
      const data = await authedFetch(`state?session=${encodeURIComponent(cellId)}`, { method: "GET" });
      setConnection({ sessionId: cellId, role: "handler", getToken }); // persist only now that ownership is confirmed
      return data;
    } catch (error) {
      connection = prior; // fail closed -- never leave the tentative, unverified connection live
      throw error;
    }
  }

  /**
   * Re-establishes a connection dropped by a page reload, using whatever sessionId/seatId
   * was last persisted for this specific role and the caller's own getToken function
   * (VeilAuth's session survives reload on its own via Supabase's persistSession, so this
   * just needs to exist for a signed-in user to pick back up). Returns the restored
   * connection, or null if there was nothing to restore. `role` is required -- this tab only
   * ever wants back the connection it itself held ("operator" from operator.js, "handler"
   * from handler.js), never whatever role happens to be persisted under the other key.
   */
  function restoreConnection(getToken, role) {
    if (connection) return connection;
    const meta = readPersistedConnectionMeta(role);
    if (!meta || typeof getToken !== "function") return null;
    setConnection({ sessionId: meta.sessionId, role: meta.role, seatId: meta.seatId || undefined, getToken });
    return connection;
  }

  function isConnected() {
    return Boolean(connection);
  }

  function currentConnection() {
    return connection;
  }

  async function authedFetch(path, options = {}) {
    if (!connection) throw new Error("Not connected to a Cell.");
    return authedFetchFor(connection, path, options);
  }

  /** Parametrized twin of authedFetch that never reads the live `connection` variable --
   * used ONLY by callers with a real "scheduled now, fires later, the active Cell may have
   * changed in between" time gap (the debounced sync-operation engine in
   * handler-cell-sync.js), OR by callers hitting a DIFFERENT API route root entirely (the
   * Weave/Thread/Clue account-level actions below, via authedFetchForWeave -- those never
   * have a live Cell `connection` to begin with). Every other caller should keep using the
   * plain, connection-reading authedFetch/action functions below. */
  async function authedFetchForRoute(routeRoot, connectionSnapshot, path, options = {}) {
    if (!connectionSnapshot) throw new Error("Not connected to a Cell.");
    const token = await connectionSnapshot.getToken();
    if (!token) throw new Error("No active VeilLink session. Log in to connect.");
    const response = await fetch(`${apiBase()}/api/${routeRoot}/${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      // `keepalive` lets this survive a `pagehide` navigation (e.g. clicking a Resume link
      // to another Cell, or any other nav link) that would otherwise abort an in-flight
      // fetch -- see handler-cell-sync.js's pagehide flush. Chrome caps keepalive request
      // bodies around 64KB combined; a large sync-operation patch can still silently fail
      // to send under that cap, same "best effort, never blocks the local save" trust level
      // this debounce engine already has everywhere else.
      keepalive: Boolean(options.keepalive),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error((data && data.error) || `Request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function authedFetchFor(connectionSnapshot, path, options = {}) {
    return authedFetchForRoute("cell", connectionSnapshot, path, options);
  }

  /** Weave/Thread/Clue actions -- originally api/weave/[action].js, merged into
   * api/cell/[action].js on 2026-08-03 (Vercel Hobby's 12-Serverless-Function-per-deployment
   * cap; see that file's header comment). These never need a live Cell `connection`, only a
   * getToken function, so callers pass a bare `{ getToken }` stand-in exactly the way
   * listCells/renameCell/operationsHistory already do for api/cell/[action].js's own
   * account-level actions. */
  async function authedFetchForWeave(connectionSnapshot, path, options = {}) {
    return authedFetchForRoute("cell", connectionSnapshot, path, options);
  }

  /** Parametrized twin of syncOperation -- see authedFetchFor's comment. `keepalive` is for
   * the pagehide-triggered unload flush (handler-cell-sync.js) -- every other caller omits it. */
  async function syncOperationFor(connectionSnapshot, patch, { keepalive } = {}) {
    if (!connectionSnapshot || connectionSnapshot.role !== "handler") return null;
    return authedFetchFor(connectionSnapshot, "sync-operation", {
      method: "POST",
      body: { cellId: connectionSnapshot.sessionId, patch: patch || {} },
      keepalive,
    });
  }

  // --- Account-level Cell actions -- the Cells dashboard's own concern, distinct from
  // everything below this point (which acts on whatever's currently attached via
  // `connection`). These take `getToken` directly rather than relying on a live connection,
  // since the dashboard lists/manages Cells the caller may not currently be attached to at
  // all. Reuses authedFetchFor with a bare `{ getToken }` stand-in -- that function only ever
  // reads `.getToken()` off whatever it's given, so a real Cell connection isn't required. ---

  /** Every Cell the signed-in Handler owns, each with its embedded current/most-recent
   * Operation and seated-Operator count -- see handleListCells's own comment for the exact
   * two-query shape. Never touches per-Cell local storage; the Cells dashboard's whole point
   * is showing this without attaching to anything. */
  async function listCells(getToken) {
    return authedFetchFor({ getToken }, "list", { method: "GET" });
  }

  /** Handler-facing label only -- Cell ids remain the durable identity, this never touches
   * join_code or anything RLS-relevant. */
  async function renameCell(getToken, { cellId, cellName }) {
    return authedFetchFor({ getToken }, "rename-cell", {
      method: "POST",
      body: { cellId, cellName },
    });
  }

  /** Every archived Operation for one Cell, most recent first -- the Cells dashboard's "View
   * prior Operations" action. */
  async function operationsHistory(getToken, { cellId }) {
    return authedFetchFor({ getToken }, `operations-history?cellId=${encodeURIComponent(cellId)}`, {
      method: "GET",
    });
  }

  // --- Weave / Needlepoint / Cell Entity / Thread / Clue -- the campaign-continuity layer
  // (api/cell/[action].js, merged in from the former api/weave/[action].js). Same
  // account-level shape as the Cell actions just above: no live
  // `connection` required, just `getToken`. Weaves/Threads/Cell Entities are Handler-only end
  // to end (an Operator-role connection's calls would just come back empty via RLS, never a
  // hard error); Needlepoints/Clues are Handler-only until explicitly published. See the
  // Weave/Thread/Clue plan for the full confidentiality model. ---

  async function listWeaves(getToken, { cellId }) {
    return authedFetchForWeave({ getToken }, `list-weaves?cellId=${encodeURIComponent(cellId)}`, { method: "GET" });
  }
  async function createWeave(getToken, { cellId, title, summary }) {
    return authedFetchForWeave({ getToken }, "create-weave", { method: "POST", body: { cellId, title, summary } });
  }
  async function updateWeave(getToken, { cellId, weaveId, patch }) {
    return authedFetchForWeave({ getToken }, "update-weave", { method: "POST", body: { cellId, weaveId, patch } });
  }

  async function createNeedlepoint(getToken, { cellId, weaveId, templateId, title }) {
    return authedFetchForWeave({ getToken }, "create-needlepoint", {
      method: "POST", body: { cellId, weaveId, templateId, title },
    });
  }
  async function listNeedlepoints(getToken, { cellId, weaveId }) {
    return authedFetchForWeave(
      { getToken },
      `list-needlepoints?cellId=${encodeURIComponent(cellId)}&weaveId=${encodeURIComponent(weaveId)}`,
      { method: "GET" },
    );
  }
  async function publishNeedlepoint(getToken, { cellId, weaveId, needlepointId }) {
    return authedFetchForWeave({ getToken }, "publish-needlepoint", {
      method: "POST", body: { cellId, weaveId, needlepointId },
    });
  }
  async function listNeedlepointOperations(getToken, { cellId, needlepointId }) {
    return authedFetchForWeave(
      { getToken },
      `list-needlepoint-operations?cellId=${encodeURIComponent(cellId)}&needlepointId=${encodeURIComponent(needlepointId)}`,
      { method: "GET" },
    );
  }

  async function createCellEntity(getToken, { cellId, kind, name, description }) {
    return authedFetchForWeave({ getToken }, "create-cell-entity", {
      method: "POST", body: { cellId, kind, name, description },
    });
  }
  async function listCellEntities(getToken, { cellId }) {
    return authedFetchForWeave({ getToken }, `list-cell-entities?cellId=${encodeURIComponent(cellId)}`, { method: "GET" });
  }
  async function updateCellEntity(getToken, { cellId, entityId, patch }) {
    return authedFetchForWeave({ getToken }, "update-cell-entity", {
      method: "POST", body: { cellId, entityId, patch },
    });
  }

  async function listThreads(getToken, { cellId, weaveId }) {
    return authedFetchForWeave(
      { getToken },
      `list-threads?cellId=${encodeURIComponent(cellId)}&weaveId=${encodeURIComponent(weaveId)}`,
      { method: "GET" },
    );
  }
  async function promoteThread(getToken, { cellId, weaveId, kind, title, notes, status, relationships, entityId, sourceOperationId, sourceRef }) {
    return authedFetchForWeave({ getToken }, "promote-thread", {
      method: "POST",
      body: { cellId, weaveId, kind, title, notes, status, relationships, entityId, sourceOperationId, sourceRef },
    });
  }
  async function updateThread(getToken, { cellId, weaveId, threadId, patch }) {
    return authedFetchForWeave({ getToken }, "update-thread", {
      method: "POST", body: { cellId, weaveId, threadId, patch },
    });
  }

  async function createClue(getToken, { cellId, weaveId, threadId, title, body, sourceOperationId, sourceNeedlepointId, sourceRef, publish }) {
    return authedFetchForWeave({ getToken }, "create-clue", {
      method: "POST",
      body: { cellId, weaveId, threadId, title, body, sourceOperationId, sourceNeedlepointId, sourceRef, publish },
    });
  }
  async function publishClueDraft(getToken, { cellId, weaveId, clueId }) {
    return authedFetchForWeave({ getToken }, "publish-clue-draft", {
      method: "POST", body: { cellId, weaveId, clueId },
    });
  }
  async function updateClueDraft(getToken, { cellId, weaveId, clueId, patch }) {
    return authedFetchForWeave({ getToken }, "update-clue-draft", {
      method: "POST", body: { cellId, weaveId, clueId, patch },
    });
  }
  async function listClues(getToken, { cellId, weaveId }) {
    return authedFetchForWeave(
      { getToken },
      `list-clues?cellId=${encodeURIComponent(cellId)}&weaveId=${encodeURIComponent(weaveId)}`,
      { method: "GET" },
    );
  }

  async function linkThreadOperation(getToken, { cellId, threadId, operationId, note }) {
    return authedFetchForWeave({ getToken }, "link-thread-operation", {
      method: "POST", body: { cellId, threadId, operationId, note },
    });
  }
  async function unlinkThreadOperation(getToken, { cellId, threadId, operationId }) {
    return authedFetchForWeave({ getToken }, "unlink-thread-operation", {
      method: "POST", body: { cellId, threadId, operationId },
    });
  }
  async function listOperationThreads(getToken, { cellId, operationId }) {
    return authedFetchForWeave(
      { getToken },
      `list-operation-threads?cellId=${encodeURIComponent(cellId)}&operationId=${encodeURIComponent(operationId)}`,
      { method: "GET" },
    );
  }

  // --- Session lifecycle (used by Connect UI, not the deliberate-sync buttons) ---

  async function createSession(getToken, { needlepoint, mission, maxOperators, cellName } = {}) {
    connection = { sessionId: "pending", role: "handler", getToken };
    const data = await authedFetch("create-session", {
      method: "POST",
      body: { needlepoint, mission, maxOperators, cellName },
    });
    // setConnection (not a raw assignment) so this survives a reload -- restoreConnection()
    // only has something to restore if the connection was actually persisted the moment it
    // was established, not left as an in-memory-only variable that a reload silently drops.
    setConnection({ sessionId: data.session.id, role: "handler", getToken });
    return data.session;
  }

  async function joinCell(getToken, { joinCode, displayName, designation } = {}) {
    connection = { sessionId: "pending", role: "operator", getToken };
    const data = await authedFetch("join", {
      method: "POST",
      body: { joinCode, displayName, designation },
    });
    // Same reasoning as createSession above: persist on success, don't just hold it in memory.
    setConnection({ sessionId: data.session.id, role: "operator", getToken, seatId: data.seat.id });
    return data;
  }

  async function leaveCell() {
    if (!connection || connection.role !== "operator") return null;
    const data = await authedFetch("leave", { method: "POST", body: { sessionId: connection.sessionId } });
    clearConnection();
    return data;
  }

  /** Handler: closes the Cell -- the LOBBY-ending action, entirely separate from archiving
   * an Operation (see archiveOperation below). The server refuses this outright if a
   * non-archived Operation still exists, so calling it while a game is still running just
   * surfaces that 409 rather than silently cascading into an archive. */
  async function closeCell() {
    if (!connection || connection.role !== "handler") return null;
    const data = await authedFetch("close-cell", {
      method: "POST",
      body: { cellId: connection.sessionId },
    });
    clearConnection();
    return data;
  }

  /** Handler: starts a new Operation in the current Cell (first, or another one after the
   * prior Operation archived -- the server's partial unique index is what actually enforces
   * "only one non-archived Operation per Cell"). needlepointId is required server-side (see
   * 20260803140000_cell_operations_needlepoint_id.sql -- the old free-text needlepoint field
   * is retired); starting an Operation also auto-publishes that Needlepoint if it wasn't
   * already (the natural reveal point for its title to seated Operators). */
  async function startOperation({ needlepointId, mission } = {}) {
    if (!connection || connection.role !== "handler") return null;
    return authedFetch("start-operation", {
      method: "POST",
      body: { cellId: connection.sessionId, needlepointId, mission },
    });
  }

  /** Handler: CAS-merges shared, Handler-authored Operation state (scene/clue/npc/reward)
   * into cell_operations -- the server-side authoritative home for what previously lived
   * only in the Handler's own browser localStorage. `patch` may include any of sceneState/
   * clueState/npcState/rewardState; each is shallow-merged into the existing jsonb column. */
  async function syncOperation(patch) {
    if (!connection || connection.role !== "handler") return null;
    return authedFetch("sync-operation", {
      method: "POST",
      body: { cellId: connection.sessionId, patch: patch || {} },
    });
  }

  /** Handler: advances the current Operation's round. `phase` ("active"|"resolving") is
   * optional -- omit it to just increment the round without an explicit phase change. */
  async function advanceRound(phase) {
    if (!connection || connection.role !== "handler") return null;
    return authedFetch("advance-round", {
      method: "POST",
      body: { cellId: connection.sessionId, phase },
    });
  }

  /** Handler: suspends the current Operation for later resumption -- writes a checkpoint,
   * blocks round advancement, but never touches a seat (everyone stays in the lobby). */
  async function suspendOperation() {
    if (!connection || connection.role !== "handler") return null;
    return authedFetch("suspend-operation", { method: "POST", body: { cellId: connection.sessionId } });
  }

  /** Handler: resumes a suspended Operation exactly where it left off -- no checkpoint
   * write, since suspending never destroyed anything to restore from. */
  async function resumeOperation() {
    if (!connection || connection.role !== "handler") return null;
    return authedFetch("resume-operation", { method: "POST", body: { cellId: connection.sessionId } });
  }

  /** Handler: archives the current Operation -- delivers final rewards/projections, freezes
   * its state permanently, and moves the Cell to POST_OPERATION. Never disconnects or evicts
   * a seat; that's the whole point of separating this from closeCell. The server itself
   * rejects this while any seated Operator's Mark/clue/trust decision is still pending. */
  async function archiveOperation({ oneShot } = {}) {
    if (!connection || connection.role !== "handler") return null;
    return authedFetch("archive-operation", {
      method: "POST",
      body: { cellId: connection.sessionId, oneShot: Boolean(oneShot) },
    });
  }

  /** Handler: removes a seated Operator -- distinct from that Operator's own voluntary
   * `leave`, with a real audit trail (removed_by/removed_reason) a plain timestamp alone
   * could never carry. */
  async function removeSeat(seatId, reason) {
    if (!connection || connection.role !== "handler") return null;
    return authedFetch("remove-seat", {
      method: "POST",
      body: { cellId: connection.sessionId, seatId, reason },
    });
  }

  /** Handler: writes a checkpoint without any status transition -- "save now" for a Cell
   * that isn't suspending or archiving anything, just wants a recovery point on record. */
  async function saveCell() {
    if (!connection || connection.role !== "handler") return null;
    return authedFetch("save-cell", { method: "POST", body: { cellId: connection.sessionId } });
  }

  /** Handler: writes a checkpoint and returns the full, downloadable snapshot JSON (the
   * schemaVersion/cellId/operationId/revision/createdAt/createdBy/previousSnapshotId/
   * checksum contract) -- the only difference from saveCell is the response carries the
   * complete payload, not just checkpoint metadata. */
  async function exportSnapshot() {
    if (!connection || connection.role !== "handler") return null;
    const data = await authedFetch("export-snapshot", { method: "POST", body: { cellId: connection.sessionId } });
    return data.snapshot;
  }

  /** Handler: restores a Cell/Operation snapshot. Always creates a brand-new Cell unless the
   * caller already owns the snapshot's cellId and explicitly confirms overwriting it -- see
   * api/cell/[action].js's handleImportSnapshot for the full conflict-handling contract.
   * Does not require an existing connection (this is how a Handler reopens a Cell they don't
   * currently have a live connection to). */
  async function importSnapshot(getToken, { snapshot, confirmOverwrite } = {}) {
    const token = await getToken();
    if (!token) throw new Error("No active VeilLink session. Log in to import.");
    const response = await fetch(`${apiBase()}/api/cell/import-snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ snapshot, confirmOverwrite: Boolean(confirmOverwrite) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error((data && data.error) || `Import failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  /** Operator: publishes their complete sheet as the current Operation's immutable legal
   * baseline. One-shot per (operationId, seatId) -- the server rejects a second attempt
   * outright rather than silently no-op'ing, so a caller always knows whether its baseline
   * is the one on record. */
  async function publishOperationBaseline(operationId, sheet) {
    if (!connection || connection.role !== "operator" || !connection.seatId) return null;
    return authedFetch("publish-operation-baseline", {
      method: "POST",
      body: { operationId, seatId: connection.seatId, sheet },
    });
  }

  /** Handler (any seat) or the owning Operator: reads a seat's complete legal sheet for a
   * given Operation. A plain authenticated database read -- works identically whether that
   * Operator is connected, disconnected, or has left, since none of it depends on a live
   * connection to that specific seat. */
  async function getOperationBaseline(operationId, seatId) {
    if (!connection) return null;
    return authedFetch(`operation-baseline?operationId=${encodeURIComponent(operationId)}&seatId=${encodeURIComponent(seatId)}`, {
      method: "GET",
    });
  }

  // --- Translation: server seats <-> local bus shape ---

  function seatOperatorKey(seat) {
    const send = seat?.live_state?.operatorSend;
    return (send && (send.operatorKey || send.sourceId || send.name)) || seat.id;
  }

  // --- Cell-scoped typed event feed (chat + the 6 other kinds) -- deduped by id, matching
  // the established sessionRewards convention, so a redelivered/re-pulled event never shows
  // twice regardless of whether it arrived via Realtime, a `since`-cursor catch-up, or the
  // last-50 backfill on a fresh state pull. ---

  let cellEvents = [];

  function mergeCellEvents(rawItems) {
    const cell = window.VeilDaemonCellSync;
    if (!cell || !Array.isArray(rawItems) || !rawItems.length) return cellEvents;
    const byId = new Map(cellEvents.map((item) => [item.id, item]));
    rawItems.forEach((raw) => {
      const normalized = cell.normalizeCellEventItem(raw);
      if (normalized) byId.set(normalized.id, normalized);
    });
    cellEvents = Array.from(byId.values()).sort((a, b) => cell.stampMs(a.createdAt) - cell.stampMs(b.createdAt)).slice(-200);
    return cellEvents;
  }

  function listCellEvents() {
    return cellEvents.slice();
  }

  function clearCellEvents() {
    cellEvents = [];
  }

  /** Subscribes to the Cell's typed event feed (chat, round_advanced, operation_archived,
   * etc.) -- mirrors subscribeToSessionRolls' one-channel-per-Cell pattern. Returns an
   * unsubscribe function. `onEvent` receives each normalized new event as it arrives; the
   * full deduped/sorted list is always available via listCellEvents(). */
  function subscribeToCellEvents(onEvent) {
    if (!connection) return () => {};
    const client = sessionRollsClient();
    if (!client) return () => {};
    const channel = client
      .channel(`cell-events-${connection.sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cell_events", filter: `cell_id=eq.${connection.sessionId}` },
        (payload) => {
          if (!payload || !payload.new) return;
          mergeCellEvents([payload.new]);
          if (typeof onEvent === "function") {
            const cell = window.VeilDaemonCellSync;
            const normalized = cell && cell.normalizeCellEventItem(payload.new);
            if (normalized) onEvent(normalized);
          }
        },
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }

  // --- Live CONNECTED/DISCONNECTED presence -- deliberately never written to Postgres, so a
  // dropped socket can never write a lobby-membership fact (that's seat_status's job, and it
  // only ever moves on an explicit leave/remove-seat). Supabase Realtime Presence tracks this
  // for free on the same transport the event feed already needs. ---

  let presenceChannel = null;
  let presenceSnapshot = {};

  /** This client's own Presence tracking key -- "handler" (there's only ever one) or the
   * Operator's seatId. Shared with the chat peer-resync election below, which needs to both
   * identify itself and recognize which Presence entry is "me" vs. an eligible peer. */
  function presenceKeyForConnection(conn) {
    return conn.role === "handler" ? "handler" : (conn.seatId || conn.role);
  }

  /** Joins the Cell's presence channel, tracking this client's own seat (or "handler" for
   * the Handler, who has no seat). Returns an unsubscribe function. */
  function joinPresence() {
    if (!connection) return () => {};
    const client = sessionRollsClient();
    if (!client) return () => {};
    const presenceKey = presenceKeyForConnection(connection);
    const channel = client.channel(`cell-presence-${connection.sessionId}`, {
      config: { presence: { key: presenceKey } },
    });
    channel.on("presence", { event: "sync" }, () => {
      presenceSnapshot = channel.presenceState ? channel.presenceState() : {};
    });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ role: connection.role, seatId: connection.seatId || null, at: new Date().toISOString() });
      }
    });
    presenceChannel = channel;
    return () => {
      client.removeChannel(channel);
      if (presenceChannel === channel) {
        presenceChannel = null;
        presenceSnapshot = {};
      }
    };
  }

  /** Whether a given seat currently has a live Presence entry -- a purely client-derived,
   * ephemeral fact, never a substitute for seat_status (JOINED/LEFT/REMOVED). A seat that's
   * JOINED but not currently connected is exactly the "OPERATOR DISCONNECTED / Seat retained"
   * case -- this function answers the "connected right now" half of that, nothing else. */
  function isSeatConnected(seatId) {
    if (!presenceChannel) return false;
    const state = presenceChannel.presenceState ? presenceChannel.presenceState() : presenceSnapshot;
    return Object.values(state || {}).some((entries) => (entries || []).some((entry) => entry.seatId === seatId));
  }

  // --- Ephemeral Cell+Operation-scoped chat -- see the Multi-Cell Handler Management plan
  // and handleSendChat's own server-side comment for the full design. No Postgres row is ever
  // created for chat content; delivery is Realtime Broadcast on a topic scoped by
  // (cellId, operationId), so starting a new Operation (or archiving the current one) makes
  // the old topic unreachable without anything needing to be explicitly deleted. Colon-
  // delimited topic names because cellId/operationId are UUIDs already containing hyphens
  // (see the realtime.messages RLS migration's own comment for why that matters). ---

  let chatChannel = null;
  let chatResyncChannel = null;
  let chatMessages = [];

  function chatOperationSegment() {
    return activeContext.activeOperationId || "lobby";
  }
  function chatTopicName(cellId, operationId) {
    return `cell-chat:${cellId}:${operationId}`;
  }
  function chatResyncTopicName(cellId, operationId) {
    return `cell-chat-resync:${cellId}:${operationId}`;
  }

  function mergeChatMessages(rawItems) {
    if (!Array.isArray(rawItems) || !rawItems.length) return chatMessages;
    const byId = new Map(chatMessages.map((item) => [item.id, item]));
    rawItems.forEach((item) => {
      if (item && item.id) byId.set(item.id, item);
    });
    chatMessages = Array.from(byId.values())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-200);
    return chatMessages;
  }

  function listChatMessages() {
    return chatMessages.slice();
  }

  /** Discards the visible buffer -- callers must invoke this at every point they already
   * discard other Cell-scoped transient UI (full Cell switch, and any Operation transition
   * within the same Cell), so a previous Cell/Operation's chat can never linger into a newly
   * selected one. Chat is a live convenience, never archival, so there is nothing here to
   * persist first. */
  function clearChatBuffer() {
    chatMessages = [];
  }

  /** Handler or Operator: sends a chat message. The server resolves sender_name and assigns
   * the message id itself (see handleSendChat) -- never trusts a client-supplied name, and
   * never lets a client choose an id it could reuse to grief peers' id-keyed dedup maps.
   * Optimistically merges the confirmed message into the local buffer immediately rather than
   * waiting for the echo broadcast; dedup-by-id makes that eventual live delivery
   * (`broadcast.self: true`) a safe no-op replay. */
  async function sendChatMessage(text) {
    if (!connection) return null;
    const data = await authedFetch("send-chat", { method: "POST", body: { cellId: connection.sessionId, text } });
    if (data && data.message) mergeChatMessages([data.message]);
    return data;
  }

  /** Elects a resync source from the current Presence snapshot: prefer the Handler (if
   * present and it isn't me), else the seated Operator with the earliest `at` join timestamp
   * (tie-broken by seatId) -- deterministic so every client reaches the SAME target
   * independently, with no coordination needed. Returns null if no eligible peer is currently
   * present (e.g. I'm alone, or Presence hasn't synced yet). */
  function electChatResyncTarget() {
    if (!presenceChannel || !connection) return null;
    const state = presenceChannel.presenceState ? presenceChannel.presenceState() : presenceSnapshot;
    const selfKey = presenceKeyForConnection(connection);
    const entries = [];
    Object.entries(state || {}).forEach(([key, list]) => {
      (list || []).forEach((entry) => entries.push({ key, ...entry }));
    });
    const others = entries.filter((entry) => entry.key !== selfKey);
    if (!others.length) return null;
    if (connection.role !== "handler") {
      const handler = others.find((entry) => entry.role === "handler");
      if (handler) return handler.key;
    }
    const operators = others
      .filter((entry) => entry.role === "operator")
      .sort((a, b) => {
        const delta = new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime();
        return delta !== 0 ? delta : String(a.seatId || a.key).localeCompare(String(b.seatId || b.key));
      });
    return operators.length ? operators[0].key : null;
  }

  /** Subscribes to the current Cell+Operation's chat topic, and separately joins the resync
   * topic (always-on: this client may itself be elected as another peer's resync source at
   * any moment, so it must listen even if it never sends a request of its own). Once
   * subscribed, attempts one peer-resync round to recover a bounded recent buffer after a
   * refresh/reconnect -- Handler preferred when connected, else the earliest-joined seated
   * Operator (see electChatResyncTarget) -- with a short delay first so the Presence channel
   * (joined separately, just before this) has time to sync its snapshot. This is a live
   * convenience, not archival: if no peer answers, this silently gives up and the buffer
   * simply starts from whatever arrives live from here on.
   *
   * Requires joinPresence() to have already been called for election to find anyone; requires
   * connection.sessionId (the Cell) and activeContext.activeOperationId (set by
   * setActiveOperationId) to both already reflect the target before calling, since both are
   * baked into the topic name at call time -- this function does not itself re-subscribe on a
   * later Operation change, callers must re-invoke it (after unsubscribing + clearing the
   * buffer) whenever setActiveOperationId moves.
   *
   * Returns an unsubscribe function. */
  function subscribeToChat(onMessage) {
    if (!connection) return () => {};
    const client = sessionRollsClient();
    if (!client) return () => {};
    const cellId = connection.sessionId;
    const operationId = chatOperationSegment();
    const selfKey = presenceKeyForConnection(connection);

    const resyncChannel = client.channel(chatResyncTopicName(cellId, operationId), {
      config: { broadcast: { self: false }, private: true },
    });
    resyncChannel.on("broadcast", { event: "resync-request" }, ({ payload }) => {
      if (!payload || payload.targetKey !== selfKey) return;
      const since = payload.since ? new Date(payload.since).getTime() : 0;
      const reply = chatMessages.filter((item) => new Date(item.createdAt).getTime() > since);
      if (reply.length) {
        resyncChannel.send({ type: "broadcast", event: "resync-reply", payload: { requesterId: payload.requesterId, messages: reply } });
      }
    });
    resyncChannel.on("broadcast", { event: "resync-reply" }, ({ payload }) => {
      if (!payload || payload.requesterId !== selfKey) return;
      if (Array.isArray(payload.messages) && payload.messages.length) {
        mergeChatMessages(payload.messages);
        if (typeof onMessage === "function") onMessage();
      }
    });

    const messageChannel = client.channel(chatTopicName(cellId, operationId), {
      config: { broadcast: { self: true }, private: true },
    });
    messageChannel.on("broadcast", { event: "chat-message" }, ({ payload }) => {
      if (!payload || !payload.id) return;
      mergeChatMessages([payload]);
      if (typeof onMessage === "function") onMessage();
    });

    resyncChannel.subscribe();
    messageChannel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      window.setTimeout(() => {
        if (chatChannel !== messageChannel) return; // superseded by a later subscribe/unsubscribe
        const targetKey = electChatResyncTarget();
        if (!targetKey) return;
        const latest = chatMessages[chatMessages.length - 1];
        resyncChannel.send({
          type: "broadcast",
          event: "resync-request",
          payload: { requesterId: selfKey, targetKey, since: latest ? latest.createdAt : null },
        });
      }, 400);
    });

    chatChannel = messageChannel;
    chatResyncChannel = resyncChannel;
    return () => {
      client.removeChannel(messageChannel);
      client.removeChannel(resyncChannel);
      if (chatChannel === messageChannel) chatChannel = null;
      if (chatResyncChannel === resyncChannel) chatResyncChannel = null;
    };
  }

  /** Pull remote state and merge it into the local cell-sync.js bus so existing synchronous readers see it. */
  async function pullState(sinceEventTimestamp) {
    if (!connection) return null;
    const cell = window.VeilDaemonCellSync;
    if (!cell) return null;
    const query = sinceEventTimestamp
      ? `state?session=${encodeURIComponent(connection.sessionId)}&since=${encodeURIComponent(sinceEventTimestamp)}`
      : `state?session=${encodeURIComponent(connection.sessionId)}`;
    const data = await authedFetch(query, { method: "GET" });
    if (Array.isArray(data.recentEvents)) mergeCellEvents(data.recentEvents);
    const seats = Array.isArray(data.seats) ? data.seats : [];
    const bus = cell.read();

    if (connection.role === "handler") {
      const operators = {};
      // Every seat, matched or not, real send or identity-stub-only (see handleJoin) --
      // first-contact visibility so "nobody's here" and "someone's here but hasn't sent
      // real state yet" are never silently indistinguishable to the Handler.
      const seatRoster = [];
      seats.forEach((seat) => {
        const send = seat.live_state && seat.live_state.operatorSend;
        const profile = seat.operator_profiles || {};
        seatRoster.push({
          seatId: seat.id,
          name: profile.display_name || profile.designation || seatOperatorKey(seat) || "Operator",
          hasRealSend: Boolean(send && send.sentAt),
          // Durable JOINED/LEFT/REMOVED -- distinct from isSeatConnected()'s ephemeral
          // Presence-derived CONNECTED/DISCONNECTED overlay. Never conflate the two in the UI.
          seatStatus: seat.seat_status || "joined",
        });
        if (!send || !Object.keys(send).length) return;
        const normalized = cell.normalizeOperatorSend({ ...send, operatorKey: seatOperatorKey(seat) });
        if (normalized) operators[normalized.operatorKey] = normalized;
      });
      bus.operators = operators;
      cell.write(bus);
      return {
        session: data.session, seats, seatRoster,
        operation: data.operation || null, latestCheckpoint: data.latestCheckpoint || null,
        events: listCellEvents(),
      };
    }

    // Operator: RLS already scopes this to their own seat.
    const mine = seats[0];
    const projection = mine && mine.live_state && mine.live_state.handlerProjection;
    if (projection && Object.keys(projection).length) {
      const normalized = cell.normalizeProjection({ ...projection, operatorKey: seatOperatorKey(mine) });
      bus.handler = {
        publishedAt: projection.publishedAt || "",
        pushedAt: projection.publishedAt || "",
        kind: projection.kind || "cell",
        pressureRound: Number(projection.round) || 0,
        syncRevision: Number(projection.syncRevision) || 0,
        note: projection.note || "",
        archiveToken: projection.archiveToken || "",
        projections: normalized ? [normalized] : [],
        // cell.write() below re-normalizes this via normalizeBus's own
        // normalizeActionEconomySnapshot -- no need to duplicate that here.
        actionEconomy: projection.actionEconomy || bus.handler.actionEconomy,
      };
      cell.write(bus);
    }
    return {
      session: data.session, seats,
      operation: data.operation || null, latestCheckpoint: data.latestCheckpoint || null,
      events: listCellEvents(),
    };
  }

  /** Operator: publish their own send remotely (mirrors cell.publishOperatorSend's payload). */
  async function pushOperatorSend(send) {
    if (!connection || connection.role !== "operator") return null;
    return authedFetch("publish", {
      method: "POST",
      body: { sessionId: connection.sessionId, patch: send },
    });
  }

  /**
   * Session-wide, real-time roll feed: the one deliberately lobby-wide piece of this module
   * (everything else here is scoped to one seat and only ever updates on a deliberate
   * pull/push). Every seated Operator and the session's Handler read the SAME feed via
   * Supabase Realtime (session_rolls table, see the 20260802060000 migration) instead of the
   * Bearer-token /api/cell/* transport the rest of this file uses -- Realtime needs a direct
   * Supabase client connection (window.VeilAuth already loads one for auth), and there is no
   * per-seat authority question to resolve here the way there is for Harm/Stability/rounds.
   */
  function sessionRollsClient() {
    return window.VeilAuth && window.VeilAuth.getClient ? window.VeilAuth.getClient() : null;
  }

  /** Broadcasts one roll to the whole lobby for the current connection's session. Requires
   * a live Supabase client session (not just a Cell connection) since the insert goes
   * straight to Supabase, not through api.veildaemon.app. */
  async function publishSessionRoll(roll) {
    if (!connection || connection.role !== "operator") return null;
    const client = sessionRollsClient();
    const user = window.VeilAuth && window.VeilAuth.getUser ? window.VeilAuth.getUser() : null;
    if (!client || !user) return null;
    const { data, error } = await client
      .from("session_rolls")
      .insert({
        session_id: connection.sessionId,
        owner_user_id: user.id,
        operator_key: roll.operatorKey || "OP-LOCAL",
        operator_name: roll.name || "Operator",
        roll,
      })
      .select()
      .single();
    if (error) throw new Error(error.message || "Roll broadcast failed.");
    return data;
  }

  /**
   * Subscribes to every new roll for the current connection's session, Operator or Handler
   * alike (matches the shared/lobby-wide read policy). Returns an unsubscribe function;
   * callers own the subscription's lifetime (e.g. unsubscribe on leaveCell/page teardown).
   */
  function subscribeToSessionRolls(onRoll) {
    if (!connection) return () => {};
    const client = sessionRollsClient();
    if (!client) return () => {};
    const channel = client
      .channel(`session-rolls-${connection.sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_rolls", filter: `session_id=eq.${connection.sessionId}` },
        (payload) => {
          if (payload && payload.new) onRoll(payload.new);
        },
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }

  /**
   * Handler: publish this round's per-operator projections remotely. Matches local
   * players to remote seats by name (same fuzzy convention as cell.matchKey) rather than
   * requiring a stored seat id on the player record, since Handler pushes are already
   * deliberate/manual and one extra round-trip to resolve seats is a fine trade for not
   * touching the player data model.
   */
  async function pushHandlerProjections({ kind, round, note, archiveToken, projections, actionEconomy }) {
    if (!connection || connection.role !== "handler") return null;
    const data = await authedFetch(`state?session=${encodeURIComponent(connection.sessionId)}`, { method: "GET" });
    const seats = Array.isArray(data.seats) ? data.seats : [];
    const seatPatches = [];
    (projections || []).forEach((projection) => {
      const seat = seats.find((s) => {
        const send = s.live_state && s.live_state.operatorSend;
        const key = ((send && (send.sourceId || send.name)) || "").toLowerCase();
        const name = (projection.name || "").toLowerCase();
        const sourceId = (projection.sourceId || projection.operatorKey || "").toLowerCase();
        return key && (key === sourceId || key === name);
      });
      if (!seat) return;
      seatPatches.push({
        seatId: seat.id,
        patch: {
          ...projection,
          kind,
          round,
          note,
          archiveToken,
          // Session-wide, not per-operator, but each seat only ever exposes its own
          // handlerProjection to its Operator under RLS -- duplicating this snapshot
          // into every seat is the simplest way for a connected Operator to see it
          // without a new session-wide storage location.
          actionEconomy,
          publishedAt: new Date().toISOString(),
        },
      });
    });
    if (!seatPatches.length) return { ok: true, results: [] };
    return authedFetch("publish", {
      method: "POST",
      body: { sessionId: connection.sessionId, seatPatches },
    });
  }

  window.VeilDaemonCellRemote = {
    setConnection,
    clearConnection,
    restoreConnection,
    attachToCell,
    listCells,
    renameCell,
    operationsHistory,
    listWeaves,
    createWeave,
    updateWeave,
    createNeedlepoint,
    listNeedlepoints,
    publishNeedlepoint,
    listNeedlepointOperations,
    createCellEntity,
    listCellEntities,
    updateCellEntity,
    listThreads,
    promoteThread,
    updateThread,
    createClue,
    publishClueDraft,
    updateClueDraft,
    listClues,
    linkThreadOperation,
    unlinkThreadOperation,
    listOperationThreads,
    isConnected,
    currentConnection,
    setActiveHandlerId,
    currentGeneration,
    isCurrentGeneration,
    getActiveContext,
    setActiveOperationId,
    syncOperationFor,
    createSession,
    joinCell,
    leaveCell,
    closeCell,
    startOperation,
    syncOperation,
    advanceRound,
    suspendOperation,
    resumeOperation,
    archiveOperation,
    removeSeat,
    saveCell,
    exportSnapshot,
    importSnapshot,
    publishOperationBaseline,
    getOperationBaseline,
    sendChatMessage,
    listChatMessages,
    clearChatBuffer,
    subscribeToChat,
    listCellEvents,
    clearCellEvents,
    subscribeToCellEvents,
    joinPresence,
    isSeatConnected,
    pullState,
    pushOperatorSend,
    publishSessionRoll,
    subscribeToSessionRolls,
    pushHandlerProjections,
  };
}());
