import { canonicalTaxonomyLevelId, validateBreed, validateBreedHierarchy, type TaxonomyType } from "../domain/worldbuilding";
import type { PrismaClient } from "../generated/prisma/client";

export async function collectWorldbuildingIntegrityIssues(database: PrismaClient) {
  const [species, taxonomy, breeds, personalities] = await Promise.all([
    database.species.findMany({ select: { speciesId: true, taxonomyLevelId: true, taxonomy: { select: { taxonomyLevelId: true } } } }),
    database.taxonomy.findMany({ select: { taxonomyLevelId: true, type: true, name: true, parentTaxonomyLevelId: true } }),
    database.breed.findMany({ include: { parentBreed: { select: { breedId: true, speciesId: true, populationKind: true, parentBreedId: true } }, species: { select: { speciesKind: true } } } }),
    database.personalityExpression.findMany({ select: { personalityId: true } }),
  ]);
  const personalityIds = new Set(personalities.map((row) => row.personalityId));
  const issues: Array<{ entity: "Species" | "Taxonomy" | "Breed"; entityId: string; message: string }> = [];
  for (const row of species) if (row.taxonomyLevelId && row.taxonomy?.taxonomyLevelId !== row.taxonomyLevelId) issues.push({ entity: "Species", entityId: row.speciesId, message: `Taxonomy reference ${row.taxonomyLevelId} does not resolve.` });
  const taxonomyById = new Map(taxonomy.map((row) => [row.taxonomyLevelId, row]));
  const rankOrder: TaxonomyType[] = ["KINGDOM", "PHYLUM", "CLASS", "ORDER", "FAMILY", "GENUS", "SPECIES"];
  for (const row of taxonomy) {
    const expectedId = canonicalTaxonomyLevelId(row.type, row.name);
    if (row.taxonomyLevelId !== expectedId) issues.push({ entity: "Taxonomy", entityId: row.taxonomyLevelId, message: `${row.type} ${row.name} must use taxonomyLevelId ${expectedId}.` });
    const parent = row.parentTaxonomyLevelId ? taxonomyById.get(row.parentTaxonomyLevelId) : undefined;
    if (row.parentTaxonomyLevelId && !parent) issues.push({ entity: "Taxonomy", entityId: row.taxonomyLevelId, message: `Parent ${row.parentTaxonomyLevelId} does not resolve.` });
    if (parent && rankOrder.indexOf(parent.type) >= rankOrder.indexOf(row.type)) issues.push({ entity: "Taxonomy", entityId: row.taxonomyLevelId, message: `Parent ${parent.taxonomyLevelId} must be a higher rank.` });
    const visited = new Set<string>();
    let current: typeof row | undefined = row;
    while (current) {
      if (visited.has(current.taxonomyLevelId)) { issues.push({ entity: "Taxonomy", entityId: row.taxonomyLevelId, message: `Taxonomy hierarchy cycle detected for ${row.taxonomyLevelId}.` }); break; }
      visited.add(current.taxonomyLevelId);
      current = current.parentTaxonomyLevelId ? taxonomyById.get(current.parentTaxonomyLevelId) : undefined;
    }
  }
  for (const row of breeds) {
    for (const message of validateBreed({ ...row, speciesKind: row.species.speciesKind }, { personalityIds })) issues.push({ entity: "Breed", entityId: row.breedId, message });
    for (const message of validateBreedHierarchy(row, row.parentBreed)) issues.push({ entity: "Breed", entityId: row.breedId, message });
  }
  const byId = new Map(breeds.map((row) => [row.breedId, row]));
  for (const row of breeds) {
    const visited = new Set<string>();
    let current: typeof row | undefined = row;
    while (current) {
      if (visited.has(current.breedId)) { issues.push({ entity: "Breed", entityId: row.breedId, message: `Breed hierarchy cycle detected for ${row.breedId}.` }); break; }
      visited.add(current.breedId);
      current = current.parentBreedId ? byId.get(current.parentBreedId) : undefined;
    }
  }
  return issues;
}
