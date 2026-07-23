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
   * Lotus Frequency pips per petal (0–6). This IS the Frequency pip track.
   * Do not invent a second parallel pip map.
   */
  lotus: FrequencyMap;
  /**
   * @deprecated Alias of lotus for older session snapshots only.
   * Rules have one pip track on the Lotus, not two.
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

export function defaultLiveState(partial?: Partial<LiveState>): LiveState {
  const base: LiveState = {
    harm: 0,
    stability: 10,
    lotus: emptyFrequencyMap(0),
    breach: 0,
    // Operator Guide §2.3: starting Void Mark at creation is 1 (Session Zero Rank 1 default).
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
  if (!partial) return base;
  // Prefer lotus; fold legacy frequencyPips into lotus if lotus absent on old snapshots.
  const lotus = {
    ...base.lotus,
    ...(partial.frequencyPips || {}),
    ...(partial.lotus || {}),
  };
  return {
    ...base,
    ...partial,
    lotus,
    unlocks: {
      ...base.unlocks,
      ...(partial.unlocks || {}),
    },
    conditions: partial.conditions ? [...partial.conditions] : base.conditions,
  };
}

/** Clamp and normalize a partial patch into a full LiveState. */
export function mergeLiveState(base: LiveState, patch: Partial<LiveState>): LiveState {
  const next = defaultLiveState({
    ...base,
    ...patch,
    lotus: { ...base.lotus, ...(patch.lotus || {}) },
    frequencyPips: { ...base.frequencyPips, ...(patch.frequencyPips || {}) },
    unlocks: {
      ...base.unlocks,
      ...(patch.unlocks || {}),
    },
  });

  next.harm = clampInt(next.harm, 0, 5); // stages: fine…dying
  next.stability = clampInt(next.stability, 0, 10); // base cap 10
  // Banked Breach is uncapped in core play; soft upper bound only for storage sanity (operator console uses high ceiling).
  next.breach = clampInt(next.breach, 0, 99);
  // Void architecture discussed through ~13 in core; 14+ is DLC pressure (Guide §2.3).
  next.voidMarks = clampInt(next.voidMarks, 0, 13);
  for (const f of FREQUENCIES) {
    next.lotus[f] = clampInt(next.lotus[f], 0, 6); // Operator ceiling pip 6
  }
  // Drop parallel frequencyPips so we do not ship a second invented track.
  delete next.frequencyPips;
  next.conditions = (next.conditions || []).map(String).slice(0, 20);
  next.needlepoint = String(next.needlepoint || "").slice(0, 120);
  next.mission = String(next.mission || "").slice(0, 200);
  next.handlerNote = String(next.handlerNote || "").slice(0, 500);

  // Cradlepoint law (Operator Guide §2.3 / §9.1–9.3):
  // Void = capacity (opens gates). Breach = growth (fills opened pip slots).
  // Separate currencies. Breach never becomes Void. Void never buys pips.
  // Live-link tracks banked totals + Lotus pips; gate checks and Breach spends stay table procedure.

  return next;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function generateJoinCode(): string {
  // Avoid ambiguous 0/O, 1/I
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
