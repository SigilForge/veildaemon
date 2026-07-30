/**
 * Builds a `cradlepoint.authorization` packet — the same format the static
 * Handler console produces (handler/handler-modules.js `buildAuthorizationPayload`)
 * and the static Operator sheet already imports (operator/operator.js
 * `importAuthorizationFile`). VeilLink's session close flow generates one of
 * these per Operator so the Handler can hand the result back to a player who
 * built their character on the static sheet, without inventing a new format.
 *
 * Flag vocabulary matches operator/operator.js `parseAuthorizationPacket`
 * exactly: ONTOLOGY_UNLOCK / BACKGROUND_UNLOCK / CASE_UNLOCK, VOID_REWARD /
 * BREACH_REWARD (additive), and HARM_SET / STABILITY_SET (absolute — the
 * authoritative end-of-session value, not a delta).
 */

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export type SessionClosePacketInput = {
  operatorName: string;
  sessionLabel?: string;
  finalHarm: number;
  finalStability: number;
  voidAwarded?: number;
  breachAwarded?: number;
  ontologyUnlocks?: string[];
  backgroundUnlocks?: string[];
  caseUnlock?: string;
  oneShot?: boolean;
  note?: string;
};

export type AuthorizationPacket = {
  exportType: "cradlepoint.authorization";
  version: 1;
  exportedAt: string;
  packetLabel: string;
  operatorName: string;
  flags: string[];
  note: string;
};

export function buildSessionClosePacket(input: SessionClosePacketInput): AuthorizationPacket {
  const flags: string[] = [
    `HARM_SET:${clampInt(input.finalHarm, 0, 5)}`,
    `STABILITY_SET:${clampInt(input.finalStability, 0, 10)}`,
  ];

  const voidAwarded = clampInt(input.voidAwarded, 0, 99);
  const breachAwarded = clampInt(input.breachAwarded, 0, 99);
  if (voidAwarded > 0) flags.push(`VOID_REWARD:${voidAwarded}`);
  if (breachAwarded > 0) flags.push(`BREACH_REWARD:${breachAwarded}`);

  (input.ontologyUnlocks || []).forEach((key) => {
    const clean = String(key || "").trim();
    if (clean) flags.push(`ONTOLOGY_UNLOCK:${clean}`);
  });
  (input.backgroundUnlocks || []).forEach((key) => {
    const clean = String(key || "").trim();
    if (clean) flags.push(`BACKGROUND_UNLOCK:${clean}`);
  });
  const caseUnlock = String(input.caseUnlock || "").trim();
  if (caseUnlock) flags.push(`CASE_UNLOCK:${caseUnlock}`);

  const note =
    input.note ||
    (input.oneShot
      ? "One-shot archive. Session closed by the Handler."
      : "Session archived. Harm/Stability and any awards below are the closing state.");

  return {
    exportType: "cradlepoint.authorization",
    version: 1,
    exportedAt: new Date().toISOString(),
    packetLabel: input.sessionLabel || "Session Archive",
    operatorName: input.operatorName,
    flags,
    note,
  };
}
