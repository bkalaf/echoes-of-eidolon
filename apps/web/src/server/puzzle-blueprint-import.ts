import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "../generated/prisma/client";
import {
  parsePuzzleBlueprintIntakeRow,
  validatePuzzleBlueprintIntakePackage,
  type PuzzleBlueprintIntakeRow,
} from "../domain/puzzle-blueprint";
import { PUZZLE_BLUEPRINT_PACKAGE_SHA256, parsePuzzleBlueprintPackageCsv } from "../domain/puzzle-blueprint-package";
import { getDatabase } from "./database";
import { buildProductionPuzzleVersionAddition } from "./puzzle-production-version-persistence";

export class PuzzleBlueprintImportConflictError extends Error {}

export type PuzzleBlueprintImportMode = "apply" | "verify";

export interface PuzzleBlueprintImportOptions {
  mode?: PuzzleBlueprintImportMode;
  targetEnvironment?: string;
}

function normalizedImportOptions(options: PuzzleBlueprintImportOptions = {}) {
  const mode = options.mode ?? "verify";
  if (mode !== "apply" && mode !== "verify") throw new Error(`Unknown Puzzle Blueprint import mode: ${String(mode)}`);
  const targetEnvironment = options.targetEnvironment?.trim();
  if (mode === "apply" && !targetEnvironment) {
    throw new Error("Puzzle Blueprint apply mode requires an explicit target environment.");
  }
  return targetEnvironment ? { mode, targetEnvironment } : { mode };
}

export function parsePuzzleBlueprintImportArguments(arguments_: string[]): PuzzleBlueprintImportOptions {
  const applyArguments = arguments_.filter((argument) => argument === "--apply");
  const verifyArguments = arguments_.filter((argument) => argument === "--verify-only");
  const targetArguments = arguments_.filter((argument) => argument.startsWith("--target="));
  const unknownArgument = arguments_.find((argument) => argument !== "--apply" && argument !== "--verify-only" && !argument.startsWith("--target="));
  if (unknownArgument) throw new Error(`Unknown Puzzle Blueprint import argument: ${unknownArgument}`);
  if (applyArguments.length > 1 || verifyArguments.length > 1 || targetArguments.length > 1) {
    throw new Error("Duplicate Puzzle Blueprint import mode or target argument.");
  }
  if (applyArguments.length && verifyArguments.length) {
    throw new Error("Conflicting Puzzle Blueprint import modes: choose verify-only or apply.");
  }
  const targetEnvironment = targetArguments[0]?.slice("--target=".length).trim();
  if (targetArguments.length && !targetEnvironment) throw new Error("Puzzle Blueprint target environment must not be empty.");
  return normalizedImportOptions({
    mode: applyArguments.length ? "apply" : "verify",
    ...(targetEnvironment ? { targetEnvironment } : {}),
  });
}

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
  options: PuzzleBlueprintImportOptions = {},
  database: PrismaClient = getDatabase(),
) {
  const importOptions = normalizedImportOptions(options);
  const apply = importOptions.mode === "apply";
  const checksum = createHash("sha256").update(csv).digest("hex");
  if (checksum !== PUZZLE_BLUEPRINT_PACKAGE_SHA256) {
    throw new Error(`Puzzle Blueprint package checksum mismatch: expected ${PUZZLE_BLUEPRINT_PACKAGE_SHA256}, received ${checksum}.`);
  }
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
    let supplementalMissingVersions = 0;
    let supplementalUnchangedVersions = 0;

    for (const entry of parsed) {
      const current = byId.get(entry.root.puzzleBlueprintId);
      const hints = entry.hints.map(({ kind, level, template }) => ({ kind, level, template }));
      const design = entry.version.design as unknown as Prisma.InputJsonValue;
      const supplemental = buildProductionPuzzleVersionAddition(entry.root.puzzleBlueprintId, entry.version.design);
      if (supplemental) supplementalMissingVersions += current?.versions.some((version) => version.generatorVersion === supplemental.generatorVersion) ? 0 : 1;
      if (!current) {
        missingRoots += 1;
        missingVersions += 1;
        if (apply) {
          await transaction.puzzleBlueprint.create({
            data: {
              ...entry.root,
              versions: {
                create: [
                  { design, generatorVersion: entry.version.generatorVersion, hints: { create: hints } },
                  ...(supplemental ? [{
                    design: supplemental.design as unknown as Prisma.InputJsonValue,
                    generatorVersion: supplemental.generatorVersion,
                    hints: { create: supplemental.hints },
                  }] : []),
                ],
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
        if (apply) {
          await transaction.puzzleBlueprintVersion.create({
            data: {
              design,
              generatorVersion: entry.version.generatorVersion,
              hints: { create: hints },
              puzzleBlueprintId: entry.root.puzzleBlueprintId,
            },
          });
        }
      } else if (stableJson(currentVersion.design) !== stableJson(entry.version.design) || stableJson(currentVersion.hints) !== stableJson(hints)) {
        throw new PuzzleBlueprintImportConflictError(
          `Puzzle Blueprint ${entry.root.puzzleBlueprintId}@${entry.version.generatorVersion} conflicts with the checksum-pinned package; the immutable version was not overwritten.`,
        );
      } else {
        unchangedVersions += 1;
      }

      if (supplemental) {
        const currentSupplemental = current.versions.find((version) => version.generatorVersion === supplemental.generatorVersion);
        if (!currentSupplemental) {
          if (apply) {
            await transaction.puzzleBlueprintVersion.create({
              data: {
                design: supplemental.design as unknown as Prisma.InputJsonValue,
                generatorVersion: supplemental.generatorVersion,
                hints: { create: supplemental.hints },
                puzzleBlueprintId: entry.root.puzzleBlueprintId,
              },
            });
          }
        } else if (stableJson(currentSupplemental.design) !== stableJson(supplemental.design) || stableJson(currentSupplemental.hints) !== stableJson(supplemental.hints)) {
          throw new PuzzleBlueprintImportConflictError(
            `Puzzle Blueprint ${entry.root.puzzleBlueprintId}@${supplemental.generatorVersion} conflicts with the supplemental production contract; the immutable version was not overwritten.`,
          );
        } else {
          supplementalUnchangedVersions += 1;
        }
      }
    }

    return {
      applied: apply,
      mode: importOptions.mode,
      ...("targetEnvironment" in importOptions ? { targetEnvironment: importOptions.targetEnvironment } : {}),
      packageBlueprints: parsed.length,
      missingRoots,
      missingVersions,
      unchangedVersions,
      supplementalMissingVersions,
      supplementalUnchangedVersions,
      provenanceComponentHandles: provenanceComponentHandles.size,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
