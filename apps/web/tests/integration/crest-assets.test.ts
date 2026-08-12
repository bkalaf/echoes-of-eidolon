import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { crestAssetFileNames } from "../../src/content/region-crests";

describe("regional crest static assets", () => {
  const crestRoot = resolve(process.cwd(), "public/crests");

  it("ships exactly the manifest-owned SVG files plus their generated vector sprite without bitmap substitutes", () => {
    expect(readdirSync(crestRoot).sort()).toEqual([...crestAssetFileNames, "region-crests.svg"].sort());
    for (const fileName of crestAssetFileNames) {
      const source = readFileSync(resolve(crestRoot, fileName), "utf8");
      expect(source).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512"/);
      expect(source).not.toMatch(/<image\b/i);
    }
  });

  it("preserves white and authored tones while mapping exact black to currentColor in the vector sprite", () => {
    const sprite = readFileSync(resolve(crestRoot, "region-crests.svg"), "utf8");

    expect(sprite.match(/<symbol\b/g)).toHaveLength(crestAssetFileNames.length);
    expect(sprite).toContain('id="crest-R03"');
    expect(sprite).toContain('fill="currentColor"');
    expect(sprite).toContain('fill="#fff"');
    expect(sprite).toContain('fill="#101010"');
    expect(sprite).toContain('stroke="none"');
    expect(sprite).not.toMatch(/fill="(?:#000|#000000|black|rgb\(0[, ]+0[, ]+0\))"/i);
  });

  it("keeps workstation download paths out of runtime sources", () => {
    const runtime = [
      "src/components/RegionCrest.tsx",
      "src/content/feature-crests.ts",
      "src/content/region-crests.ts",
      "src/screens/public/HomePage.tsx",
    ].map((fileName) => readFileSync(resolve(process.cwd(), fileName), "utf8")).join("\n");
    expect(runtime).not.toMatch(/\/home\/bobby\/Downloads|crests_30_svg/);
  });
});
