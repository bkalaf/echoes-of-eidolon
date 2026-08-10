import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import type { AnySchema } from "ajv";

import { getAtlasEnv } from "./env";

interface ArtifactReference {
  path: string;
  sha256: string;
  byteSize: number;
}

interface DatasetReference extends ArtifactReference {
  recordCount: number | null;
}

interface AtlasReleaseManifest {
  releaseId: string;
  worldId: string;
  coordinateReferenceSystem: string;
  datasets: {
    pointsOfInterest: DatasetReference;
    settlementSites: DatasetReference;
  };
  [key: string]: unknown;
}

export interface CanonicalPointOfInterest {
  poiId: string;
  workingLabel: string;
  displayName: string | null;
  nameStatus: "WORKING" | "CANONICAL";
  category: string;
  latitude: number;
  longitude: number;
  regionId: string;
}

export interface CanonicalSettlementSite {
  siteId: string;
  regionId: string;
  classification: string;
  latitude: number;
  longitude: number;
  [key: string]: unknown;
}

interface PointOfInterestDataset {
  pointsOfInterest: CanonicalPointOfInterest[];
}

interface SettlementSiteDataset {
  settlementSites: CanonicalSettlementSite[];
}

export interface AtlasCatalog {
  releaseId: string;
  worldId: string;
  coordinateReferenceSystem: string;
  pointsOfInterest: CanonicalPointOfInterest[];
  settlementSites: CanonicalSettlementSite[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectArtifactReferences(value: unknown): ArtifactReference[] {
  if (Array.isArray(value)) return value.flatMap(collectArtifactReferences);
  if (!isRecord(value)) return [];

  const ownReference =
    typeof value.path === "string" &&
    typeof value.sha256 === "string" &&
    typeof value.byteSize === "number"
      ? [{ path: value.path, sha256: value.sha256, byteSize: value.byteSize }]
      : [];
  return [...ownReference, ...Object.values(value).flatMap(collectArtifactReferences)];
}

function artifactPath(root: string, relativePath: string): string {
  const absoluteRoot = resolve(root);
  const absoluteArtifact = resolve(absoluteRoot, relativePath);
  if (!absoluteArtifact.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error(`Atlas artifact escapes the release root: ${relativePath}`);
  }
  return absoluteArtifact;
}

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function assertSchema(schema: unknown, value: unknown, label: string): void {
  const validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    schema as AnySchema,
  );
  if (!validator(value)) {
    const details = validator.errors
      ?.map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new Error(`${label} failed schema validation: ${details}`);
  }
}

async function verifyArtifacts(root: string, manifest: AtlasReleaseManifest): Promise<void> {
  const references = collectArtifactReferences(manifest);
  await Promise.all(
    references.map(async (reference) => {
      const path = artifactPath(root, reference.path);
      const file = await stat(path);
      if (file.size !== reference.byteSize) {
        throw new Error(`Atlas artifact size mismatch: ${reference.path}`);
      }
      if ((await sha256(path)) !== reference.sha256) {
        throw new Error(`Atlas artifact hash mismatch: ${reference.path}`);
      }
    }),
  );
}

export async function loadAtlasRelease(root: string): Promise<AtlasCatalog> {
  const manifestPath = artifactPath(root, "atlas-data-release.json");
  const manifestSchemaPath = artifactPath(root, "contracts/atlas-data-release.schema.json");
  const manifestValue = await readJson(manifestPath);
  const manifestSchema = await readJson(manifestSchemaPath);
  assertSchema(manifestSchema, manifestValue, "Atlas release manifest");

  const manifest = manifestValue as AtlasReleaseManifest;
  await verifyArtifacts(root, manifest);

  const poiValue = await readJson(artifactPath(root, manifest.datasets.pointsOfInterest.path));
  const poiSchema = await readJson(artifactPath(root, "contracts/points_of_interest.schema.json"));
  assertSchema(poiSchema, poiValue, "Points of Interest");

  const siteValue = await readJson(artifactPath(root, manifest.datasets.settlementSites.path));
  const siteSchema = await readJson(artifactPath(root, "contracts/settlement_sites.schema.json"));
  assertSchema(siteSchema, siteValue, "Settlement Sites");

  const pointsOfInterest = (poiValue as PointOfInterestDataset).pointsOfInterest;
  const settlementSites = (siteValue as SettlementSiteDataset).settlementSites;
  if (pointsOfInterest.length !== manifest.datasets.pointsOfInterest.recordCount) {
    throw new Error("Points of Interest count does not match the release manifest");
  }
  if (settlementSites.length !== manifest.datasets.settlementSites.recordCount) {
    throw new Error("Settlement Sites count does not match the release manifest");
  }

  return {
    releaseId: manifest.releaseId,
    worldId: manifest.worldId,
    coordinateReferenceSystem: manifest.coordinateReferenceSystem,
    pointsOfInterest,
    settlementSites,
  };
}

let catalog: Promise<AtlasCatalog> | undefined;

export function getAtlasCatalog(): Promise<AtlasCatalog> {
  catalog ??= loadAtlasRelease(getAtlasEnv().ATLAS_RELEASE_ROOT);
  return catalog;
}
