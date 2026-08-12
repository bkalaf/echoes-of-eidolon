import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { effectiveAudioGains } from "../../src/domain/audio-settings";
import { currencyForWorld, projectWithdrawalWindow } from "../../src/domain/world-economy";
import { applyRecovery, projectRecoveryCondition } from "../../src/domain/recovery";

const schema = readFileSync(resolve(import.meta.dirname, "../../prisma/schema.prisma"), "utf8");

describe("0.3.0 gameplay foundation", () => {
  it("extends the existing owners instead of creating planner-only duplicates", () => {
    expect(schema).toMatch(/enum CompanionKey \{[\s\S]*\n {2}L\n\}/);
    expect(schema).toMatch(/model Soul \{[\s\S]*companionKey\s+CompanionKey\?/);
    expect(schema).toContain("model Occupation {");
    expect(schema).toContain("model OccupationAttributeAffinity {");
    expect(schema).toMatch(/enum AbilityType \{\s+CHARISMA\s+DEXTERITY\s+INTELLIGENCE\s+STAMINA\s+STRENGTH\s+WISDOM\s+\}/);
    expect(schema).toContain("knowledgeSkill");
    expect(schema).toContain("awarenessSkill");
    expect(schema).toContain("primaryAttribute");
    expect(schema).toContain("secondaryAttribute");
  });

  it("persists normalized world, party, money, service, recovery, soundtrack, and audio owners", () => {
    for (const model of ["WorldInstance", "Party", "PartyMember", "MoneyTransaction", "RecoveryPolicy", "Soundtrack", "SettlementSoundtrackAssignment", "PointOfInterestServiceAssignment"]) {
      expect(schema).toContain(`model ${model} {`);
    }
    expect(schema).toContain("audioMasterVolume");
    expect(schema).toContain("audioSoundtrackVolume");
    expect(schema).toContain("audioNarrativeVolume");
    expect(schema).toContain("audioMuted");
  });

  it("maps world currencies and derives rolling limits without mutable remaining counters", () => {
    expect(currencyForWorld("CONCORD")).toEqual({ asset: "CURRENCY_MANE.svg", name: "Mane" });
    expect(currencyForWorld("RUIN")).toEqual({ asset: "CURRENCY_FAN.svg", name: "Fan" });
    expect(currencyForWorld("SCHISM")).toEqual({ asset: "CURRENCY_MANTLE.svg", name: "Mantle" });
    expect(projectWithdrawalWindow({ currentGameMinute: 20_000n, limit: 100, withdrawals: [
      { amount: 20, occurredAtGameMinute: 9_919n },
      { amount: 30, occurredAtGameMinute: 9_921n },
      { amount: 40, occurredAtGameMinute: 19_000n },
    ] })).toEqual({ used: 70, remaining: 30, nextLimitIncreaseAtGameMinute: 20_001n });
  });

  it("keeps recovery thresholds authorable and composes audio buses from one value source", () => {
    expect(projectRecoveryCondition({ rest: 80, morale: 70, comfort: 60 }, { greenMinimum: 60, yellowMinimum: 40, orangeMinimum: 20 })).toBe("GREEN");
    expect(projectRecoveryCondition({ rest: 80, morale: 15, comfort: 60 }, { greenMinimum: 60, yellowMinimum: 40, orangeMinimum: 20 })).toBe("RED");
    expect(applyRecovery({ rest: 90, morale: 20, comfort: 30 }, { rest: 20, morale: 10, comfort: 5 }, 100)).toEqual({ rest: 100, morale: 30, comfort: 35 });
    expect(effectiveAudioGains({ master: 50, soundtrack: 80, narrative: 40, muted: false })).toEqual({ soundtrack: 0.4, narrative: 0.2 });
    expect(effectiveAudioGains({ master: 50, soundtrack: 80, narrative: 40, muted: true })).toEqual({ soundtrack: 0, narrative: 0 });
  });
});
