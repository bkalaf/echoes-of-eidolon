export const entityFields = {
  AchievementDefinition: ["achievementDefinitionId", "name", "chainKey", "rank", "imageAssetId", "status"],
  Architect: ["characterId", "department"],
  Ark: ["arkId", "name", "status"],
  Breed: ["breedId", "name", "speciesId", "cultureId", "parentBreedId", "populationKind", "groupId", "personalityId", "traits", "accent", "appearance", "clothing", "architecture", "foodBroad", "foodSpecific", "terrainBroad", "terrainSpecific", "motivation", "operatingStyle", "structureOrientation", "administrationMode", "ownershipMode", "allocationMode", "legitimacyBasis", "authoritySource", "loquacity", "emotionalTemperature", "outlookOrientation", "collaborativePosture"],
  CapabilityDefinition: ["capabilityDefinitionId", "code", "pathPattern", "valueKind", "minValue", "maxValue", "enumValues", "allowedReferenceEntityTypes", "allowedOperations", "monotonicPolicy", "initialValue", "description", "parameters"],
  Character: ["characterId", "displayName", "breedId", "occupationId", "worldKey", "soulId", "gender", "age", "skinScaleColor", "hairFurColor", "eyeColor", "clothing", "faction", "primaryAttribute", "secondaryAttribute"],
  Citation: ["citationId", "sourceId", "locator", "rendering", "quality"],
  Companion: ["characterId", "companionKey"],
  CompanionDef: ["companionKey", "concordCharacterId", "ruinCharacterId", "schismCharacterId", "soulId", "heirloom", "knowledgeSkill", "awarenessSkill"],
  Constellation: ["constellationId", "name", "rightAscension", "declination"],
  Culture: ["cultureId", "name", "appearance", "clothing", "architecture"],
  Definition: ["definitionId", "term", "definition"],
  Interlude: ["interludeId", "name", "interludeType", "summary"],
  InterludeSubstitution: ["interludeSubstitutionId", "interludeId", "replacementInterludeId", "reason"],
  KnowledgeBaseItem: ["knowledgeBaseItemId", "entityType", "entityId", "title", "baseContent"],
  Layette: ["layetteId", "name", "description"],
  LegendaryReward: ["legendaryRewardId", "name", "description"],
  Lesson: ["lessonId", "name", "description"],
  PersonalityExpression: ["personalityId", "family", "expression", "dominantFaction"],
  Pillar: ["pillarId", "name", "domain"],
  PointOfInterest: ["pointOfInterestId", "name", "kind", "regionId", "longitude", "latitude"],
  PuzzleBlueprint: ["puzzleBlueprintId", "title", "primaryFamily", "difficultyTier"],
  Research: ["researchId", "notes", "citationId", "category"],
  Settlement: ["settlementId", "siteId", "name", "classification"],
  SettlementPopulationEvent: ["settlementPopulationEventId", "settlementWorldId", "year", "sequence", "breedId", "eventType", "populationDelta"],
  SettlementWorld: ["settlementWorldId", "settlementId", "worldKey", "totalPopulation", "dominantBreedId", "cultureId"],
  Site: ["siteId", "regionId", "candidateType", "longitude", "latitude"],
  Soul: ["soulId", "name"],
  Source: ["sourceId", "title", "authors", "publisher", "publicationDate", "sourceType", "urlOrIdentifier"],
  Species: ["speciesId", "name", "speciesKind", "scientificName", "taxonomy", "traits", "accent", "anthropomorphization", "appearance", "clothing", "architecture", "originMode", "reproductiveMethod", "juvenileStages", "nurseryMode", "longevityClass", "mortalityMode", "soulDisposition", "continuityGroup", "continuityPropagationMode"],
  TimelineEvent: ["timelineEventId", "name", "timelineEventType", "summary"],
  Tome: ["tomeId", "title", "author"],
  Transition: ["transitionId", "name", "bookA", "bookB", "summary"],
  Witness: ["characterId", "witnessDefId", "trueFlawName", "architectCharacterId", "legendaryRewardId", "constellationBeforeId", "constellationAfterId"],
  WitnessDef: ["witnessDefId", "name", "department", "apparentDomain", "realDomain", "color"],
} as const;

export type EntityName = keyof typeof entityFields;

const pathEntityAliases: Record<string, EntityName> = {
  "achievement-definition": "AchievementDefinition", achievementdefinition: "AchievementDefinition",
  architect: "Architect", ark: "Ark", breed: "Breed",
  "capability-definition": "CapabilityDefinition", capabilitydefinition: "CapabilityDefinition",
  character: "Character", citation: "Citation", citations: "Citation", companion: "Companion", companiondef: "CompanionDef", "companion-def": "CompanionDef",
  constellation: "Constellation", culture: "Culture", definition: "Definition", interlude: "Interlude",
  "interlude-substitution": "InterludeSubstitution", interludesubstitution: "InterludeSubstitution",
  "knowledge-base-item": "KnowledgeBaseItem", knowledgebaseitem: "KnowledgeBaseItem", layette: "Layette",
  legendaryreward: "LegendaryReward", lesson: "Lesson",
  "personality-expression": "PersonalityExpression", personalityexpression: "PersonalityExpression",
  pillar: "Pillar", "point-of-interest": "PointOfInterest", pointofinterest: "PointOfInterest",
  research: "Research", settlement: "Settlement",
  "puzzle-blueprint": "PuzzleBlueprint", puzzleblueprint: "PuzzleBlueprint",
  "settlement-population-event": "SettlementPopulationEvent", settlementpopulationevent: "SettlementPopulationEvent",
  "settlement-world": "SettlementWorld", settlementworld: "SettlementWorld", site: "Site", soul: "Soul",
  source: "Source", sources: "Source",
  species: "Species", "timeline-event": "TimelineEvent", timelineevent: "TimelineEvent", tome: "Tome",
  transition: "Transition", witness: "Witness", witnessdef: "WitnessDef", "witness-def": "WitnessDef", reward: "LegendaryReward",
};

export function entityForPath(path: string | null): EntityName | undefined {
  if (!path) return undefined;
  const segment = path.split("?")[0]!.split("/").filter(Boolean)[2];
  return segment ? pathEntityAliases[segment] : undefined;
}
