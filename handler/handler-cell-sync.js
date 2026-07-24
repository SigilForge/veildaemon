/**
 * Handler Live: End Pressure Round / Sync Cell / Archive Session.
 *
 * Architecture:
 *   OPERATOR — resolve local rules, queue/send state
 *   HANDLER  — queue consequences, request reconciliation
 *   SYNC     — merge by authority, publish projection
 *   OPERATOR — pull projection, render through existing rules
 *
 * Authority:
 *   Operator-submitted Harm and Stability remain authoritative during
 *   reconciliation when present. Mid-round projections may include only
 *   Harm, Stability, and notes. Lotus is between-sessions. Void/Breach
 *   are Archive Session currencies.
 *
 * Recovery resolves on the Operator page — Handler never re-runs heal rules.
 */
(function () {
  const api = window.HandlerState;

  function setStatus(message, isError) {
    const node = document.getElementById("storage-status");
    if (node) {
      node.textContent = message;
      node.classList.toggle("is-error", Boolean(isError));
    }
    const out = document.getElementById("cell-sync-output");
    if (out) out.textContent = message;
  }

  function pendingPrompts(state) {
    return (Array.isArray(state?.trackPromptQueue) ? state.trackPromptQueue : [])
      .filter((item) => item && item.status !== "Resolved");
  }

  function isRoundTrack(track) {
    const t = String(track || "");
    // Mid-round: Harm, Stability, presentation load — not Lotus, Void, or Breach.
    return t === "harm" || t === "stability" || t.endsWith("_load");
  }

  function projectionFromPlayer(player, trackLines, includeBanks) {
    const out = {
      operatorKey: player.sourceId || player.id || player.name,
      sourceId: player.sourceId || player.id || "",
      name: player.name || "Operator",
      harmBoxes: player.harmBoxes,
      stability: player.stabilityPoints,
      trackLines: trackLines || []
    };
    if (includeBanks && player.operatorStatus && typeof player.operatorStatus === "object") {
      const status = player.operatorStatus;
      if (status.voidMarks !== undefined) out.voidMarks = Number(status.voidMarks) || 0;
      if (status.breachPoints !== undefined) out.breachPoints = Number(status.breachPoints) || 0;
    }
    return out;
  }

  function applyOperatorSendToPlayer(player, send, { includeBanks }) {
    const next = { ...player };
    if (send.harmBoxes !== undefined) {
      next.harmBoxes = api.normalizeTrackerValue(send.harmBoxes, 5, 0);
      next.harm = api.formatPlayerHarm(next.harmBoxes);
    }
    if (send.stability !== undefined) {
      next.stabilityPoints = api.normalizeTrackerValue(send.stability, 10, 10);
      next.stabilityBand = api.stabilityBandFromPoints(next.stabilityPoints);
      next.stability = api.formatPlayerStability(next.stabilityPoints, next.stabilityBand);
    }
    if (send.misfire) next.misfire = api.safeString(send.misfire, 180);
    if (includeBanks) {
      const parts = [];
      if (send.voidMarks !== undefined) parts.push(`Void ${send.voidMarks}`);
      if (send.breachPoints !== undefined) parts.push(`Breach ${send.breachPoints}`);
      if (send.voidBreach) parts.push(send.voidBreach);
      if (parts.length) next.voidBreach = parts.join(" // ");
    }
    if (next.operatorStatus && typeof next.operatorStatus === "object") {
      next.operatorStatus = {
        ...next.operatorStatus,
        harmBoxes: next.harmBoxes !== undefined ? String(next.harmBoxes) : next.operatorStatus.harmBoxes,
        stability: next.stabilityPoints !== undefined ? String(next.stabilityPoints) : next.operatorStatus.stability
      };
      if (includeBanks) {
        if (send.voidMarks !== undefined) next.operatorStatus.voidMarks = String(send.voidMarks);
        if (send.breachPoints !== undefined) next.operatorStatus.breachPoints = String(send.breachPoints);
      }
    }
    next.lastImported = new Date().toISOString();
    return next;
  }

  /** Apply a queued track delta onto current mirror values (post Operator pull). */
  function applyTrackDeltaToPlayer(player, prompt) {
    if (!player || !prompt) return player;
    const next = { ...player };
    const delta = Number(prompt.delta) || 0;
    if (!delta) return next;
    if (prompt.track === "stability") {
      const value = api.normalizeTrackerValue((next.stabilityPoints ?? 10) + delta, 10, 10);
      next.stabilityPoints = value;
      next.stabilityBand = api.stabilityBandFromPoints(value);
      next.stability = api.formatPlayerStability(value, next.stabilityBand);
      return next;
    }
    if (String(prompt.track || "").endsWith("_load")) {
      const pp = window.PresentationPressure;
      const presentation = pp ? pp.presentationForLoadTrackKind(prompt.track) : null;
      const track = presentation ? pp.primaryTrack(presentation) : null;
      if (!pp || !track) return next;
      if (!next.operatorStatus || typeof next.operatorStatus !== "object") {
        next.operatorStatus = { presentationPressures: {} };
      }
      const current = Number(pp.readTrackValue?.(next.operatorStatus, track.id) ?? 0);
      const value = Math.max(0, Math.min(6, current + delta));
      next.operatorStatus = pp.writeTrackValue(next.operatorStatus, track.id, value);
      if (track.stateKey) next.operatorStatus[track.stateKey] = String(value);
      return next;
    }
    if (prompt.track === "harm") {
      const value = api.normalizeTrackerValue((next.harmBoxes ?? 0) + delta, 5, 0);
      next.harmBoxes = value;
      next.harm = api.formatPlayerHarm(value);
    }
    return next;
  }

  function ensureSession(state) {
    if (!state.session || typeof state.session !== "object") state.session = {};
    return state.session;
  }

  function syncKind(kind) {
    const cell = window.VeilDaemonCellSync;
    if (!cell || !api) {
      setStatus("Cell sync bus unavailable.", true);
      return null;
    }

    let state = api.readState();
    const session = ensureSession(state);
    const includeBanks = kind === "archive";
    const lines = [];

    // Archive is idempotent — never reconcile Void/Breach twice.
    if (kind === "archive" && session.cellArchiveToken) {
      const summary = `ARCHIVE ALREADY COMPLETE · token ${session.cellArchiveToken}`;
      setStatus(summary);
      return { state, kind, lines: [], summary, rejected: true, reason: "already_archived" };
    }

    const promptIds = pendingPrompts(state)
      .filter((p) => isRoundTrack(p.track))
      .map((p) => p.id);

    // 1) Pull Operator sends first.
    //    On-time sends are authoritative. Late/future sends refuse automatic sync.
    const allSends = cell.listOperatorSends();
    const currentRound = Number(session.pressureRound) || 0;

    const sends = [];
    const heldSends = [];
    allSends.forEach((send) => {
      const sendRound = send.pressureRound || send.round || 0;
      if (send.isLate || (currentRound > 0 && sendRound < currentRound)) {
        heldSends.push({ send, reason: "late", round: send.lateForRound || sendRound });
      } else if (send.isFuture || (currentRound > 0 && sendRound > currentRound)) {
        heldSends.push({ send, reason: "future", round: send.futureRound || sendRound });
      } else {
        sends.push(send);
      }
    });

    heldSends.forEach(({ send, reason, round: sendRound }) => {
      if (reason === "late") {
        lines.push(`Hold ${send.name}: Late send for closed Round ${sendRound} (current Round ${currentRound || 1}). Refused automatic sync.`);
      } else {
        lines.push(`Hold ${send.name}: Future send for Round ${sendRound} (current Round ${currentRound || 1}). Refused automatic sync.`);
      }
    });

    let players = Array.isArray(state.players) ? state.players.slice() : [];
    const seatsThatSent = new Set();
    const recoveryNotes = [];
    sends.forEach((send) => {
      const index = players.findIndex((player) => cell.matchKey(player, [send]));
      if (index < 0) {
        if (send.recoveryDeclared) {
          recoveryNotes.push(`${send.name}: declaring ${send.recoveryDeclared} (no matching seat)`);
        } else {
          recoveryNotes.push(`${send.name}: Cell send with no matching Operator seat`);
        }
        return;
      }
      seatsThatSent.add(index);
      const before = players[index];
      players[index] = applyOperatorSendToPlayer(before, send, { includeBanks });
      const harmDelta = (players[index].harmBoxes ?? 0) - (before.harmBoxes ?? 0);
      const stabDelta = (players[index].stabilityPoints ?? 10) - (before.stabilityPoints ?? 10);
      const bits = [];
      if (harmDelta) bits.push(`Harm ${harmDelta > 0 ? "+" : ""}${harmDelta}`);
      if (stabDelta) bits.push(`Stability ${stabDelta > 0 ? "+" : ""}${stabDelta}`);
      if (send.recoveryDeclared) bits.push(`recovery ${send.recoveryDeclared}`);
      if (includeBanks && (send.voidMarks !== undefined || send.breachPoints !== undefined)) {
        bits.push(`banks Void ${send.voidMarks ?? "—"} / Breach ${send.breachPoints ?? "—"}`);
      }
      lines.push(`Pull ${send.name}: ${bits.join(" // ") || "sheet refresh"}`);
      try {
        cell.clearOperatorSend(send.operatorKey);
      } catch (_error) {
        // Non-fatal — clear is best-effort after pull.
      }
    });
    recoveryNotes.forEach((note) => lines.push(note));
    state.players = players;

    // 2) Seats without a send get Handler-queued Harm/Stability deltas.
    //    Seats that sent: Operator authority — clear queue without replaying deltas.
    players = Array.isArray(state.players) ? state.players.slice() : [];
    promptIds.forEach((id) => {
      const before = pendingPrompts(state).find((p) => p.id === id);
      if (before) {
        const index = Number(before.operatorIndex);
        const track = before.track === "harm"
          ? "Harm"
          : before.track === "stability"
            ? "Stability"
            : String(before.track || "Track");
        const delta = Number(before.delta) || 0;
        const sign = delta > 0 ? "+" : "";
        if (Number.isFinite(index) && seatsThatSent.has(index)) {
          lines.push(`Hold ${before.operatorName || "Operator"}: ${track} ${sign}${delta} (Operator send is authority)`);
        } else if (Number.isFinite(index) && players[index]) {
          players[index] = applyTrackDeltaToPlayer(players[index], before);
          lines.push(`Push ${before.operatorName || "Operator"}: ${track} ${sign}${delta}`);
        }
      }
      state = { ...state, players };
      state = api.resolveTrackPrompt(state, id, { applySummary: false });
      players = Array.isArray(state.players) ? state.players.slice() : players;
    });
    state.players = players;

    // 3) Advance local pressure-round counter only on End Pressure Round.
    const prevRound = Number(session.pressureRound) || 0;
    if (kind === "pressure_round") {
      session.pressureRound = prevRound + 1;
    }
    const round = Number(session.pressureRound) || prevRound;
    state.session = session;

    // 4) Publish Handler projections (Harm/Stability/notes; banks only on archive).
    //    Lotus is never mid-round — between-sessions only.
    const projections = players.map((player) => {
      const related = lines.filter((line) => line.includes(player.name || ""));
      return projectionFromPlayer(player, related, includeBanks);
    });
    const note = kind === "pressure_round"
      ? "Pressure Round ended. Reactions refresh next round. Harm & Stability reconciled."
      : kind === "archive"
        ? "Session archived. Void/Breach banks reconciled once."
        : "Cell synced. Harm & Stability reconciled.";

    const archiveToken = kind === "archive"
      ? (session.cellArchiveToken || cell.makeId("archive"))
      : "";

    let publishResult;
    try {
      publishResult = cell.publishHandlerPush(kind, {
        projections,
        round,
        pressureRound: round,
        note,
        archiveToken: archiveToken || undefined
      });
    } catch (error) {
      setStatus(error.message || "Cell publish refused.", true);
      return null;
    }

    if (publishResult?.rejected && publishResult.reason === "already_archived") {
      session.cellArchiveToken = publishResult.archiveToken || session.cellArchiveToken;
      state.session = session;
      try {
        state = api.writeState(state, "ARCHIVE ALREADY COMPLETE");
      } catch (_error) {
        // ignore
      }
      const summary = `ARCHIVE ALREADY COMPLETE · token ${session.cellArchiveToken}`;
      setStatus(summary);
      return { state, kind, lines: [], summary, rejected: true, reason: "already_archived" };
    }

    if (kind === "archive" && publishResult?.archiveToken) {
      session.cellArchiveToken = publishResult.archiveToken;
      session.cellArchivedAt = publishResult.publishedAt || new Date().toISOString();
      state.session = session;
    }

    session.lastCellSyncRevision = publishResult?.syncRevision || session.lastCellSyncRevision || 0;
    session.lastCellPublishedAt = publishResult?.publishedAt || "";
    session.cellId = publishResult?.cellId || session.cellId || "";
    state.session = session;

    // 5) Persist Handler state.
    try {
      state = api.writeState(state, note);
    } catch (_error) {
      setStatus("STORAGE REFUSED", true);
      return null;
    }

    const summary = [
      kind === "pressure_round" ? `PRESSURE ROUND ${round} ENDED` : kind === "archive" ? "ARCHIVE SESSION" : "CELL SYNCED",
      `rev ${publishResult?.syncRevision || "—"}`,
      `${promptIds.length} Handler prompt(s) cleared`,
      `${sends.length} Operator send(s) pulled`,
      includeBanks ? "Void/Breach included once" : "Void/Breach held for Archive · Lotus between sessions"
    ].join(" // ");
    setStatus(lines.length ? `${summary}\n${lines.join("\n")}` : summary);

    return { state, kind, lines, summary, publishResult };
  }

  function resolveLateSend(operatorKey, choice) {
    const cell = window.VeilDaemonCellSync;
    if (!cell || !api) return null;
    let state = api.readState();
    const session = ensureSession(state);
    const sends = cell.listOperatorSends();
    const key = api.safeString(operatorKey, 120);
    const send = sends.find((s) => cell.matchKey({ sourceId: key, id: key, name: key }, [s]) || s.operatorKey === key);
    if (!send) return null;

    let players = Array.isArray(state.players) ? state.players.slice() : [];
    const index = players.findIndex((player) => cell.matchKey(player, [send]));
    if (index < 0) {
      setStatus(`Late send resolution failed: no matching seat for ${send.name}`, true);
      return null;
    }

    const currentRound = Number(session.pressureRound) || 0;
    const sendRound = send.lateForRound || send.round || 0;
    const before = players[index];
    players[index] = applyOperatorSendToPlayer(before, send, { includeBanks: false });

    const timeStamp = new Date().toISOString();
    let logNote = "";
    if (choice === "apply_correction") {
      logNote = `Audit: Operator submitted: Round ${sendRound} // Received during: Round ${currentRound || 1} // Resolution: Amended Round ${sendRound} // Resolved by Handler at: ${timeStamp}`;
    } else {
      logNote = `Audit: Operator submitted: Round ${sendRound} // Received during: Round ${currentRound || 1} // Resolution: Carried into Round ${currentRound || 1} // Resolved by Handler at: ${timeStamp}`;
    }

    state.players = players;
    try {
      cell.clearOperatorSend(send.operatorKey);
    } catch (_error) {
      // ignore
    }

    try {
      state = api.writeState(state, logNote);
    } catch (_error) {
      // ignore
    }

    setStatus(logNote);
    if (window.HandlerCellSync?.refreshHint) window.HandlerCellSync.refreshHint();
    return { state, send, logNote };
  }

  function renderLateSendReview(lateSends, currentRound) {
    let container = document.getElementById("cell-sync-late-review");
    const dock = document.getElementById("cell-sync-dock");
    if (!dock) return;

    if (!Array.isArray(lateSends) || !lateSends.length) {
      if (container) container.remove();
      return;
    }

    if (!container) {
      container = document.createElement("div");
      container.id = "cell-sync-late-review";
      container.className = "cell-sync-late-review";
      dock.appendChild(container);
    }

    container.innerHTML = lateSends.map((send) => {
      const sendRound = send.lateForRound || send.round || 1;
      const name = api.safeString ? api.safeString(send.name, 80) : send.name;
      return `
        <div class="late-send-card" data-op-key="${send.operatorKey}">
          <div class="late-send-info">
            <strong>⚠️ ROUND ${sendRound} ALREADY CLOSED — Operator report from ${name}</strong>
            <span>Arrived during Round ${currentRound || 1} · Harm ${send.harmBoxes} / Stability ${send.stability}</span>
          </div>
          <div class="late-send-actions">
            <button class="button secondary btn-late-correct" type="button" data-op-key="${send.operatorKey}">Amend Round ${sendRound}</button>
            <button class="button primary btn-late-carry" type="button" data-op-key="${send.operatorKey}">Carry into Round ${currentRound || 1}</button>
          </div>
        </div>
      `;
    }).join("\n");

    container.querySelectorAll(".btn-late-correct").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.getAttribute("data-op-key");
        resolveLateSend(key, "apply_correction");
      };
    });

    container.querySelectorAll(".btn-late-carry").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.getAttribute("data-op-key");
        resolveLateSend(key, "carry_forward");
      };
    });
  }

  function bind(hooks) {
    const onAfter = typeof hooks?.onAfter === "function" ? hooks.onAfter : null;
    const pressureBtn = document.getElementById("cell-sync-pressure-round");
    const cellBtn = document.getElementById("cell-sync-cell");
    const archiveBtn = document.getElementById("cell-sync-archive");

    function run(kind) {
      const result = syncKind(kind);
      if (result && onAfter) onAfter(result);
    }

    if (pressureBtn) {
      pressureBtn.addEventListener("click", () => run("pressure_round"));
    }
    if (cellBtn) {
      cellBtn.addEventListener("click", () => run("cell"));
    }
    if (archiveBtn) {
      archiveBtn.addEventListener("click", () => {
        const state = api.readState();
        if (state.session?.cellArchiveToken) {
          setStatus(`ARCHIVE ALREADY COMPLETE · token ${state.session.cellArchiveToken}`);
          return;
        }
        if (!window.confirm("Archive Session? Pull Operator banks (Void/Breach) once, reconcile Harm/Stability, clear Cell sends. Lotus stays between-sessions.")) {
          return;
        }
        run("archive");
      });
    }

    const statusLine = document.getElementById("cell-sync-status");
    function refreshHint() {
      if (!statusLine || !api) return;
      const state = api.readState();
      const pending = pendingPrompts(state).filter((p) => isRoundTrack(p.track)).length;
      const allSends = window.VeilDaemonCellSync?.listOperatorSends?.() || [];
      const round = Number(state.session?.pressureRound) || 0;
      const onTimeSends = allSends.filter((s) => !s.isLate && !s.isFuture && !(round > 0 && (s.pressureRound || s.round) < round));
      const lateSends = allSends.filter((s) => s.isLate || (round > 0 && (s.pressureRound || s.round) < round));
      const rev = Number(state.session?.lastCellSyncRevision) || 0;
      const archived = state.session?.cellArchiveToken ? "archived" : "open";

      statusLine.textContent = [
        round ? `Pressure Round ${round}` : "Pressure Round ready",
        rev ? `rev ${rev}` : "rev —",
        pending ? `${pending} Handler update(s) queued` : "No Handler queue",
        onTimeSends.length ? `${onTimeSends.length} Operator send(s) waiting` : "No active Operator sends",
        lateSends.length ? `⚠️ ${lateSends.length} LATE REPORT(S) QUEUED` : "",
        `session ${archived}`,
        "Closed-round boundary active"
      ].filter(Boolean).join(" · ");

      renderLateSendReview(lateSends, round);
    }
    refreshHint();
    window.setInterval(refreshHint, 4000);
    window.VeilDaemonCellSync?.onUpdate?.(refreshHint);

    window.HandlerCellSync = { syncKind, resolveLateSend, refreshHint, pendingPrompts };
  }

  window.HandlerCellSync = { bind, syncKind, resolveLateSend, pendingPrompts };
}());
