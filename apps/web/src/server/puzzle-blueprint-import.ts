import { Prisma, type PrismaClient } from "../generated/prisma/client";
import {
  parsePuzzleBlueprintIntakeRow,
  validatePuzzleBlueprintIntakePackage,
  type PuzzleBlueprintIntakeRow,
} from "../domain/puzzle-blueprint";
import { parsePuzzleBlueprintPackageCsv } from "../domain/puzzle-blueprint-package";
import { getDatabase } from "./database";

export class PuzzleBlueprintImportConflictError extends Error {}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function assertRootMatches(
  expected: { difficultyTier: string; primaryFamily: string; puzzleBlueprintId: string; title: string },
  actual: { difficultyTier: string; primaryFamily: string; puzzleBlueprintId: string; title: string },
) {
  for (const field of ["difficultyTier", "primaryFamily", "title"] as const) {
    if (actual[field] !== expected[field]) {
      throw new PuzzleBlueprintImportConflictError(
        `Puzzle Blueprint ${expected.puzzleBlueprintId} conflicts on ${field}; existing data was not overwritten.`,
      );
    }
  }
}

export async function importPuzzleBlueprintPackage(
  csv: string,
  options: { verifyOnly?: boolean } = {},
  database: PrismaClient = getDatabase(),
) {
  const rows = parsePuzzleBlueprintPackageCsv(csv);
  const parsed = rows.map((row) => parsePuzzleBlueprintIntakeRow(row as PuzzleBlueprintIntakeRow));
  validatePuzzleBlueprintIntakePackage(parsed.map(({ hints, root, version }) => ({
    ...root,
    generatorVersion: version.generatorVersion,
    hints,
  })));
  const ids = parsed.map(({ root }) => root.puzzleBlueprintId);
  const provenanceComponentHandles = new Set(parsed.flatMap((entry) => entry.provenanceOnly.reusableComponentRequirementIds));

  return database.$transaction(async (transaction) => {
    const existing = await transaction.puzzleBlueprint.findMany({
      where: { puzzleBlueprintId: { in: ids } },
      select: {
        difficultyTier: true,
        primaryFamily: true,
        puzzleBlueprintId: true,
        title: true,
        versions: {
          select: {
            design: true,
            generatorVersion: true,
            hints: { orderBy: { level: "asc" }, select: { kind: true, level: true, template: true } },
          },
        },
      },
    });
    const byId = new Map(existing.map((blueprint) => [blueprint.puzzleBlueprintId, blueprint]));
    let missingRoots = 0;
    let missingVersions = 0;
    let unchangedVersions = 0;

    for (const entry of parsed) {
      const current = byId.get(entry.root.puzzleBlueprintId);
      const hints = entry.hints.map(({ kind, level, template }) => ({ kind, level, template }));
      if (!current) {
        missingRoots += 1;
        missingVersions += 1;
        if (!options.verifyOnly) {
          await transaction.puzzleBlueprint.create({
            data: {
              ...entry.root,
              versions: {
                create: {
                  design: entry.version.design,
                  generatorVersion: entry.version.generatorVersion,
                  hints: { create: hints },
                },
              },
            },
          });
        }
        continue;
      }

      assertRootMatches(entry.root, current);
      const currentVersion = current.versions.find((version) => version.generatorVersion === entry.version.generatorVersion);
      if (!currentVersion) {
        missingVersions += 1;
        if (!options.verifyOnly) {
          await transaction.puzzleBlueprintVersion.create({
            data: {
              design: entry.version.design,
              generatorVersion: entry.version.generatorVersion,
              hints: { create: hints },
              puzzleBlueprintId: entry.root.puzzleBlueprintId,
            },
          });
        }
        continue;
      }

      if (stableJson(currentVersion.design) !== stableJson(entry.version.design) || stableJson(currentVersion.hints) !== stableJson(hints)) {
        throw new PuzzleBlueprintImportConflictError(
          `Puzzle Blueprint ${entry.root.puzzleBlueprintId}@${entry.version.generatorVersion} conflicts with the checksum-pinned package; the immutable version was not overwritten.`,
        );
      }
      unchangedVersions += 1;
    }

    return {
      applied: !options.verifyOnly,
      packageBlueprints: parsed.length,
      missingRoots,
      missingVersions,
      unchangedVersions,
      provenanceComponentHandles: provenanceComponentHandles.size,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
