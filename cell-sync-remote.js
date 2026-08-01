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
  function apiBase() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? ""
      : "https://api.veildaemon.app";
  }

  let connection = null; // { sessionId, role: "operator"|"handler", getToken }

  function setConnection(next) {
    connection = next && next.sessionId && next.role && typeof next.getToken === "function" ? next : null;
  }

  function clearConnection() {
    connection = null;
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
    connection = { sessionId: data.session.id, role: "handler", getToken };
    return data.session;
  }

  async function joinCell(getToken, { joinCode, displayName, designation } = {}) {
    connection = { sessionId: "pending", role: "operator", getToken };
    const data = await authedFetch("join", {
      method: "POST",
      body: { joinCode, displayName, designation },
    });
    connection = { sessionId: data.session.id, role: "operator", getToken, seatId: data.seat.id };
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
    isConnected,
    currentConnection,
    createSession,
    joinCell,
    leaveCell,
    closeCell,
    pullState,
    pushOperatorSend,
    pushHandlerProjections,
  };
}());
