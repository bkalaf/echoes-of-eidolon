import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
  "CapabilityOperation", "CapabilityRequirementOperator", "RewardEvidenceKind", "KnowledgeBaseBlockKind",
  "CalendarTrigger", "SpeciesKind", "TimelineEventType", "InterludeType", "ArkStatus", "DefinitionType", "Holiday",
  "EntityType", "Heirloom", "CitationQuality", "SourceType", "ContributorType", "ResearchCategory",
  "DepartmentWitnessPathStatus", "PuzzleSharedComponentId", "PuzzleFamily", "PuzzleDifficultyTier", "AgeEligibility",
  "FriendInvitationRequestStatus", "ExternalBulkApiState", "MembershipGrantSource", "PerkStatus", "PaymentProvider",
  "FulfillmentProvider", "ProtagonistImportance", "ReleaseNotesStatus", "ReleaseAudience", "ReleaseNoteCategory",
  "KnowledgeBaseDisclosureMode", "PuzzleHintKind", "BulkOperation", "ImportAliasDisposition", "ImportResultState",
  "MembershipRevocationReason", "ManagedAssetMediaKind", "PromptFamily", "PromptStatus", "Loquacity",
  "EmotionalTemperature", "OutlookOrientation", "CollaborativePosture", "SpeciesResearchDimension",
  "SpeciesResearchReviewStatus", "SpeciesResearchProvenanceKind", "SpeciesDimensionValue",
] as const;

describe("Prisma finite enum authority", () => {
  it("defines all 92 supplied enums plus the separate Better Auth authorization enum", () => {
    const actualNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);
    expect(new Set(actualNames)).toEqual(new Set([...suppliedEnumNames, "AuthorizationRole"]));
    expect(suppliedEnumNames).toHaveLength(92);
    expect(actualNames).toHaveLength(93);
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
});
