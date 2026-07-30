import { describe, expect, it } from "vitest";
import { importFromOperatorExport } from "@/lib/table/state";

function operatorExport(overrides: Record<string, unknown> = {}) {
  return {
    exportType: "cradlepoint.operator",
    version: 1,
    exportedAt: "2026-07-30T21:00:00.000Z",
    operatorName: "Cathy Holloway",
    operatorId: "cathy-1",
    source: "veildaemon.operatorConsole.v1",
    operatorRecord: { designation: "Knox-07" },
    operatorStatus: {
      operatorName: "Cathy Holloway",
      designation: "Knox-07",
      harmBoxes: "2",
      stability: "7",
      breachPoints: "5",
      voidMarks: "3",
      blindPetal: "Silence",
      lotus: { Dream: 4, Hunger: 0, Silence: 0, Stillness: 2, Empyrean: 0, Becoming: 1 },
    },
    operatorEquipment: [],
    ...overrides,
  };
}

describe("importFromOperatorExport", () => {
  it("maps a well-formed export into VeilLink identity + live-state fields", () => {
    const result = importFromOperatorExport(operatorExport());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.displayName).toBe("Cathy Holloway");
    expect(result.result.designation).toBe("Knox-07");
    expect(result.result.blindPetal).toBe("Silence");
    expect(result.result.liveState.harm).toBe(2);
    expect(result.result.liveState.stability).toBe(7);
    expect(result.result.liveState.breach).toBe(5);
    expect(result.result.liveState.voidMarks).toBe(3);
    expect(result.result.liveState.lotus?.Dream).toBe(4);
    expect(result.result.liveState.lotus?.Stillness).toBe(2);
    expect(result.result.snapshot).toEqual(operatorExport());
  });

  it("falls back through operatorName -> operatorRecord.designation -> status.designation", () => {
    const result = importFromOperatorExport(
      operatorExport({ operatorStatus: { designation: "Fallback-Op", harmBoxes: "0" } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // No status.operatorName; operatorRecord.designation ("Knox-07") wins over status.designation.
    expect(result.result.displayName).toBe("Knox-07");
  });

  it("clamps out-of-range values instead of overflowing", () => {
    const result = importFromOperatorExport(
      operatorExport({
        operatorStatus: {
          operatorName: "Overloaded",
          harmBoxes: "99",
          stability: "-5",
          breachPoints: "500",
          voidMarks: "40",
          blindPetal: "Silence",
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.liveState.harm).toBe(5);
    expect(result.result.liveState.stability).toBe(0);
    expect(result.result.liveState.breach).toBe(99);
    expect(result.result.liveState.voidMarks).toBe(13);
  });

  it("omits fields the export never set, instead of injecting false zeros", () => {
    const result = importFromOperatorExport({
      exportType: "cradlepoint.operator",
      operatorStatus: { operatorName: "Sparse", blindPetal: "Dream" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.liveState.harm).toBeUndefined();
    expect(result.result.liveState.stability).toBeUndefined();
    expect(result.result.liveState.breach).toBeUndefined();
    expect(result.result.liveState.voidMarks).toBeUndefined();
  });

  it("rejects a payload with the wrong exportType", () => {
    const result = importFromOperatorExport({ exportType: "cradlepoint.authorization", flags: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(importFromOperatorExport(null).ok).toBe(false);
    expect(importFromOperatorExport("not json").ok).toBe(false);
    expect(importFromOperatorExport(42).ok).toBe(false);
  });

  it("falls back to the Silence Blind Petal when the export's value isn't a valid Frequency", () => {
    const result = importFromOperatorExport(
      operatorExport({ operatorStatus: { operatorName: "Bad Petal", blindPetal: "Nonsense" } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.blindPetal).toBe("Silence");
  });
});
