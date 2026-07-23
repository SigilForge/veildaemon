import { describe, expect, it } from "vitest";
import {
  defaultLiveState,
  diffLiveState,
  filterPatchForSyncKind,
  mergeLiveState,
  mergePersistentState,
  type LiveState,
} from "@/lib/table/state";

describe("table live state", () => {
  it("clamps tracks without converting Breach into Void", () => {
    // Operator Guide: Void opens gates; Breach fills pips. Separate currencies.
    const base = defaultLiveState({ breach: 5, voidMarks: 1, harm: 0 });
    const next = mergeLiveState(base, { breach: 7, harm: 9 });
    expect(next.breach).toBe(7);
    expect(next.voidMarks).toBe(1);
    expect(next.harm).toBe(5); // Harm stages 0–5
  });

  it("starts with one Void Mark, six petals, one Blind locked at 0", () => {
    const fresh = defaultLiveState({ blindPetal: "Hunger" });
    expect(fresh.voidMarks).toBe(1);
    expect(fresh.stability).toBe(10);
    expect(fresh.blindPetal).toBe("Hunger");
    expect(fresh.lotus.Hunger).toBe(0);
    expect(fresh.frequencyPips).toBeUndefined();
  });

  it("live merge never cultivates Lotus mid-session", () => {
    const base = defaultLiveState({
      blindPetal: "Silence",
      lotus: { Dream: 2, Hunger: 0, Silence: 0, Stillness: 1, Empyrean: 0, Becoming: 0 },
    });
    const next = mergeLiveState(base, {
      harm: 1,
      lotus: { Dream: 3, Hunger: 0, Silence: 4, Stillness: 1, Empyrean: 0, Becoming: 0 },
    });
    // Lotus patch ignored — still base snapshot
    expect(next.lotus.Silence).toBe(0);
    expect(next.lotus.Dream).toBe(2);
    expect(next.harm).toBe(1);
    expect(next.blindPetal).toBe("Silence");
  });

  it("persistent merge allows Lotus between sessions", () => {
    const base = defaultLiveState({
      blindPetal: "Silence",
      lotus: { Dream: 2, Hunger: 0, Silence: 0, Stillness: 1, Empyrean: 0, Becoming: 0 },
    });
    const next = mergePersistentState(base, {
      lotus: { Dream: 3, Hunger: 0, Silence: 4, Stillness: 1, Empyrean: 0, Becoming: 0 },
    });
    expect(next.lotus.Silence).toBe(0); // Blind still locked
    expect(next.lotus.Dream).toBe(3);
  });

  it("records field diffs for mutations", () => {
    const before = defaultLiveState({ stability: 10, breach: 0 });
    const after = mergeLiveState(before, { stability: 8, breach: 2 });
    const diffs = diffLiveState(before, after);
    const paths = diffs.map((d) => d.field_path).sort();
    expect(paths).toContain("stability");
    expect(paths).toContain("breach");
  });

  it("awards unlock lists without dropping others", () => {
    const base = defaultLiveState({
      unlocks: { frequencies: ["Dream"], mythtech: [], traits: [], flags: [] },
    });
    const next = mergeLiveState(base, {
      unlocks: {
        frequencies: ["Dream", "Silence"],
        mythtech: ["Vault Interface II"],
        traits: [],
        flags: ["PULSE SURVIVOR"],
      },
    });
    expect(next.unlocks.frequencies).toEqual(["Dream", "Silence"]);
    expect(next.unlocks.mythtech).toContain("Vault Interface II");
    expect(next.unlocks.flags).toContain("PULSE SURVIVOR");
  });

  describe("filterPatchForSyncKind", () => {
    const full = defaultLiveState({
      harm: 2,
      stability: 7,
      breach: 4,
      voidMarks: 3,
      handlerNote: "tell them",
      conditions: ["Ground"],
      lotus: { Dream: 5, Hunger: 0, Silence: 0, Stillness: 0, Empyrean: 0, Becoming: 0 },
      unlocks: { frequencies: ["Dream"], mythtech: [], traits: [], flags: ["X"] },
    });

    it("pressure_round only allows harm, stability, conditions", () => {
      const patch = filterPatchForSyncKind("pressure_round", full);
      expect(Object.keys(patch).sort()).toEqual(["conditions", "harm", "stability"]);
      expect(patch.harm).toBe(2);
      expect(patch.breach).toBeUndefined();
      expect(patch.lotus).toBeUndefined();
      expect(patch.handlerNote).toBeUndefined();
    });

    it("cell allows handlerNote in addition to pressure fields", () => {
      const patch = filterPatchForSyncKind("cell", full);
      expect(Object.keys(patch).sort()).toEqual(["conditions", "handlerNote", "harm", "stability"]);
      expect(patch.handlerNote).toBe("tell them");
      expect(patch.voidMarks).toBeUndefined();
    });

    it("operator_send matches pressure_round whitelist", () => {
      const patch = filterPatchForSyncKind("operator_send", full);
      expect(Object.keys(patch).sort()).toEqual(["conditions", "harm", "stability"]);
    });

    it("archive allows banks and unlocks but never lotus", () => {
      const patch = filterPatchForSyncKind("archive", full);
      expect(patch.breach).toBe(4);
      expect(patch.voidMarks).toBe(3);
      expect(patch.unlocks?.flags).toContain("X");
      expect(patch.harm).toBe(2);
      expect(patch.lotus).toBeUndefined();
    });

    it("maps recoveryNotes alias into conditions", () => {
      const patch = filterPatchForSyncKind("pressure_round", {
        harm: 1,
        recoveryNotes: "Breathe declared",
      } as Partial<LiveState> & { recoveryNotes: string });
      expect(patch.conditions).toEqual(["Breathe declared"]);
      expect(patch.harm).toBe(1);
    });
  });
});
