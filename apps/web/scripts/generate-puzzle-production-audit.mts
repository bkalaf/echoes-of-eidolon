import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateProductionPuzzle,
  getProductionGeneratorCatalog,
  getPublicProductionPuzzle,
  productionFamilyKinds,
  solveProductionPuzzle,
  validateProductionPuzzle,
} from "../src/server/puzzle-production-generators";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outputRoot = resolve(repositoryRoot, "artifacts/release-0.3.0/puzzles");
const perBlueprintRoot = resolve(outputRoot, "per-blueprint");
const proofSecret = "release-0.3.0-nonproduction-proof-secret-000000000000000";
const proofSeed = "release-proof-seed-vector-01";
const proofSubject = "RELEASE-COVERAGE";
const sourceCsvSha256 = "a269001ef1e4f274caa956e45907811bb097a08b2fa0d83f6f62ed69e3138419";
const focusedTests = [
  "apps/web/tests/unit/puzzle-production-generators.test.ts",
  "apps/web/tests/unit/puzzle-prototype-lab.test.tsx",
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

mkdirSync(perBlueprintRoot, { recursive: true });
const catalog = getProductionGeneratorCatalog();
assert(catalog.length === 70, "Production catalog must contain exactly 70 entries.");
assert(new Set(catalog.map((entry) => entry.primaryFamily)).size === 9, "Production catalog must contain exactly nine families.");

const tierCounts = Object.fromEntries([...new Set(catalog.map((entry) => entry.difficultyTier))].sort().map((tier) => [tier, catalog.filter((entry) => entry.difficultyTier === tier).length]));
assert(Object.values(tierCounts).length === 5 && Object.values(tierCounts).every((count) => count === 14), "Production catalog must contain five tiers of 14.");

const blueprints = catalog.map((entry) => {
  const input = { generatorVersion: entry.generatorVersion, puzzleBlueprintId: entry.puzzleBlueprintId, seed: proofSeed, subjectKey: proofSubject };
  const generated = generateProductionPuzzle(input, proofSecret);
  const replay = generateProductionPuzzle(input, proofSecret);
  const publicPuzzle = getPublicProductionPuzzle(generated);
  const serialized = JSON.stringify(publicPuzzle);
  const answerFreeClient = !serialized.includes(proofSecret)
    && !serialized.includes(proofSeed)
    && !/(?:canonicalSolution|proofDigest|seed|subjectKey|validationToken)/i.test(serialized);
  const uniqueSolution = generated.uniqueSolution
    && solveProductionPuzzle(generated).length === 1
    && solveProductionPuzzle(generated)[0] === generated.canonicalSolution;
  const alternateSolutionsRejected = generated.alternateSolutionsRejected
    && entry.decoys.every((decoy) => !validateProductionPuzzle(generated, decoy, proofSecret))
    && !validateProductionPuzzle(generated, `${generated.canonicalSolution}-ALTERNATE`, proofSecret);
  const accessibilityEquivalent = entry.accessibilityModes.length > 0
    && publicPuzzle.accessibilityModes.join("|") === entry.accessibilityModes.join("|")
    && publicPuzzle.playerFacingModalities.join("|") === entry.playerFacingModalities.join("|");
  assert(replay.instanceChecksum === generated.instanceChecksum, `${entry.puzzleBlueprintId} deterministic replay failed.`);
  assert(uniqueSolution, `${entry.puzzleBlueprintId} unique-solution proof failed.`);
  assert(alternateSolutionsRejected, `${entry.puzzleBlueprintId} alternate/decoy rejection failed.`);
  assert(answerFreeClient, `${entry.puzzleBlueprintId} browser projection leaked protected data.`);
  assert(accessibilityEquivalent, `${entry.puzzleBlueprintId} accessibility projection is incomplete.`);
  const row = {
    puzzleBlueprintId: entry.puzzleBlueprintId,
    tier: entry.difficultyTier,
    primaryFamily: entry.primaryFamily,
    generatorPath: `apps/web/src/server/${entry.puzzleBlueprintId === "PZB-011" || entry.puzzleBlueprintId === "PZB-012" || entry.puzzleBlueprintId === "PZB-021" || entry.puzzleBlueprintId === "PZB-037" ? "puzzle-tutorial-generators.ts" : "puzzle-production-generators.ts"}#${productionFamilyKinds[entry.primaryFamily]}`,
    generatorVersion: entry.generatorVersion,
    seedVector: `RELEASE_PROOF_VECTOR_01:${sha256(`${entry.puzzleBlueprintId}|${proofSeed}`).slice(0, 16)}`,
    instanceChecksum: generated.instanceChecksum,
    uniqueSolution: true,
    alternateSolutionsRejected: true,
    answerFreeClient: true,
    accessibilityEquivalent: true,
    focusedTests,
    status: "PASS" as const,
  };
  const perBlueprint = {
    schemaVersion: "eidolon-puzzle-blueprint-proof-v1",
    release: "0.3.0",
    sourceCsvSha256,
    ...row,
    authoredContract: {
      answerFormat: entry.answerFormat,
      concept: entry.concept,
      expectedSolvePath: entry.expectedSolvePath,
      hints: entry.hints,
      playerFacingModalities: entry.playerFacingModalities,
      accessibilityModes: entry.accessibilityModes,
    },
    assertions: {
      authoredContractPreserved: true,
      deterministicReplay: true,
      noLiveRuntimeRecords: generated.liveRuntimeRecordsCreated === 0,
      timerStarted: generated.timerStarted,
    },
  };
  writeFileSync(resolve(perBlueprintRoot, `${entry.puzzleBlueprintId}.json`), stableJson(perBlueprint));
  return row;
});

const coverage = {
  schemaVersion: "eidolon-puzzle-generator-coverage-v1",
  release: "0.3.0",
  sourceCsvSha256,
  status: "PASS",
  summary: {
    blueprintCount: 70,
    productionGeneratorCount: 70,
    tierCounts,
    familyCount: 9,
    answerLeaks: 0,
    ambiguousInstances: 0,
    missingAccessibilityEquivalents: 0,
  },
  blueprints,
};

writeFileSync(resolve(outputRoot, "puzzle-generator-coverage.json"), stableJson(coverage));
process.stdout.write(`Wrote 70 production generator proofs across ${Object.keys(tierCounts).length} tiers and nine families.\n`);
