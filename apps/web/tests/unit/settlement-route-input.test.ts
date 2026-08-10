import { describe, expect, it } from "vitest";

import { foundCityInputSchema } from "../../src/routes/api/admin/settlements/found-city";
import { migrationInputSchema } from "../../src/routes/api/admin/settlements/migrate";

const foundCityInput = {
  departures: [{ amount: 10, breedId: "BREED-1", originSettlementWorldId: "SW-1" }],
  siteId: "SITE-1",
  worldKey: "CONCORD",
  year: 12,
};

describe("settlement admin input boundary", () => {
  it("accepts only the browser-owned founding fields", () => {
    expect(foundCityInputSchema.parse(foundCityInput)).toEqual(foundCityInput);
    expect(() => foundCityInputSchema.parse({
      ...foundCityInput,
      prompt: {
        promptText: "BROWSER AUTHORED PROMPT",
        purpose: "BROWSER_AUTHORED_PURPOSE",
        responseContract: { type: "object" },
        status: "READY",
      },
    })).toThrow();
  });

  it("fails closed on unknown fields and out-of-range years", () => {
    expect(() => foundCityInputSchema.parse({ ...foundCityInput, fabricated: true })).toThrow();
    expect(() => foundCityInputSchema.parse({ ...foundCityInput, year: 4041 })).toThrow();
    expect(() => migrationInputSchema.parse({
      destinationSettlementId: "SET-2",
      originSettlementId: "SET-1",
      rows: [{ amount: 1, breedId: "BREED-1", fabricated: true }],
      worldKey: "RUIN",
      year: 4,
    })).toThrow();
  });

  it("accepts only the three canonical WorldKey values", () => {
    for (const worldKey of ["CONCORD", "RUIN", "SCHISM"]) {
      expect(migrationInputSchema.parse({
        destinationSettlementId: "SET-2",
        originSettlementId: "SET-1",
        rows: [{ amount: 1, breedId: "BREED-1" }],
        worldKey,
        year: 4,
      }).worldKey).toBe(worldKey);
    }
    expect(() => foundCityInputSchema.parse({ ...foundCityInput, worldKey: "UNKNOWN_WORLD" })).toThrow();
  });
});
