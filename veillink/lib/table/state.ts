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
  harm: number;
  stability: number;
  lotus: FrequencyMap;
  frequencyPips: FrequencyMap;
  breach: number;
  voidMarks: number;
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
    frequencyPips: emptyFrequencyMap(0),
    breach: 0,
    voidMarks: 0,
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
  return {
    ...base,
    ...partial,
    lotus: { ...base.lotus, ...(partial.lotus || {}) },
    frequencyPips: { ...base.frequencyPips, ...(partial.frequencyPips || {}) },
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

  next.harm = clampInt(next.harm, 0, 5);
  next.stability = clampInt(next.stability, 0, 10);
  next.breach = clampInt(next.breach, 0, 20);
  next.voidMarks = clampInt(next.voidMarks, 0, 13);
  for (const f of FREQUENCIES) {
    next.lotus[f] = clampInt(next.lotus[f], 0, 6);
    next.frequencyPips[f] = clampInt(next.frequencyPips[f], 0, 6);
  }
  next.conditions = (next.conditions || []).map(String).slice(0, 20);
  next.needlepoint = String(next.needlepoint || "").slice(0, 120);
  next.mission = String(next.mission || "").slice(0, 200);
  next.handlerNote = String(next.handlerNote || "").slice(0, 500);

  // Cradlepoint law (Operator Guide): Void = capacity/gates; Breach = growth/pips.
  // They are separate currencies. Breach never becomes Void. Void never buys pips.
  // Live-link only tracks banked totals; pip spends remain a table procedure.

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
    if (before.frequencyPips[f] !== after.frequencyPips[f]) {
      out.push({
        field_path: `frequencyPips.${f}`,
        old_value: before.frequencyPips[f],
        new_value: after.frequencyPips[f],
      });
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
