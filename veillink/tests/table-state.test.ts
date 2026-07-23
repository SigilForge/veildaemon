import { describe, expect, it } from "vitest";
import { defaultLiveState, diffLiveState, mergeLiveState } from "@/lib/table/state";

describe("table live state", () => {
  it("clamps tracks without converting Breach into Void", () => {
    // Operator Guide: Void opens gates; Breach fills pips. Separate currencies.
    const base = defaultLiveState({ breach: 5, voidMarks: 1, harm: 0 });
    const next = mergeLiveState(base, { breach: 7, harm: 9 });
    expect(next.breach).toBe(7);
    expect(next.voidMarks).toBe(1);
    expect(next.harm).toBe(5); // clamp 0–5
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
