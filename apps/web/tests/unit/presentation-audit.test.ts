import { describe, expect, it } from "vitest";

import {
  auditPresentationField,
  auditEffectiveBreedPresentation,
  assertPresentationPackagingGate,
  presentationAuditJsonl,
  type SemanticPresentationReview,
} from "../../src/domain/presentation-audit";

const clothing = [
  "Civilian: Indigo wrap coats, patterned sashes, fitted trousers, and worked leather shoes.",
  "Light armor: Layered quilted cotton with lacquered hide guards and woven insignia.",
  "Medium armor: Riveted mail beneath indigo textile panels, reinforced bracers, and a crested helm.",
  "Heavy armor: Articulated dark-steel plates over patterned padding with repoussé geometric borders.",
  "Weapons: Leaf-bladed spears, recurved bows, hide-covered shields, and broad utility knives.",
].join("\n");

function semantic(value: string, overrides: Partial<SemanticPresentationReview["checks"]> = {}): SemanticPresentationReview {
  return {
    reviewedValue: value,
    reviewer: "semantic-review:test",
    checks: {
      correctFieldMeaning: true,
      culturalSpecificity: true,
      antiEssentialism: true,
      respectfulCraftsmanship: true,
      nonEuropeanization: true,
      directVoiceCasting: true,
      usableRenderDetail: true,
      legendaryHistoricitySeparated: true,
      ...overrides,
    },
  };
}

describe("presentation completion audit", () => {
  it("requires all five renderable clothing sections and an independent review of the exact value", () => {
    expect(auditPresentationField({ entityId: "BRD_TEST", field: "clothing", researchStatus: "RESOLVED", value: clothing, semanticReview: semantic(clothing) }).disposition).toBe("PASS");
    expect(auditPresentationField({ entityId: "BRD_TEST", field: "clothing", researchStatus: "RESOLVED", value: "Civilian: A coat.", semanticReview: semantic("Civilian: A coat.") }).disposition).toBe("FAIL");
    expect(auditPresentationField({ entityId: "BRD_TEST", field: "clothing", researchStatus: "RESOLVED", value: clothing, semanticReview: semantic(`${clothing} changed`) }).disposition).toBe("FAIL");
  });

  it("accepts the five canonical clothing sections inline and does not misclassify source-animal anatomy as commentary", () => {
    const inline = clothing.replaceAll("\n", " ");
    expect(auditPresentationField({ entityId: "SPC_MOTH", field: "clothing", researchStatus: "RESOLVED", value: inline, semanticReview: semantic(inline) }).disposition).toBe("PASS");
    const anatomy = "Preserve the source-animal silhouette, sensory structures, and nonhuman proportions.";
    expect(auditPresentationField({ entityId: "SPC_MOTH", field: "appearance", researchStatus: "RESOLVED", value: anatomy, semanticReview: semantic(anatomy) }).staticQa.passed).toBe(true);
  });

  it("blocks meta language and cannot treat keyword checks as semantic review", () => {
    const contaminated = "A source-supported appearance that may use blue cloth.";
    const result = auditPresentationField({ entityId: "CLT_TEST", field: "appearance", researchStatus: "RESOLVED", value: contaminated, semanticReview: semantic(contaminated) });
    expect(result.disposition).toBe("FAIL");
    expect(result.staticQa.failures).toEqual(expect.arrayContaining([expect.stringContaining("meta language")]));

    const noSemanticReview = auditPresentationField({ entityId: "CLT_TEST", field: "appearance", researchStatus: "RESOLVED", value: "Warm brown skin, tightly curled dark hair, and varied individual facial structures." });
    expect(noSemanticReview.disposition).toBe("FAIL");
    expect(noSemanticReview.semanticReview.failures).toContain("Independent semantic review is required.");
  });

  it("uses only the four allowed dispositions and preserves unresolved and PET not-applicable cases", () => {
    expect(auditPresentationField({ entityId: "BRD_BLOCKED", field: "clothing", researchStatus: "REVIEW_REQUIRED", value: null }).disposition).toBe("BLOCKED_BY_RESEARCH_STATUS");
    expect(auditPresentationField({ applicable: false, entityId: "SPC_CAT", field: "architecture", researchStatus: "RESOLVED", value: null }).disposition).toBe("NOT_APPLICABLE");
  });

  it("audits effective Breed presentation after inheritance and emits JSONL", () => {
    const values = {
      accent: "Cast a low, measured voice with clear consonants and gently lengthened vowels.",
      appearance: "Deep brown skin, dark coiled hair, athletic builds, and varied individual facial features.",
      clothing,
      architecture: "Indigo, ochre, and dark timber surfaces with woven geometric bands, carved posts, and broad curved rooflines.",
    };
    const audits = auditEffectiveBreedPresentation({
      breedId: "BRD_TEST",
      researchStatus: "RESOLVED",
      species: values,
      semanticReviews: Object.fromEntries(Object.entries(values).map(([field, value]) => [field, semantic(value)])),
    });
    expect(audits).toHaveLength(4);
    expect(audits.every((audit) => audit.scope === "EFFECTIVE_BREED" && audit.disposition === "PASS")).toBe(true);
    expect(presentationAuditJsonl(audits).split("\n")).toHaveLength(4);
    expect(() => assertPresentationPackagingGate({
      audits,
      expected: audits.map((audit) => ({ applicable: true, entityId: audit.entityId, field: audit.field, researchStatus: "RESOLVED", scope: audit.scope })),
    })).not.toThrow();
    expect(() => assertPresentationPackagingGate({ audits: audits.slice(1), expected: [{ applicable: true, entityId: "BRD_TEST", field: "accent", researchStatus: "RESOLVED", scope: "EFFECTIVE_BREED" }] })).toThrow("PRESENTATION_AUDIT_COMPLETION_BLOCKER");
  });

  it("does not inherit sapient Species presentation into a PET population", () => {
    const appearance = "A compact domestic duck with a broad bill, webbed feet, layered waterproof plumage, and a low horizontal carriage.";
    const accent = "Vocalization prompt: breath-led avian resonance, short call-length phrases, and restrained nonverbal sounds.";
    const audits = auditEffectiveBreedPresentation({
      breedId: "BRD_PET_DUCK",
      researchStatus: "RESOLVED",
      pet: true,
      species: {
        accent,
        appearance: "An upright feathered person.",
        clothing,
        architecture: "Carved timber halls with reed-patterned screens.",
      },
      breed: { accent: null, appearance, clothing: null, architecture: null },
      semanticReviews: { accent: semantic(accent), appearance: semantic(appearance) },
    });
    expect(audits.map(({ field, disposition }) => [field, disposition])).toEqual([
      ["accent", "PASS"],
      ["appearance", "PASS"],
      ["clothing", "NOT_APPLICABLE"],
      ["architecture", "NOT_APPLICABLE"],
    ]);
  });
});
