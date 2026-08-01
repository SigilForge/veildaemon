import { getSupabaseAdminClient } from "@/lib/supabase";
import { publicError, requireUser } from "@/lib/store";
import {
  applyStatePatch,
  defaultLiveState,
  generateJoinCode,
  importFromOperatorExport,
  isFrequency,
  mergeLiveState,
  normalizeBlindPetal,
  normalizeSyncKind,
  type LiveState,
  type StateStoreAdapter,
} from "@/lib/table/state";
import { buildSessionClosePacket, type AuthorizationPacket } from "@/lib/table/authorizationPacket";
import type { Json } from "@/lib/database.types";

function clampAward(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 99);
}

export async function listMyOperators() {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("operator_profiles")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw publicError(error.message, 500);
  return data || [];
}

// NOTE: operator_profiles is identity + ownership only (owner_user_id, display_name,
// designation) — it no longer carries persistent_state/character_snapshot. That was a
// parallel, VeilLink-owned copy of the real static Operator sheet's character (the
// "ferry" problem the Cell/Live-Link rearchitecture removes). This function, its
// TableHubClient.tsx caller, and importOperator below are legacy V1 UI slated for
// removal once the real Operator/Handler apps' own Connect UI (api/cell/*, root
// cell-sync.js remote transport) replaces them — kept compiling in the interim, not
// redesigned further.
export async function createOperator(input: {
  displayName: string;
  designation?: string;
  blindPetal?: string;
}) {
  const { user, supabase } = await requireUser();
  const name = String(input.displayName || "").trim().slice(0, 80);
  if (!name) throw publicError("Display name is required.");
  // Operator Guide §2.2 / §9.4: six Lotus petals; choose one permanent Blind Petal; cultivate five.
  if (input.blindPetal != null && input.blindPetal !== "" && !isFrequency(input.blindPetal)) {
    throw publicError("Blind Petal must be one of the six Frequencies.");
  }
  const { data, error } = await supabase
    .from("operator_profiles")
    .insert({
      owner_user_id: user.id,
      display_name: name,
      designation: String(input.designation || "").trim().slice(0, 40),
    })
    .select("*")
    .single();
  if (error) throw publicError(error.message, 500);
  return data;
}

/**
 * Creates a new operator_profiles row from a static Operator sheet's
 * `cradlepoint.operator` export. Always creates a fresh row rather than
 * matching/overwriting an existing one (V1 scope — avoids ambiguous matching;
 * the caller picks the freshly-imported entry to join with). Only identity
 * (display name / designation) survives the import now — see note above.
 */
export async function importOperator(payload: unknown) {
  const { user, supabase } = await requireUser();
  const mapped = importFromOperatorExport(payload);
  if (!mapped.ok) throw publicError(mapped.error);
  const { displayName, designation } = mapped.result;
  const { data, error } = await supabase
    .from("operator_profiles")
    .insert({
      owner_user_id: user.id,
      display_name: displayName,
      designation,
    })
    .select("*")
    .single();
  if (error) throw publicError(error.message, 500);
  return data;
}

export async function createHandlerSession(input?: {
  needlepoint?: string;
  mission?: string;
  maxOperators?: number | null;
}) {
  const { user, supabase } = await requireUser();
  const maxOperators = normalizeSeatCap(input?.maxOperators);
  let code = generateJoinCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from("handler_sessions")
      .insert({
        handler_user_id: user.id,
        join_code: code,
        needlepoint: String(input?.needlepoint || "").slice(0, 120),
        mission: String(input?.mission || "").slice(0, 200),
        max_operators: maxOperators,
      })
      .select("*")
      .single();
    if (!error && data) return data;
    if (error?.code !== "23505") throw publicError(error?.message || "Could not create session.", 500);
    code = generateJoinCode();
  }
  throw publicError("Could not allocate join code.", 500);
}

/** Optional lobby ceiling only — null means uncapped. Absolute safety bound for abuse, not product design. */
export const ABSOLUTE_MAX_SESSION_OPERATORS = 32;

function normalizeSeatCap(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, ABSOLUTE_MAX_SESSION_OPERATORS);
}

async function assertSeatAvailable(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  sessionId: string,
  maxOperators: number | null,
) {
  if (maxOperators == null) return;
  const { count: activeCount } = await admin
    .from("session_operator_state")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .is("left_at", null);
  if ((activeCount || 0) >= maxOperators) {
    throw publicError(`Session is full (Handler set a ${maxOperators}-Operator lobby cap).`, 409);
  }
}

export async function joinSession(input: { joinCode: string; operatorProfileId: string }) {
  const { user, supabase } = await requireUser();
  const code = String(input.joinCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  if (code.length !== 6) throw publicError("Join code must be 6 characters.");

  const { data: profile, error: profileError } = await supabase
    .from("operator_profiles")
    .select("*")
    .eq("id", input.operatorProfileId)
    .eq("owner_user_id", user.id)
    .single();
  if (profileError || !profile) throw publicError("Operator file not found.", 404);

  // Join-code lookup uses admin read so Operators not yet seated can resolve the session.
  const admin = getSupabaseAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("handler_sessions")
    .select("*")
    .eq("join_code", code)
    .eq("status", "open")
    .single();
  if (sessionError || !session) throw publicError("No open session for that code.", 404);

  const seatCap = normalizeSeatCap((session as { max_operators?: number | null }).max_operators);

  // No persistent_state to seed from anymore -- a seat starts blank and fills in from
  // the Operator's own deliberate sends once connected, same as the local Cell bus.
  const snapshot = defaultLiveState({});
  snapshot.needlepoint = session.needlepoint || snapshot.needlepoint;
  snapshot.mission = session.mission || snapshot.mission;

  const { data: existing } = await supabase
    .from("session_operator_state")
    .select("*")
    .eq("session_id", session.id)
    .eq("operator_profile_id", profile.id)
    .maybeSingle();

  if (existing) {
    if (existing.left_at) {
      await assertSeatAvailable(admin, session.id, seatCap);
      const { data: reopened, error } = await supabase
        .from("session_operator_state")
        .update({
          left_at: null,
          live_state: snapshot as unknown as Json,
          last_mutated_by: user.id,
          last_mutated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw publicError(error.message, 500);
      return { session, state: reopened, profile };
    }
    return { session, state: existing, profile };
  }

  await assertSeatAvailable(admin, session.id, seatCap);

  const { data: state, error } = await supabase
    .from("session_operator_state")
    .insert({
      session_id: session.id,
      operator_profile_id: profile.id,
      owner_user_id: user.id,
      live_state: snapshot as unknown as Json,
      last_mutated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw publicError(error.message, 500);
  return { session, state, profile };
}

export async function getSessionBundle(sessionId: string) {
  const { user, supabase } = await requireUser();
  const { data: session, error } = await supabase
    .from("handler_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error || !session) throw publicError("Session not found.", 404);

  const isHandler = session.handler_user_id === user.id;
  const { data: states, error: stateError } = await supabase
    .from("session_operator_state")
    .select("*, operator_profiles(display_name, designation, owner_user_id)")
    .eq("session_id", sessionId)
    .is("left_at", null);
  if (stateError) throw publicError(stateError.message, 500);

  if (!isHandler) {
    const mine = (states || []).filter((row) => row.owner_user_id === user.id);
    if (!mine.length) throw publicError("Not a participant in this session.", 403);
    return { session, states: mine, role: "operator" as const, userId: user.id };
  }
  return { session, states: states || [], role: "handler" as const, userId: user.id };
}

export async function patchSessionState(input: {
  sessionId: string;
  sessionOperatorStateId: string;
  patch: Partial<LiveState>;
  /** Deliberate sync kind — server enforces field whitelist. Defaults to pressure_round (strictest mid-round). */
  syncKind?: string;
}) {
  const { user, supabase } = await requireUser();
  const { data: session, error: sessionError } = await supabase
    .from("handler_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .single();
  if (sessionError || !session) throw publicError("Session not found.", 404);
  if (session.status !== "open") throw publicError("Session is closed.", 400);

  const { data: row, error: rowError } = await supabase
    .from("session_operator_state")
    .select("*")
    .eq("id", input.sessionOperatorStateId)
    .eq("session_id", input.sessionId)
    .single();
  if (rowError || !row) throw publicError("Session operator not found.", 404);
  if (row.left_at) throw publicError("Operator has left the session.", 400);

  const isHandler = session.handler_user_id === user.id;
  const isOwner = row.owner_user_id === user.id;
  if (!isHandler && !isOwner) throw publicError("Not authorized.", 403);

  // Structural boundary: only fields allowed for this sync kind may change.
  // Lotus never enters via live PATCH (mergeLiveState also ignores lotus).
  const kind = normalizeSyncKind(input.syncKind || (isHandler ? "cell" : "operator_send"));
  const role: "handler" | "operator" = isHandler ? "handler" : "operator";

  // Optimistic-concurrency adapter: compare-and-swap on state_version so a
  // concurrent writer's change to a field this patch never touched is never
  // reverted to a stale snapshot. See applyStatePatch for the retry contract.
  const adapter: StateStoreAdapter = {
    async read() {
      const { data, error } = await supabase
        .from("session_operator_state")
        .select("live_state, state_version, left_at")
        .eq("id", row.id)
        .single();
      if (error || !data || data.left_at) return null;
      return {
        liveState: (data.live_state || {}) as Partial<LiveState>,
        version: data.state_version ?? 1,
      };
    },
    async write({ liveState, expectedVersion }) {
      const { data, error } = await supabase
        .from("session_operator_state")
        .update({
          live_state: liveState as unknown as Json,
          state_version: expectedVersion + 1,
          last_mutated_by: user.id,
          last_mutated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("state_version", expectedVersion)
        .select("*")
        .maybeSingle();
      if (error) throw publicError(error.message, 500);
      if (!data) return { ok: false };
      return { ok: true, version: data.state_version };
    },
  };

  const applied = await applyStatePatch(kind, input.patch || {}, adapter);
  if (!applied) throw publicError("Operator has left the session.", 400);
  if (!applied.diffs.length) return { row, session, diffs: [], syncKind: kind, filtered: {} };

  const { data: updated, error: updateError } = await supabase
    .from("session_operator_state")
    .select("*")
    .eq("id", row.id)
    .single();
  if (updateError || !updated) throw publicError(updateError?.message || "Session operator not found.", 500);

  const mutationRows = applied.diffs.map((d) => ({
    session_id: session.id,
    session_operator_state_id: row.id,
    actor_user_id: user.id,
    actor_role: role as "handler" | "operator",
    field_path: d.field_path,
    old_value: d.old_value as Json,
    new_value: d.new_value as Json,
  }));
  const { error: mutError } = await supabase.from("session_mutations").insert(mutationRows);
  if (mutError) throw publicError(mutError.message, 500);

  return { row: updated, session, diffs: applied.diffs, role, syncKind: kind, filtered: applied.after };
}

export async function leaveSession(sessionId: string, sessionOperatorStateId: string) {
  const { user, supabase } = await requireUser();
  const { data: row, error } = await supabase
    .from("session_operator_state")
    .select("*")
    .eq("id", sessionOperatorStateId)
    .eq("session_id", sessionId)
    .eq("owner_user_id", user.id)
    .single();
  if (error || !row) throw publicError("Session seat not found.", 404);

  const { data: updated, error: updateError } = await supabase
    .from("session_operator_state")
    .update({ left_at: new Date().toISOString() })
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError) throw publicError(updateError.message, 500);
  return updated;
}

export type CloseSessionOptions = {
  /** Final session for these characters vs an ongoing campaign. Recorded on the session; doesn't hard-gate other choices. */
  oneShot?: boolean;
  /** Reset Harm to 0 / Stability to 10 instead of carrying the session's ending levels forward. */
  resetVitals?: boolean;
  /** Applied equally to every still-active seat. */
  groupAward?: {
    voidReward?: number;
    breachReward?: number;
    ontologyUnlocks?: string[];
    backgroundUnlocks?: string[];
    caseUnlock?: string;
  };
  /** Discretionary, per-seat, on top of the group award (e.g. "went above and beyond"). Keyed by session_operator_state id. */
  perOperatorAwards?: Record<string, { voidBonus?: number; breachBonus?: number }>;
};

export type SessionClosePacketResult = {
  sessionOperatorStateId: string;
  operatorName: string;
  packet: AuthorizationPacket;
};

export async function closeSession(sessionId: string, options: CloseSessionOptions = {}) {
  const { user, supabase } = await requireUser();
  const { data: session, error } = await supabase
    .from("handler_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("handler_user_id", user.id)
    .single();
  if (error || !session) throw publicError("Session not found.", 404);
  if (session.status === "closed") return { session, reconciled: 0, packets: [] as SessionClosePacketResult[] };

  const { data: seats } = await supabase
    .from("session_operator_state")
    .select("*")
    .eq("session_id", sessionId);

  const groupAward = options.groupAward || {};
  const groupVoid = clampAward(groupAward.voidReward);
  const groupBreach = clampAward(groupAward.breachReward);
  const perOperatorAwards = options.perOperatorAwards || {};
  const sessionLabel = session.needlepoint || session.mission || "Session Archive";

  let reconciled = 0;
  const packets: SessionClosePacketResult[] = [];
  for (const seat of seats || []) {
    if (seat.left_at) continue;
    const live = defaultLiveState((seat.live_state || {}) as Partial<LiveState>);
    // Reconcile allowed persistent fields back into operator profile
    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from("operator_profiles")
      .select("*")
      .eq("id", seat.operator_profile_id)
      .single();
    if (!profile) continue;

    const bonus = perOperatorAwards[seat.id] || {};
    const voidAwarded = groupVoid + clampAward(bonus.voidBonus);
    const breachAwarded = groupBreach + clampAward(bonus.breachBonus);

    // No operator_profiles.persistent_state to reconcile into anymore -- the packet's
    // final numbers come straight from the session's own ending live state + awards.
    // A connected Operator's real sheet gets these live at close (see api/cell/*); the
    // packet below stays only for an Operator who was never connected this session.
    const next = mergeLiveState(defaultLiveState({}), {
      harm: options.resetVitals ? 0 : live.harm,
      stability: options.resetVitals ? 10 : live.stability,
      breach: live.breach + breachAwarded,
      voidMarks: live.voidMarks + voidAwarded,
      conditions: live.conditions,
      unlocks: live.unlocks,
    });
    await supabase
      .from("session_operator_state")
      .update({ left_at: new Date().toISOString() })
      .eq("id", seat.id)
      .is("left_at", null);
    reconciled += 1;

    packets.push({
      sessionOperatorStateId: seat.id,
      operatorName: profile.display_name,
      packet: buildSessionClosePacket({
        operatorName: profile.display_name,
        sessionLabel,
        finalHarm: next.harm,
        finalStability: next.stability,
        voidAwarded,
        breachAwarded,
        ontologyUnlocks: groupAward.ontologyUnlocks,
        backgroundUnlocks: groupAward.backgroundUnlocks,
        caseUnlock: groupAward.caseUnlock,
        oneShot: Boolean(options.oneShot),
      }),
    });
  }

  const { data: closed, error: closeError } = await supabase
    .from("handler_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString(), one_shot: Boolean(options.oneShot) })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (closeError) throw publicError(closeError.message, 500);
  return { session: closed, reconciled, packets };
}
