import { describe, expect, it } from "vitest";
import { defaultLiveState, diffLiveState, mergeLiveState } from "@/lib/table/state";

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

  it("never cultivates the Blind Petal", () => {
    const base = defaultLiveState({
      blindPetal: "Silence",
      lotus: { Dream: 2, Hunger: 0, Silence: 0, Stillness: 1, Empyrean: 0, Becoming: 0 },
    });
    const next = mergeLiveState(base, {
      lotus: { Dream: 3, Hunger: 0, Silence: 4, Stillness: 1, Empyrean: 0, Becoming: 0 },
    });
    expect(next.lotus.Silence).toBe(0);
    expect(next.lotus.Dream).toBe(3);
    expect(next.blindPetal).toBe("Silence");
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
});
