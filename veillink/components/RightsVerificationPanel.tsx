"use client";

import { useState } from "react";
import type { VerificationEvidence, VerificationProjection } from "@/lib/rights/verification";
import { DECLARED_CLAIM, VERIFICATION_BOUNDED_CLAIM, verificationLevelLabel } from "@/lib/rights/verification-display";

type Challenge = {
  id: string;
  method: "domain" | "github";
  target: string;
  status: string;
  expires_at: string;
  attempt_count: number;
  max_attempts: number;
};

type Proof = {
  location: string;
  path: string;
  contents: string;
};

export function RightsVerificationPanel({
  recordId,
  initialProjection,
  initialEvidence,
  initialChallenges,
}: {
  recordId: string;
  initialProjection: VerificationProjection;
  initialEvidence: VerificationEvidence[];
  initialChallenges: Challenge[];
}) {
  const [projection, setProjection] = useState(initialProjection);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [challenges, setChallenges] = useState(initialChallenges);
  const [proof, setProof] = useState<Proof | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function refresh() {
    const response = await fetch(`/api/rights/${recordId}/verification/challenges`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Verification state could not be loaded.");
    setProjection(data.projection);
    setEvidence(data.evidence);
    setChallenges(data.challenges);
  }

  async function createChallenge(formData: FormData) {
    setBusy("create");
    setMessage("");
    try {
      const response = await fetch(`/api/rights/${recordId}/verification/challenges`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: formData.get("method"),
          target: formData.get("target"),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Challenge could not be created.");
      setProof(data.proof);
      await refresh();
      setMessage("Challenge created. Publish the proof contents before leaving this page.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Challenge could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function checkChallenge(challengeId: string) {
    setBusy(challengeId);
    setMessage("");
    try {
      const response = await fetch(`/api/rights/${recordId}/verification/${challengeId}/verify`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Verification check failed.");
      await refresh();
      setMessage("Verification passed and evidence was recorded.");
    } catch (error) {
      await refresh().catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "Verification check failed.");
    } finally {
      setBusy("");
    }
  }

  async function attachIsbn(formData: FormData) {
    setBusy("isbn");
    setMessage("");
    try {
      const response = await fetch(`/api/rights/${recordId}/evidence/isbn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isbn: formData.get("isbn") }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "ISBN evidence could not be attached.");
      await refresh();
      setMessage("ISBN evidence attached. It does not verify legal ownership.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ISBN evidence could not be attached.");
    } finally {
      setBusy("");
    }
  }

  async function revoke(evidenceId: string) {
    setBusy(evidenceId);
    setMessage("");
    try {
      const response = await fetch(`/api/rights/${recordId}/verification/${evidenceId}/revoke`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Evidence could not be revoked.");
      await refresh();
      setMessage("Evidence revoked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence could not be revoked.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rights-verification panel">
      <p className="panel-kicker">Verification</p>
      <h3>{verificationLevelLabel(projection.level)}</h3>
      <p className="muted">{projection.level === "surface_verified" ? VERIFICATION_BOUNDED_CLAIM : DECLARED_CLAIM}</p>
      {projection.methods.length ? (
        <div className="proof-row">
          {projection.methods.map((method) => <span className="proof-chip" key={method}>{method.replace(/_/g, " ")}</span>)}
        </div>
      ) : null}

      <form action={createChallenge} className="rights-verification-form">
        <label>
          Method
          <select name="method" defaultValue="domain">
            <option value="domain">Domain</option>
            <option value="github">GitHub</option>
          </select>
        </label>
        <label>
          Surface URL
          <input name="target" placeholder="https://example.com or https://github.com/owner/repo" required />
        </label>
        <button className="button secondary" type="submit" disabled={busy === "create"}>Create challenge</button>
      </form>

      {proof ? (
        <div className="rights-proof-box">
          <p><strong>Publish at:</strong> {proof.location}</p>
          <pre>{proof.contents}</pre>
        </div>
      ) : null}

      <div className="rights-verification-list">
        {challenges.map((challenge) => (
          <div key={challenge.id} className="rights-verification-row">
            <span>{challenge.method} · {challenge.status} · expires {new Date(challenge.expires_at).toLocaleString()}</span>
            {challenge.status === "pending" ? (
              <button className="button secondary" type="button" onClick={() => checkChallenge(challenge.id)} disabled={busy === challenge.id}>
                Check verification
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <form action={attachIsbn} className="rights-verification-form">
        <label>
          ISBN evidence
          <input name="isbn" placeholder="ISBN-10 or ISBN-13" />
        </label>
        <button className="button secondary" type="submit" disabled={busy === "isbn"}>Attach ISBN</button>
        <p className="muted">ISBN is linked publication evidence, not proof of legal ownership.</p>
      </form>

      {evidence.length ? (
        <div className="rights-verification-list">
          {evidence.map((item) => (
            <div key={item.id || `${item.method}-${item.target}`} className="rights-verification-row">
              <span>{item.method === "isbn" ? "ISBN evidence" : item.method} · {item.status} · {item.target || "No target"}</span>
              {item.id && item.status !== "revoked" ? (
                <button className="button secondary" type="button" onClick={() => revoke(item.id as string)} disabled={busy === item.id}>
                  Revoke
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p className="notice">{message}</p> : null}
    </section>
  );
}
