import { describe, expect, it } from "vitest";
import {
  applyStatePatch,
  defaultLiveState,
  mergeLiveState,
  type LiveState,
  type StateStoreAdapter,
} from "@/lib/table/state";

/** In-memory stand-in for the session_operator_state row + state_version column. */
class FakeSessionRow {
  liveState: LiveState;
  version = 1;
  left = false;

  constructor(initial: Partial<LiveState> = {}) {
    this.liveState = defaultLiveState(initial);
  }

  adapter(): StateStoreAdapter {
    return {
      read: async () => {
        if (this.left) return null;
        return { liveState: this.liveState, version: this.version };
      },
      write: async ({ liveState, expectedVersion }) => {
        if (this.left) return { ok: false };
        if (this.version !== expectedVersion) return { ok: false };
        this.liveState = liveState;
        this.version += 1;
        return { ok: true, version: this.version };
      },
    };
  }
}

/** Wraps an adapter so a caller-supplied side effect fires once, right after the
 *  first read and before the first write — simulating a concurrent actor's
 *  commit landing in that exact window. */
function withInjectedRace(base: StateStoreAdapter, inject: () => void): StateStoreAdapter {
  let injected = false;
  return {
    read: base.read,
    write: async (input) => {
      if (!injected) {
        injected = true;
        inject();
      }
      return base.write(input);
    },
  };
}

function countingAdapter(base: StateStoreAdapter) {
  const calls = { read: 0, write: 0 };
  return {
    calls,
    adapter: {
      read: async () => {
        calls.read += 1;
        return base.read();
      },
      write: async (input: { liveState: LiveState; expectedVersion: number }) => {
        calls.write += 1;
        return base.write(input);
      },
    } satisfies StateStoreAdapter,
  };
}

describe("applyStatePatch optimistic concurrency", () => {
  it("applies a patch in one round trip when there is no contention", async () => {
    const row = new FakeSessionRow({ harm: 1, stability: 8 });
    const result = await applyStatePatch("pressure_round", { harm: 2 }, row.adapter());
    expect(result?.attempts).toBe(1);
    expect(row.liveState.harm).toBe(2);
    expect(row.version).toBe(2);
  });

  it("preserves a concurrent writer's field instead of reverting it to a stale snapshot", async () => {
    // Handler and Operator both act on the same row. Handler's write (stability
    // 8 -> 5) lands in the gap between the Operator's read and write.
    const row = new FakeSessionRow({ harm: 1, stability: 8 });
    const racedAdapter = withInjectedRace(row.adapter(), () => {
      row.liveState = mergeLiveState(row.liveState, { stability: 5 });
      row.version += 1;
    });

    const result = await applyStatePatch("pressure_round", { harm: 2 }, racedAdapter);

    // Had to retry once after losing the first compare-and-swap.
    expect(result?.attempts).toBe(2);
    // Our own patched field applied.
    expect(row.liveState.harm).toBe(2);
    // The concurrent writer's field survived — a naive read/merge/write would
    // have reapplied the Operator's stale `before.stability` (8) here and
    // silently undone the Handler's already-committed change. This is the
    // lost-update bug applyStatePatch exists to close.
    expect(row.liveState.stability).toBe(5);
  });

  it("resolves a genuine same-field race to whichever patch lands last", async () => {
    // Both sides patch `harm` within the race window. Handler's write (harm -> 3)
    // lands between the Operator's read and write; the Operator's own explicit
    // value (harm -> 2) still wins for that field once it retries and reapplies
    // its own patch on top of the Handler's committed row — a defined,
    // deterministic outcome instead of an accidental one.
    const row = new FakeSessionRow({ harm: 1 });
    const racedAdapter = withInjectedRace(row.adapter(), () => {
      row.liveState = mergeLiveState(row.liveState, { harm: 3 });
      row.version += 1;
    });

    const result = await applyStatePatch("pressure_round", { harm: 2 }, racedAdapter);

    expect(result?.attempts).toBe(2);
    expect(row.liveState.harm).toBe(2);
  });

  it("does not write when the patch produces no diff", async () => {
    const row = new FakeSessionRow({ harm: 2 });
    const { calls, adapter } = countingAdapter(row.adapter());
    const result = await applyStatePatch("pressure_round", { harm: 2 }, adapter);
    expect(result?.diffs).toEqual([]);
    expect(calls.write).toBe(0);
    expect(row.version).toBe(1);
  });

  it("returns null when the operator has left the session", async () => {
    const row = new FakeSessionRow({ harm: 1 });
    row.left = true;
    const result = await applyStatePatch("pressure_round", { harm: 2 }, row.adapter());
    expect(result).toBeNull();
  });

  it("throws after exhausting retries under continuous contention", async () => {
    const row = new FakeSessionRow({ harm: 0 });
    const alwaysLosesRace: StateStoreAdapter = {
      read: async () => ({ liveState: row.liveState, version: row.version }),
      write: async () => {
        // Simulate another writer always committing first.
        row.version += 1;
        return { ok: false };
      },
    };
    await expect(applyStatePatch("pressure_round", { harm: 3 }, alwaysLosesRace, 3)).rejects.toThrow(
      /concurrent attempts/,
    );
  });

  it("only ever writes fields whitelisted for the sync kind, even across retries", async () => {
    const row = new FakeSessionRow({ harm: 1, breach: 0 });
    const racedAdapter = withInjectedRace(row.adapter(), () => {
      row.liveState = mergeLiveState(row.liveState, { stability: 4 });
      row.version += 1;
    });
    // pressure_round never allows `breach` through, even if a caller sneaks it in.
    const result = await applyStatePatch(
      "pressure_round",
      { harm: 2, breach: 50 } as Partial<LiveState>,
      racedAdapter,
    );
    expect(result?.after.breach).toBe(0);
    expect(row.liveState.breach).toBe(0);
  });
});
