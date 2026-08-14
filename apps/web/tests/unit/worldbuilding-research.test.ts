import { describe, expect, it } from "vitest";

import {
  bindWorldbuildingResearchReview,
  classifyWorldbuildingResearch,
  applyWorldbuildingResearchReview,
  parseWorldbuildingResearchEnvelope,
  type WorldbuildingImportIdAllocator,
} from "../../src/server/worldbuilding-research";

const allocator: WorldbuildingImportIdAllocator = {
  allocate(entity, recordKey) { return `opaque:${entity}:${recordKey}`; },
};

describe("WorldBuilding v3 research staging", () => {
  it("retains incomplete research without weakening persistence DTOs", () => {
    const pack = parseWorldbuildingResearchEnvelope({
      entity: "worldbuilding-research",
      schemaVersion: "eidolon-worldbuilding-research-v3-simple",
      records: [
        { recordKey: "species:one", kind: "SPECIES", speciesRef: "species:one", status: "RESEARCH_COMPLETE_IMPORTABLE", data: { name: "One", speciesKind: "BEAST", originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" } },
        { recordKey: "culture:blocked", kind: "CULTURE", cultureRef: "culture:blocked", status: "RESEARCH_COMPLETE_BLOCKED", data: { name: "Blocked", culturePoolId: null } },
        { recordKey: "breed:one", kind: "BREED", breedRef: "breed:one", speciesRef: "species:one", status: "RESEARCH_COMPLETE_IMPORTABLE", data: { name: "Breed", groupId: "B01", personalityId: null } },
      ],
    });
    const result = classifyWorldbuildingResearch(pack, { existingRefs: new Set(), personalityIds: new Set() });
    expect(result.rows.map((row) => [row.recordKey, row.status])).toEqual([
      ["species:one", "RESEARCH_COMPLETE_IMPORTABLE"],
      ["culture:blocked", "RESEARCH_COMPLETE_BLOCKED"],
      ["breed:one", "RESEARCH_COMPLETE_BLOCKED"],
    ]);
    expect(result.importableClosure).toEqual(["species:one"]);
  });

  it("allocates opaque IDs only for the importable closure and binds map plus payload digest", () => {
    const pack = parseWorldbuildingResearchEnvelope({
      entity: "worldbuilding-research",
      schemaVersion: "eidolon-worldbuilding-research-v3-simple",
      records: [{ recordKey: "species:one", kind: "SPECIES", speciesRef: "species:one", status: "RESEARCH_COMPLETE_IMPORTABLE", data: { name: "One", speciesKind: "BEAST", originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" } }],
    });
    const classified = classifyWorldbuildingResearch(pack, { existingRefs: new Set(), personalityIds: new Set() });
    const first = bindWorldbuildingResearchReview(pack, classified, allocator);
    const second = bindWorldbuildingResearchReview(pack, classified, allocator, first.idMap);
    expect(first.idMap).toEqual({ "species:one": "opaque:SPECIES:species:one" });
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toEqual(first);
  });

  it("retains reviewed opaque IDs for persisted dependencies without allocating IDs to blocked staged rows", () => {
    const pack = parseWorldbuildingResearchEnvelope({ entity: "worldbuilding-research", schemaVersion: "eidolon-worldbuilding-research-v3-simple", records: [
      { recordKey: "culture:blocked", kind: "CULTURE", cultureRef: "culture:blocked", status: "RESEARCH_COMPLETE_BLOCKED", data: { name: "Blocked", culturePoolId: null } },
      { recordKey: "breed:new", kind: "BREED", breedRef: "breed:new", speciesRef: "species:persisted", status: "RESEARCH_COMPLETE_IMPORTABLE", data: { name: "New Breed", groupId: "B01", personalityId: "PERSONALITY", foodBroad: [], foodSpecific: [], terrainBroad: [], terrainSpecific: [] } },
    ] });
    const classified = classifyWorldbuildingResearch(pack, {
      existingRefs: new Set(["species:persisted"]),
      personalityIds: new Set(["PERSONALITY"]),
      speciesKindsByRef: { "species:persisted": "BEAST" },
    });
    const review = bindWorldbuildingResearchReview(pack, classified, allocator, {
      "species:persisted": "opaque-persisted-species-id",
      "culture:blocked": "must-not-survive",
    });
    expect(review.idMap).toEqual({
      "species:persisted": "opaque-persisted-species-id",
      "breed:new": "opaque:BREED:breed:new",
    });
  });

  it("applies only the dependency-closed selection in Species to Culture to Breed order", async () => {
    const pack = parseWorldbuildingResearchEnvelope({ entity: "worldbuilding-research", schemaVersion: "eidolon-worldbuilding-research-v3-simple", records: [
      { recordKey: "species:one", kind: "SPECIES", speciesRef: "species:one", status: "RESEARCH_COMPLETE_IMPORTABLE", data: { name: "One", speciesKind: "PET", originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" } },
      { recordKey: "culture:blocked", kind: "CULTURE", cultureRef: "culture:blocked", status: "RESEARCH_COMPLETE_BLOCKED", data: { name: "Blocked", culturePoolId: null } },
      { recordKey: "breed:one", kind: "BREED", breedRef: "breed:one", speciesRef: "species:one", status: "RESEARCH_COMPLETE_IMPORTABLE", data: { name: "Pet Breed", groupId: "P01", personalityId: null, foodBroad: [], foodSpecific: [], terrainBroad: [], terrainSpecific: [] } },
    ] });
    const classified = classifyWorldbuildingResearch(pack, { existingRefs: new Set(), personalityIds: new Set() });
    const review = bindWorldbuildingResearchReview(pack, classified, allocator);
    const calls: string[] = [];
    const delegate = (kind: string) => ({ findUnique: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { calls.push(`${kind}:${String(Object.values(data)[0])}`); return data; } });
    const database = { $transaction: async <T>(work: (transaction: unknown) => Promise<T>) => work({ species: delegate("SPECIES"), culture: delegate("CULTURE"), breed: delegate("BREED") }) };
    await expect(applyWorldbuildingResearchReview(pack, classified, review, database)).resolves.toEqual({ applied: 2, unchanged: 0, retainedBlocked: 1 });
    expect(calls.map((call) => call.split(":")[0])).toEqual(["SPECIES", "BREED"]);
  });
});
