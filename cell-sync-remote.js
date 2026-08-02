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
    if (connection) persistConnectionMeta(connection);
  }

  function clearConnection() {
    // Clear the role this tab actually held, not a single shared key -- clearing the
    // Operator's own connection must never touch a Handler connection persisted separately
    // (or vice versa), even on the same browser/account.
    const role = connection?.role;
    connection = null;
    if (role) {
      try {
        window.localStorage.removeItem(connectionStorageKey(role));
      } catch (_error) {
        // Best-effort.
      }
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
    const token = await connection.getToken();
    if (!token) throw new Error("No active VeilLink session. Log in to connect.");
    const response = await fetch(`${apiBase()}/api/cell/${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error((data && data.error) || `Cell request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  // --- Session lifecycle (used by Connect UI, not the deliberate-sync buttons) ---

  async function createSession(getToken, { needlepoint, mission, maxOperators } = {}) {
    connection = { sessionId: "pending", role: "handler", getToken };
    const data = await authedFetch("create-session", {
      method: "POST",
      body: { needlepoint, mission, maxOperators },
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

  /** Handler: closes the Cell server-side after Archive Session's local + push steps. */
  async function closeCell({ oneShot } = {}) {
    if (!connection || connection.role !== "handler") return null;
    const data = await authedFetch("close", {
      method: "POST",
      body: { sessionId: connection.sessionId, oneShot: Boolean(oneShot) },
    });
    clearConnection();
    return data;
  }

  // --- Translation: server seats <-> local bus shape ---

  function seatOperatorKey(seat) {
    const send = seat?.live_state?.operatorSend;
    return (send && (send.operatorKey || send.sourceId || send.name)) || seat.id;
  }

  /** Pull remote state and merge it into the local cell-sync.js bus so existing synchronous readers see it. */
  async function pullState() {
    if (!connection) return null;
    const cell = window.VeilDaemonCellSync;
    if (!cell) return null;
    const data = await authedFetch(`state?session=${encodeURIComponent(connection.sessionId)}`, { method: "GET" });
    const seats = Array.isArray(data.seats) ? data.seats : [];
    const bus = cell.read();

    if (connection.role === "handler") {
      const operators = {};
      seats.forEach((seat) => {
        const send = seat.live_state && seat.live_state.operatorSend;
        if (!send || !Object.keys(send).length) return;
        const normalized = cell.normalizeOperatorSend({ ...send, operatorKey: seatOperatorKey(seat) });
        if (normalized) operators[normalized.operatorKey] = normalized;
      });
      bus.operators = operators;
      cell.write(bus);
      return { session: data.session, seats };
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
    return { session: data.session, seats };
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
    isConnected,
    currentConnection,
    createSession,
    joinCell,
    leaveCell,
    closeCell,
    pullState,
    pushOperatorSend,
    publishSessionRoll,
    subscribeToSessionRolls,
    pushHandlerProjections,
  };
}());
