/** Narrow live-link state surface for Operator ↔ Handler sessions. */

export const FREQUENCIES = [
  "Dream",
  "Hunger",
  "Silence",
  "Stillness",
  "Empyrean",
  "Becoming",
] as const;

export type Frequency = (typeof FREQUENCIES)[number];

export type FrequencyMap = Record<Frequency, number>;

export type LiveUnlocks = {
  frequencies: string[];
  mythtech: string[];
  traits: string[];
  flags: string[];
};

/**
 * Deliberate sync kinds. Payload boundaries are structural — client and server
 * both whitelist fields. Lotus is never a live-session write surface.
 *
 *   pressure_round / operator_send → harm, stability, recovery notes (conditions)
 *   cell                           → above + handlerNote
 *   archive                        → breach, voidMarks, unlocks (+ final harm/stability)
 *   between sessions               → Lotus purchases (not via live session PATCH)
 */
export type SyncKind = "pressure_round" | "cell" | "operator_send" | "archive";

export type LiveState = {
  /** Harm stages 0–5: fine → dying (Operator Guide §3.9). */
  harm: number;
  /** Operational coherence 0–10; base cap 10 (Operator Guide §3.9 / §5.3). */
  stability: number;
  /**
   * Lotus Frequency pips: six petals, 0–6 each.
   * Humans cultivate five; one permanent Blind Petal stays at 0 (Operator Guide §2.2 / §9.4).
   * Stored for display / between-sessions reconciliation only — not mid-session edits.
   */
  lotus: FrequencyMap;
  /**
   * Permanent Blind Petal — the sixth Frequency not cultivated. Locked at 0.
   */
  blindPetal: Frequency;
  /**
   * @deprecated Alias of lotus for older session snapshots only.
   */
  frequencyPips?: FrequencyMap;
  /** Breach Points bank — growth currency; fills pips after Void gates. Never converts to Void. */
  breach: number;
  /** Void Marks bank — capacity currency; opens gates. Starts at 1. Never buys pips alone. */
  voidMarks: number;
  /**
   * Recovery notes / declared recovery / temporary fallout this round.
   * Mid-round sync surface (recoveryNotes). Not Lotus.
   */
  conditions: string[];
  unlocks: LiveUnlocks;
  needlepoint: string;
  mission: string;
  handlerNote: string;
};

/** Mid-round pressure exchange — no banks, no Lotus, no unlocks. */
export const PRESSURE_ROUND_FIELDS = ["harm", "stability", "conditions"] as const satisfies readonly (keyof LiveState)[];

/** Investigation / social — Handler notes allowed. Still no Lotus / banks. */
export const CELL_SYNC_FIELDS = ["harm", "stability", "conditions", "handlerNote"] as const satisfies readonly (keyof LiveState)[];

/**
 * Archive Session — mission-end banks and earned unlocks.
 * Final Harm/Stability snapshot included so persistent files match the table.
 * Lotus is between-sessions only and is never written through live PATCH.
 */
export const ARCHIVE_FIELDS = [
  "harm",
  "stability",
  "breach",
  "voidMarks",
  "unlocks",
  "handlerNote",
  "conditions",
] as const satisfies readonly (keyof LiveState)[];

export function emptyFrequencyMap(value = 0): FrequencyMap {
  return {
    Dream: value,
    Hunger: value,
    Silence: value,
    Stillness: value,
    Empyrean: value,
    Becoming: value,
  };
}

export function isFrequency(value: unknown): value is Frequency {
  return typeof value === "string" && (FREQUENCIES as readonly string[]).includes(value);
}

export function normalizeBlindPetal(value: unknown, fallback: Frequency = "Silence"): Frequency {
  return isFrequency(value) ? value : fallback;
}

export function defaultLiveState(partial?: Partial<LiveState>): LiveState {
  const base: LiveState = {
    harm: 0,
    stability: 10,
    lotus: emptyFrequencyMap(0),
    // Must be set at Operator creation; fallback only for incomplete snapshots.
    blindPetal: "Silence",
    breach: 0,
    // Operator Guide §2.3: starting Void Mark at creation is 1.
    voidMarks: 1,
    conditions: [],
    unlocks: {
      frequencies: [],
      mythtech: [],
      traits: [],
      flags: [],
    },
    needlepoint: "",
    mission: "",
    handlerNote: "",
  };
  if (!partial) {
    return applyBlindPetal(base);
  }
  const lotus = {
    ...base.lotus,
    ...(partial.frequencyPips || {}),
    ...(partial.lotus || {}),
  } as FrequencyMap;
  const next: LiveState = {
    ...base,
    ...partial,
    lotus,
    blindPetal: normalizeBlindPetal(partial.blindPetal, base.blindPetal),
    unlocks: {
      ...base.unlocks,
      ...(partial.unlocks || {}),
    },
    conditions: partial.conditions ? [...partial.conditions] : base.conditions,
  };
  return applyBlindPetal(next);
}

function applyBlindPetal(state: LiveState): LiveState {
  const blind = normalizeBlindPetal(state.blindPetal);
  const lotus = emptyFrequencyMap(0);
  for (const f of FREQUENCIES) {
    lotus[f] = f === blind ? 0 : clampInt(state.lotus[f], 0, 6);
  }
  return { ...state, blindPetal: blind, lotus };
}

/**
 * Strip a raw client patch to the fields allowed for a deliberate sync kind.
 * Server and client both call this — UI filtering alone is not the boundary.
 */
export function filterPatchForSyncKind(
  kind: SyncKind | string | null | undefined,
  patch: Partial<LiveState> | Record<string, unknown> | null | undefined,
): Partial<LiveState> {
  const raw = patch && typeof patch === "object" ? (patch as Partial<LiveState>) : {};
  const normalizedKind = normalizeSyncKind(kind);

  // recoveryNotes string alias → conditions (declared recovery / fallout notes)
  const withNotes: Partial<LiveState> = { ...raw };
  if ("recoveryNotes" in (raw as Record<string, unknown>) && !withNotes.conditions) {
    const note = String((raw as Record<string, unknown>).recoveryNotes ?? "").slice(0, 500);
    withNotes.conditions = note ? [note] : [];
  }

  const fields =
    normalizedKind === "archive"
      ? ARCHIVE_FIELDS
      : normalizedKind === "cell"
        ? CELL_SYNC_FIELDS
        : PRESSURE_ROUND_FIELDS;

  const out: Partial<LiveState> = {};
  for (const key of fields) {
    if (withNotes[key] !== undefined) {
      (out as Record<string, unknown>)[key] = withNotes[key];
    }
  }
  return out;
}

export function normalizeSyncKind(kind: SyncKind | string | null | undefined): SyncKind {
  const k = String(kind || "").toLowerCase();
  if (k === "archive") return "archive";
  if (k === "cell") return "cell";
  if (k === "operator_send" || k === "send") return "operator_send";
  return "pressure_round";
}

/** Clamp and normalize a partial patch into a full LiveState. */
export function mergeLiveState(base: LiveState, patch: Partial<LiveState>): LiveState {
  // Blind petal is permanent — ignore attempts to change it mid-session unless base had none.
  const blindPetal = normalizeBlindPetal(base.blindPetal || patch.blindPetal);

  // Lotus is between-sessions. Ignore lotus / blindPetal / frequencyPips in live patches
  // unless the caller intentionally merges full state via defaultLiveState construction.
  // mergeLiveState is used for live session writes — never accept lotus mutations here.
  const { lotus: _ignoredLotus, frequencyPips: _ignoredFp, blindPetal: _ignoredBlind, ...safePatch } =
    patch || {};

  let next = defaultLiveState({
    ...base,
    ...safePatch,
    // Keep base Lotus snapshot; live session cannot cultivate petals.
    lotus: base.lotus,
    blindPetal,
    unlocks: {
      ...base.unlocks,
      ...(safePatch.unlocks || {}),
    },
  });

  next.harm = clampInt(next.harm, 0, 5);
  next.stability = clampInt(next.stability, 0, 10);
  next.breach = clampInt(next.breach, 0, 99);
  next.voidMarks = clampInt(next.voidMarks, 0, 13);
  next = applyBlindPetal({ ...next, lotus: base.lotus, blindPetal });
  delete next.frequencyPips;
  next.conditions = (next.conditions || []).map(String).slice(0, 20);
  next.needlepoint = String(next.needlepoint || "").slice(0, 120);
  next.mission = String(next.mission || "").slice(0, 200);
  next.handlerNote = String(next.handlerNote || "").slice(0, 500);

  // Operator Guide §2.2 / §9.4: six petals on the Lotus; humans cultivate five;
  // one Blind Petal permanent at 0. Void/Breach remain separate currencies.
  // Lotus purchases are between sessions — not via live merge.

  return next;
}

/**
 * Between-sessions / profile-only merge that may update Lotus.
 * Do not use for live session PATCH paths.
 */
export function mergePersistentState(base: LiveState, patch: Partial<LiveState>): LiveState {
  const blindPetal = normalizeBlindPetal(base.blindPetal || patch.blindPetal);
  let next = defaultLiveState({
    ...base,
    ...patch,
    blindPetal,
    lotus: { ...base.lotus, ...(patch.lotus || {}) } as FrequencyMap,
    unlocks: {
      ...base.unlocks,
      ...(patch.unlocks || {}),
    },
  });
  next.harm = clampInt(next.harm, 0, 5);
  next.stability = clampInt(next.stability, 0, 10);
  next.breach = clampInt(next.breach, 0, 99);
  next.voidMarks = clampInt(next.voidMarks, 0, 13);
  next = applyBlindPetal({ ...next, blindPetal });
  delete next.frequencyPips;
  next.conditions = (next.conditions || []).map(String).slice(0, 20);
  next.needlepoint = String(next.needlepoint || "").slice(0, 120);
  next.mission = String(next.mission || "").slice(0, 200);
  next.handlerNote = String(next.handlerNote || "").slice(0, 500);
  return next;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** Diff top-level and nested fields for mutation log. */
export function diffLiveState(
  before: LiveState,
  after: LiveState,
): Array<{ field_path: string; old_value: unknown; new_value: unknown }> {
  const out: Array<{ field_path: string; old_value: unknown; new_value: unknown }> = [];
  const keys: (keyof LiveState)[] = [
    "harm",
    "stability",
    "breach",
    "voidMarks",
    "blindPetal",
    "conditions",
    "needlepoint",
    "mission",
    "handlerNote",
  ];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      out.push({ field_path: key, old_value: before[key], new_value: after[key] });
    }
  }
  for (const f of FREQUENCIES) {
    if (before.lotus[f] !== after.lotus[f]) {
      out.push({ field_path: `lotus.${f}`, old_value: before.lotus[f], new_value: after.lotus[f] });
    }
  }
  for (const key of ["frequencies", "mythtech", "traits", "flags"] as const) {
    if (JSON.stringify(before.unlocks[key]) !== JSON.stringify(after.unlocks[key])) {
      out.push({
        field_path: `unlocks.${key}`,
        old_value: before.unlocks[key],
        new_value: after.unlocks[key],
      });
    }
  }
  return out;
}
