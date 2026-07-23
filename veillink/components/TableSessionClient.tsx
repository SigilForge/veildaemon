"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FREQUENCIES,
  defaultLiveState,
  filterPatchForSyncKind,
  type LiveState,
  type SyncKind,
} from "@/lib/table/state";

type Seat = {
  id: string;
  owner_user_id: string;
  operator_profile_id: string;
  live_state: LiveState | Record<string, unknown>;
  last_mutated_at: string;
  operator_profiles?: { display_name: string; designation: string } | null;
};

type Bundle = {
  session: {
    id: string;
    join_code: string;
    status: string;
    needlepoint: string;
    mission: string;
    handler_user_id: string;
    max_operators?: number | null;
  };
  states: Seat[];
  role: "handler" | "operator";
  userId: string;
};

/**
 * Deliberate sync only — no polling, no WebSockets.
 *
 * Payload boundaries (client + server whitelist):
 *   pressure_round / operator_send → harm, stability, conditions (recovery notes)
 *   cell                           → above + handlerNote
 *   archive                        → breach, voidMarks, unlocks (+ final harm/stability)
 *
 * Lotus is between-sessions: displayed read-only, never editable in live session.
 */
export function TableSessionClient({ sessionId }: { sessionId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  /** seatId → local draft (authoritative UI until next deliberate sync) */
  const [drafts, setDrafts] = useState<Record<string, LiveState>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  /** Local tactical counter — End Pressure Round advances; Sync Cell does not. */
  const [pressureRound, setPressureRound] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/table/sessions/${sessionId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load session");
    setBundle(data as Bundle);
    const nextDrafts: Record<string, LiveState> = {};
    for (const seat of (data as Bundle).states || []) {
      nextDrafts[seat.id] = defaultLiveState(seat.live_state as Partial<LiveState>);
    }
    setDrafts(nextDrafts);
    setDirty({});
  }, [sessionId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  function seatLabel(seat: Seat): string {
    return (
      seat.operator_profiles?.display_name ||
      (seat.owner_user_id === bundle?.userId ? "You" : "Operator")
    );
  }

  /** Mid-round draft edits only — Lotus / banks ignored even if sneaked into patch. */
  function updateDraft(seatId: string, patch: Partial<LiveState>) {
    const {
      lotus: _l,
      frequencyPips: _f,
      blindPetal: _b,
      breach: _br,
      voidMarks: _v,
      unlocks: _u,
      ...midRound
    } = patch;
    setDrafts((prev) => {
      const base = prev[seatId] || defaultLiveState();
      return {
        ...prev,
        [seatId]: defaultLiveState({
          ...base,
          ...midRound,
          // Preserve Lotus / banks from base unless archive editor uses updateArchiveDraft
          lotus: base.lotus,
          blindPetal: base.blindPetal,
          breach: base.breach,
          voidMarks: base.voidMarks,
          unlocks: base.unlocks,
        }),
      };
    });
    setDirty((prev) => ({ ...prev, [seatId]: true }));
  }

  /** Archive-only bank / unlock edits. Still cannot touch Lotus. */
  function updateArchiveDraft(seatId: string, patch: Partial<LiveState>) {
    const { lotus: _l, frequencyPips: _f, blindPetal: _b, ...rest } = patch;
    setDrafts((prev) => {
      const base = prev[seatId] || defaultLiveState();
      return {
        ...prev,
        [seatId]: defaultLiveState({
          ...base,
          ...rest,
          lotus: base.lotus,
          blindPetal: base.blindPetal,
        }),
      };
    });
    setDirty((prev) => ({ ...prev, [seatId]: true }));
  }

  async function pushDrafts(seatIds: string[], kind: SyncKind) {
    for (const seatId of seatIds) {
      if (!dirty[seatId] || !drafts[seatId]) continue;
      const full = drafts[seatId];
      // Structural whitelist — same helper the server re-applies.
      const patch = filterPatchForSyncKind(kind, full);
      const res = await fetch(`/api/table/sessions/${sessionId}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionOperatorStateId: seatId,
          patch,
          syncKind: kind,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
    }
  }

  async function operatorSendToCell(seatId: string) {
    setBusy(true);
    setError("");
    try {
      await pushDrafts([seatId], "operator_send");
      setFlash("Sent to Cell — Harm, Stability, recovery notes. Lotus not transmitted.");
      setTimeout(() => setFlash(""), 2400);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlerSync(kind: SyncKind) {
    setBusy(true);
    setError("");
    try {
      if (kind === "archive") {
        if (bundle?.session?.status === "closed") {
          setFlash("Archive already complete — session is closed.");
          setTimeout(() => setFlash(""), 2800);
          return;
        }
        const dirtyIds = Object.keys(dirty).filter((id) => dirty[id]);
        await pushDrafts(dirtyIds, "archive");
        const res = await fetch(`/api/table/sessions/${sessionId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Archive failed");
        const count = Number(data.reconciled) || 0;
        setFlash(
          count
            ? `Archive Session complete. Reconciled ${count} Operator file(s). Void/Breach once. Lotus unchanged (between sessions).`
            : "Archive already complete — no additional bank reconciliation.",
        );
        await load();
        return;
      }

      const dirtyIds = Object.keys(dirty).filter((id) => dirty[id]);
      await pushDrafts(dirtyIds, kind);
      await load();

      if (kind === "pressure_round") {
        const nextRound = pressureRound + 1;
        setPressureRound(nextRound);
        setFlash(
          `Pressure Round ${nextRound} ended. Payload: Harm, Stability, recovery notes. Reactions refresh next round.`,
        );
      } else {
        setFlash(
          "Cell synced. Payload: Harm, Stability, recovery notes, Handler note. Not a tactical round end.",
        );
      }
      setTimeout(() => setFlash(""), 3200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function leave(seatId: string) {
    setBusy(true);
    try {
      if (dirty[seatId]) await pushDrafts([seatId], "operator_send");
      const res = await fetch(`/api/table/sessions/${sessionId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionOperatorStateId: seatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Leave failed");
      window.location.href = "/table";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const joinUrl = useMemo(() => {
    if (!bundle || typeof window === "undefined") return "";
    return `${window.location.origin}/table/join?code=${bundle.session.join_code}`;
  }, [bundle]);

  if (!bundle) {
    return <p className="muted">{error || "Loading lobby…"}</p>;
  }

  const connected = bundle.states;
  const pendingCount = Object.values(dirty).filter(Boolean).length;
  const isHandler = bundle.role === "handler";
  const sessionOpen = bundle.session.status === "open";

  return (
    <div className="table-session">
      <header className="session-top">
        <div>
          <p className="eyebrow">
            Handler lobby · {bundle.session.status}
            {bundle.role === "operator" ? " · Operator seat" : ""}
            {pressureRound > 0 ? ` · Pressure Round ${pressureRound}` : ""}
          </p>
          <h1 className="page-title" style={{ marginBottom: "0.35rem" }}>
            {bundle.session.join_code}
          </h1>
          <p className="muted">
            {bundle.session.needlepoint || "No Needlepoint"} · {bundle.session.mission || "No mission note"}
          </p>
          {isHandler ? <p className="mono small">{joinUrl}</p> : null}
        </div>
        <div className="session-actions">
          <Link className="button ghost" href="/table">
            Hub
          </Link>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {flash ? <p className="flash-ok">{flash}</p> : null}

      <section className="card lobby-panel">
        <p className="eyebrow">Connected Operators</p>
        {connected.length === 0 ? (
          <p className="muted">Waiting for Operators to join…</p>
        ) : (
          <ul className="connected-list">
            {connected.map((seat) => {
              const label = seatLabel(seat);
              const designation = seat.operator_profiles?.designation;
              return (
                <li key={seat.id}>
                  <span className="check">✓</span>
                  <strong>{label}</strong>
                  {designation ? <span className="muted small"> · {designation}</span> : null}
                  {dirty[seat.id] ? <span className="pending-tag">local changes</span> : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted small">
          {connected.length} connected
          {bundle.session.max_operators != null ? ` · lobby cap ${bundle.session.max_operators}` : ""}
          {pendingCount ? ` · ${pendingCount} seat(s) with unsent local edits` : ""}
          {pressureRound ? ` · Pressure Round ${pressureRound}` : ""}
        </p>

        {isHandler && sessionOpen ? (
          <div className="lobby-actions">
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={() => handlerSync("pressure_round")}
            >
              End Pressure Round
            </button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => handlerSync("cell")}>
              Sync Cell
            </button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => handlerSync("archive")}>
              Archive Session
            </button>
          </div>
        ) : null}

        {isHandler ? (
          <p className="muted small">
            <strong>End Pressure Round</strong> — advances the local Pressure Round counter; whitelist: Harm,
            Stability, recovery notes.{" "}
            <strong>Sync Cell</strong> — same mid-round exchange <em>plus</em> Handler note; does not advance the
            round.{" "}
            <strong>Archive Session</strong> — Void, Breach, unlocks (once). Lotus is between sessions and never
            mutates here.
          </p>
        ) : (
          <p className="muted small">
            Edit Harm / Stability / recovery notes locally. <strong>Send to Cell</strong> uploads only those fields.
            Recovery resolves on your Operator sheet first. Lotus purchases are between sessions.
          </p>
        )}
      </section>

      {!connected.length ? null : (
        <div className="seat-grid">
          {connected.map((seat) => {
            const state = drafts[seat.id] || defaultLiveState(seat.live_state as Partial<LiveState>);
            const label = seatLabel(seat);
            const designation = seat.operator_profiles?.designation || "";
            const isMine = seat.owner_user_id === bundle.userId;
            const canEditMid = sessionOpen && (isHandler || isMine);
            const canEditArchiveBanks = sessionOpen && isHandler;
            return (
              <article key={seat.id} className="card seat-card">
                <header className="seat-head">
                  <div>
                    <h2>{label}</h2>
                    <p className="muted small">{designation || seat.operator_profile_id.slice(0, 8)}</p>
                  </div>
                  <div className="seat-head-actions">
                    {bundle.role === "operator" && isMine && sessionOpen ? (
                      <>
                        <button
                          className="button secondary"
                          type="button"
                          disabled={busy || !dirty[seat.id]}
                          onClick={() => operatorSendToCell(seat.id)}
                        >
                          Send to Cell
                        </button>
                        <button className="button ghost" type="button" disabled={busy} onClick={() => leave(seat.id)}>
                          Leave
                        </button>
                      </>
                    ) : null}
                  </div>
                </header>

                <div className="stat-row">
                  <Stat
                    label="Harm"
                    value={state.harm}
                    disabled={!canEditMid || busy}
                    onDelta={(d) => updateDraft(seat.id, { harm: state.harm + d })}
                  />
                  <Stat
                    label="Stability"
                    value={state.stability}
                    disabled={!canEditMid || busy}
                    onDelta={(d) => updateDraft(seat.id, { stability: state.stability + d })}
                  />
                  <Stat
                    label="Breach"
                    value={state.breach}
                    disabled={!canEditArchiveBanks || busy}
                    onDelta={(d) => updateArchiveDraft(seat.id, { breach: state.breach + d })}
                    big
                    hint="Archive only"
                  />
                  <Stat
                    label="Void"
                    value={state.voidMarks}
                    disabled={!canEditArchiveBanks || busy}
                    onDelta={(d) => updateArchiveDraft(seat.id, { voidMarks: state.voidMarks + d })}
                    big
                    hint="Archive only"
                  />
                </div>

                <label className="note-field">
                  Recovery notes / declared recovery
                  <textarea
                    value={(state.conditions || []).join("\n")}
                    disabled={!canEditMid || busy}
                    onChange={(e) =>
                      updateDraft(seat.id, {
                        conditions: e.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .slice(0, 20),
                      })
                    }
                    rows={2}
                    maxLength={500}
                    placeholder="e.g. Ground declared · Treat Harm pending"
                  />
                </label>

                {isHandler ? (
                  <label className="note-field">
                    Handler note / prompt
                    <textarea
                      value={state.handlerNote}
                      disabled={!canEditMid || busy}
                      onChange={(e) => updateDraft(seat.id, { handlerNote: e.target.value })}
                      rows={2}
                      maxLength={500}
                    />
                    <span className="muted small">Transmitted on Sync Cell / Archive — not End Pressure Round.</span>
                  </label>
                ) : state.handlerNote ? (
                  <p className="muted small">Handler note: {state.handlerNote}</p>
                ) : null}

                <section className="lotus-block lotus-readonly">
                  <p className="eyebrow">Lotus · between sessions · Blind: {state.blindPetal}</p>
                  <div className="freq-grid">
                    {FREQUENCIES.map((f) => {
                      const blind = f === state.blindPetal;
                      return (
                        <div key={f} className={blind ? "freq-cell blind" : "freq-cell"}>
                          <span>
                            {f}
                            {blind ? " · Blind" : ""}
                          </span>
                          <strong>{blind ? 0 : state.lotus[f]}</strong>
                        </div>
                      );
                    })}
                  </div>
                  <p className="muted small">Read-only. Petal purchases happen between sessions, not mid-table.</p>
                </section>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  onDelta,
  disabled,
  big,
  hint,
}: {
  label: string;
  value: number;
  onDelta: (d: number) => void;
  disabled?: boolean;
  big?: boolean;
  hint?: string;
}) {
  return (
    <div className={big ? "stat big" : "stat"}>
      <span>
        {label}
        {hint ? <em className="stat-hint"> · {hint}</em> : null}
      </span>
      <strong>{value}</strong>
      <div className="mini-actions">
        <button type="button" disabled={disabled} onClick={() => onDelta(1)}>
          +
        </button>
        {big ? (
          <>
            <button type="button" disabled={disabled} onClick={() => onDelta(2)}>
              +2
            </button>
            <button type="button" disabled={disabled} onClick={() => onDelta(-1)}>
              −
            </button>
          </>
        ) : (
          <button type="button" disabled={disabled} onClick={() => onDelta(-1)}>
            −
          </button>
        )}
      </div>
    </div>
  );
}
