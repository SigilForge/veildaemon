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

  /** Refreshes the local bus from the server before a deliberate sync click, when CONNECTED
   * — syncKind() itself stays synchronous/unchanged, reading whatever this leaves in the bus. */
  async function pullRemoteIfConnected() {
    const remote = window.VeilDaemonCellRemote;
    if (!remote?.isConnected()) return;
    try {
      await remote.pullState();
    } catch (error) {
      setStatus(error?.message || "Remote Cell pull failed", true);
    }
  }

  /** Publishes this round's per-operator projections remotely, when CONNECTED — the local
   * bus write already happened inside syncKind(), so a remote failure only affects
   * cross-device Operators, never the Handler's own local state. */
  async function pushRemoteIfConnected(result) {
    const remote = window.VeilDaemonCellRemote;
    if (!remote?.isConnected() || !result || result.rejected) return;
    try {
      await remote.pushHandlerProjections({
        kind: result.kind,
        round: result.round,
        note: result.note,
        archiveToken: result.archiveToken,
        projections: result.projections,
        actionEconomy: result.actionEconomy,
      });
    } catch (error) {
      setStatus(error?.message || "Remote Cell publish failed", true);
    }
  }

  function pendingPrompts(state) {
    return (Array.isArray(state?.trackPromptQueue) ? state.trackPromptQueue : [])
      .filter((item) => item && item.status !== "Resolved");
  }

  /** By-name readiness for "End Pressure Round" -- the visibility the table never had before:
   * an Operator is "Accepted" once every Track Prompt addressed to them this round is
   * Acknowledged or Resolved (or they simply have none queued); otherwise "Pending". Handler
   * authority is never reduced by this -- it's a confirm summary, not a gate, so one AFK
   * Operator can't freeze the table. */
  function buildRoundAdvanceSummary(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    const queue = Array.isArray(state?.trackPromptQueue) ? state.trackPromptQueue : [];
    return players.map((player, index) => {
      const mine = queue.filter((item) => item && Number(item.operatorIndex) === index);
      // Status alone isn't a reliable "caught up" signal: every Track Prompt auto-resolves
      // on any sync (see the promptIds loop below), often before the Operator has even seen
      // it -- so an item can be "Resolved" and still genuinely unacknowledged. acknowledgedAt
      // is only ever set by a real incoming Operator confirmation, never by auto-resolve.
      const outstanding = mine.some((item) => !item.acknowledgedAt);
      return { name: player.name || "Operator", accepted: !outstanding };
    });
  }

  function isRoundTrack(track) {
    const t = String(track || "");
    // Mid-round: Harm, Stability, presentation load — not Lotus, Void, or Breach.
    return t === "harm" || t === "stability" || t.endsWith("_load");
  }

  function projectionFromPlayer(player, trackLines, includeBanks, trackPromptIds, archiveState) {
    const out = {
      operatorKey: player.sourceId || player.id || player.name,
      sourceId: player.sourceId || player.id || "",
      name: player.name || "Operator",
      harmBoxes: player.harmBoxes,
      stability: player.stabilityPoints,
      trackLines: trackLines || []
    };
    // Session-end rewards: only on the archive push, and only for whatever this player's
    // decision record actually resolved to "awarded" -- declined/na/pending deliver nothing.
    // The Scar case is NOT included here: a real ontology-eligible Scar already reaches the
    // Operator through the existing presentationDriftState field below; this reward system
    // only confirms it happened, it never delivers a second one.
    if (archiveState) {
      const decision = archiveState.sessionRewardDecisions?.[player.id];
      const needlepoint = archiveState.activeNeedlepoint || {};
      const stamp = api.nowStamp();
      if (decision?.mark?.status === "awarded" && !api.playerLoadPresentation?.(player)) {
        out.sessionMarkAward = {
          id: `mark-${player.id}-${archiveState.session?.cellId || stamp}`,
          label: decision.mark.label,
          benefit: decision.mark.benefit,
          cost: decision.mark.cost,
          needlepointId: needlepoint.id || "",
          needlepointTitle: archiveState.session?.caseTitle || needlepoint.id || "",
          awardedAt: stamp,
          ontologyGrant: decision.mark.ontologyGrant ? { ...decision.mark.ontologyGrant, status: "proposed" } : null
        };
      }
      if (decision?.clue?.status === "awarded" && decision.clue.clueId) {
        const clue = archiveState.clueIntegrity?.clues?.find((item) => item.id === decision.clue.clueId);
        if (clue) {
          out.recoveredClue = {
            id: `clue-${player.id}-${decision.clue.clueId}`,
            clueId: clue.id,
            clue: clue.clue,
            needlepointId: needlepoint.id || "",
            needlepointTitle: archiveState.session?.caseTitle || needlepoint.id || "",
            awardedAt: stamp
          };
        }
      }
      if (decision?.trust?.status === "awarded" && decision.trust.target) {
        out.trustRecord = {
          id: `trust-${player.id}-${archiveState.session?.cellId || stamp}`,
          target: decision.trust.target,
          stance: decision.trust.stance,
          note: decision.trust.note,
          source: decision.trust.source,
          sessionReference: archiveState.session?.caseTitle || needlepoint.id || "",
          awardedAt: stamp
        };
      }
    }
    if (Array.isArray(trackPromptIds) && trackPromptIds.length) {
      out.trackPromptIds = trackPromptIds;
    }
    if (includeBanks && player.operatorStatus && typeof player.operatorStatus === "object") {
      const status = player.operatorStatus;
      if (status.voidMarks !== undefined) out.voidMarks = Number(status.voidMarks) || 0;
      if (status.breachPoints !== undefined) out.breachPoints = Number(status.breachPoints) || 0;
    }
    // Presentation Load: Handler already computes this via the trigger/manual-pressure
    // pipeline (misfireLoadDeltaForTrigger etc.) — put the player's current value on the
    // wire so the Operator sheet's own meter actually moves instead of a toast-only note.
    let presentationForDrift = null;
    if (api?.playerLoadPresentation && api?.playerTrackLoad) {
      const presentation = api.playerLoadPresentation(player);
      presentationForDrift = presentation;
      const track = presentation ? window.PresentationPressure?.primaryTrack(presentation) : null;
      if (track) {
        const value = api.playerTrackLoad(player, presentation);
        if (value !== null && value !== undefined) {
          out.loadDeltas = [{ trackKind: track.kind, value }];
        }
      }
    }
    // Handler-authored Drift/Scar award -- absolute snapshot, not Load-gated (a scar can be
    // developed or a deferred choice resolved with Load already back below 6). Deliberately
    // excludes pendingScarChoices and the Collapse Record log; those stay Handler-only.
    const drift = window.PresentationDrift;
    if (drift?.presentationDriftView && presentationForDrift && player.operatorStatus) {
      const view = drift.presentationDriftView(player.operatorStatus, presentationForDrift.id);
      if (view && (view.value > 0 || view.scars.length || view.scarDevelopments.length)) {
        out.presentationDriftState = [{
          presentationId: view.presentationId,
          value: view.value,
          catalogVersion: drift.DRIFT_CATALOG_VERSION,
          scars: view.scars,
          scarDevelopments: view.scarDevelopments,
          thresholdDecision: view.thresholdDecision
        }];
      }
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
      // Routed through the same centralized helper the Handler's manual Resolve/Undo use
      // (handler-state.js) so this auto-apply-during-sync path also notifies
      // PresentationDrift's Load-transition mint/clear logic -- this is one of the three
      // real Presentation Load write sites, not a separate one that could forget it.
      next.operatorStatus = api.writeHandlerPresentationLoad(next.operatorStatus, presentation.id, value);
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
      if (send.recoveryDeclared) {
        bits.push(send.recoveryResolution ? `recovery ${send.recoveryDeclared}: ${send.recoveryResolution}` : `recovery ${send.recoveryDeclared}`);
      }
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

    // 1b) Fold in anything the Operator has Acknowledged -- the loop-closing report from
    // the declare -> resolve -> distribute -> acknowledge -> advance model. A report, not a
    // request: Handler still decides when to advance regardless of what this shows.
    sends.forEach((send) => {
      if (!Array.isArray(send.acknowledgedPromptIds)) return;
      send.acknowledgedPromptIds.forEach((id) => {
        state = api.acknowledgeTrackPrompt(state, id);
      });
    });

    // 2) Seats without a send get Handler-queued Harm/Stability deltas.
    //    Seats that sent: Operator authority — clear queue without replaying deltas.
    players = Array.isArray(state.players) ? state.players.slice() : [];
    // Which Track Prompt ids actually landed a Handler-queued change onto each seat this
    // sync -- gives the Operator something concrete to Acknowledge. A "Hold" (the Operator's
    // own send was authoritative) isn't included: nothing new was pushed onto them to confirm.
    const pushedIdsByPlayerIndex = new Map();
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
          if (!pushedIdsByPlayerIndex.has(index)) pushedIdsByPlayerIndex.set(index, []);
          pushedIdsByPlayerIndex.get(index).push(id);
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

    // Action economy: fresh Main/Move/Frequency/Reaction budgets for every known seat when
    // a Pressure Round ends; otherwise carry the existing bus snapshot forward. Either way,
    // apply any actionSpend/actionReset this batch of Operator sends reported before
    // publishing. Each is an absolute state report (spend, restore, or full reset), not
    // an append-only event, so a toggled-back or reset slot converges correctly here too.
    const economy = window.VeilDaemonPressureRoundEconomy;
    let actionEconomy = economy
      ? (kind === "pressure_round"
        ? economy.resetBudgetsForRound(round, players.map((p) => p.sourceId || p.name).filter(Boolean))
        : (cell.read().handler.actionEconomy || { round, budgets: {} }))
      : undefined;
    if (economy && actionEconomy) {
      sends.forEach((send) => {
        if (send.actionReset) {
          actionEconomy = economy.resetSeatBudget(actionEconomy, send.operatorKey);
        } else if (send.actionSpend?.slot) {
          actionEconomy = economy.setSlotSpent(actionEconomy, send.operatorKey, send.actionSpend.slot, send.actionSpend.used !== false);
        }
      });
    }

    // 4) Publish Handler projections (Harm/Stability/notes; banks only on archive).
    //    Lotus is never mid-round — between-sessions only.
    const projections = players.map((player, index) => {
      const related = lines.filter((line) => line.includes(player.name || ""));
      const relatedIds = pushedIdsByPlayerIndex.get(index) || [];
      return projectionFromPlayer(player, related, includeBanks, relatedIds, kind === "archive" ? state : null);
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
        archiveToken: archiveToken || undefined,
        actionEconomy
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

    return { state, kind, lines, summary, publishResult, projections, round, note, archiveToken };
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

  /**
   * Reconciles every authoritative Handler mutation into cell_operations, debounced.
   *
   * writeState() (handler-state.js) is the single canonical write path for the entire
   * Handler dashboard -- every mutation of any kind (Scene State, Clocks, NPC roster, Entity/
   * Zone Loop, Clue Integrity, Track Prompt queue, session-end reward decisions, round
   * advancement) already funnels through it and fires "veildaemon:handler-state-updated"
   * synchronously on every call. That is the one hook this needs; no new call sites had to be
   * threaded through the ~30 places that mutate Handler state.
   *
   * Debouncing/batching: a rapid burst of mutations (typing in a textarea, dragging a clock
   * tick, resolving several Track Prompts in a row) collapses into ONE push after
   * IDLE_DELAY_MS of quiet, or is force-flushed after MAX_WAIT_MS of continuous activity so a
   * long unbroken editing session still checkpoints periodically. Always sends the FULL
   * current snapshot read at actual send time (api.readState()), not whatever was live when
   * the timer started -- there is no per-field diffing to get subtly wrong.
   *
   * Revision checks: the server's own CAS retry loop (state_version, see handleSyncOperation
   * in api/cell/[action].js) is the actual protection against lost updates from concurrent
   * writers. The client-side contribution is simpler and just as load-bearing: never have two
   * pushes in flight at once. inFlight + flushAgainAfter guarantee that a mutation arriving
   * mid-push schedules exactly one follow-up flush (reading fresh state at that later send
   * time) rather than racing a second overlapping request against the first.
   *
   * One-shot effect safety: this pipeline only ever WRITES cell_operations; it never reads
   * data back into local Handler state or triggers any Operator-facing effect on its own (that
   * remains the existing, separate, explicit publish/archive flow). So there is nothing here
   * that could replay a Track Prompt resolution, a Recovery resolution, or an Entity Loop step
   * twice -- the synced snapshot is inert until an actual Resume/reconnect reads it back, and
   * whatever "already resolved" flags a mutation set (acknowledgedAt, resolvedAt, etc.) travel
   * with it exactly once, encoded in the state itself, not as a separate event log this engine
   * could double-fire.
   *
   * Multi-Cell correctness: a debounce timer fires LATER than it's scheduled, and the active
   * Cell can change in between (switchToCell). The target connection AND generation are
   * therefore captured at SCHEDULE time, not flush time, and threaded through explicitly
   * (targetConnection/targetGeneration below) rather than re-reading the live `connection` var
   * when the timer fires -- a scheduled push whose generation has since moved on becomes an
   * inert no-op (no network call at all), instead of writing possibly-stale data into
   * whichever Cell happens to be connected by the time the timer goes off. This is the fix
   * for a confirmed real bleed path (see the Multi-Cell Handler Management architecture plan).
   */
  const OPERATION_SYNC_IDLE_DELAY_MS = 1500;
  const OPERATION_SYNC_MAX_WAIT_MS = 8000;
  let operationSyncTimer = null;
  let operationSyncFirstDirtyAt = 0;
  // A promise chain, not a busy-flag: every push (whether from the debounce timer or a forced
  // caller like Archive/Suspend/Close) appends onto this chain, so "await flushOperationSync()"
  // always genuinely waits for every push already queued ahead of it to finish AND for one
  // more push reading the truly-current state, rather than racing an in-flight request or
  // silently no-op'ing because one happened to already be running.
  let operationSyncChain = Promise.resolve();

  function buildOperationStatePatch(state) {
    return {
      round: Number(state.session?.pressureRound) || 0,
      sceneState: {
        sceneState: state.sceneState,
        primaryClock: state.primaryClock,
        secondaryClock: state.secondaryClock,
        entityLoop: state.entityLoop,
        activeEntity: state.activeEntity,
        entityLibrary: state.entityLibrary,
        attention: state.attention,
        roomAnswer: state.roomAnswer,
        unresolvedConsequences: state.unresolvedConsequences,
        trackPromptQueue: state.trackPromptQueue
      },
      clueState: { clueIntegrity: state.clueIntegrity },
      npcState: { npcs: state.npcs },
      rewardState: state.sessionRewardDecisions || {}
    };
  }

  function operationSyncEligible() {
    const remote = window.VeilDaemonCellRemote;
    return Boolean(remote?.isConnected() && remote.currentConnection()?.role === "handler");
  }

  /** Pushes to the EXPLICIT target connection captured at schedule/flush time -- never re-reads
   * the live `connection` var, so a stale scheduled push can never land on whichever Cell
   * happens to be active by the time it actually fires. */
  async function pushOperationSyncNow(targetConnection, targetGeneration) {
    const remote = window.VeilDaemonCellRemote;
    if (!remote || !remote.isCurrentGeneration(targetGeneration)) return; // stale -- silent no-op
    if (!targetConnection || targetConnection.role !== "handler") return;
    try {
      const state = api.readState();
      await remote.syncOperationFor(targetConnection, buildOperationStatePatch(state));
    } catch (_error) {
      // Best-effort, silent: local Handler state is never at risk -- only the server-side
      // mirror lags behind until the next successful flush (next mutation, or the periodic
      // refreshHint tick already running independently).
    }
  }

  /** Cancels any pending debounce timer and pushes the CURRENT (live, right-now) state
   * immediately, chained behind any push already in flight. Callers that need the server to
   * be caught up before proceeding (Archive/Suspend/Close/a Cell switch) must `await` this
   * rather than firing it and moving on -- this is a forced, immediate flush, not a scheduled
   * one, so it intentionally reads the live connection/generation rather than a snapshot. */
  function flushOperationSync() {
    if (operationSyncTimer) {
      window.clearTimeout(operationSyncTimer);
      operationSyncTimer = null;
    }
    operationSyncFirstDirtyAt = 0;
    const remote = window.VeilDaemonCellRemote;
    const targetConnection = remote ? remote.currentConnection() : null;
    const targetGeneration = remote ? remote.currentGeneration() : -1;
    operationSyncChain = operationSyncChain.then(() => pushOperationSyncNow(targetConnection, targetGeneration));
    return operationSyncChain;
  }

  function scheduleOperationSync() {
    if (!operationSyncEligible()) return;
    if (!operationSyncFirstDirtyAt) operationSyncFirstDirtyAt = Date.now();
    if (operationSyncTimer) window.clearTimeout(operationSyncTimer);
    const elapsed = Date.now() - operationSyncFirstDirtyAt;
    const delay = elapsed >= OPERATION_SYNC_MAX_WAIT_MS ? 0 : OPERATION_SYNC_IDLE_DELAY_MS;
    // Snapshot NOW (schedule time), not when the timer callback runs -- see the doc comment
    // above for why this is the actual fix, not just a convenience.
    const remote = window.VeilDaemonCellRemote;
    const targetConnection = remote.currentConnection();
    const targetGeneration = remote.currentGeneration();
    operationSyncTimer = window.setTimeout(() => {
      operationSyncTimer = null;
      operationSyncFirstDirtyAt = 0;
      operationSyncChain = operationSyncChain.then(() => pushOperationSyncNow(targetConnection, targetGeneration));
    }, delay);
  }

  window.addEventListener("veildaemon:handler-state-updated", scheduleOperationSync);

  /** Best-effort flush of a still-pending debounced push when the page is about to unload --
   * navigating to another Cell (Resume link, deep-link, the Cells dashboard) or simply
   * closing the tab. Without this, a mutation still sitting inside the 1.5s idle-delay window
   * at the moment of navigation would be silently lost: the in-memory setTimeout never fires,
   * a fresh page load has no memory of it, and there is no other trigger that would ever push
   * it. `keepalive` is required for the fetch to have any real chance of completing after the
   * page starts unloading -- without it, `pagehide` naturally cancels the request. */
  window.addEventListener("pagehide", () => {
    if (!operationSyncTimer && !operationSyncFirstDirtyAt) return; // nothing pending
    if (operationSyncTimer) {
      window.clearTimeout(operationSyncTimer);
      operationSyncTimer = null;
    }
    operationSyncFirstDirtyAt = 0;
    const remote = window.VeilDaemonCellRemote;
    if (!remote || !remote.isConnected() || remote.currentConnection()?.role !== "handler") return;
    const targetConnection = remote.currentConnection();
    const targetGeneration = remote.currentGeneration();
    if (!remote.isCurrentGeneration(targetGeneration)) return;
    try {
      const state = api.readState();
      remote.syncOperationFor(targetConnection, buildOperationStatePatch(state), { keepalive: true });
    } catch (_error) {
      // Best-effort, same trust level as every other push in this engine.
    }
  });

  function bind(hooks) {
    const onAfter = typeof hooks?.onAfter === "function" ? hooks.onAfter : null;
    const pressureBtn = document.getElementById("cell-sync-pressure-round");
    const cellBtn = document.getElementById("cell-sync-cell");
    const archiveBtn = document.getElementById("cell-sync-archive");

    async function run(kind) {
      await pullRemoteIfConnected();
      const result = syncKind(kind);
      if (result && onAfter) onAfter(result);
      await pushRemoteIfConnected(result);
    }

    if (pressureBtn) {
      pressureBtn.addEventListener("click", () => {
        // Confirm summary, not a gate: Handler authority to advance is never reduced, but the
        // acknowledge state is finally visible by name instead of buried in an advisory
        // status line -- exactly the "readable at a glance" the round loop needs.
        const summary = buildRoundAdvanceSummary(api.readState());
        if (summary.length) {
          const lines = summary.map((entry) => `${entry.name}: ${entry.accepted ? "Accepted" : "Pending"}`);
          const anyPending = summary.some((entry) => !entry.accepted);
          const prompt = anyPending
            ? `Advance Pressure Round?\n\n${lines.join("\n")}\n\nSome Operators are still Pending. Advance anyway?`
            : `Advance Pressure Round?\n\n${lines.join("\n")}\n\nAll Operators Accepted.`;
          if (!window.confirm(prompt)) return;
        }
        run("pressure_round");
      });
    }
    if (cellBtn) {
      cellBtn.addEventListener("click", () => run("cell"));
    }
    if (archiveBtn) {
      archiveBtn.addEventListener("click", async () => {
        const state = api.readState();
        if (state.session?.cellArchiveToken) {
          setStatus(`ARCHIVE ALREADY COMPLETE · token ${state.session.cellArchiveToken}`);
          return;
        }
        // Refuse to claim "session complete" while a reward this session promised (Mark/
        // Scar, recovered clue, trust/distrust) is still sitting unresolved for any seated
        // Operator -- awarded, declined, and not-applicable all count as resolved; only
        // "pending" blocks. See handler-session-rewards.js for where these get set.
        if (api.sessionRewardsResolved && !api.sessionRewardsResolved(state)) {
          const names = api.unresolvedSessionRewardPlayerNames(state).join(", ");
          setStatus(`Resolve session-end rewards (Mark/Scar, clue, trust) for: ${names}`, true);
          return;
        }
        if (!window.confirm("Archive Session? Pull Operator banks (Void/Breach) once, reconcile Harm/Stability, clear Cell sends. Lotus stays between-sessions.")) {
          return;
        }
        await run("archive");
        // "OPERATION ARCHIVED / Lobby remains open" -- this marks the Cell's own Operation
        // record archived server-side (checkpoint, Cell -> POST_OPERATION) and is a
        // completely separate call from closing the Cell (see cell-lifecycle-close below).
        // It NEVER disconnects or evicts a seat, on purpose.
        const remote = window.VeilDaemonCellRemote;
        if (remote?.isConnected()) {
          try {
            // Archive must never race the debounced reconciliation engine: the server's own
            // reward-gate check on archive-operation reads whatever is CURRENTLY in
            // cell_operations.reward_state, and a just-resolved reward decision (e.g. marking
            // not-applicable moments before clicking Archive) may not have flushed yet. Force
            // a synchronous flush first so Archive always sees the true current state, not a
            // stale pre-decision snapshot.
            await flushOperationSync();
            await remote.archiveOperation({ oneShot: state.activeNeedlepoint?.one_shot });
            setStatus("OPERATION ARCHIVED — lobby remains open. Chat, reward review, and character maintenance are still available.");
          } catch (error) {
            setStatus(error?.message || "Remote Operation archive failed", true);
          }
          renderOperationLifecycle();
        }
      });
    }

    // --- Operation lifecycle: a SEPARATE dock from Cell lifecycle below. Start/Suspend/
    // Resume Operation only ever touch cell_operations server-side -- never a seat row,
    // never handler_sessions.status beyond the OPEN<->ACTIVE_OPERATION<->POST_OPERATION
    // reflection the server itself computes. ---
    const operationStatusNote = document.getElementById("cell-operation-status");
    const startOperationBtn = document.getElementById("cell-operation-start");
    const suspendOperationBtn = document.getElementById("cell-operation-suspend");
    const resumeOperationBtn = document.getElementById("cell-operation-resume");
    const needlepointEmptyNote = document.getElementById("cell-operation-needlepoint-empty");
    const needlepointWeaveLink = document.getElementById("cell-operation-weave-link");
    const needlepointPicker = document.getElementById("cell-operation-needlepoint-picker");
    const needlepointSelect = document.getElementById("cell-operation-needlepoint-select");
    let latestOperation = null;
    let latestCellStatus = "";

    async function weaveGetToken() {
      const auth = window.VeilAuth;
      if (!auth) return null;
      if (!auth.getSession()) await auth.init();
      return auth.getSession()?.access_token || null;
    }

    /** Needlepoints are Weave-scoped and there's no "list every Needlepoint for a Cell"
     * endpoint (see handleListNeedlepoints in api/cell/[action].js) -- weaves are Handler-only and typically few per
     * Cell, so this just fetches each Weave's own Needlepoints and flattens them for the
     * picker, labeled "Weave title -- Needlepoint title" so a Handler running several arcs
     * can tell them apart. */
    async function loadStartableNeedlepoints(cellId) {
      const remote = window.VeilDaemonCellRemote;
      const weavesRes = await remote.listWeaves(weaveGetToken, { cellId }).catch(() => null);
      const weaves = (weavesRes && weavesRes.weaves) || [];
      const entries = [];
      for (const weave of weaves) {
        const npRes = await remote.listNeedlepoints(weaveGetToken, { cellId, weaveId: weave.id }).catch(() => null);
        const needlepoints = (npRes && npRes.needlepoints) || [];
        needlepoints.forEach((np) => entries.push({ id: np.id, label: `${weave.title || "Untitled Weave"} — ${np.title}` }));
      }
      return entries;
    }

    async function renderOperationLifecycle() {
      const remote = window.VeilDaemonCellRemote;
      if (!remote?.isConnected() || remote.currentConnection()?.role !== "handler") {
        if (operationStatusNote) operationStatusNote.textContent = "Connect a Cell to manage Operations.";
        if (startOperationBtn) startOperationBtn.hidden = true;
        if (suspendOperationBtn) suspendOperationBtn.hidden = true;
        if (resumeOperationBtn) resumeOperationBtn.hidden = true;
        if (needlepointEmptyNote) needlepointEmptyNote.hidden = true;
        if (needlepointPicker) needlepointPicker.hidden = true;
        window.HandlerWeaveLivePanel?.render?.(null);
        return;
      }
      let pulled;
      try {
        pulled = await remote.pullState();
      } catch (error) {
        setStatus(error?.message || "Could not read Cell/Operation state.", true);
        return;
      }
      latestOperation = pulled?.operation || null;
      latestCellStatus = pulled?.session?.status || "";
      const status = latestOperation?.status;
      if (operationStatusNote) {
        operationStatusNote.textContent = latestOperation
          ? `Operation ${latestOperation.sequence} · ${status.toUpperCase()} · Round ${latestOperation.round}`
          : `Cell is ${latestCellStatus.toUpperCase() || "OPEN"} — no Operation started yet.`;
      }
      const canStart = !status || status === "archived";
      if (startOperationBtn) startOperationBtn.hidden = !canStart;
      if (suspendOperationBtn) suspendOperationBtn.hidden = !(status === "active" || status === "resolving");
      if (resumeOperationBtn) resumeOperationBtn.hidden = status !== "suspended";

      // Every Operation now requires a durable Needlepoint (see
      // 20260803140000_cell_operations_needlepoint_id.sql) -- the free-text case field this
      // used to be is retired. Populate the picker only while Start Operation is actually
      // reachable, so this never fires an extra round trip mid-play.
      if (canStart && needlepointPicker && needlepointSelect) {
        const cellId = remote.currentConnection()?.sessionId;
        if (needlepointWeaveLink) needlepointWeaveLink.href = `../weave/?cell=${encodeURIComponent(cellId || "")}`;
        const entries = cellId ? await loadStartableNeedlepoints(cellId) : [];
        if (entries.length) {
          needlepointSelect.innerHTML = entries.map((e) => `<option value="${e.id}">${api.safeString(e.label, 200)}</option>`).join("");
          needlepointPicker.hidden = false;
          if (needlepointEmptyNote) needlepointEmptyNote.hidden = true;
          if (startOperationBtn) startOperationBtn.disabled = false;
        } else {
          needlepointPicker.hidden = true;
          if (needlepointEmptyNote) needlepointEmptyNote.hidden = false;
          if (startOperationBtn) startOperationBtn.disabled = true;
        }
      } else {
        if (needlepointPicker) needlepointPicker.hidden = true;
        if (needlepointEmptyNote) needlepointEmptyNote.hidden = true;
      }

      // Weave dock: Known Threads / pull-in / published-Clues reference for whatever
      // Operation is now current. Passed the operation object directly (already has its own
      // needlepoint.weave_id embed from this same pull) rather than making the panel
      // re-fetch it itself.
      window.HandlerWeaveLivePanel?.render?.(latestOperation);
    }

    if (startOperationBtn) {
      startOperationBtn.addEventListener("click", async () => {
        const remote = window.VeilDaemonCellRemote;
        if (!remote?.isConnected()) return;
        const needlepointId = needlepointSelect?.value || "";
        if (!needlepointId) {
          setStatus("Choose a Needlepoint before starting an Operation.", true);
          return;
        }
        let state = api.readState();
        try {
          const response = await remote.startOperation({
            needlepointId,
            mission: state.session?.location || "",
          });
          // Reset per-Operation local state (round, live scene/attention, Track Prompt
          // queue, reward decisions, archive token) and carry forward Cell-scoped campaign
          // material (NPCs, entity library, notes, clue integrity) -- see
          // transitionToNewOperation's own doc comment for the exact split and rationale.
          state = window.HandlerState.transitionToNewOperation(api.readState(), response?.operation?.id);
          state = api.writeState(state, "New Operation started.");
          remote.setActiveOperationId?.(response?.operation?.id || null);
          // Chat is scoped by (cellId, operationId) -- a new Operation means a new topic, so
          // the prior Operation's (or lobby's) buffer must never leak into this one. Same
          // unsubscribe -> clear -> resubscribe sequence switchToCell uses for a full Cell
          // switch, just triggered by an Operation change within the same Cell.
          unsubscribeChatIfAny();
          clearChatBuffer();
          subscribeChatIfConnected();
          setStatus("Operation started.");
        } catch (error) {
          setStatus(error?.message || "Could not start Operation.", true);
        }
        renderOperationLifecycle();
      });
    }
    if (suspendOperationBtn) {
      suspendOperationBtn.addEventListener("click", async () => {
        const remote = window.VeilDaemonCellRemote;
        if (!remote?.isConnected()) return;
        if (!window.confirm("Suspend Operation? Writes a checkpoint and leaves the Cell intact -- pick up again later with Resume Operation.")) return;
        try {
          // Same reasoning as Archive: the checkpoint must capture the truly-current state,
          // not whatever happened to have already reconciled before the debounce settled.
          await flushOperationSync();
          await remote.suspendOperation();
          setStatus("Operation suspended. Round advancement and declarations are paused; lobby, chat, and reward review stay open.");
        } catch (error) {
          setStatus(error?.message || "Could not suspend Operation.", true);
        }
        renderOperationLifecycle();
      });
    }
    if (resumeOperationBtn) {
      resumeOperationBtn.addEventListener("click", async () => {
        const remote = window.VeilDaemonCellRemote;
        if (!remote?.isConnected()) return;
        try {
          await remote.resumeOperation();
          setStatus("Operation resumed.");
        } catch (error) {
          setStatus(error?.message || "Could not resume Operation.", true);
        }
        renderOperationLifecycle();
      });
    }

    // --- Cell lifecycle: Save / Export / Close. Close is its OWN control, deliberately not
    // reachable from the Archive Session button above -- the server itself refuses close-cell
    // while a non-archived Operation exists, but the UI shouldn't even invite the mistake. ---
    const lifecycleOutput = document.getElementById("cell-lifecycle-output");
    const saveCellBtn = document.getElementById("cell-lifecycle-save");
    const exportSnapshotBtn = document.getElementById("cell-lifecycle-export");
    const closeCellBtn = document.getElementById("cell-lifecycle-close");

    function setLifecycleOutput(message, isError) {
      if (lifecycleOutput) {
        lifecycleOutput.textContent = message;
        lifecycleOutput.classList.toggle("is-error", Boolean(isError));
      }
    }

    if (saveCellBtn) {
      saveCellBtn.addEventListener("click", async () => {
        const remote = window.VeilDaemonCellRemote;
        if (!remote?.isConnected()) return setLifecycleOutput("Connect a Cell first.", true);
        try {
          const data = await remote.saveCell();
          setLifecycleOutput(`Checkpoint saved · revision ${data.checkpoint.revision}.`);
        } catch (error) {
          setLifecycleOutput(error?.message || "Could not save Cell.", true);
        }
      });
    }
    if (exportSnapshotBtn) {
      exportSnapshotBtn.addEventListener("click", async () => {
        const remote = window.VeilDaemonCellRemote;
        if (!remote?.isConnected()) return setLifecycleOutput("Connect a Cell first.", true);
        try {
          const snapshot = await remote.exportSnapshot();
          const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `veildaemon-cell-${snapshot.cellId}-rev${snapshot.revision}.json`;
          a.click();
          URL.revokeObjectURL(url);
          setLifecycleOutput(`Snapshot exported · revision ${snapshot.revision} · checksum ${snapshot.checksum.slice(0, 12)}…`);
        } catch (error) {
          setLifecycleOutput(error?.message || "Could not export snapshot.", true);
        }
      });
    }
    if (closeCellBtn) {
      closeCellBtn.addEventListener("click", async () => {
        const remote = window.VeilDaemonCellRemote;
        if (!remote?.isConnected()) return setLifecycleOutput("Connect a Cell first.", true);
        if (!window.confirm("CELL CLOSED -- Lobby ended. This is separate from archiving an Operation and cannot be undone. Continue?")) return;
        try {
          await remote.closeCell();
          setLifecycleOutput("CELL CLOSED — lobby ended.");
        } catch (error) {
          setLifecycleOutput(error?.message || "Could not close Cell (archive the current Operation first if one is active).", true);
        }
        renderOperationLifecycle();
      });
    }

    // --- Cell-scoped chat --- (a <div>, not a <form>: this whole page is already inside
    // #handler-form, and a nested <form> would be silently dropped by the HTML parser)
    // Ephemeral to the current Cell+Operation -- delivered via Realtime Broadcast, never a
    // cell_events row (see cell-sync-remote.js's chat section and handleSendChat's own
    // comment). unsubscribeChatIfAny/clearChatBuffer/subscribeChatIfConnected are exposed on
    // window.HandlerCellSync below for handler.js's switchToCell (full Cell switch) and the
    // Operation-lifecycle handlers here (start/archive -- same topic-scoping rule applies
    // within one Cell, since the topic includes operationId) to call at the exact points they
    // already discard/re-establish every other Cell-scoped transient subscription.
    const chatList = document.getElementById("cell-chat-list");
    const chatSendBtn = document.getElementById("cell-chat-send");
    const chatInput = document.getElementById("cell-chat-input");
    let unsubscribeChat = null;

    function renderChat() {
      if (!chatList) return;
      const remote = window.VeilDaemonCellRemote;
      const messages = remote?.listChatMessages ? remote.listChatMessages() : [];
      if (!messages.length) {
        chatList.innerHTML = `<p class="cell-chat-empty">No messages yet.</p>`;
        return;
      }
      chatList.innerHTML = messages.slice(-100).map((message) => {
        const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
        return `<div class="cell-chat-line"><strong>${api.safeString(message.senderName, 80)}</strong> <time>${time}</time><p>${api.safeString(message.text, 2000)}</p></div>`;
      }).join("");
      chatList.scrollTop = chatList.scrollHeight;
    }

    async function sendChat() {
      const remote = window.VeilDaemonCellRemote;
      const text = (chatInput?.value || "").trim();
      if (!text || !remote?.isConnected()) return;
      try {
        await remote.sendChatMessage(text);
        if (chatInput) chatInput.value = "";
        renderChat();
      } catch (error) {
        setStatus(error?.message || "Chat message failed to send.", true);
      }
    }
    if (chatSendBtn) chatSendBtn.addEventListener("click", sendChat);
    if (chatInput) {
      chatInput.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          evt.preventDefault();
          sendChat();
        }
      });
    }

    function subscribeChatIfConnected() {
      if (unsubscribeChat) return;
      const remote = window.VeilDaemonCellRemote;
      if (!remote?.isConnected() || !remote.subscribeToChat) return;
      unsubscribeChat = remote.subscribeToChat(() => renderChat());
      renderChat();
    }
    function unsubscribeChatIfAny() {
      if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
      }
    }
    function clearChatBuffer() {
      window.VeilDaemonCellRemote?.clearChatBuffer?.();
      renderChat();
    }

    const ROLL_FEED_COLLAPSED_COUNT = 2;
    let rollFeedExpanded = false;

    function renderRollFeed() {
      const panel = document.querySelector(".roll-feed-panel");
      const container = document.getElementById("roll-feed-list");
      const badge = document.getElementById("roll-feed-badge");
      const expandBtn = document.getElementById("roll-feed-expand-btn");
      if (!container) return;
      const rolls = window.VeilDaemonCellSync?.listRollFeed?.() || [];
      if (badge) {
        badge.textContent = `${rolls.length} ROLL${rolls.length === 1 ? "" : "S"}`;
      }
      if (panel) panel.classList.toggle("is-expanded", rollFeedExpanded);
      if (expandBtn) {
        const hasOverflow = rolls.length > ROLL_FEED_COLLAPSED_COUNT;
        expandBtn.hidden = !hasOverflow;
        expandBtn.textContent = rollFeedExpanded ? "Collapse" : `Expand (${rolls.length})`;
      }
      if (!rolls.length) {
        container.innerHTML = `<p class="roll-feed-empty">No Operator rolls recorded yet in this session.</p>`;
        return;
      }
      const reversed = rolls.slice().reverse();
      const visible = rollFeedExpanded ? reversed : reversed.slice(0, ROLL_FEED_COLLAPSED_COUNT);
      container.innerHTML = visible.map((item) => {
        const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
        const diceStr = Array.isArray(item.keptDice) && item.keptDice.length ? item.keptDice.join("+") : (Array.isArray(item.dice) ? item.dice.join("+") : "");
        return `
          <article class="roll-feed-card">
            <div class="roll-feed-header">
              <strong class="roll-feed-name">${api.safeString(item.name || item.operatorKey, 80)}</strong>
              <span class="roll-feed-type">${api.safeString(item.rollType || "Check", 60)}</span>
              <time class="roll-feed-time">${timeStr}</time>
            </div>
            <div class="roll-feed-body">
              <div class="roll-feed-result-line">
                <span class="roll-feed-total">TOTAL ${item.total}</span>
                <span class="roll-feed-mode">${api.safeString(item.rollMode, 20)} (${diceStr})</span>
              </div>
              <p class="roll-feed-summary">${api.safeString(item.summary, 300)}</p>
            </div>
          </article>
        `;
      }).join("");
    }

    const rollFeedExpandBtn = document.getElementById("roll-feed-expand-btn");
    if (rollFeedExpandBtn) {
      rollFeedExpandBtn.addEventListener("click", () => {
        rollFeedExpanded = !rollFeedExpanded;
        renderRollFeed();
      });
    }

    const statusLine = document.getElementById("cell-sync-status");
    function refreshHint() {
      renderRollFeed();
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
    renderOperationLifecycle();
    renderChat();
    window.setInterval(refreshHint, 4000);
    window.setInterval(renderOperationLifecycle, 6000);
    window.VeilDaemonCellSync?.onUpdate?.(refreshHint);

    window.HandlerCellSync = {
      syncKind, resolveLateSend, refreshHint, pendingPrompts, buildRoundAdvanceSummary,
      renderOperationLifecycle, renderChat, flushOperationSync, buildOperationStatePatch,
      subscribeChatIfConnected, unsubscribeChatIfAny, clearChatBuffer,
      getLatestOperation: () => latestOperation,
    };
  }

  window.HandlerCellSync = {
    bind, syncKind, resolveLateSend, pendingPrompts, buildRoundAdvanceSummary,
    flushOperationSync, buildOperationStatePatch,
    getLatestOperation: () => null,
  };
}());
