import { z } from "zod";

import { BreedDimensionValue, BreedResearchDimension, ResearchCategory } from "../generated/prisma/enums";
import { isValueForBreedDimension } from "../domain/breed-personality";

export const noellHistoricalQuoteKey = "NOELL_HISTORICAL_QUOTE" as const;

const inputSchema = z.object({
  breedResearchEvidenceId: z.string().trim().min(1),
  breedResearchValueId: z.string().trim().min(1),
  breedId: z.string().trim().min(1),
  dimension: z.enum(BreedResearchDimension),
  value: z.enum(BreedDimensionValue),
  research: z.object({
    researchId: z.string().trim().min(1),
    notes: z.string().trim().min(1),
    citationId: z.string().trim().min(1),
    category: z.enum(ResearchCategory).nullable().optional(),
  }).strict(),
}).strict();

export type CreateBreedResearchInput = z.infer<typeof inputSchema>;

interface BreedResearchTransaction {
  breed: { findUnique(input: { where: { breedId: string }; select: { breedId: true } }): Promise<{ breedId: string } | null> };
  citation: { findUnique(input: { where: { citationId: string }; select: { citationId: true; source: { select: { sourceId: true } } } }): Promise<{ citationId: string; source: { sourceId: string } } | null> };
  breedResearchValue: {
    findUnique(input: { where: { breedId_dimension: { breedId: string; dimension: CreateBreedResearchInput["dimension"] } } }): Promise<{ breedResearchValueId: string; value: CreateBreedResearchInput["value"] } | null>;
    create(input: { data: { breedResearchValueId: string; breedId: string; dimension: CreateBreedResearchInput["dimension"]; value: CreateBreedResearchInput["value"] } }): Promise<{ breedResearchValueId: string }>;
  };
  research: { create(input: { data: CreateBreedResearchInput["research"] }): Promise<{ researchId: string }> };
  breedResearchEvidence: { create(input: { data: { breedResearchEvidenceId: string; breedResearchValueId: string; researchId: string } }): Promise<unknown> };
}

export interface BreedResearchDatabase {
  $transaction<Result>(work: (transaction: BreedResearchTransaction) => Promise<Result>): Promise<Result>;
}

export async function createBreedResearchAssertion(
  rawInput: unknown,
  database: BreedResearchDatabase,
): Promise<{ breedResearchValueId: string; researchId: string }> {
  const input = inputSchema.parse(rawInput);
  if (!isValueForBreedDimension(input.dimension, input.value)) {
    throw new Error(`${input.value} is not valid for Breed dimension ${input.dimension}.`);
  }
  return database.$transaction(async (transaction) => {
    const [breed, citation] = await Promise.all([
      transaction.breed.findUnique({ where: { breedId: input.breedId }, select: { breedId: true } }),
      transaction.citation.findUnique({
        where: { citationId: input.research.citationId },
        select: { citationId: true, source: { select: { sourceId: true } } },
      }),
    ]);
    if (!breed) throw new Error(`Breed ${input.breedId} does not exist.`);
    if (!citation?.source.sourceId) throw new Error(`Research ${input.research.researchId} requires a legitimate Source and Citation.`);

    const existing = await transaction.breedResearchValue.findUnique({
      where: { breedId_dimension: { breedId: input.breedId, dimension: input.dimension } },
    });
    if (existing && existing.value !== input.value) {
      throw new Error(`Breed ${input.breedId} already has a different current ${input.dimension} value.`);
    }
    const value = existing ?? await transaction.breedResearchValue.create({
      data: {
        breedResearchValueId: input.breedResearchValueId,
        breedId: input.breedId,
        dimension: input.dimension,
        value: input.value,
      },
    });
    const research = await transaction.research.create({ data: input.research });
    await transaction.breedResearchEvidence.create({
      data: {
        breedResearchEvidenceId: input.breedResearchEvidenceId,
        breedResearchValueId: value.breedResearchValueId,
        researchId: research.researchId,
      },
    });
    return { breedResearchValueId: value.breedResearchValueId, researchId: research.researchId };
  });
}
