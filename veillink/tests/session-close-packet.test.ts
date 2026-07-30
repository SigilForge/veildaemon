import { describe, expect, it } from "vitest";
import { buildSessionClosePacket } from "@/lib/table/authorizationPacket";

describe("buildSessionClosePacket", () => {
  it("always includes HARM_SET and STABILITY_SET as absolute values", () => {
    const packet = buildSessionClosePacket({
      operatorName: "Cathy Holloway",
      finalHarm: 2,
      finalStability: 7,
    });
    expect(packet.exportType).toBe("cradlepoint.authorization");
    expect(packet.operatorName).toBe("Cathy Holloway");
    expect(packet.flags).toContain("HARM_SET:2");
    expect(packet.flags).toContain("STABILITY_SET:7");
  });

  it("clamps Harm/Stability to their track ranges", () => {
    const packet = buildSessionClosePacket({
      operatorName: "Overloaded",
      finalHarm: 99,
      finalStability: -5,
    });
    expect(packet.flags).toContain("HARM_SET:5");
    expect(packet.flags).toContain("STABILITY_SET:0");
  });

  it("omits VOID_REWARD/BREACH_REWARD when nothing was awarded", () => {
    const packet = buildSessionClosePacket({
      operatorName: "No Reward",
      finalHarm: 0,
      finalStability: 10,
      voidAwarded: 0,
      breachAwarded: 0,
    });
    expect(packet.flags.some((f) => f.startsWith("VOID_REWARD"))).toBe(false);
    expect(packet.flags.some((f) => f.startsWith("BREACH_REWARD"))).toBe(false);
  });

  it("includes VOID_REWARD/BREACH_REWARD as the combined group + per-operator total the caller computed", () => {
    const packet = buildSessionClosePacket({
      operatorName: "Above and Beyond",
      finalHarm: 1,
      finalStability: 9,
      voidAwarded: 3,
      breachAwarded: 6, // e.g. group 5 + per-operator bonus 1, already summed by the caller
    });
    expect(packet.flags).toContain("VOID_REWARD:3");
    expect(packet.flags).toContain("BREACH_REWARD:6");
  });

  it("emits ONTOLOGY_UNLOCK / BACKGROUND_UNLOCK / CASE_UNLOCK flags matching the static parser's format", () => {
    const packet = buildSessionClosePacket({
      operatorName: "Unlocked",
      finalHarm: 0,
      finalStability: 10,
      ontologyUnlocks: ["sanguine", "wraith touched"],
      backgroundUnlocks: ["Tech"],
      caseUnlock: "needlepoint_survivor",
    });
    expect(packet.flags).toContain("ONTOLOGY_UNLOCK:sanguine");
    expect(packet.flags).toContain("ONTOLOGY_UNLOCK:wraith touched");
    expect(packet.flags).toContain("BACKGROUND_UNLOCK:Tech");
    expect(packet.flags).toContain("CASE_UNLOCK:needlepoint_survivor");
  });

  it("skips blank ontology/background/case entries", () => {
    const packet = buildSessionClosePacket({
      operatorName: "Blanks",
      finalHarm: 0,
      finalStability: 10,
      ontologyUnlocks: ["", "  "],
      backgroundUnlocks: [],
      caseUnlock: "   ",
    });
    expect(packet.flags.some((f) => f.startsWith("ONTOLOGY_UNLOCK"))).toBe(false);
    expect(packet.flags.some((f) => f.startsWith("CASE_UNLOCK"))).toBe(false);
  });

  it("every flag matches the static Operator sheet's parser regex", () => {
    const packet = buildSessionClosePacket({
      operatorName: "Full Packet",
      finalHarm: 3,
      finalStability: 4,
      voidAwarded: 2,
      breachAwarded: 5,
      ontologyUnlocks: ["SANGUINE"],
      backgroundUnlocks: ["TECH"],
      caseUnlock: "NEEDLEPOINT_SURVIVOR",
    });
    // Mirrors operator/operator.js parseAuthorizationPacket's flag regex.
    const flagRegex = /^(?:(?:ONTOLOGY|BACKGROUND|CASE|ARCHIVE)_UNLOCK|(?:VOID|BREACH)_REWARD|(?:HARM|STABILITY)_SET):[A-Z0-9_ -]+$/i;
    for (const flag of packet.flags) {
      expect(flag).toMatch(flagRegex);
    }
  });

  it("uses a distinct default note for one-shot vs ongoing sessions", () => {
    const oneShot = buildSessionClosePacket({ operatorName: "X", finalHarm: 0, finalStability: 10, oneShot: true });
    const ongoing = buildSessionClosePacket({ operatorName: "X", finalHarm: 0, finalStability: 10, oneShot: false });
    expect(oneShot.note).not.toBe(ongoing.note);
  });

  it("respects an explicit note override", () => {
    const packet = buildSessionClosePacket({
      operatorName: "X",
      finalHarm: 0,
      finalStability: 10,
      note: "Custom Handler note.",
    });
    expect(packet.note).toBe("Custom Handler note.");
  });

  it("defaults packetLabel to Session Archive when no session label is given", () => {
    const packet = buildSessionClosePacket({ operatorName: "X", finalHarm: 0, finalStability: 10 });
    expect(packet.packetLabel).toBe("Session Archive");
  });
});
