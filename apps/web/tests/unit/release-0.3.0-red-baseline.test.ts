import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../..");
const repositoryRoot = resolve(webRoot, "../..");
const readWeb = (path: string) => readFileSync(resolve(webRoot, path), "utf8");

describe("Release 0.3.0 intentional red baseline", () => {
  it("R030-Q01 through Q03: the authoritative 2D Atlas map does not crop its EPSG:4326 stage", () => {
    const styles = readWeb("src/styles.css");
    expect(styles).not.toMatch(/\.map img\s*\{[^}]*object-fit:\s*cover/s);
  });

  it("R030-Q04 and Q05: deterministic founding Settlement and population importers exist", () => {
    expect(existsSync(resolve(webRoot, "scripts/import-initial-settlements.mts"))).toBe(true);
    expect(existsSync(resolve(webRoot, "scripts/import-initial-settlement-populations.mts"))).toBe(true);
  });

  it("R030-Q06 and Q07: Atlas Sites resolve selected-world occupancy instead of exposing every Site as foundable", () => {
    const atlas = readWeb("src/screens/admin/AtlasAdminPage.tsx");
    expect(atlas).toContain("/api/admin/settlements/?world=");
    expect(atlas).toContain('occupancy: founded ? "FOUNDED" : "CANDIDATE"');
    expect(atlas).toContain("Already founded");
    expect(atlas).toContain("aria-disabled={!worldKey || Boolean(selectedOccupancy)}");
  });

  it("R030-Q08: the exact current Guide titles and identities remain locked", () => {
    const guides = JSON.parse(readWeb("src/data/architect-witness-guide/guides.json")) as {
      guides: Array<{ title: string; characterId: string; soulId: string; worldKey: string }>;
    };
    expect(guides.guides.map(({ worldKey, title, characterId, soulId }) => ({ worldKey, title, characterId, soulId }))).toEqual([
      { worldKey: "CONCORD", title: "The Overseer", characterId: "CHA_HANS_HALYCON_HOHENZOLLERN", soulId: "SOUL_HANS_HALYCON_HOHENZOLLERN" },
      { worldKey: "SCHISM", title: "The Herald", characterId: "CHA_FRANK_ADRIAN_VOSS", soulId: "SOUL_FRANK_ADRIAN_VOSS" },
      { worldKey: "RUIN", title: "The Steward", characterId: "CHA_MOTHER", soulId: "SOUL_MOTHER" },
    ]);
  });

  it("R030-Q09 and Q14U: Campaign cards expose the exact readable reorder controls", () => {
    const campaign = readWeb("src/screens/admin/CampaignAdminPage.tsx");
    expect(campaign).toContain("↑ Move up");
    expect(campaign).toContain("↓ Move down");
  });

  it("R030-Q10 through Q13 and Q15: the exhaustive owner UI audit exists", () => {
    expect(existsSync(resolve(repositoryRoot, "artifacts/release-0.3.0-owner-data-ui-audit.json"))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, "artifacts/release-0.3.0/owner-ui/owner-row-edit-audit.json"))).toBe(true);
  });

  it("R030-Q16A: the registry-backed owner record detail route exists", () => {
    expect(existsSync(resolve(webRoot, "src/routes/admin/data/$entityKey/$recordId.tsx"))).toBe(true);
  });

  it("R030-Q16B: Taxonomy is a first-class relational Prisma entity", () => {
    const schema = readWeb("prisma/schema.prisma");
    expect(schema).toMatch(/model Taxonomy\s*\{/);
    expect(schema).toMatch(/taxonomyLevelId\s+String\s+@id/);
  });

  it("R030-Q17: production generator evidence covers all 70 blueprints", () => {
    const path = resolve(repositoryRoot, "artifacts/release-0.3.0/puzzles/puzzle-generator-coverage.json");
    expect(existsSync(path)).toBe(true);
    const coverage = JSON.parse(readFileSync(path, "utf8")) as { summary?: { productionGeneratorCount?: number } };
    expect(coverage.summary?.productionGeneratorCount).toBe(70);
  });
});
