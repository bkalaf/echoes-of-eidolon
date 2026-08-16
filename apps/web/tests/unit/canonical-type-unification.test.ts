import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(import.meta.dirname, "../../prisma/schema.prisma"), "utf8");

const model = (name: string) => schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
const enumValues = (name: string) => (schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "")
  .split("\n").map((line) => line.trim().split(/\s+/)[0]).filter(Boolean);

describe("canonical Character subtype schema", () => {
  it("removes obsolete duplicate and reward-scoring models", () => {
    for (const name of ["Protagonist", "Antagonist", "RewardCandidate", "RewardEvidenceEvent", "RewardScoringPolicy", "RewardScoringWeight"]) expect(schema).not.toContain(`model ${name} {`);
    expect(schema).not.toContain("enum ProtagonistImportance {");
    expect(schema).not.toContain("enum DepartmentWitnessPathStatus {");
  });

  it("makes Character the concrete identity owner", () => {
    const character = model("Character");
    for (const field of ["displayName", "breedId", "occupationId", "worldKey", "soulId", "gender", "age", "faction", "primaryAttribute", "secondaryAttribute"]) expect(character).toMatch(new RegExp(`\\b${field}\\b`));
    expect(character).toMatch(/worldKey\s+WorldKey\?/);
    expect(character).toMatch(/soulId\s+String\?/);
  });

  it("uses the exact ArchitectDepartment enum and canonical WitnessDef color payload", () => {
    expect(enumValues("ArchitectDepartment")).toEqual([
      "ASTRONOMY", "NAVIGATION", "PROPULSION", "HABITABILITY", "PLANETOLOGY", "PHYSICS", "CHEMISTRY", "COMPUTING", "MATERIALS", "ENERGY", "NANOTECHNOLOGY", "BIOLOGY", "GENETICS", "CRYOBIOLOGY", "NEUROSCIENCE", "MEDICINE", "EPIDEMIOLOGY", "ECOLOGY", "TERRAFORMING", "AGRICULTURE", "BOTANY", "ZOOLOGY", "MICROBIOLOGY", "INTELLIGENCE", "ALIGNMENT", "SOFTWARE", "CYBERSECURITY", "CONTINUITY", "ARCHIVES", "SYSTEMS", "ARCHITECTURE", "ROBOTICS", "ELECTRICAL", "MANUFACTURING", "LOGISTICS", "RESOURCES", "RECYCLING", "SAFETY", "RELIABILITY", "COMMAND", "GOVERNANCE", "JUSTICE", "ECONOMICS", "ADMINISTRATION", "SOCIOLOGY", "PSYCHOLOGY", "ANTHROPOLOGY", "HISTORY", "EDUCATION", "LINGUISTICS", "HUMANITIES", "OUTREACH", "SPONSORSHIP", "INNOVATION",
    ]);
    expect(enumValues("WitnessColor")).toEqual([]);
  });

  it("uses direct one-to-one subtype links without global XOR or invented Companion identity", () => {
    expect(model("Architect")).toMatch(/characterId\s+String\s+@id/);
    expect(model("Architect")).not.toMatch(/architectId|profession/);
    expect(model("Architect")).toMatch(/department\s+ArchitectDepartment\?/);
    expect(model("Witness")).toMatch(/characterId\s+String\s+@id/);
    expect(model("Witness")).not.toMatch(/witnessId/);
    expect(model("Companion")).toMatch(/characterId\s+String\s+@id/);
    expect(model("Companion")).not.toMatch(/companionId/);
    expect(schema).not.toMatch(/subtype.*xor|xor.*subtype/i);
  });

  it("defines reusable WitnessDef and CompanionDef owners", () => {
    const witnessDef = model("WitnessDef");
    expect(witnessDef).toMatch(/witnessDefId\s+String\s+@id/);
    expect(witnessDef).toMatch(/department\s+ArchitectDepartment/);
    expect(witnessDef).toMatch(/apparentDomain\s+String/);
    expect(witnessDef).toMatch(/realDomain\s+String/);
    expect(witnessDef).toMatch(/color\s+Json/);
    expect(witnessDef).toMatch(/architectSoulId\s+String/);
    const companionDef = model("CompanionDef");
    expect(companionDef).toMatch(/companionKey\s+CompanionKey\s+@id/);
    for (const field of ["concordCharacterId", "ruinCharacterId", "schismCharacterId", "soulId", "heirloom", "knowledgeSkill", "awarenessSkill"]) expect(companionDef).toMatch(new RegExp(`\\b${field}\\b`));
  });

  it("keeps canonical Witness reward and constellation bindings but no Puzzle ownership", () => {
    const witness = model("Witness");
    for (const field of ["legendaryRewardId", "constellationBeforeId", "constellationAfterId", "architectCharacterId", "witnessDefId"]) expect(witness).toMatch(new RegExp(`\\b${field}\\b`));
    expect(witness).toMatch(/architect\s+Architect\s+@relation\(fields: \[architectCharacterId\], references: \[characterId\], onDelete: Restrict\)/);
    expect(witness).not.toMatch(/puzzleBlueprintId|inversionRule|witnessName|presentsAs|family\s/);
    expect(model("LegendaryReward")).toMatch(/witnesses\s+Witness\[\]/);
  });

  it("removes obsolete ownership and entity tokens", () => {
    expect(model("Soul")).not.toMatch(/companionKey|companions\s/);
    expect(model("Pillar")).not.toMatch(/seatNumber/);
    for (const token of ["PROTAGONIST", "ANTAGONIST", "DEPARTMENT", "MATRIX"]) expect(enumValues("EntityType")).not.toContain(token);
    expect(enumValues("CapabilityValueKind")).toContain("SCORE");
  });

  it("keeps Culture independent from Species and CulturePool persistence", () => {
    const culture = model("Culture");
    expect(culture).not.toMatch(/speciesId|culturePoolId/);
    expect(culture).toMatch(/cultureId\s+String\s+@id/);
  });
});
