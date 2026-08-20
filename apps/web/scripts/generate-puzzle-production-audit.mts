import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateProductionPuzzle,
  getPublicProductionPuzzle,
  getPuzzleGeneratorReadinessCatalog,
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
const commitSha = process.env.EIDOLON_CANDIDATE_SHA ?? "UNCOMMITTED_WORKTREE";
const generatedAt = new Date().toISOString();
const focusedTests = [
  "apps/web/tests/unit/puzzle-production-generators.test.ts",
  "apps/web/tests/unit/puzzle-tutorial-generators.test.ts",
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

function commonEvidence(status: "BLOCKED" | "PASS") {
  return {
    generatedAt,
    repository: "bkalaf/echoes-of-eidolon",
    commitSha,
    environment: { name: "local-repair", node: process.version, database: "NOT_USED", browser: "NOT_RUN" },
    status,
    inputs: [{ path: "apps/web/data/puzzles/puzzle-blueprint-bank-70.csv", sha256: sourceCsvSha256 }],
    commands: [{ command: "pnpm puzzles:production-audit", startedAt: generatedAt, completedAt: generatedAt, exitCode: 0, logPath: null }],
    artifacts: [],
    blockers: status === "PASS" ? [] : ["66 authored generators remain unimplemented", "independent accessibility/browser/security review not run"],
    notes: ["Local deterministic checks are implementation evidence only; they are not named review or real-browser acceptance."],
  };
}

mkdirSync(perBlueprintRoot, { recursive: true });
const readiness = getPuzzleGeneratorReadinessCatalog();
assert(readiness.length === 70, "Puzzle readiness catalog must contain exactly 70 entries.");
assert(new Set(readiness.map((entry) => entry.primaryFamily)).size === 9, "Puzzle readiness catalog must contain exactly nine families.");

const tierCounts = Object.fromEntries([...new Set(readiness.map((entry) => entry.difficultyTier))]
  .sort()
  .map((tier) => [tier, readiness.filter((entry) => entry.difficultyTier === tier).length]));
assert(Object.values(tierCounts).length === 5 && Object.values(tierCounts).every((count) => count === 14), "Puzzle readiness catalog must contain five tiers of 14.");

const blueprints = readiness.map((entry) => {
  if (entry.productionStatus === "PROTOTYPE_ONLY") {
    const row = {
      puzzleBlueprintId: entry.puzzleBlueprintId,
      tier: entry.difficultyTier,
      primaryFamily: entry.primaryFamily,
      generatorPath: null,
      generatorVersion: entry.generatorVersion,
      productionStatus: "PROTOTYPE_ONLY" as const,
      localDeterministicReplay: "NOT_RUN" as const,
      localSingleSolutionCheck: "NOT_RUN" as const,
      answerFreeClient: "NOT_RUN" as const,
      accessibilityEquivalent: "NOT_PROVEN" as const,
      independentAuthoredContractProof: "NOT_IMPLEMENTED" as const,
      focusedTests,
      status: "BLOCKED" as const,
      blockers: ["No authored production generator exists; the former generic Unicode carrier is prototype-only."],
    };
    writeFileSync(resolve(perBlueprintRoot, `${entry.puzzleBlueprintId}.json`), stableJson({
      schemaVersion: "eidolon-puzzle-blueprint-proof-v2",
      ...commonEvidence("BLOCKED"),
      ...row,
      assertions: [
        { name: "Authored production generator exists", expected: true, observed: false, pass: false },
        { name: "Generic carrier excluded from production coverage", expected: true, observed: true, pass: true },
      ],
      authoredContract: {
        answerFormat: entry.answerFormat,
        concept: entry.concept,
        expectedSolvePath: entry.expectedSolvePath,
        hints: entry.hints,
        playerFacingModalities: entry.playerFacingModalities,
        accessibilityModes: entry.accessibilityModes,
      },
    }));
    return row;
  }

  const input = { generatorVersion: entry.generatorVersion, puzzleBlueprintId: entry.puzzleBlueprintId, seed: proofSeed, subjectKey: proofSubject };
  const generated = generateProductionPuzzle(input, proofSecret);
  const replay = generateProductionPuzzle(input, proofSecret);
  const publicPuzzle = getPublicProductionPuzzle(generated);
  const serialized = JSON.stringify(publicPuzzle);
  const answerFreeClient = !serialized.includes(proofSecret)
    && !serialized.includes(proofSeed)
    && !/(?:canonicalSolution|proofDigest|seed|subjectKey|validationToken)/i.test(serialized);
  const solutions = solveProductionPuzzle(generated);
  const localSingleSolutionCheck = solutions.length === 1 && solutions[0] === generated.canonicalSolution;
  const localAlternateRejection = entry.decoys.every((decoy) => !validateProductionPuzzle(generated, decoy, proofSecret))
    && !validateProductionPuzzle(generated, `${generated.canonicalSolution}-ALTERNATE`, proofSecret);
  assert(replay.instanceChecksum === generated.instanceChecksum, `${entry.puzzleBlueprintId} deterministic replay failed.`);
  assert(localSingleSolutionCheck, `${entry.puzzleBlueprintId} local single-solution check failed.`);
  assert(localAlternateRejection, `${entry.puzzleBlueprintId} local alternate/decoy rejection failed.`);
  assert(answerFreeClient, `${entry.puzzleBlueprintId} browser projection leaked protected data.`);
  const row = {
    puzzleBlueprintId: entry.puzzleBlueprintId,
    tier: entry.difficultyTier,
    primaryFamily: entry.primaryFamily,
    generatorPath: entry.implementationPath,
    generatorVersion: entry.generatorVersion,
    productionStatus: "PRODUCTION" as const,
    seedVector: `RELEASE_PROOF_VECTOR_01:${sha256(`${entry.puzzleBlueprintId}|${proofSeed}`).slice(0, 16)}`,
    instanceChecksum: generated.instanceChecksum,
    localDeterministicReplay: true,
    localSingleSolutionCheck: true,
    localAlternateRejection: true,
    answerFreeClient: true,
    accessibilityEquivalent: "NOT_PROVEN" as const,
    independentAuthoredContractProof: "REVIEW_REQUIRED" as const,
    focusedTests,
    status: "BLOCKED" as const,
    blockers: ["Real accessibility-equivalence, browser, security, and named owner review remain outstanding."],
  };
  writeFileSync(resolve(perBlueprintRoot, `${entry.puzzleBlueprintId}.json`), stableJson({
    schemaVersion: "eidolon-puzzle-blueprint-proof-v2",
    ...commonEvidence("BLOCKED"),
    ...row,
    assertions: [
      { name: "Authored production generator exists", expected: true, observed: true, pass: true },
      { name: "Deterministic local replay", expected: true, observed: true, pass: true },
      { name: "Answer-free public projection", expected: true, observed: true, pass: true },
      { name: "Independent accessibility equivalence", expected: true, observed: "NOT_RUN", pass: false },
    ],
    authoredContract: {
      answerFormat: entry.answerFormat,
      concept: entry.concept,
      expectedSolvePath: entry.expectedSolvePath,
      hints: entry.hints,
      playerFacingModalities: entry.playerFacingModalities,
      accessibilityModes: entry.accessibilityModes,
    },
  }));
  return row;
});

const productionGeneratorCount = blueprints.filter((entry) => entry.productionStatus === "PRODUCTION").length;
const prototypeOnlyCount = blueprints.filter((entry) => entry.productionStatus === "PROTOTYPE_ONLY").length;
assert(productionGeneratorCount === 4, `Expected four authored tutorial generators, observed ${productionGeneratorCount}.`);
assert(prototypeOnlyCount === 66, `Expected 66 prototype-only entries, observed ${prototypeOnlyCount}.`);

const coverage = {
  schemaVersion: "eidolon-puzzle-generator-coverage-v2",
  ...commonEvidence("BLOCKED"),
  release: "0.3.0",
  sourceCsvSha256,
  summary: {
    blueprintCount: 70,
    productionGeneratorCount,
    prototypeOnlyCount,
    releaseAcceptedGeneratorCount: 0,
    authoredGeneratorsMissing: prototypeOnlyCount,
    tierCounts,
    familyCount: 9,
    locallyObservedAnswerLeaks: 0,
    independentlyProvenAccessibilityEquivalents: 0,
  },
  assertions: [
    { name: "Exact Blueprint inventory", expected: 70, observed: blueprints.length, pass: blueprints.length === 70 },
    { name: "Generic carriers excluded from production", expected: 66, observed: prototypeOnlyCount, pass: prototypeOnlyCount === 66 },
    { name: "Release production coverage", expected: 70, observed: productionGeneratorCount, pass: productionGeneratorCount === 70 },
    { name: "Independent accessibility equivalence", expected: 70, observed: 0, pass: false },
  ],
  blueprints,
};

writeFileSync(resolve(outputRoot, "puzzle-generator-coverage.json"), stableJson(coverage));
process.stdout.write(`Recorded ${productionGeneratorCount} authored production generators and ${prototypeOnlyCount} prototype-only Blueprints; G08 remains BLOCKED.\n`);
