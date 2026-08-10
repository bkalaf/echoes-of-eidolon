export const entityFields = {
  AchievementDefinition: ["achievementDefinitionId", "name", "chainKey", "rank", "imageAssetId", "status"],
  Antagonist: ["antagonistId", "characterId", "worldKey", "family", "trueFlawName", "witnessName", "presentsAs", "inversionRule", "architectId", "apparentDomain", "realDomain", "color", "legendaryRewardId", "puzzleBlueprintId", "constellationBeforeId", "constellationAfterId"],
  Architect: ["architectId", "departmentId", "name", "profession"],
  Ark: ["arkId", "name", "status"],
  Breed: ["breedId", "name", "speciesId", "cultureId", "appearance", "accent", "costume", "architecture", "structuralStability", "motivation", "operatingStyle", "structureOrientation", "administrationMode", "ownershipMode", "allocationMode", "legitimacyBasis", "authoritySource", "politicalForm", "economicForm"],
  CapabilityDefinition: ["capabilityDefinitionId", "key", "valueType", "minValue", "maxValue", "description"],
  Character: ["characterId", "displayName", "breedId"],
  Citation: ["citationId", "sourceId", "locator", "rendering", "quality"],
  Companion: ["companionKey", "concordProtagonistId", "ruinProtagonistId", "schismProtagonistId", "soulId", "heirloom"],
  Constellation: ["constellationId", "name", "rightAscension", "declination"],
  Culture: ["cultureId", "culturePoolId", "cultureName", "hamletArchitecture", "villageArchitecture", "townArchitecture", "cityArchitecture", "metropolisArchitecture", "architectureColorPalette", "clothingPalette", "clothing"],
  Definition: ["definitionId", "term", "definition"],
  Interlude: ["interludeId", "name", "interludeType", "summary"],
  InterludeSubstitution: ["interludeSubstitutionId", "interludeId", "replacementInterludeId", "reason"],
  KnowledgeBaseItem: ["knowledgeBaseItemId", "entityType", "entityId", "title", "baseContent"],
  Layette: ["layetteId", "name", "description"],
  LegendaryReward: ["legendaryRewardId", "name", "description"],
  Lesson: ["lessonId", "name", "description"],
  Matrix: ["matrixId", "regionId", "latticeId", "culturePoolIds"],
  PersonalityExpression: ["personalityExpressionId", "name", "loquacity", "emotionalTemperature", "outlookOrientation", "collaborativePosture"],
  Pillar: ["pillarId", "name", "domain", "seatNumber"],
  PointOfInterest: ["pointOfInterestId", "name", "kind", "regionId", "longitude", "latitude"],
  Protagonist: ["protagonistId", "characterId", "importance", "worldKey"],
  Research: ["researchId", "ownerEntityType", "ownerEntityId", "notes", "citationId", "citationQuality"],
  Settlement: ["settlementId", "siteId", "name", "size", "regionId"],
  Site: ["siteId", "regionId", "candidateType", "longitude", "latitude", "settlementId"],
  Soul: ["soulId", "name"],
  Source: ["sourceId", "title", "authors", "publisher", "publicationDate", "sourceType", "urlOrIdentifier"],
  SpeciesGroup: ["speciesGroupId", "name", "speciesKind", "description"],
  Species: ["speciesId", "name", "speciesKind", "scientificName", "taxonomy", "appearance", "accent", "anthropomorphization"],
  TimelineEvent: ["timelineEventId", "name", "timelineEventType", "summary"],
  Tome: ["tomeId", "title", "author"],
  Transition: ["transitionId", "name", "bookA", "bookB", "summary"],
  Witness: ["witnessId", "antagonist1Id", "antagonist2Id"],
} as const;

export type EntityName = keyof typeof entityFields;

const pathEntityAliases: Record<string, EntityName> = {
  "achievement-definition": "AchievementDefinition", achievementdefinition: "AchievementDefinition",
  antagonist: "Antagonist", architect: "Architect", ark: "Ark", breed: "Breed",
  "capability-definition": "CapabilityDefinition", capabilitydefinition: "CapabilityDefinition",
  character: "Character", citation: "Citation", citations: "Citation", companion: "Companion",
  constellation: "Constellation", culture: "Culture", definition: "Definition", interlude: "Interlude",
  "interlude-substitution": "InterludeSubstitution", interludesubstitution: "InterludeSubstitution",
  "knowledge-base-item": "KnowledgeBaseItem", knowledgebaseitem: "KnowledgeBaseItem", layette: "Layette",
  legendaryreward: "LegendaryReward", lesson: "Lesson", matrix: "Matrix",
  "personality-expression": "PersonalityExpression", personalityexpression: "PersonalityExpression",
  pillar: "Pillar", "point-of-interest": "PointOfInterest", pointofinterest: "PointOfInterest",
  protagonist: "Protagonist", research: "Research", settlement: "Settlement", site: "Site", soul: "Soul",
  source: "Source", sources: "Source", "species-group": "SpeciesGroup", speciesgroup: "SpeciesGroup",
  species: "Species", "timeline-event": "TimelineEvent", timelineevent: "TimelineEvent", tome: "Tome",
  transition: "Transition", witness: "Witness", reward: "LegendaryReward",
};

export function entityForPath(path: string | null): EntityName | undefined {
  if (!path) return undefined;
  const segment = path.split("?")[0]!.split("/").filter(Boolean)[2];
  return segment ? pathEntityAliases[segment] : undefined;
}
