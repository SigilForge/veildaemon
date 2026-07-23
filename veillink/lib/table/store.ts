import { getSupabaseAdminClient } from "@/lib/supabase";
import { publicError, requireUser } from "@/lib/store";
import {
  defaultLiveState,
  diffLiveState,
  generateJoinCode,
  mergeLiveState,
  type LiveState,
} from "@/lib/table/state";
import type { Json } from "@/lib/database.types";

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

export async function createOperator(input: { displayName: string; designation?: string }) {
  const { user, supabase } = await requireUser();
  const name = String(input.displayName || "").trim().slice(0, 80);
  if (!name) throw publicError("Display name is required.");
  const state = defaultLiveState();
  const { data, error } = await supabase
    .from("operator_profiles")
    .insert({
      owner_user_id: user.id,
      display_name: name,
      designation: String(input.designation || "").trim().slice(0, 40),
      persistent_state: state as unknown as Json,
    })
    .select("*")
    .single();
  if (error) throw publicError(error.message, 500);
  return data;
}

export async function createHandlerSession(input?: { needlepoint?: string; mission?: string }) {
  const { user, supabase } = await requireUser();
  let code = generateJoinCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from("handler_sessions")
      .insert({
        handler_user_id: user.id,
        join_code: code,
        needlepoint: String(input?.needlepoint || "").slice(0, 120),
        mission: String(input?.mission || "").slice(0, 200),
      })
      .select("*")
      .single();
    if (!error && data) return data;
    if (error?.code !== "23505") throw publicError(error?.message || "Could not create session.", 500);
    code = generateJoinCode();
  }
  throw publicError("Could not allocate join code.", 500);
}

/** Soft table size for live-link V1 (hobby table, not MMO). */
export const MAX_SESSION_OPERATORS = 6;

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

  const snapshot = defaultLiveState(
    (profile.persistent_state || {}) as Partial<LiveState>,
  );
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
      // Re-seat counts as a seat again — enforce cap among currently active seats.
      const { count: activeCount } = await admin
        .from("session_operator_state")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id)
        .is("left_at", null);
      if ((activeCount || 0) >= MAX_SESSION_OPERATORS) {
        throw publicError(`Session is full (${MAX_SESSION_OPERATORS} Operators max).`, 409);
      }
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

  const { count: activeCount } = await admin
    .from("session_operator_state")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .is("left_at", null);
  if ((activeCount || 0) >= MAX_SESSION_OPERATORS) {
    throw publicError(`Session is full (${MAX_SESSION_OPERATORS} Operators max).`, 409);
  }

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

  const before = defaultLiveState((row.live_state || {}) as Partial<LiveState>);
  // Operators can spend/self-adjust; handlers can award. Both may patch allowed fields for V1 demo.
  const after = mergeLiveState(before, input.patch || {});
  const diffs = diffLiveState(before, after);
  if (!diffs.length) return { row, session, diffs: [] };

  const role: "handler" | "operator" = isHandler ? "handler" : "operator";
  const { data: updated, error: updateError } = await supabase
    .from("session_operator_state")
    .update({
      live_state: after as unknown as Json,
      last_mutated_by: user.id,
      last_mutated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError) throw publicError(updateError.message, 500);

  const mutationRows = diffs.map((d) => ({
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

  return { row: updated, session, diffs, role };
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

export async function closeSession(sessionId: string) {
  const { user, supabase } = await requireUser();
  const { data: session, error } = await supabase
    .from("handler_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("handler_user_id", user.id)
    .single();
  if (error || !session) throw publicError("Session not found.", 404);
  if (session.status === "closed") return { session, reconciled: 0 };

  const { data: seats } = await supabase
    .from("session_operator_state")
    .select("*")
    .eq("session_id", sessionId);

  let reconciled = 0;
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
    const persistent = defaultLiveState((profile.persistent_state || {}) as Partial<LiveState>);
    const next = mergeLiveState(persistent, {
      harm: live.harm,
      stability: live.stability,
      lotus: live.lotus,
      frequencyPips: live.frequencyPips,
      breach: live.breach,
      voidMarks: live.voidMarks,
      conditions: live.conditions,
      unlocks: live.unlocks,
    });
    await admin
      .from("operator_profiles")
      .update({ persistent_state: next as unknown as Json })
      .eq("id", profile.id);
    await supabase
      .from("session_operator_state")
      .update({ left_at: new Date().toISOString() })
      .eq("id", seat.id)
      .is("left_at", null);
    reconciled += 1;
  }

  const { data: closed, error: closeError } = await supabase
    .from("handler_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (closeError) throw publicError(closeError.message, 500);
  return { session: closed, reconciled };
}
