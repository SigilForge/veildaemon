/**
 * Deliberate Cell sync bus (same-origin).
 * No polling. Handler End Pressure Round / Sync Cell / Archive Session
 * and Operator Send to Cell write here; the other role pulls on its button.
 * Multi-device sessions use VeilLink table live-link instead.
 *
 * Authority (mid-round):
 * - Operator-submitted Harm and Stability remain authoritative when present.
 * - Mid-round projections may include only Harm, Stability, and notes.
 * - Lotus is between-sessions (Archive / campaign purchase), not mid-round.
 * - Void and Breach are Archive Session currencies.
 *
 * Freshness fields:
 *   cellId · pressureRound · syncRevision · operator sentAt · handler publishedAt · archiveToken
 */
(function () {
  const STORAGE_KEY = "veildaemon.cellSync.v1";
  const CHANNEL_NAME = "veildaemon-cell-sync";
  const MAX_OPERATORS = 32;

  function nowStamp() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    const rand = Math.random().toString(16).slice(2, 10);
    return `${prefix || "cell"}-${Date.now().toString(16)}-${rand}`;
  }

  function emptyBus() {
    return {
      version: 1,
      cellId: "",
      updatedAt: "",
      lastKind: "idle",
      handler: {
        publishedAt: "",
        pushedAt: "",
        kind: "idle",
        pressureRound: 0,
        syncRevision: 0,
        note: "",
        archiveToken: "",
        projections: []
      },
      operators: {}
    };
  }

  function clampInt(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function safeString(value, max) {
    return String(value == null ? "" : value).slice(0, max);
  }

  function stampMs(value) {
    if (!value) return 0;
    const ms = Date.parse(String(value));
    return Number.isFinite(ms) ? ms : 0;
  }

  function normalizeProjection(item) {
    if (!item || typeof item !== "object") return null;
    const operatorKey = safeString(item.operatorKey || item.sourceId || item.id || item.name, 120);
    if (!operatorKey) return null;
    const out = {
      operatorKey,
      name: safeString(item.name, 80) || "Operator",
      sourceId: safeString(item.sourceId || item.operatorKey, 120)
    };
    if (item.harmBoxes !== undefined && item.harmBoxes !== null && item.harmBoxes !== "") {
      out.harmBoxes = clampInt(item.harmBoxes, 0, 5, 0);
    }
    if (item.stability !== undefined && item.stability !== null && item.stability !== "") {
      out.stability = clampInt(item.stability, 0, 10, 10);
    }
    if (item.stabilityPoints !== undefined && item.stabilityPoints !== null && item.stabilityPoints !== "") {
      out.stability = clampInt(item.stabilityPoints, 0, 10, 10);
    }
    if (Array.isArray(item.trackLines)) {
      out.trackLines = item.trackLines.map((line) => safeString(line, 200)).filter(Boolean).slice(0, 12);
    }
    if (item.handlerNote) out.handlerNote = safeString(item.handlerNote, 500);
    // Mid-round: no Lotus. Banks only appear when Handler marks archive on the projection pack.
    if (item.voidMarks !== undefined) out.voidMarks = clampInt(item.voidMarks, 0, 13, 0);
    if (item.breachPoints !== undefined) out.breachPoints = clampInt(item.breachPoints, 0, 99, 0);
    return out;
  }

  function normalizeOperatorSend(item) {
    if (!item || typeof item !== "object") return null;
    const operatorKey = safeString(item.operatorKey || item.sourceId || item.id || item.name, 120);
    if (!operatorKey) return null;
    const recoveryDeclared = safeString(item.recoveryDeclared, 40);
    const out = {
      operatorKey,
      name: safeString(item.name, 80) || "Operator",
      sourceId: safeString(item.sourceId || operatorKey, 120),
      harmBoxes: clampInt(item.harmBoxes, 0, 5, 0),
      stability: clampInt(item.stability ?? item.stabilityPoints, 0, 10, 10),
      recoveryDeclared: recoveryDeclared || "",
      sentAt: safeString(item.sentAt || nowStamp(), 40),
      pressureRound: clampInt(item.pressureRound ?? item.round, 0, 999, 0),
      round: clampInt(item.round, 1, 999, 1)
    };
    if (item.isLate) out.isLate = true;
    if (item.lateForRound !== undefined) out.lateForRound = clampInt(item.lateForRound, 0, 999, 0);
    if (item.closedHandlerRound !== undefined) out.closedHandlerRound = clampInt(item.closedHandlerRound, 0, 999, 0);
    if (item.isFuture) out.isFuture = true;
    if (item.futureRound !== undefined) out.futureRound = clampInt(item.futureRound, 0, 999, 0);
    if (item.rejectionReason) out.rejectionReason = safeString(item.rejectionReason, 40);
    // Void / Breach travel with the send for Archive visibility only.
    if (item.voidMarks !== undefined) out.voidMarks = clampInt(item.voidMarks, 0, 13, 0);
    if (item.breachPoints !== undefined) out.breachPoints = clampInt(item.breachPoints, 0, 99, 0);
    if (item.voidBreach) out.voidBreach = safeString(item.voidBreach, 180);
    if (item.misfire) out.misfire = safeString(item.misfire, 180);
    if (item.sceneLogLine) out.sceneLogLine = safeString(item.sceneLogLine, 200);
    return out;
  }

  function normalizeBus(raw) {
    const base = emptyBus();
    if (!raw || typeof raw !== "object") return base;
    const projections = Array.isArray(raw.handler?.projections)
      ? raw.handler.projections.map(normalizeProjection).filter(Boolean).slice(0, MAX_OPERATORS)
      : [];
    const operators = {};
    const rawOps = raw.operators && typeof raw.operators === "object" ? raw.operators : {};
    Object.keys(rawOps).slice(0, MAX_OPERATORS).forEach((key) => {
      const normalized = normalizeOperatorSend({ ...rawOps[key], operatorKey: key });
      if (normalized) operators[normalized.operatorKey] = normalized;
    });
    const publishedAt = safeString(raw.handler?.publishedAt || raw.handler?.pushedAt, 40);
    return {
      version: 1,
      cellId: safeString(raw.cellId, 80),
      updatedAt: safeString(raw.updatedAt, 40),
      lastKind: safeString(raw.lastKind, 40) || "idle",
      handler: {
        publishedAt,
        pushedAt: publishedAt,
        kind: safeString(raw.handler?.kind, 40) || "idle",
        pressureRound: clampInt(raw.handler?.pressureRound ?? raw.handler?.round, 0, 999, 0),
        syncRevision: clampInt(raw.handler?.syncRevision, 0, 1e9, 0),
        note: safeString(raw.handler?.note, 500),
        archiveToken: safeString(raw.handler?.archiveToken, 120),
        projections
      },
      operators
    };
  }

  function read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyBus();
      return normalizeBus(JSON.parse(raw));
    } catch (_error) {
      return emptyBus();
    }
  }

  function write(bus) {
    const next = normalizeBus(bus);
    if (!next.cellId) next.cellId = makeId("cell");
    next.updatedAt = nowStamp();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_error) {
      const err = new Error("Cell bus storage refused.");
      err.code = "CELL_STORAGE";
      throw err;
    }
    broadcast(next);
    return next;
  }

  let channel = null;
  function getChannel() {
    if (channel || typeof BroadcastChannel !== "function") return channel;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (_error) {
      channel = null;
    }
    return channel;
  }

  function broadcast(bus) {
    const ch = getChannel();
    if (!ch) return;
    try {
      ch.postMessage({ type: "cell-sync", bus });
    } catch (_error) {
      // Channel closed.
    }
  }

  /**
   * @returns {{ bus: object, rejected?: boolean, reason?: string }}
   */
  function publishHandlerPush(kind, payload) {
    const bus = read();
    if (!bus.cellId) bus.cellId = makeId("cell");

    const safeKind = safeString(kind, 40) || "cell";

    // Archive is idempotent: one token / one close per Cell lifetime until cleared.
    if (safeKind === "archive") {
      const existingToken = safeString(bus.handler.archiveToken, 120);
      const incomingToken = safeString(payload?.archiveToken, 120);
      if (existingToken && bus.handler.kind === "archive") {
        if (!incomingToken || incomingToken === existingToken) {
          return { bus, rejected: true, reason: "already_archived", archiveToken: existingToken };
        }
      }
    }

    const projections = (Array.isArray(payload?.projections) ? payload.projections : [])
      .map(normalizeProjection)
      .filter(Boolean)
      .slice(0, MAX_OPERATORS);

    const publishedAt = nowStamp();
    const nextRevision = clampInt(bus.handler.syncRevision, 0, 1e9, 0) + 1;
    const archiveToken = safeKind === "archive"
      ? (safeString(payload?.archiveToken, 120) || makeId("archive"))
      : safeString(bus.handler.archiveToken, 120);

    bus.lastKind = safeKind;
    bus.handler = {
      publishedAt,
      pushedAt: publishedAt,
      kind: safeKind,
      pressureRound: clampInt(payload?.round ?? payload?.pressureRound, 0, 999, bus.handler.pressureRound || 0),
      syncRevision: nextRevision,
      note: safeString(payload?.note, 500),
      archiveToken,
      projections
    };

    if (safeKind === "archive") {
      bus.operators = {};
    }

    const written = write(bus);
    return {
      bus: written,
      rejected: false,
      syncRevision: nextRevision,
      publishedAt,
      cellId: written.cellId,
      archiveToken
    };
  }

  function publishOperatorSend(payload) {
    const send = normalizeOperatorSend(payload);
    if (!send) {
      const err = new Error("Invalid Operator Cell send.");
      err.code = "CELL_SEND_INVALID";
      throw err;
    }
    const bus = read();
    if (!bus.cellId) bus.cellId = makeId("cell");

    if (bus.handler && bus.handler.kind === "archive") {
      return {
        bus,
        result: "session_archived",
        reason: "session_archived",
        status: "session_archived",
        send
      };
    }

    const sendRound = send.pressureRound || send.round || 1;
    const handlerRound = bus.handler ? (bus.handler.pressureRound || 0) : 0;

    let result = "accepted";
    if (handlerRound > 0) {
      if (sendRound < handlerRound) {
        result = "late_for_closed_round";
        send.isLate = true;
        send.lateForRound = sendRound;
        send.closedHandlerRound = handlerRound;
        send.rejectionReason = "late_for_closed_round";
      } else if (sendRound > handlerRound) {
        result = "future_round";
        send.isFuture = true;
        send.futureRound = sendRound;
        send.closedHandlerRound = handlerRound;
        send.rejectionReason = "future_round";
      } else {
        send.isLate = false;
        send.isFuture = false;
        delete send.rejectionReason;
      }
    } else {
      send.isLate = false;
      send.isFuture = false;
      delete send.rejectionReason;
    }

    bus.operators = { ...bus.operators, [send.operatorKey]: send };
    bus.lastKind = "operator_send";
    const written = write(bus);

    return {
      bus: written,
      result,
      reason: result,
      status: result,
      send,
      sendRound,
      handlerRound
    };
  }

  function listOperatorSends(options) {
    const all = Object.values(read().operators || {});
    if (!options) return all;
    if (options.onTimeOnly) return all.filter((s) => !s.isLate && !s.isFuture);
    if (options.lateOnly) return all.filter((s) => Boolean(s.isLate));
    return all;
  }

  function listLateOperatorSends() {
    return listOperatorSends({ lateOnly: true });
  }

  function clearOperatorSend(operatorKey) {
    const bus = read();
    const key = safeString(operatorKey, 120);
    if (!key || !bus.operators[key]) return bus;
    delete bus.operators[key];
    return write(bus);
  }

  function onUpdate(callback) {
    if (typeof callback !== "function") return () => {};
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      callback(read());
    };
    window.addEventListener("storage", onStorage);
    const ch = getChannel();
    const onMessage = (event) => {
      if (event?.data?.type !== "cell-sync") return;
      callback(normalizeBus(event.data.bus));
    };
    if (ch) ch.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      if (ch) ch.removeEventListener("message", onMessage);
    };
  }

  /** Match a Handler seat / player to an operator send or projection key. */
  function matchKey(player, candidates) {
    if (!player || !Array.isArray(candidates) || !candidates.length) return null;
    const sourceId = safeString(player.sourceId || player.id, 120).toLowerCase();
    const name = safeString(player.name, 80).toLowerCase();
    const bySource = candidates.find((c) => {
      const key = safeString(c.operatorKey || c.sourceId, 120).toLowerCase();
      return key && sourceId && (key === sourceId || key === safeString(player.id, 120).toLowerCase());
    });
    if (bySource) return bySource;
    if (!name) return null;
    return candidates.find((c) => safeString(c.name, 80).toLowerCase() === name) || null;
  }

  /**
   * Whether a Handler projection pack is newer than local Operator state.
   * localMeta: { lastAppliedRevision, localRevisedAt, lastAppliedPublishedAt }
   */
  function isHandlerProjectionFresh(handler, localMeta) {
    if (!handler || !handler.projections || !handler.projections.length) {
      return { ok: false, reason: "no_projection" };
    }
    const revision = clampInt(handler.syncRevision, 0, 1e9, 0);
    const publishedAt = handler.publishedAt || handler.pushedAt || "";
    const lastApplied = clampInt(localMeta?.lastAppliedRevision, 0, 1e9, 0);
    if (revision > 0 && revision <= lastApplied) {
      return { ok: false, reason: "already_applied", revision, publishedAt };
    }
    const localRevisedAt = safeString(localMeta?.localRevisedAt, 40);
    if (localRevisedAt && publishedAt && stampMs(localRevisedAt) > stampMs(publishedAt)) {
      return { ok: false, reason: "local_newer", revision, publishedAt, localRevisedAt };
    }
    return { ok: true, revision, publishedAt };
  }

  window.VeilDaemonCellSync = {
    STORAGE_KEY,
    emptyBus,
    read,
    write,
    publishHandlerPush,
    publishOperatorSend,
    listOperatorSends,
    listLateOperatorSends,
    clearOperatorSend,
    onUpdate,
    matchKey,
    isHandlerProjectionFresh,
    stampMs,
    makeId,
    normalizeProjection,
    normalizeOperatorSend
  };
}());
