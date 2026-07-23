import { describe, expect, it } from "vitest";
import { defaultLiveState, diffLiveState, mergeLiveState } from "@/lib/table/state";

describe("table live state", () => {
  it("clamps harm and converts breach to void", () => {
    const base = defaultLiveState({ breach: 5, voidMarks: 1 });
    const next = mergeLiveState(base, { breach: 7 });
    // 5+7 would be wrong; patch replaces breach then merge converts while >= 6
    expect(next.breach).toBe(1); // 7 -> convert once -> 1 breach, void 2
    expect(next.voidMarks).toBe(2);
    expect(next.harm).toBe(0);
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
