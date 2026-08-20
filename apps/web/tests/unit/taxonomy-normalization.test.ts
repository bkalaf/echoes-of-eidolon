import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeTaxonomyPreflight, type SpeciesTaxonomyPreflightRow } from "../../src/domain/taxonomy-normalization";

const node = (
  taxonomyLevelId: string,
  type: "KINGDOM" | "PHYLUM" | "CLASS" | "ORDER" | "FAMILY" | "GENUS" | "SPECIES",
  name: string,
  parent: SpeciesTaxonomyPreflightRow["existingTaxonomy"] = null,
  isOfficial = true,
) => ({ taxonomyLevelId, type, name, parent, isOfficial });

describe("taxonomy normalization", () => {
  it("deduplicates shared nodes and resolves known casing and parent defects", () => {
    const animalia = node("TAX_KINGDOM_ANIMALIA", "KINGDOM", "Animalia");
    const upperAnimalia = node("TAX_KINGDOM_ANIMALIA", "KINGDOM", "ANIMALIA");
    const chordata = node("TAX_PHYLUM_CHORDATA", "PHYLUM", "Chordata", animalia);
    const orphanChordata = node("TAX_PHYLUM_CHORDATA", "PHYLUM", "Chordata", null);
    const rows: SpeciesTaxonomyPreflightRow[] = [
      { speciesId: "SPC_ALPHA", speciesName: "Alpha", existingTaxonomy: node("TAX_SPECIES_ALPHA", "SPECIES", "Alpha", chordata) },
      { speciesId: "SPC_BETA", speciesName: "Beta", existingTaxonomy: node("TAX_SPECIES_BETA", "SPECIES", "Beta", orphanChordata) },
      { speciesId: "SPC_GAMMA", speciesName: "Gamma", existingTaxonomy: node("TAX_SPECIES_GAMMA", "SPECIES", "Gamma", upperAnimalia) },
    ];

    const plan = normalizeTaxonomyPreflight(rows);

    expect(plan.conflicts).toEqual([]);
    expect(plan.nodes.find(({ taxonomyLevelId }) => taxonomyLevelId === "TAX_KINGDOM_ANIMALIA")).toMatchObject({ name: "Animalia", parentTaxonomyLevelId: null });
    expect(plan.nodes.find(({ taxonomyLevelId }) => taxonomyLevelId === "TAX_PHYLUM_CHORDATA")).toMatchObject({ parentTaxonomyLevelId: "TAX_KINGDOM_ANIMALIA" });
  });

  it("keeps the official Draco genus and isolates the manufactured Mythos genus", () => {
    const animalia = node("TAX_KINGDOM_ANIMALIA", "KINGDOM", "Animalia");
    const chordata = node("TAX_PHYLUM_CHORDATA", "PHYLUM", "Chordata", animalia);
    const reptilia = node("TAX_CLASS_REPTILIA", "CLASS", "Reptilia", chordata);
    const squamata = node("TAX_ORDER_SQUAMATA", "ORDER", "Squamata", reptilia);
    const agamidae = node("TAX_FAMILY_AGAMIDAE", "FAMILY", "Agamidae", squamata);
    const dracoiformes = node("TAX_ORDER_DRACOIFORMES", "ORDER", "Dracoiformes", null, false);
    const dracoidae = node("TAX_FAMILY_DRACOIDAE", "FAMILY", "Dracoidae", dracoiformes, false);
    const rows: SpeciesTaxonomyPreflightRow[] = [
      { speciesId: "SPC_DRACO_VOLANS", speciesName: "Flying dragon", existingTaxonomy: node("TAX_SPECIES_DRACO_VOLANS", "SPECIES", "Draco volans", node("TAX_GENUS_DRACO", "GENUS", "Draco", agamidae, true), true) },
      { speciesId: "SPC_DRACO_NAGA", speciesName: "Naga dragon", existingTaxonomy: node("TAX_SPECIES_DRACO_NAGA", "SPECIES", "Draco naga", node("TAX_GENUS_DRACO", "GENUS", "Draco", dracoidae, false), false) },
    ];

    const plan = normalizeTaxonomyPreflight(rows);

    expect(plan.conflicts).toEqual([]);
    expect(plan.nodes.find(({ taxonomyLevelId }) => taxonomyLevelId === "TAX_GENUS_DRACO")).toMatchObject({ isOfficial: true, parentTaxonomyLevelId: "TAX_FAMILY_AGAMIDAE" });
    expect(plan.nodes.find(({ taxonomyLevelId }) => taxonomyLevelId === "TAX_GENUS_DRACO_MYTHOS")).toMatchObject({ name: "Draco Mythos", isOfficial: false, parentTaxonomyLevelId: "TAX_FAMILY_DRACOIDAE" });
    expect(plan.speciesReferences.find(({ speciesId }) => speciesId === "SPC_DRACO_NAGA")?.taxonomyLevelId).toBe("TAX_SPECIES_DRACO_NAGA");
  });

  it("fails closed for an unknown duplicated-ID conflict", () => {
    const rows: SpeciesTaxonomyPreflightRow[] = [
      { speciesId: "SPC_ALPHA", speciesName: "Alpha", existingTaxonomy: node("TAX_SPECIES_SHARED", "SPECIES", "Shared") },
      { speciesId: "SPC_BETA", speciesName: "Beta", existingTaxonomy: node("TAX_SPECIES_SHARED", "SPECIES", "Different") },
    ];

    const conflicts = normalizeTaxonomyPreflight(rows).conflicts;
    expect(conflicts.some(({ taxonomyLevelId }) => taxonomyLevelId === "TAX_SPECIES_SHARED")).toBe(true);
  });

  it("normalizes the current production preflight without unresolved conflicts", () => {
    const inputPath = process.env.EIDOLON_TAXONOMY_PREFLIGHT_PATH;
    if (!inputPath) return;
    const rows = JSON.parse(readFileSync(inputPath, "utf8")) as SpeciesTaxonomyPreflightRow[];
    const plan = normalizeTaxonomyPreflight(rows);
    expect(plan.speciesCount).toBe(1_131);
    expect(plan.speciesWithTaxonomy).toBe(1_131);
    expect(plan.conflicts).toEqual([]);
    expect(plan.uniqueTaxonomyNodeIds).toBe(2_616);
    expect(plan.speciesReferences).toHaveLength(1_131);
    expect(plan.sourceConflicts).toHaveLength(25);
  });
});
