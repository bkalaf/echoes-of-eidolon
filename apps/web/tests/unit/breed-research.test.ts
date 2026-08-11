import { describe, expect, it, vi } from "vitest";

import { createBreedResearchAssertion, noellHistoricalQuoteKey } from "../../src/server/breed-research";

const input = {
  breedResearchEvidenceId: "BRE-1",
  breedResearchValueId: "BRV-1",
  breedId: "BREED-1",
  dimension: "LOQUACITY" as const,
  value: "TALKATIVE" as const,
  research: {
    researchId: "RES-1",
    notes: "Supported assertion",
    citationId: "CIT-1",
    category: "SPECIES" as const,
  },
};

describe("typed Breed research ownership", () => {
  it("uses the canonical Noell historical quotation key", () => {
    expect(noellHistoricalQuoteKey).toBe("NOELL_HISTORICAL_QUOTE");
  });

  it("creates Research and its one typed owner link atomically", async () => {
    const createValue = vi.fn(async ({ data }) => ({ breedResearchValueId: data.breedResearchValueId }));
    const createResearch = vi.fn(async ({ data }) => ({ researchId: data.researchId }));
    const createEvidence = vi.fn(async () => ({}));
    const database = {
      $transaction: vi.fn(async (work) => work({
        breed: { findUnique: async () => ({ breedId: input.breedId }) },
        citation: { findUnique: async () => ({ citationId: "CIT-1", source: { sourceId: "SRC-1" } }) },
        breedResearchValue: { findUnique: async () => null, create: createValue },
        research: { create: createResearch },
        breedResearchEvidence: { create: createEvidence },
      })),
    };
    await expect(createBreedResearchAssertion(input, database)).resolves.toEqual({
      breedResearchValueId: "BRV-1",
      researchId: "RES-1",
    });
    expect(createResearch).toHaveBeenCalledBefore(createEvidence);
  });

  it("rejects a value from another dimension before opening a transaction", async () => {
    const database = { $transaction: vi.fn() };
    await expect(createBreedResearchAssertion({ ...input, value: "JOYFUL" }, database as never))
      .rejects.toThrow("not valid for Breed dimension LOQUACITY");
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it("refuses Research without legitimate Source/Citation evidence", async () => {
    const database = {
      $transaction: async (work: (transaction: unknown) => Promise<unknown>) => work({
        breed: { findUnique: async () => ({ breedId: input.breedId }) },
        citation: { findUnique: async () => null },
      }),
    };
    await expect(createBreedResearchAssertion(input, database as never)).rejects.toThrow("requires a legitimate Source and Citation");
  });
});
