import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { puzzleDifficultyTiers, puzzleFamilies, puzzleHintKinds } from "../../src/domain/puzzle-blueprint";
import { settlementPopulationEventKinds } from "../../src/domain/settlement-population";
import { breedPersonalityDimensions } from "../../src/domain/breed-personality";
import { BreedResearchDimension, PuzzleDifficultyTier, PuzzleFamily, PuzzleHintKind, SettlementPopulationEventType } from "../../src/generated/prisma/enums";

const schema = readFileSync(resolve(import.meta.dirname, "../../prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(
  import.meta.dirname,
  "../../prisma/migrations/20260810090000_exact_enum_index/migration.sql",
), "utf8");

const suppliedEnumNames = [
  "Alignment", "Faction", "SizeClass", "PersonalityFamily", "LatitudinalZone", "CulturePoolId",
  "AdministrationMode", "OwnershipMode", "AllocationMode", "LegitimacyBasis", "AuthoritySource",
  "PoliticalForm", "EconomicForm", "LeadershipModel", "SelectionMethod", "SuccessionMode", "OriginMode",
  "ReproductionMethod", "JuvenileStage", "NurseryMode", "LongevityClass", "NaturalMortalityMode",
  "SoulDisposition", "ContinuityGroupType", "ContinuityPropagationMode", "NameGenderBucket",
  "FoodBroadCategory", "FoodSpecific", "TerrainBroad", "TerrainSpecific", "Motivation", "OperatingStyle",
  "StructureOrientation", "WorldKey", "CompanionKey", "RegionId", "NameStatus", "SettlementClassification",
  "SettlementSurfaceType", "CharacterType", "LatticeId", "SettlementPopulationEventType", "CapabilityValueKind",
  "CapabilityOperation", "CapabilityRequirementOperator", "CapabilityParameterKind", "CapabilityMonotonicPolicy",
  "CapabilityDefinitionVersionStatus", "CapabilityScopeType", "ScoringPolicyStatus", "RewardEvidenceKind",
  "FactionStandingEvidenceKind", "KnowledgeBaseBlockKind",
  "CalendarTrigger", "SpeciesKind", "TimelineEventType", "InterludeType", "ArkStatus", "DefinitionType", "Holiday",
  "EntityType", "Heirloom", "CitationQuality", "SourceType", "ContributorType", "ResearchCategory",
  "DepartmentWitnessPathStatus", "PuzzleSharedComponentId", "PuzzleFamily", "PuzzleDifficultyTier", "AgeEligibility",
  "BookGroupingType", "BookGroupingEditability",
  "FriendInvitationRequestStatus", "ExternalBulkApiState", "MembershipGrantSource", "PerkStatus", "PaymentProvider",
  "FulfillmentProvider", "ProtagonistImportance", "ReleaseNotesStatus", "ReleaseAudience", "ReleaseNoteCategory",
  "KnowledgeBaseDisclosureMode", "PuzzleHintKind", "BulkOperation", "ImportAliasDisposition", "ImportResultState",
  "MembershipRevocationReason", "ManagedAssetMediaKind", "PromptFamily", "PromptStatus", "Loquacity",
  "EmotionalTemperature", "OutlookOrientation", "CollaborativePosture", "BreedResearchDimension",
  "BreedResearchReviewStatus", "BreedResearchProvenanceKind", "BreedDimensionValue",
  "ContactTopic", "ContactRequestStatus", "GameTurnStatus", "DocumentDraftStatus", "DeploymentStatus", "CampaignObjectType",
  "DonationCheckoutStatus", "StoreProductType",
] as const;

describe("Prisma finite enum authority", () => {
  it("preserves the supplied enums and the authorized application runtime enums", () => {
    const actualNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);
    expect(new Set(actualNames)).toEqual(new Set(suppliedEnumNames));
    expect(actualNames).toHaveLength(suppliedEnumNames.length);
    expect(new Set(actualNames).size).toBe(suppliedEnumNames.length);
    expect(schema).toContain('role                String                    @default("user")');
  });

  it("preserves all 31 externally governed hyphenated puzzle component values", () => {
    const mappedValues = [...schema.matchAll(/@map\("(PUZCMP-[A-Z0-9-]+)"\)/g)].map((match) => match[1]);
    expect(mappedValues).toHaveLength(31);
    expect(new Set(mappedValues).size).toBe(31);
    expect(mappedValues).toContain("PUZCMP-AUDIO-TRANSPORT");
    expect(mappedValues).toContain("PUZCMP-ACCESSIBILITY-MODE-SWITCHER");
    expect(mappedValues).toContain("PUZCMP-COLLABORATION-PACKET");
  });

  it("casts existing finite values instead of dropping and recreating populated columns", () => {
    expect(migration).not.toMatch(/DROP COLUMN "(status|valueType|eligibilityStatus)"/);
    expect(migration).toContain('USING ("status"::text::"FriendInvitationRequestStatus")');
    expect(migration).toContain('USING ("valueType"::text::"CapabilityValueKind")');
    expect(migration).toContain('USING ("eligibilityStatus"::text::"AgeEligibility")');
  });

  it("uses generated Prisma values in exported persistence-domain collections", () => {
    expect(puzzleFamilies).toEqual(Object.values(PuzzleFamily));
    expect(puzzleDifficultyTiers).toEqual(Object.values(PuzzleDifficultyTier));
    expect(puzzleHintKinds).toEqual(Object.values(PuzzleHintKind));
    expect(settlementPopulationEventKinds).toEqual(Object.values(SettlementPopulationEventType));
    expect(breedPersonalityDimensions).toEqual(Object.values(BreedResearchDimension));
  });
});
