import { createHmac } from "node:crypto";

import { productionPresentationBySlug, type ProductionPuzzleSlug } from "../domain/puzzle-production-version-catalog";
import {
  generateProductionPuzzle,
  getMemberPuzzleSummaries,
  getProductionGeneratorCatalog,
  getPublicProductionPuzzle,
  type PlayerPuzzle,
} from "./puzzle-production-generators";
import {
  resolveProductionInstanceRoute,
  validateProductionInstanceSubmission,
  type ProductionPlayerSubmission,
  type PublicRouteStage,
} from "./puzzle-production-validation";

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function memberInstance(publicSlug: string, userId: string, secret: string) {
  const presentation = productionPresentationBySlug(publicSlug);
  if (!presentation) throw new Error("Member puzzle not found.");
  const entry = getProductionGeneratorCatalog().find((candidate) => candidate.puzzleBlueprintId === presentation.puzzleBlueprintId);
  if (!entry || entry.generatorVersion !== presentation.generatorVersion) throw new Error("Member puzzle is not currently available.");
  const subjectKey = `MEMBER:${hmac(secret, `member-puzzle-subject-v1|${userId}`).slice(0, 32)}`;
  const seed = hmac(secret, `member-puzzle-instance-v1|${userId}|${presentation.publicSlug}|${presentation.generatorVersion}`);
  return generateProductionPuzzle({
    generatorVersion: presentation.generatorVersion,
    puzzleBlueprintId: presentation.puzzleBlueprintId,
    seed,
    subjectKey,
  }, secret);
}

export function getMemberPuzzleCatalog() {
  return getMemberPuzzleSummaries();
}

export function getMemberPuzzle(publicSlug: string, userId: string, secret: string): PlayerPuzzle {
  return getPublicProductionPuzzle(memberInstance(publicSlug, userId, secret));
}

export function validateMemberPuzzleSubmission(
  publicSlug: string,
  userId: string,
  submission: ProductionPlayerSubmission,
  secret: string,
) {
  return validateProductionInstanceSubmission(memberInstance(publicSlug, userId, secret), submission, secret);
}

export function resolveMemberPuzzleRoute(
  publicSlug: string,
  userId: string,
  threshold: number,
  secret: string,
): PublicRouteStage {
  if (publicSlug !== "the-pall") throw new Error("The recovered passage is not available for this puzzle.");
  return resolveProductionInstanceRoute(memberInstance(publicSlug, userId, secret), threshold, secret);
}

export function isProductionPuzzleSlug(value: string): value is ProductionPuzzleSlug {
  return Boolean(productionPresentationBySlug(value));
}
