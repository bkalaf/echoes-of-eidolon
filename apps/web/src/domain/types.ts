/** Echoes of Eidolon current rebuild type map.
 * Only owner-approved/current relationships are represented here.
 */
import type {
  AdministrationMode, AllocationMode, ArkStatus, AuthoritySource, CapabilityValueKind,
  CitationQuality, CollaborativePosture, CompanionKey, CulturePoolId, EconomicForm,
  EmotionalTemperature, EntityType, Heirloom, InterludeType, LegitimacyBasis, Loquacity,
  Motivation, OperatingStyle, OutlookOrientation, OwnershipMode, PoliticalForm,
  ProtagonistImportance, PuzzleDifficultyTier, PuzzleFamily, RegionId, ResearchCategory,
  SettlementClassification, SettlementPopulationEventType, SourceType, SpeciesKind,
  StructureOrientation, TimelineEventType, WorldKey,
} from "../generated/prisma/enums";

export type {
  AdministrationMode, AllocationMode, AuthoritySource, CitationQuality, CompanionKey,
  CulturePoolId, EconomicForm, Heirloom, InterludeType, LegitimacyBasis, Motivation,
  OperatingStyle, OwnershipMode, PoliticalForm, ProtagonistImportance, RegionId,
  ResearchCategory, SettlementClassification, SpeciesKind, StructureOrientation,
  TimelineEventType, WorldKey,
} from "../generated/prisma/enums";

export interface Species {
  speciesId: string;
  name: string;
  speciesKind: SpeciesKind;
  scientificName?: string | null;
  taxonomy?: { kingdom?: string; phylum?: string; className?: string; order?: string; family?: string; genus?: string; species?: string };
  appearance?: string[];
  anthropomorphization?: string[];
}
export interface Breed {
  breedId: string;
  name: string;
  speciesId: Species['speciesId'];
  cultureId?: Culture['cultureId'] | null;
  appearance?: string[];
  accent?: string[];
  costume?: string[];
  architecture?: string[];
  structuralStability?: number;
  motivation?: Motivation | null;
  operatingStyle?: OperatingStyle | null;
  structureOrientation?: StructureOrientation | null;
  administrationMode?: AdministrationMode | null;
  ownershipMode?: OwnershipMode | null;
  allocationMode?: AllocationMode | null;
  legitimacyBasis?: LegitimacyBasis | null;
  authoritySource?: AuthoritySource | null;
  politicalForm?: PoliticalForm | null;
  economicForm?: EconomicForm | null;
  loquacity?: Loquacity | null;
  emotionalTemperature?: EmotionalTemperature | null;
  outlookOrientation?: OutlookOrientation | null;
  collaborativePosture?: CollaborativePosture | null;
}
export interface Culture {
  cultureId: string;
  culturePoolId: CulturePoolId;
  cultureName: string;
  hamletArchitecture: string;
  villageArchitecture: string;
  townArchitecture: string;
  cityArchitecture: string;
  metropolisArchitecture: string;
  architectureColorPalette: string[];
  clothingPalette: string[];
  clothing: string;
}
export interface Character { characterId: string; displayName: string; breedId: Breed['breedId']; }
export interface Protagonist { protagonistId: string; characterId: Character['characterId']; importance: ProtagonistImportance; worldKey: WorldKey | null; }
export interface Architect { architectId: string; departmentId: string; name: string; profession?: string | null; }
export interface Antagonist {
  antagonistId: string;
  characterId: Character['characterId'];
  worldKey: WorldKey | null;
  family: string;
  trueFlawName: string;
  witnessName: string;
  presentsAs: string;
  inversionRule: string;
  architectId: Architect['architectId'];
  apparentDomain: string;
  realDomain: string;
  color: string[] | string;
  legendaryRewardId: string;
  puzzleBlueprintId: string;
  constellationBeforeId?: string | null;
  constellationAfterId?: string | null;
}
export interface Witness { witnessId: string; antagonist1Id: Antagonist['antagonistId']; antagonist2Id?: Antagonist['antagonistId'] | null; }
export interface Soul { soulId: string; name: string; }
export interface Companion {
  companionKey: CompanionKey;
  concordProtagonistId: Protagonist['protagonistId'];
  ruinProtagonistId: Protagonist['protagonistId'];
  schismProtagonistId: Protagonist['protagonistId'];
  soulId: Soul['soulId'];
  heirloom: Heirloom;
}
export interface TimelineEvent { timelineEventId: string; name: string; timelineEventType: TimelineEventType; summary: string; }
export interface Interlude { interludeId: string; name: string; interludeType: InterludeType; summary: string; }
export interface InterludeSubstitution { interludeSubstitutionId: string; interludeId: string; replacementInterludeId: string; reason: string; }
export interface Pillar { pillarId: string; name: string; domain?: string; seatNumber?: number; }
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
export interface Matrix { matrixId: string; regionId: string; latticeId: string; culturePoolIds: string[]; }
export interface Layette { layetteId: string; name: string; description: string; }
export interface PersonalityExpression { personalityExpressionId: string; name: string; }
export interface CapabilityDefinition { capabilityDefinitionId: string; key: string; valueKind: CapabilityValueKind; minValue?: number; maxValue?: number; description: string; }
export interface AchievementDefinition { achievementDefinitionId: string; name: string; chainKey: string; rank: number; imageAssetId?: string | null; status: string; }
export interface SpeciesGroup { speciesGroupId: string; name: string; speciesKind: SpeciesKind; description?: string; }
export interface PuzzleBlueprint { puzzleBlueprintId: string; family: PuzzleFamily; difficultyTier: PuzzleDifficultyTier; }
