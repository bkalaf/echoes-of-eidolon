export type OwnerTableField = {
  isList: boolean;
  kind: "enum" | "json" | "relation" | "scalar";
  name: string;
  relationFromFields?: string[];
  type: string;
};

const ownerLockedPrefixes: Record<string, string[]> = {
  Architect: ["character", "characterId", "department"],
  Breed: ["name", "breedId", "species", "speciesId", "parentBreed", "parentBreedId", "culture", "cultureId", "populationKind", "groupId", "personality", "personalityId"],
  Character: ["displayName", "characterId", "breed", "breedId", "occupation", "occupationId", "worldKey", "soul", "soulId"],
  Companion: ["character", "characterId", "companionDef", "companionKey"],
  CompanionDef: ["companionKey", "concordCharacter", "concordCharacterId", "ruinCharacter", "ruinCharacterId", "schismCharacter", "schismCharacterId", "soul", "soulId"],
  Culture: ["name", "cultureId"],
  Settlement: ["name", "settlementId", "site", "siteId"],
  Species: ["name", "speciesId"],
  Witness: ["character", "characterId", "witnessDef", "witnessDefId", "architect", "architectCharacterId", "legendaryReward", "legendaryRewardId", "constellationBefore", "constellationBeforeId", "constellationAfter", "constellationAfterId"],
  WitnessDef: ["name", "witnessDefId", "department", "architectSoul", "architectSoulId", "apparentDomain", "realDomain", "color"],
};

const discriminatorNames = new Set([
  "department", "worldKey", "status", "classification", "populationKind", "groupId", "speciesKind", "kind", "type",
]);
const metadataNames = new Set(["createdAt", "updatedAt", "deletedAt"]);

export function orderOwnerTableFields<T extends OwnerTableField>(entity: string, idField: string, fields: readonly T[]): T[] {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const ordered: T[] = [];
  const add = (name: string) => {
    const field = byName.get(name);
    if (field && !ordered.includes(field)) ordered.push(field);
  };

  for (const name of ownerLockedPrefixes[entity] ?? []) add(name);
  for (const name of ["displayName", "name", "title", "term"]) add(name);
  add(idField);
  for (const field of fields) if (discriminatorNames.has(field.name)) add(field.name);
  for (const relation of fields.filter((field) => field.kind === "relation" && (field.relationFromFields?.length ?? 0) > 0)) {
    add(relation.name);
    for (const foreignKey of relation.relationFromFields ?? []) add(foreignKey);
  }
  for (const field of fields) if (!field.isList && field.kind !== "json" && !metadataNames.has(field.name)) add(field.name);
  for (const field of fields) if ((field.isList || field.kind === "json") && !metadataNames.has(field.name)) add(field.name);
  for (const field of fields) if (metadataNames.has(field.name)) add(field.name);
  return ordered;
}

