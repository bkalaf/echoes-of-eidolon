import { describe, expect, it } from "vitest";

import { chooseSoundtrack, parseSoundtrackSourcePath } from "../../src/domain/soundtrack";

describe("soundtrack authority", () => {
  it("accepts only the exact culture directory and CITY/TAVERN MP3 convention", () => {
    expect(parseSoundtrackSourcePath("/library/CULTURE_HOMO_SAPIEN_AFRICAN_AMERICAN/CULTURE_HOMO_SAPIEN_AFRICAN_AMERICAN_CITY.mp3")).toEqual({
      category: "CITY", cultureKey: "CULTURE_HOMO_SAPIEN_AFRICAN_AMERICAN", displayName: "Homo Sapien African American · City", sourceFilename: "CULTURE_HOMO_SAPIEN_AFRICAN_AMERICAN_CITY.mp3",
    });
    expect(parseSoundtrackSourcePath("/library/CULTURE_TEST/CULTURE_OTHER_CITY.mp3")).toBeNull();
    expect(parseSoundtrackSourcePath("/library/CULTURE_TEST/CULTURE_TEST_CITY.wav")).toBeNull();
    expect(parseSoundtrackSourcePath("/library/CULTURE_TEST/CULTURE_TEST_BATTLE.mp3")).toBeNull();
  });

  it("returns silence for an empty pool and avoids an immediate repeat", () => {
    const pool = [{ soundtrackId: "one" }, { soundtrackId: "two" }, { soundtrackId: "three" }];
    expect(chooseSoundtrack([], null)).toBeNull();
    expect(chooseSoundtrack(pool, "two", () => 0)).toEqual({ soundtrackId: "one" });
    expect(chooseSoundtrack(pool, "two", () => 0.99)).toEqual({ soundtrackId: "three" });
  });
});
