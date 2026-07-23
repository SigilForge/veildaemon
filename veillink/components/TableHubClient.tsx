"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FREQUENCIES, type Frequency } from "@/lib/table/state";

type Operator = {
  id: string;
  display_name: string;
  designation: string;
  updated_at: string;
};

export function TableHubClient({ initialJoinCode = "" }: { initialJoinCode?: string }) {
  const router = useRouter();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [blindPetal, setBlindPetal] = useState<Frequency>("Silence");
  const [joinCode, setJoinCode] = useState((initialJoinCode || "").toUpperCase());
  const [selectedOp, setSelectedOp] = useState("");
  const [needlepoint, setNeedlepoint] = useState("Needlepoint 001");
  const [mission, setMission] = useState("");
  const [maxOperators, setMaxOperators] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdJoin, setCreatedJoin] = useState<{ code: string; url: string; id: string } | null>(null);

  const loadOperators = useCallback(async () => {
    const res = await fetch("/api/table/operators");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load operators");
    setOperators(data.operators || []);
    if (data.operators?.[0]?.id) setSelectedOp((curr) => curr || data.operators[0].id);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/table/operators");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load operators");
        if (!active) return;
        setOperators(data.operators || []);
        if (data.operators?.[0]?.id) setSelectedOp((curr) => curr || data.operators[0].id);
      } catch (e) {
        if (active && e instanceof Error) setError(e.message);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  async function createOperator(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/table/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, designation, blindPetal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setName("");
      setDesignation("");
      await loadOperators();
      setSelectedOp(data.operator.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/table/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          needlepoint,
          mission,
          maxOperators: maxOperators.trim() === "" ? null : Number(maxOperators),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session create failed");
      setCreatedJoin({
        code: data.session.join_code,
        url: data.joinUrl,
        id: data.session.id,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function joinAsOperator(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOp) {
      setError("Select an Operator file first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/table/sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode, operatorProfileId: selectedOp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Join failed");
      router.push(`/table/session/${data.session.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="table-hub">
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="card table-card">
        <p className="eyebrow">1 · Operator file</p>
        <h2>Persistent Archive record</h2>
        <p className="muted">Account-owned. Survives between missions.</p>
        <form className="stack-form" onSubmit={createOperator}>
          <label>
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Cathy Holloway" />
          </label>
          <label>
            Designation
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={40} placeholder="Knox-07" />
          </label>
          <label>
            Blind Petal (permanent)
            <select value={blindPetal} onChange={(e) => setBlindPetal(e.target.value as Frequency)} required>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">Six Lotus petals; you cultivate five. Blind Petal stays at 0 forever.</p>
          <button className="button primary" type="submit" disabled={busy}>
            Create Operator file
          </button>
        </form>
        {operators.length ? (
          <ul className="op-list">
            {operators.map((op) => (
              <li key={op.id}>
                <button
                  type="button"
                  className={selectedOp === op.id ? "op-chip active" : "op-chip"}
                  onClick={() => setSelectedOp(op.id)}
                >
                  <strong>{op.display_name}</strong>
                  <span>{op.designation || "no designation"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No Operator files yet.</p>
        )}
      </section>

      <section className="card table-card">
        <p className="eyebrow">2 · Handler session</p>
        <h2>Open a temporary table</h2>
        <p className="muted">Short code + QR. Operators join explicitly.</p>
        <form className="stack-form" onSubmit={createSession}>
          <label>
            Needlepoint
            <input value={needlepoint} onChange={(e) => setNeedlepoint(e.target.value)} maxLength={120} />
          </label>
          <label>
            Mission note
            <input value={mission} onChange={(e) => setMission(e.target.value)} maxLength={200} placeholder="First contact intake" />
          </label>
          <label>
            Lobby seat cap (optional)
            <input
              type="number"
              min={1}
              max={32}
              value={maxOperators}
              onChange={(e) => setMaxOperators(e.target.value)}
              placeholder="Leave empty for no cap"
            />
          </label>
          <p className="muted small">Only set if you want a fixed table size (e.g. 4 or 6). Empty = uncapped.</p>
          <button className="button primary" type="submit" disabled={busy}>
            Create Handler session
          </button>
        </form>
        {createdJoin ? (
          <div className="join-panel">
            <p className="join-code">{createdJoin.code}</p>
            <p className="muted">Share this code or QR join URL with Operators.</p>
            <p className="mono small">{createdJoin.url}</p>
            <Link className="button secondary" href={`/table/session/${createdJoin.id}`}>
              Open Handler live view
            </Link>
          </div>
        ) : null}
      </section>

      <section className="card table-card">
        <p className="eyebrow">3 · Operator join</p>
        <h2>Link file to session</h2>
        <form className="stack-form" onSubmit={joinAsOperator}>
          <label>
            Join code
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              minLength={6}
              required
              placeholder="AB12CD"
              className="code-input"
            />
          </label>
          <p className="muted small">
            Selected file: {operators.find((o) => o.id === selectedOp)?.display_name || "none"}
          </p>
          <button className="button primary" type="submit" disabled={busy || !selectedOp}>
            Join session
          </button>
        </form>
      </section>
    </div>
  );
}
