import { validateBreed, validateBreedHierarchy, validateTaxonomy } from "../domain/worldbuilding";
import type { PrismaClient } from "../generated/prisma/client";

export async function collectWorldbuildingIntegrityIssues(database: PrismaClient) {
  const [species, breeds, personalities] = await Promise.all([
    database.species.findMany({ select: { speciesId: true, taxonomy: true } }),
    database.breed.findMany({ include: { parentBreed: { select: { breedId: true, speciesId: true, populationKind: true, parentBreedId: true } }, species: { select: { speciesKind: true } } } }),
    database.personalityExpression.findMany({ select: { personalityId: true } }),
  ]);
  const personalityIds = new Set(personalities.map((row) => row.personalityId));
  const issues: Array<{ entity: "Species" | "Breed"; entityId: string; message: string }> = [];
  for (const row of species) if (row.taxonomy != null) for (const message of validateTaxonomy(row.taxonomy)) issues.push({ entity: "Species", entityId: row.speciesId, message });
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
