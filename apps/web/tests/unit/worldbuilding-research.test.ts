import { describe, expect, it } from "vitest";

import {
  bindWorldbuildingResearchReview,
  classifyWorldbuildingResearch,
  applyWorldbuildingResearchReview,
  buildWorldbuildingResearchEnvelopes,
  parseWorldbuildingResearchEnvelope,
  WorldbuildingEnvelopeLimitError,
} from "../../src/server/worldbuilding-research";

describe("WorldBuilding v3 research staging", () => {
  it("retains incomplete research without weakening persistence DTOs", () => {
    const pack = parseWorldbuildingResearchEnvelope({
      entity: "worldbuilding-research",
      schemaVersion: "eidolon-worldbuilding-research-v3-simple",
      records: [
        { recordKey: "local:species:one", kind: "SPECIES", speciesRef: "SPC_ONE", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { speciesId: "SPC_ONE", name: "One", speciesKind: "BEAST", originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" } },
        { recordKey: "local:culture:blocked", kind: "CULTURE", cultureRef: "CLT_BLOCKED", researchStatus: "REVIEW_REQUIRED", importStatus: "RESEARCH_COMPLETE_BLOCKED", data: { cultureId: "CLT_BLOCKED", name: "Blocked", culturePoolId: null } },
        { recordKey: "local:breed:one", kind: "BREED", breedRef: "BRD_BREED", speciesRef: "SPC_ONE", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { breedId: "BRD_BREED", name: "Breed", groupId: "B01", personalityId: null } },
      ],
    });
    const result = classifyWorldbuildingResearch(pack, { existingRefs: new Set(), personalityIds: new Set() });
    expect(result.rows.map((row) => [row.recordKey, row.importStatus])).toEqual([
      ["local:species:one", "RESEARCH_COMPLETE_IMPORTABLE"],
      ["local:culture:blocked", "RESEARCH_COMPLETE_BLOCKED"],
      ["local:breed:one", "RESEARCH_COMPLETE_BLOCKED"],
    ]);
    expect(result.importableClosure).toEqual(["SPC_ONE"]);
  });

  it("preserves explicit canonical persistence IDs without allocating replacements", () => {
    const pack = parseWorldbuildingResearchEnvelope({
      entity: "worldbuilding-research",
      schemaVersion: "eidolon-worldbuilding-research-v3-simple",
      records: [{ recordKey: "checkpoint:species:one", kind: "SPECIES", speciesRef: "SPC_ONE", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { speciesId: "SPC_ONE", name: "One", speciesKind: "BEAST", originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" } }],
    });
    const classified = classifyWorldbuildingResearch(pack, { existingRefs: new Set(), personalityIds: new Set() });
    const first = bindWorldbuildingResearchReview(pack, classified);
    const second = bindWorldbuildingResearchReview(pack, classified, first.idMap);
    expect(first.idMap).toEqual({ "SPC_ONE": "SPC_ONE" });
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toEqual(first);
  });

  it("retains exact canonical IDs for persisted dependencies without allocating IDs to blocked staged rows", () => {
    const pack = parseWorldbuildingResearchEnvelope({ entity: "worldbuilding-research", schemaVersion: "eidolon-worldbuilding-research-v3-simple", records: [
      { recordKey: "local:culture:blocked", kind: "CULTURE", cultureRef: "CLT_BLOCKED", researchStatus: "REVIEW_REQUIRED", importStatus: "RESEARCH_COMPLETE_BLOCKED", data: { cultureId: "CLT_BLOCKED", name: "Blocked", culturePoolId: null } },
      { recordKey: "local:breed:new", kind: "BREED", breedRef: "BRD_NEW_BREED", speciesRef: "SPC_PERSISTED", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { breedId: "BRD_NEW_BREED", name: "New Breed", groupId: "B01", personalityId: "PERSONALITY", foodBroad: [], foodSpecific: [], terrainBroad: [], terrainSpecific: [] } },
    ] });
    const classified = classifyWorldbuildingResearch(pack, {
      existingRefs: new Set(["SPC_PERSISTED"]),
      personalityIds: new Set(["PERSONALITY"]),
      speciesKindsByRef: { SPC_PERSISTED: "BEAST" },
    });
    const review = bindWorldbuildingResearchReview(pack, classified, {
      SPC_PERSISTED: "SPC_PERSISTED",
      CLT_BLOCKED: "must-not-survive",
    });
    expect(review.idMap).toEqual({
      SPC_PERSISTED: "SPC_PERSISTED",
      BRD_NEW_BREED: "BRD_NEW_BREED",
    });
  });

  it("applies only the dependency-closed selection in Species to Culture to Breed order", async () => {
    const pack = parseWorldbuildingResearchEnvelope({ entity: "worldbuilding-research", schemaVersion: "eidolon-worldbuilding-research-v3-simple", records: [
      { recordKey: "local:species:one", kind: "SPECIES", speciesRef: "SPC_ONE", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { speciesId: "SPC_ONE", name: "One", speciesKind: "PET", anthropomorphization: null, appearance: "A compact biological animal form.", clothing: null, architecture: null, originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" } },
      { recordKey: "local:culture:blocked", kind: "CULTURE", cultureRef: "CLT_BLOCKED", researchStatus: "REVIEW_REQUIRED", importStatus: "RESEARCH_COMPLETE_BLOCKED", data: { cultureId: "CLT_BLOCKED", name: "Blocked", culturePoolId: null } },
      { recordKey: "local:breed:one", kind: "BREED", breedRef: "BRD_PET_BREED", speciesRef: "SPC_ONE", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { breedId: "BRD_PET_BREED", name: "Pet Breed", groupId: "P01", personalityId: null, foodBroad: [], foodSpecific: [], terrainBroad: [], terrainSpecific: [] } },
    ] });
    const classified = classifyWorldbuildingResearch(pack, { existingRefs: new Set(), personalityIds: new Set() });
    const review = bindWorldbuildingResearchReview(pack, classified);
    const calls: string[] = [];
    const delegate = (kind: string) => ({ findUnique: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { calls.push(`${kind}:${String(Object.values(data)[0])}`); return data; } });
    const database = { $transaction: async <T>(work: (transaction: unknown) => Promise<T>) => work({ species: delegate("SPECIES"), culture: delegate("CULTURE"), breed: delegate("BREED") }) };
    await expect(applyWorldbuildingResearchReview(pack, classified, review, database)).resolves.toEqual({ applied: 2, unchanged: 0, retainedBlocked: 1 });
    expect(calls.map((call) => call.split(":")[0])).toEqual(["SPECIES", "BREED"]);
  });

  it("converges identical canonical entities and merges their local evidence provenance", () => {
    const common = { kind: "SPECIES" as const, speciesRef: "SPC_ONE", researchStatus: "RESOLVED" as const, importStatus: "RESEARCH_COMPLETE_IMPORTABLE" as const, data: { speciesId: "SPC_ONE", name: "One", speciesKind: "BEAST", originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" } };
    const pack = parseWorldbuildingResearchEnvelope({ entity: "worldbuilding-research", schemaVersion: "eidolon-worldbuilding-research-v3-simple", records: [
      { ...common, recordKey: "source:a", evidence: [{ evidenceKey: "A" }] },
      { ...common, recordKey: "source:b", evidence: [{ evidenceKey: "B" }] },
    ] });
    const classified = classifyWorldbuildingResearch(pack, { existingRefs: new Set(), personalityIds: new Set() });
    expect(classified.rows).toHaveLength(2);
    expect(classified.canonicalRows).toHaveLength(1);
    expect(classified.canonicalRows[0]?.evidence).toEqual([{ evidenceKey: "A" }, { evidenceKey: "B" }]);
    expect(classified.importableClosure).toEqual(["SPC_ONE"]);
  });

  it("preserves conflicting canonical duplicates for review instead of silently choosing one", () => {
    const base = { kind: "SPECIES" as const, speciesRef: "SPC_ONE", researchStatus: "RESOLVED" as const, importStatus: "RESEARCH_COMPLETE_IMPORTABLE" as const, data: { speciesId: "SPC_ONE", name: "One", speciesKind: "BEAST", originMode: "UNKNOWN", reproductiveMethod: "UNKNOWN", longevityClass: "UNKNOWN", mortalityMode: "UNKNOWN", soulDisposition: "UNKNOWN", continuityGroup: "UNKNOWN", continuityPropagationMode: "UNKNOWN" } };
    const pack = parseWorldbuildingResearchEnvelope({ entity: "worldbuilding-research", schemaVersion: "eidolon-worldbuilding-research-v3-simple", records: [
      { ...base, recordKey: "source:a" },
      { ...base, recordKey: "source:b", data: { ...base.data, scientificName: "Conflicting value" } },
    ] });
    const classified = classifyWorldbuildingResearch(pack, { existingRefs: new Set(), personalityIds: new Set() });
    expect(classified.rows.every((row) => row.researchStatus === "CONFLICTING_SOURCES" && row.importStatus === "RESEARCH_COMPLETE_BLOCKED")).toBe(true);
    expect(classified.importableClosure).toEqual([]);
  });

  it("packs only whole dependency components, orders roots before Breeds, and counts canonical rows", () => {
    const records = [
      { recordKey: "s:a", kind: "SPECIES", speciesRef: "SPC_A", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { speciesId: "SPC_A", name: "A" } },
      { recordKey: "c:a", kind: "CULTURE", cultureRef: "CLT_A", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { cultureId: "CLT_A", name: "A" } },
      { recordKey: "b:a", kind: "BREED", breedRef: "BRD_A", speciesRef: "SPC_A", cultureRef: "CLT_A", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { breedId: "BRD_A", name: "A" } },
      { recordKey: "s:b", kind: "SPECIES", speciesRef: "SPC_B", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { speciesId: "SPC_B", name: "B" } },
    ];
    const envelopes = buildWorldbuildingResearchEnvelopes(records, { maximumCanonicalRows: 3 });
    expect(envelopes.map((envelope) => envelope.records.map((record) => record.kind))).toEqual([["SPECIES", "CULTURE", "BREED"], ["SPECIES"]]);
  });

  it("emits the explicit envelope blocker when one intact component exceeds the limit", () => {
    const records = [
      { recordKey: "s:a", kind: "SPECIES", speciesRef: "SPC_A", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { speciesId: "SPC_A", name: "A" } },
      { recordKey: "b:a", kind: "BREED", breedRef: "BRD_A", speciesRef: "SPC_A", researchStatus: "RESOLVED", importStatus: "RESEARCH_COMPLETE_IMPORTABLE", data: { breedId: "BRD_A", name: "A" } },
    ];
    expect(() => buildWorldbuildingResearchEnvelopes(records, { maximumCanonicalRows: 1 })).toThrow(WorldbuildingEnvelopeLimitError);
    expect(() => buildWorldbuildingResearchEnvelopes(records, { maximumCanonicalRows: 1 })).toThrow("ENVELOPE_LIMIT_IMPLEMENTATION_BLOCKER");
  });
});
