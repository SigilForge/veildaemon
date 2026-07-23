"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase";
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
  };
  states: Seat[];
  role: "handler" | "operator";
  userId: string;
};

export function TableSessionClient({ sessionId }: { sessionId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/table/sessions/${sessionId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load session");
    setBundle(data);
  }, [sessionId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  // Realtime + light polling fallback
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`table-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_operator_state",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          load().catch(() => undefined);
        },
      )
      .subscribe();

    const poll = setInterval(() => {
      load().catch(() => undefined);
    }, 4000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [sessionId, load]);

  async function patch(seatId: string, patch: Partial<LiveState>, label: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/table/sessions/${sessionId}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionOperatorStateId: seatId, patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setFlash(label);
      setTimeout(() => setFlash(""), 1800);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function leave(seatId: string) {
    setBusy(true);
    try {
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

  async function closeSession() {
    setBusy(true);
    try {
      const res = await fetch(`/api/table/sessions/${sessionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Close failed");
      setFlash(`Session closed. Reconciled ${data.reconciled} Operator file(s).`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const joinUrl = useMemo(() => {
    if (!bundle) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/table/join?code=${bundle.session.join_code}`;
  }, [bundle]);

  if (!bundle) {
    return <p className="muted">{error || "Loading session…"}</p>;
  }

  return (
    <div className="table-session">
      <header className="session-top">
        <div>
          <p className="eyebrow">
            {bundle.role === "handler" ? "Handler live view" : "Operator live file"} · {bundle.session.status}
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
          {bundle.role === "handler" && bundle.session.status === "open" ? (
            <button className="button secondary" type="button" disabled={busy} onClick={closeSession}>
              Close & reconcile
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {flash ? <p className="flash-ok">{flash}</p> : null}

      {!bundle.states.length ? (
        <p className="muted">Waiting for Operators to join…</p>
      ) : (
        <div className="seat-grid">
          {bundle.states.map((seat) => {
            const state = defaultLiveState(seat.live_state as Partial<LiveState>);
            const label =
              seat.operator_profiles?.display_name ||
              (seat.owner_user_id === bundle.userId ? "You" : "Operator");
            const designation = seat.operator_profiles?.designation || "";
            return (
              <article key={seat.id} className="card seat-card">
                <header className="seat-head">
                  <div>
                    <h2>{label}</h2>
                    <p className="muted small">{designation || seat.operator_profile_id.slice(0, 8)}</p>
                  </div>
                  {bundle.role === "operator" && seat.owner_user_id === bundle.userId ? (
                    <button className="button ghost" type="button" disabled={busy} onClick={() => leave(seat.id)}>
                      Leave / revoke
                    </button>
                  ) : null}
                </header>

                <div className="stat-row">
                  <Stat label="Harm" value={state.harm} onDelta={(d) => patch(seat.id, { harm: state.harm + d }, `Harm → ${state.harm + d}`)} busy={busy} />
                  <Stat label="Stability" value={state.stability} onDelta={(d) => patch(seat.id, { stability: state.stability + d }, `Stability → ${state.stability + d}`)} busy={busy} />
                  <Stat label="Breach" value={state.breach} onDelta={(d) => patch(seat.id, { breach: state.breach + d }, d > 0 ? `Award Breach +${d}` : `Breach ${d}`)} busy={busy} big />
                  <Stat label="Void" value={state.voidMarks} onDelta={(d) => patch(seat.id, { voidMarks: state.voidMarks + d }, `Void → ${state.voidMarks + d}`)} busy={busy} big />
                </div>

                <section className="lotus-block">
                  <p className="eyebrow">Lotus / Frequency pips</p>
                  <div className="freq-grid">
                    {FREQUENCIES.map((f) => (
                      <div key={f} className="freq-cell">
                        <span>{f}</span>
                        <strong>{state.lotus[f]}</strong>
                        <div className="mini-actions">
                          <button type="button" disabled={busy} onClick={() => patch(seat.id, { lotus: { ...state.lotus, [f]: state.lotus[f] + 1 } }, `${f} +1`)}>
                            +
                          </button>
                          <button type="button" disabled={busy} onClick={() => patch(seat.id, { lotus: { ...state.lotus, [f]: state.lotus[f] - 1 } }, `${f} −1`)}>
                            −
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="unlock-block">
                  <p className="eyebrow">Handler unlocks</p>
                  <div className="unlock-actions">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        patch(
                          seat.id,
                          { unlocks: { ...state.unlocks, flags: [...state.unlocks.flags, `FLAG:${Date.now()}`] } },
                          "Unlock flag awarded",
                        )
                      }
                    >
                      Award unlock flag
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        patch(
                          seat.id,
                          {
                            unlocks: {
                              ...state.unlocks,
                              frequencies: [...new Set([...state.unlocks.frequencies, "Silence"])],
                            },
                          },
                          "Frequency authorization: Silence",
                        )
                      }
                    >
                      Unlock Silence
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        patch(
                          seat.id,
                          {
                            unlocks: {
                              ...state.unlocks,
                              mythtech: [...new Set([...state.unlocks.mythtech, "Vault Interface II"])],
                            },
                          },
                          "Myth-Tech: Vault Interface II",
                        )
                      }
                    >
                      Myth-Tech cert
                    </button>
                  </div>
                  <ul className="unlock-list">
                    {state.unlocks.frequencies.map((x) => (
                      <li key={`f-${x}`}>Frequency · {x}</li>
                    ))}
                    {state.unlocks.mythtech.map((x) => (
                      <li key={`m-${x}`}>Myth-Tech · {x}</li>
                    ))}
                    {state.unlocks.traits.map((x) => (
                      <li key={`t-${x}`}>Trait · {x}</li>
                    ))}
                    {state.unlocks.flags.map((x) => (
                      <li key={`g-${x}`}>Flag · {x}</li>
                    ))}
                  </ul>
                </section>

                <label className="note-field">
                  Handler note / prompt
                  <textarea
                    value={state.handlerNote}
                    disabled={busy || bundle.role !== "handler"}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBundle((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          states: prev.states.map((s) =>
                            s.id === seat.id
                              ? { ...s, live_state: { ...defaultLiveState(s.live_state as Partial<LiveState>), handlerNote: value } }
                              : s,
                          ),
                        };
                      });
                    }}
                    onBlur={(e) => {
                      if (bundle.role === "handler") {
                        patch(seat.id, { handlerNote: e.target.value }, "Handler note updated");
                      }
                    }}
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
  busy,
  big,
}: {
  label: string;
  value: number;
  onDelta: (d: number) => void;
  busy: boolean;
  big?: boolean;
}) {
  return (
    <div className={big ? "stat big" : "stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="mini-actions">
        <button type="button" disabled={busy} onClick={() => onDelta(1)}>
          +
        </button>
        <button type="button" disabled={busy} onClick={() => onDelta(big ? 2 : -1)}>
          {big ? "+2" : "−"}
        </button>
        {!big ? null : (
          <button type="button" disabled={busy} onClick={() => onDelta(-1)}>
            −
          </button>
        )}
      </div>
    </div>
  );
}
