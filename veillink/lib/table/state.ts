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

export type LiveState = {
  /** Harm stages 0–5: fine → dying (Operator Guide §3.9). */
  harm: number;
  /** Operational coherence 0–10; base cap 10 (Operator Guide §3.9 / §5.3). */
  stability: number;
  /**
   * Lotus Frequency pips: six petals, 0–6 each.
   * Humans cultivate five; one permanent Blind Petal stays at 0 (Operator Guide §2.2 / §9.4).
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
   * Free-text active pressure notes (Misfires, temporary fallout, etc.).
   * Not a full Misfire / Presentation Load rules engine.
   */
  conditions: string[];
  unlocks: LiveUnlocks;
  needlepoint: string;
  mission: string;
  handlerNote: string;
};

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

/** Clamp and normalize a partial patch into a full LiveState. */
export function mergeLiveState(base: LiveState, patch: Partial<LiveState>): LiveState {
  // Blind petal is permanent — ignore attempts to change it mid-session unless base had none.
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

  // Operator Guide §2.2 / §9.4: six petals on the Lotus; humans cultivate five;
  // one Blind Petal permanent at 0. Void/Breach remain separate currencies.

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
