/** Echoes of Eidolon current rebuild type map.
 * Only owner-approved/current relationships are represented here.
 */
export type WorldKey = 'CONCORD' | 'RUIN' | 'SCHISM';
export type SpeciesKind = 'HUMAN' | 'BEAST' | 'MYTHOS' | 'PET';
export type ProtagonistImportance = 'MINOR' | 'MAJOR';
export type TimelineEventType = 'HISTORICAL' | 'ATROCITY' | 'EXODUS' | 'IN_TRANSIT';
export type InterludeType = 'WWII' | 'HISTORICAL' | 'MYTH' | 'SCIENCE' | 'DEJA_VU' | 'OTHER';
export type StructureOrientation = 'ORDERED' | 'NEUTRAL' | 'CHAOS';
export type OperatingStyle = 'TEAMWORK' | 'SITUATIONAL' | 'SOLO';
export type Motivation = 'ALTRUISTIC' | 'RECIPROCAL' | 'SELFISH';
export type AdministrationMode = 'CENTRALIZED' | 'DELEGATED' | 'DISTRIBUTED';
export type AuthoritySource = 'APPOINTMENT' | 'DIVINE_MANDATE' | 'ELECTION';
export type LegitimacyBasis = 'ANCESTRAL' | 'CHARTERED' | 'MARTIAL';
export type AllocationMode = 'CUSTOMARY' | 'MARKET' | 'PLANNED';
export type OwnershipMode = 'COMMON_USE' | 'SHARED_TITLE' | 'SINGLE_ENTITY';
export type PoliticalForm =
  | 'ACCLAIMED_IMPERATOR' | 'APPOINTED_COMMISSION' | 'APPOINTED_DIRECTORATE'
  | 'CAPTAINS_COUNCIL' | 'CHIEFTAIN_COUNCIL' | 'CONSECRATED_REPUBLIC'
  | 'COVENANT_ASSEMBLY' | 'COVENANT_CROWN' | 'DELEGATE_LEAGUE' | 'DIVINE_THRONE'
  | 'ELDER_MOOT' | 'ELECTED_EXECUTIVE' | 'ELECTIVE_CROWN' | 'ESTATES_DIET'
  | 'FEUDAL_ORDER' | 'FREE_COMPANY' | 'GARRISON_COMMAND' | 'HALLOWED_CUSTOM'
  | 'JUNTA' | 'MILITANT_ORDER' | 'MILITANT_THEOCRACY' | 'POPULAR_FEDERATION'
  | 'RAIDER_CONFEDERACY' | 'REGENT_THRONE' | 'REPUBLIC' | 'TEMPLE_HIERARCHY'
  | 'ZEALOT_BANDS';
export type EconomicForm =
  | 'COMMAND_DEMESNE' | 'COMMUNE_PLAN' | 'FOLK_COMMONS' | 'GUILD_COMPACT'
  | 'MONOPOLY_ESTATE' | 'OPEN_BAZAAR' | 'SHAREHOLDER_BOURSE'
  | 'SYNDICATE_CARTEL' | 'TRIBUTARY_DEMESNE';

export interface Species {
  speciesId: string;
  name: string;
  speciesKind: SpeciesKind;
  scientificName?: string | null;
  taxonomy?: { kingdom?: string; phylum?: string; className?: string; order?: string; family?: string; genus?: string; species?: string };
  appearance?: string[];
  accent?: string[];
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
}
export interface Culture {
  cultureId: string;
  culturePoolId: string;
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
export type Heirloom = string;
export interface Companion {
  companionKey: string;
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
export interface Ark { arkId: string; name: string; status: string; }
export interface PointOfInterest { pointOfInterestId: string; name: string; kind: string; regionId: string; longitude: number; latitude: number; }
export interface Site { siteId: string; regionId: string; candidateType: string; longitude: number; latitude: number; settlementId?: string | null; }
export interface Settlement { settlementId: string; siteId: Site['siteId']; name: string; size: string; regionId: string; }
export interface BreedPopulation { settlementId: Settlement['settlementId']; worldKey: WorldKey; year: number; breedId: Breed['breedId']; population: number; }
export interface Source { sourceId: string; title: string; authors: string[]; publisher?: string; publicationDate?: string; sourceType: string; urlOrIdentifier?: string; }
export interface Citation { citationId: string; sourceId: Source['sourceId']; locator?: string; rendering: string; quality?: 'HIGH'|'MEDIUM'|'LOW'|'UNVERIFIED'; }
export interface Research { researchId: string; ownerEntityType: string; ownerEntityId: string; notes: string; citationId: Citation['citationId']; citationQuality: NonNullable<Citation['quality']>; }
export interface KnowledgeBaseItem { knowledgeBaseItemId: string; entityType: string; entityId: string; title: string; baseContent: string; }
export interface Definition { definitionId: string; term: string; definition: string; }
export interface Matrix { matrixId: string; regionId: string; latticeId: string; culturePoolIds: string[]; }
export interface Layette { layetteId: string; name: string; description: string; }
export interface PersonalityExpression { personalityExpressionId: string; name: string; loquacity: string; emotionalTemperature: string; outlookOrientation: string; collaborativePosture: string; }
export interface CapabilityDefinition { capabilityDefinitionId: string; key: string; valueType: 'BOOLEAN'|'SCORE'; minValue?: number; maxValue?: number; description: string; }
export interface AchievementDefinition { achievementDefinitionId: string; name: string; chainKey: string; rank: number; imageAssetId?: string | null; status: string; }
export interface SpeciesGroup { speciesGroupId: string; name: string; speciesKind: SpeciesKind; description?: string; }
export interface PuzzleBlueprint { puzzleBlueprintId: string; family: string; difficultyTier: 1|2|3|4|5; hint1: string; hint2: string; generatorVersion: number; }
