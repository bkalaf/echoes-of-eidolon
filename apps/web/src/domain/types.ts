/** Echoes of Eidolon current rebuild type map.
 * Only owner-approved/current relationships are represented here.
 */
import type {
  AdministrationMode, AllocationMode, ArkStatus, AuthoritySource, CapabilityMonotonicPolicy,
  CapabilityOperation, CapabilityParameterKind, CapabilityValueKind,
  AbilityType, ArchitectDepartment, AwarenessSkill, CitationQuality, CollaborativePosture, CompanionKey,
  EmotionalTemperature, EntityType, Heirloom, InterludeType, LegitimacyBasis, Loquacity, BreedGroupId,
  KnowledgeSkill, Motivation, OperatingStyle, OutlookOrientation, OwnershipMode,
  PuzzleDifficultyTier, PuzzleFamily, RegionId, ResearchCategory,
  SettlementClassification, SettlementPopulationEventType, SourceType, SpeciesKind, PopulationKind,
  StructureOrientation, TimelineEventType, WorldKey, Faction, FoodBroadCategory, FoodSpecific,
  TerrainBroad, SpecificTerrain, OriginMode, ReproductionMethod, JuvenileStage, NurseryMode,
  LongevityClass, NaturalMortalityMode, SoulDisposition, ContinuityGroupType, ContinuityPropagationMode, PersonalityFamily,
} from "../generated/prisma/enums";

export type {
  AdministrationMode, AllocationMode, AuthoritySource, CitationQuality, CompanionKey,
  CulturePoolId, EconomicForm, Heirloom, InterludeType, LegitimacyBasis, Motivation,
  OperatingStyle, OwnershipMode, PoliticalForm, RegionId,
  ResearchCategory, SettlementClassification, SpeciesKind, PopulationKind, StructureOrientation,
  TimelineEventType, WorldKey,
} from "../generated/prisma/enums";

export interface Species {
  speciesId: string;
  name: string;
  speciesKind: SpeciesKind;
  scientificName?: string | null;
  taxonomyLevelId?: Taxonomy['taxonomyLevelId'] | null;
  taxonomy?: Taxonomy | null;
  traits: string[];
  accent?: string | null;
  anthropomorphization?: string | null;
  appearance?: string | null;
  clothing?: string | null;
  architecture?: string | null;
  originMode: OriginMode;
  reproductiveMethod: ReproductionMethod;
  juvenileStages: JuvenileStage[];
  nurseryMode: NurseryMode[];
  longevityClass: LongevityClass;
  mortalityMode: NaturalMortalityMode;
  soulDisposition: SoulDisposition;
  continuityGroup: ContinuityGroupType;
  continuityPropagationMode: ContinuityPropagationMode;
}
export type TaxonomyType = "KINGDOM" | "PHYLUM" | "CLASS" | "ORDER" | "FAMILY" | "GENUS" | "SPECIES";
export interface Taxonomy { taxonomyLevelId: string; type: TaxonomyType; name: string; isOfficial: boolean; text?: string | null; commonName?: string | null; parentTaxonomyLevelId?: string | null; parent?: Taxonomy | null; }
export interface Breed {
  breedId: string;
  name: string;
  speciesId: Species['speciesId'];
  cultureId?: Culture['cultureId'] | null;
  parentBreedId?: Breed['breedId'] | null;
  populationKind: PopulationKind;
  groupId: BreedGroupId;
  personalityId?: string | null;
  traits: string[];
  accent?: string | null;
  appearance?: string | null;
  clothing?: string | null;
  architecture?: string | null;
  foodBroad: FoodBroadCategory[];
  foodSpecific: FoodSpecific[];
  terrainBroad: TerrainBroad[];
  terrainSpecific: SpecificTerrain[];
  motivation?: Motivation | null;
  operatingStyle?: OperatingStyle | null;
  structureOrientation?: StructureOrientation | null;
  administrationMode?: AdministrationMode | null;
  ownershipMode?: OwnershipMode | null;
  allocationMode?: AllocationMode | null;
  legitimacyBasis?: LegitimacyBasis | null;
  authoritySource?: AuthoritySource | null;
  loquacity?: Loquacity | null;
  emotionalTemperature?: EmotionalTemperature | null;
  outlookOrientation?: OutlookOrientation | null;
  collaborativePosture?: CollaborativePosture | null;
}
export interface Culture {
  cultureId: string;
  name: string;
  appearance?: string | null;
  clothing?: string | null;
  architecture?: string | null;
}
export interface Character {
  characterId: string;
  displayName: string;
  breedId: Breed['breedId'] | null;
  occupationId?: string | null;
  worldKey?: WorldKey | null;
  soulId?: Soul['soulId'] | null;
  gender?: string | null;
  age?: string | null;
  skinScaleColor?: string | null;
  hairFurColor?: string | null;
  eyeColor?: string | null;
  clothing?: string | null;
  faction?: Faction | null;
  primaryAttribute?: AbilityType | null;
  secondaryAttribute?: AbilityType | null;
}
export interface Architect { characterId: Character['characterId']; department: ArchitectDepartment | null; }
export type Color = 'SPECTRAL_VIOLET' | 'GREEN' | 'WHITE';
export interface WitnessDef {
  witnessDefId: string;
  name: string;
  department: ArchitectDepartment;
  kernelKey: string;
  apparentDomain: string;
  realDomain: string;
  color: Record<Color, number>;
  architectSoulId: Soul['soulId'];
  worldKey: WorldKey;
  bookNumber: number;
}
export interface Witness {
  characterId: Character['characterId'];
  witnessDefId: WitnessDef['witnessDefId'];
  trueFlawName?: string | null;
  architectCharacterId: Architect['characterId'];
  legendaryRewardId?: string | null;
  constellationBeforeId?: string | null;
  constellationAfterId?: string | null;
}
export interface Soul { soulId: string; name: string; }
export interface CompanionDef {
  companionKey: CompanionKey;
  concordCharacterId: Character['characterId'];
  ruinCharacterId: Character['characterId'];
  schismCharacterId: Character['characterId'];
  soulId: Soul['soulId'];
  heirloom: Heirloom;
  knowledgeSkill: KnowledgeSkill | null;
  awarenessSkill: AwarenessSkill | null;
}
export interface Companion {
  characterId: Character['characterId'];
  companionKey: CompanionKey;
}
export interface TimelineEvent { timelineEventId: string; name: string; timelineEventType: TimelineEventType; summary: string; }
export interface Interlude { interludeId: string; name: string; interludeType: InterludeType; summary: string; }
export interface InterludeSubstitution { interludeSubstitutionId: string; interludeId: string; replacementInterludeId: string; reason: string; }
export interface Pillar { pillarId: string; name: string; domain?: string; }
export interface LegendaryReward { legendaryRewardId: string; name: string; description: string; }
export interface Lesson { lessonId: string; name: string; description: string; }
export interface Tome { tomeId: string; title: string; author?: string; }
export interface Transition { transitionId: string; name: string; bookA: number; bookB: number; summary: string; }
export interface Constellation { constellationId: string; name: string; rightAscension?: string; declination?: string; }
export interface Ark { arkId: string; name: string; status: ArkStatus; }
export interface PointOfInterest { pointOfInterestId: string; name: string; kind: string; regionId: string; longitude: number; latitude: number; }
export interface Site { siteId: string; regionId: RegionId; candidateType: SettlementClassification; longitude: number; latitude: number; }
export interface Settlement { settlementId: string; siteId: Site['siteId']; name: string | null; classification: SettlementClassification; }
export interface SettlementWorld {
  settlementWorldId: string;
  settlementId: Settlement['settlementId'];
  worldKey: WorldKey;
  totalPopulation: number;
  dominantBreedId: Breed['breedId'] | null;
  cultureId: Culture['cultureId'] | null;
}
export interface SettlementPopulationEvent {
  settlementPopulationEventId: string;
  settlementWorldId: SettlementWorld['settlementWorldId'];
  year: number;
  sequence: number;
  breedId: Breed['breedId'];
  eventType: SettlementPopulationEventType;
  populationDelta: number;
}
export interface Source { sourceId: string; title: string; authors: string[]; publisher?: string; publicationDate?: string; sourceType: SourceType; urlOrIdentifier?: string; }
export interface Citation { citationId: string; sourceId: Source['sourceId']; locator?: string; rendering: string; quality?: CitationQuality; }
export interface Research { researchId: string; notes: string; citationId: Citation['citationId']; category?: ResearchCategory | null; }
export interface KnowledgeBaseItem { knowledgeBaseItemId: string; entityType: EntityType; entityId: string; title: string; baseContent: string; }
export interface Definition { definitionId: string; term: string; definition: string; }
export interface Layette { layetteId: string; name: string; description: string; }
export interface PersonalityExpression { personalityId: string; family: PersonalityFamily; expression: string; dominantFaction: Faction[]; }
export interface CapabilityDefinition { capabilityDefinitionId: string; code: string; createdAt?: Date; }
export interface CapabilityParameterDefinition { name: string; kind: CapabilityParameterKind; entityType?: EntityType | null; allowedValues: string[]; ordinal: number; }
export interface CapabilityDefinitionVersion {
  capabilityDefinitionVersionId: string;
  capabilityDefinitionId: CapabilityDefinition['capabilityDefinitionId'];
  version: number;
  pathPattern: string;
  parameters: CapabilityParameterDefinition[];
  valueKind: CapabilityValueKind;
  minValue?: number | null;
  maxValue?: number | null;
  enumValues: string[];
  allowedReferenceEntityTypes: EntityType[];
  allowedOperations: CapabilityOperation[];
  monotonicPolicy: CapabilityMonotonicPolicy;
  description: string;
}
export interface AchievementDefinition { achievementDefinitionId: string; name: string; chainKey: string; rank: number; imageAssetId?: string | null; status: string; }
export interface PuzzleBlueprint { puzzleBlueprintId: string; title: string; primaryFamily: PuzzleFamily; difficultyTier: PuzzleDifficultyTier; }
