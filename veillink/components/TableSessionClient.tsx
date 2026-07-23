"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FREQUENCIES, defaultLiveState, type LiveState } from "@/lib/table/state";

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

type SyncKind = "pressure_round" | "cell" | "archive";

/**
 * Deliberate sync only — no polling, no WebSockets.
 * Local edits queue until:
 * - Operator: Send to Cell
 * - Handler: End Pressure Round | Sync Cell | Archive Session
 */
export function TableSessionClient({ sessionId }: { sessionId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  /** seatId → local draft (authoritative UI until next deliberate sync) */
  const [drafts, setDrafts] = useState<Record<string, LiveState>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);

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

  function updateDraft(seatId: string, patch: Partial<LiveState>) {
    setDrafts((prev) => {
      const base = prev[seatId] || defaultLiveState();
      return { ...prev, [seatId]: defaultLiveState({ ...base, ...patch, lotus: { ...base.lotus, ...(patch.lotus || {}) } }) };
    });
    setDirty((prev) => ({ ...prev, [seatId]: true }));
  }

  async function pushDrafts(seatIds: string[]) {
    for (const seatId of seatIds) {
      if (!dirty[seatId] || !drafts[seatId]) continue;
      const res = await fetch(`/api/table/sessions/${sessionId}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionOperatorStateId: seatId, patch: drafts[seatId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
    }
  }

  async function operatorSendToCell(seatId: string) {
    setBusy(true);
    setError("");
    try {
      await pushDrafts([seatId]);
      setFlash("State sent to Cell.");
      setTimeout(() => setFlash(""), 2000);
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
        // Push any Handler drafts first, then archive
        const dirtyIds = Object.keys(dirty).filter((id) => dirty[id]);
        await pushDrafts(dirtyIds);
        const res = await fetch(`/api/table/sessions/${sessionId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Archive failed");
        setFlash(`Archive Session complete. Reconciled ${data.reconciled} Operator file(s).`);
        await load();
        return;
      }

      const dirtyIds = Object.keys(dirty).filter((id) => dirty[id]);
      await pushDrafts(dirtyIds);
      await load();
      if (kind === "pressure_round") {
        setFlash("Pressure Round ended. Cell snapshot updated. Reactions refresh next round.");
      } else {
        setFlash("Cell synced. Authoritative snapshot loaded.");
      }
      setTimeout(() => setFlash(""), 2800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function leave(seatId: string) {
    setBusy(true);
    try {
      if (dirty[seatId]) await pushDrafts([seatId]);
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

  return (
    <div className="table-session">
      <header className="session-top">
        <div>
          <p className="eyebrow">
            Handler lobby · {bundle.session.status}
            {bundle.role === "operator" ? " · Operator seat" : ""}
          </p>
          <h1 className="page-title" style={{ marginBottom: "0.35rem" }}>
            {bundle.session.join_code}
          </h1>
          <p className="muted">
            {bundle.session.needlepoint || "No Needlepoint"} · {bundle.session.mission || "No mission note"}
          </p>
          {bundle.role === "handler" ? <p className="mono small">{joinUrl}</p> : null}
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
        </p>

        {bundle.role === "handler" && bundle.session.status === "open" ? (
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

        {bundle.role === "handler" ? (
          <p className="muted small">
            <strong>End Pressure Round</strong> — tactical boundary (reactions refresh next round).{" "}
            <strong>Sync Cell</strong> — investigation / social.{" "}
            <strong>Archive Session</strong> — mission end, write back to Operator files.
          </p>
        ) : (
          <p className="muted small">
            Edit locally. Use <strong>Send to Cell</strong> so your sheet is on the server before the Handler ends a
            Pressure Round or syncs.
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
            const canEdit = bundle.session.status === "open" && (bundle.role === "handler" || isMine);
            return (
              <article key={seat.id} className="card seat-card">
                <header className="seat-head">
                  <div>
                    <h2>{label}</h2>
                    <p className="muted small">{designation || seat.operator_profile_id.slice(0, 8)}</p>
                  </div>
                  <div className="seat-head-actions">
                    {bundle.role === "operator" && isMine && bundle.session.status === "open" ? (
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
                    disabled={!canEdit || busy}
                    onDelta={(d) => updateDraft(seat.id, { harm: state.harm + d })}
                  />
                  <Stat
                    label="Stability"
                    value={state.stability}
                    disabled={!canEdit || busy}
                    onDelta={(d) => updateDraft(seat.id, { stability: state.stability + d })}
                  />
                  <Stat
                    label="Breach"
                    value={state.breach}
                    disabled={!canEdit || busy}
                    onDelta={(d) => updateDraft(seat.id, { breach: state.breach + d })}
                    big
                  />
                  <Stat
                    label="Void"
                    value={state.voidMarks}
                    disabled={!canEdit || busy}
                    onDelta={(d) => updateDraft(seat.id, { voidMarks: state.voidMarks + d })}
                    big
                  />
                </div>

                <section className="lotus-block">
                  <p className="eyebrow">Lotus pips · 5 cultivable · Blind: {state.blindPetal}</p>
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
                          <div className="mini-actions">
                            <button
                              type="button"
                              disabled={!canEdit || busy || blind}
                              onClick={() =>
                                updateDraft(seat.id, { lotus: { ...state.lotus, [f]: state.lotus[f] + 1 } })
                              }
                            >
                              +
                            </button>
                            <button
                              type="button"
                              disabled={!canEdit || busy || blind}
                              onClick={() =>
                                updateDraft(seat.id, { lotus: { ...state.lotus, [f]: state.lotus[f] - 1 } })
                              }
                            >
                              −
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <label className="note-field">
                  Handler note / prompt
                  <textarea
                    value={state.handlerNote}
                    disabled={!canEdit || busy || bundle.role !== "handler"}
                    onChange={(e) => updateDraft(seat.id, { handlerNote: e.target.value })}
                    rows={3}
                    maxLength={500}
                  />
                </label>
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
}: {
  label: string;
  value: number;
  onDelta: (d: number) => void;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <div className={big ? "stat big" : "stat"}>
      <span>{label}</span>
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
