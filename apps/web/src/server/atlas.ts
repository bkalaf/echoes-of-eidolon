import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import type { AnySchema } from "ajv";

import { validateAtlasTopology, latticeForRegion, type AtlasTopology } from "../domain/atlas-topology";
import type { LatticeId, NameStatus, RegionId } from "../generated/prisma/enums";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { getAtlasEnv } from "./env";

interface R09FileReference {
  path: string;
  sha256: string;
  bytes: number;
}

interface R09FileManifest {
  datasetId: string;
  fileCount: number;
  files: R09FileReference[];
}

interface R09DeploymentManifest {
  datasetId: string;
  status: string;
}

interface R09ReleaseManifest {
  releaseId: string;
  worldId: string;
  coordinateReferenceSystem: string;
  invariants: {
    physicalRegions: number;
    physicalSettlementCandidates: number;
    initialOriginalFoundingCities: number;
    connections: number;
    poleCrossovers: number;
    latticeIdEqualsRegionId: boolean;
  };
}

const r09DatasetId = "EIDOLON_ATLAS_DATASET_R09_AUTHORITATIVE_DEPLOYMENT_V2";
const r09ReleaseId = "EIDOLON_ATLAS_RECON_NIMBUS_P3V6_R09_AUTHORITATIVE_FULL_ATLAS_RELEASE";
const r09FileManifestSha256 = "e3a8d11e9a80c44d06aeba62fceff4b733acc516a6aded4fff3fd3913ecc8ac2";

export interface CanonicalPointOfInterest {
  poiId: string;
  workingLabel: string;
  displayName: string | null;
  nameStatus: NameStatus;
  category: string;
  latitude: number;
  longitude: number;
  regionId: RegionId;
  [key: string]: unknown;
}

export interface CanonicalSettlementSite {
  siteId: string;
  regionId: RegionId;
  classification: string;
  latitude: number;
  longitude: number;
  [key: string]: unknown;
}

export interface CanonicalFoundingCitySite extends CanonicalSettlementSite {
  cityDisplayName: string;
  existsAtInitialFounding: boolean;
  isOriginalFoundingCity: boolean;
  surfaceType: string;
}

export interface CanonicalAtlasRegion {
  displayName: string;
  regionId: RegionId;
}

export type ProjectedPointOfInterest = CanonicalPointOfInterest & { latticeId: LatticeId };
export type ProjectedSettlementSite = CanonicalSettlementSite & { latticeId: LatticeId };

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

export interface AtlasCatalogProjection extends Omit<AtlasCatalog, "pointsOfInterest" | "settlementSites"> {
  connections: AtlasTopology["connections"];
  pointsOfInterest: ProjectedPointOfInterest[];
  regionMappings: AtlasTopology["mappings"];
  settlementSites: ProjectedSettlementSite[];
}

export interface AtlasAuthoritySummary {
  physicalRegions: number;
  initialOriginalFoundingCities: number;
  r10InitialSettlementExists: boolean;
  r10PostDjtNames: { C: string; S: string; R: string };
  ascendancy: {
    cityName: string;
    siteId: string;
    regionId: RegionId;
    latitude: number;
    longitude: number;
    surfaceType: string;
  };
  highcourtPopulation: string[];
  forestfoldPopulation: string[];
  continents: string[];
  latticeConnections: number;
  poleCrossovers: number;
  regionMappingCount: number;
  latticeIdEqualsRegionId: boolean;
}

export interface AtlasReleaseBundle {
  authority: AtlasAuthoritySummary;
  catalog: AtlasCatalog;
  foundingCitySites: CanonicalFoundingCitySite[];
  regions: CanonicalAtlasRegion[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function omitCopiedLatticeId(record: CanonicalPointOfInterest): CanonicalPointOfInterest;
export function omitCopiedLatticeId(record: CanonicalSettlementSite): CanonicalSettlementSite;
export function omitCopiedLatticeId<T extends Record<string, unknown>>(record: T): Omit<T, "latticeId">;
export function omitCopiedLatticeId<T extends Record<string, unknown>>(record: T): Omit<T, "latticeId"> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== "latticeId")) as Omit<T, "latticeId">;
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

async function verifyR09Files(root: string): Promise<void> {
  const manifestPath = artifactPath(root, "FILE_MANIFEST.json");
  if ((await sha256(manifestPath)) !== r09FileManifestSha256) {
    throw new Error("R09 Atlas file manifest hash mismatch");
  }
  const value = await readJson(manifestPath);
  if (!isRecord(value) || value.datasetId !== r09DatasetId || value.fileCount !== 100 || !Array.isArray(value.files)) {
    throw new Error("R09 Atlas file manifest identity is invalid");
  }
  const manifest = value as unknown as R09FileManifest;
  if (manifest.files.length !== manifest.fileCount || new Set(manifest.files.map(({ path }) => path)).size !== manifest.fileCount) {
    throw new Error("R09 Atlas file manifest count or identity is invalid");
  }
  await Promise.all(
    manifest.files.map(async (reference) => {
      if (typeof reference.path !== "string" || typeof reference.sha256 !== "string" || typeof reference.bytes !== "number") {
        throw new Error("R09 Atlas file reference is invalid");
      }
      const path = artifactPath(root, reference.path);
      const file = await stat(path);
      if (file.size !== reference.bytes) {
        throw new Error(`Atlas artifact size mismatch: ${reference.path}`);
      }
      if ((await sha256(path)) !== reference.sha256) {
        throw new Error(`Atlas artifact hash mismatch: ${reference.path}`);
      }
    }),
  );
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error(`${label} is invalid`);
  return value;
}

function assertR09Authority(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(`R09 Atlas authority mismatch: ${label}`);
}

export async function loadAtlasReleaseBundle(root: string): Promise<AtlasReleaseBundle> {
  await verifyR09Files(root);

  const [deploymentValue, releaseValue] = await Promise.all([
    readJson(artifactPath(root, "DEPLOYMENT_DATASET_MANIFEST.json")),
    readJson(artifactPath(root, "R09_AUTHORITATIVE_RELEASE_MANIFEST.json")),
  ]);
  if (!isRecord(deploymentValue) || !isRecord(releaseValue)) throw new Error("R09 Atlas manifests are invalid");
  const deployment = deploymentValue as unknown as R09DeploymentManifest;
  const release = releaseValue as unknown as R09ReleaseManifest;
  assertR09Authority(deployment.datasetId === r09DatasetId, "deployment dataset identity");
  assertR09Authority(deployment.status === "AUTHORITATIVE_CURRENT", "deployment status");
  assertR09Authority(release.releaseId === r09ReleaseId, "release identity");
  assertR09Authority(release.coordinateReferenceSystem === "EPSG:4326", "coordinate reference system");

  const poiValue = await readJson(artifactPath(root, "data/points_of_interest.json"));
  const poiSchema = await readJson(artifactPath(root, "contracts/points_of_interest.schema.json"));
  assertSchema(poiSchema, poiValue, "Points of Interest");

  const siteValue = await readJson(artifactPath(root, "data/settlement_sites.json"));
  const siteSchema = await readJson(artifactPath(root, "contracts/settlement_sites.schema.json"));
  assertSchema(siteSchema, siteValue, "Settlement Sites");

  const pointsOfInterest = (poiValue as PointOfInterestDataset).pointsOfInterest.map((point) => omitCopiedLatticeId(point));
  const settlementSites = (siteValue as SettlementSiteDataset).settlementSites.map((site) => omitCopiedLatticeId(site));
  assertR09Authority(pointsOfInterest.length === 92, "Point of Interest count");
  assertR09Authority(settlementSites.length === release.invariants.physicalSettlementCandidates && settlementSites.length === 400, "physical settlement candidate count");

  const [foundingValue, regionsValue, continentsValue, connectionsValue, mappingsValue, initialValue, concordValue, schismValue, ruinValue] = await Promise.all([
    readJson(artifactPath(root, "data/canonical_integration/founding_city_sites.json")),
    readJson(artifactPath(root, "data/regions_25.json")),
    readJson(artifactPath(root, "data/canonical_integration/continents.json")),
    readJson(artifactPath(root, "data/topology/Connections.json")),
    readJson(artifactPath(root, "data/topology/Region Mapping.json")),
    readJson(artifactPath(root, "data/world_history/initial-founding-state.json")),
    readJson(artifactPath(root, "data/world_history/concord-post-djt-state.json")),
    readJson(artifactPath(root, "data/world_history/schism-post-djt-state.json")),
    readJson(artifactPath(root, "data/world_history/ruin-post-djt-state.json")),
  ]);
  if (!isRecord(foundingValue) || !isRecord(regionsValue) || !isRecord(continentsValue)
    || !isRecord(connectionsValue) || !isRecord(mappingsValue) || !isRecord(initialValue)
    || !isRecord(concordValue) || !isRecord(schismValue) || !isRecord(ruinValue)) {
    throw new Error("R09 canonical authority dataset is invalid");
  }

  const foundingRecords = foundingValue.records as CanonicalFoundingCitySite[];
  const regionRecords = regionsValue.records as Array<Record<string, unknown>>;
  const continentRecords = continentsValue.records as Array<Record<string, unknown>>;
  const connections = connectionsValue.connections as Array<Record<string, unknown>>;
  const mappings = mappingsValue.regionMapping as Array<Record<string, unknown>>;
  assertR09Authority(Array.isArray(foundingRecords) && foundingValue.recordCount === 25 && foundingRecords.length === 25, "founding city Site count");
  assertR09Authority(foundingRecords.filter(({ isOriginalFoundingCity }) => isOriginalFoundingCity).length === 24, "original founding city count");
  assertR09Authority(Array.isArray(regionRecords) && regionRecords.length === release.invariants.physicalRegions && regionRecords.length === 25, "physical Region count");
  const regions = regionRecords.map((entry, index) => {
    const expectedRegionId = `R${String(index + 1).padStart(2, "0")}`;
    assertR09Authority(entry.regionId === expectedRegionId && typeof entry.displayName === "string" && entry.displayName.trim().length > 0, `Region identity ${expectedRegionId}`);
    return { displayName: entry.displayName, regionId: entry.regionId as RegionId };
  });
  assertR09Authority(Array.isArray(continentRecords) && continentRecords.length === 3, "continent count");
  assertR09Authority(Array.isArray(connections) && connectionsValue.count === 44 && connections.length === release.invariants.connections, "Lattice connection count");
  assertR09Authority(isRecord(connectionsValue.counts) && connectionsValue.counts.POLE_CROSSOVER === 0 && release.invariants.poleCrossovers === 0, "pole crossover count");
  assertR09Authority(Array.isArray(mappings) && mappingsValue.count === 25 && mappings.length === 25, "Region Mapping count");
  assertR09Authority(release.invariants.latticeIdEqualsRegionId === false && mappings.some((entry) => String(entry.regionId).slice(1) !== String(entry.latticeId).slice(1)), "Region and Lattice identity separation");

  const region = (regionId: string) => regionRecords.find((entry) => entry.regionId === regionId);
  const highcourt = region("R06");
  const forestfold = region("R15");
  const innerwood = region("R10");
  const population = (entry: Record<string, unknown> | undefined, label: string) => {
    assertR09Authority(!!entry && Array.isArray(entry.regionalRacialGroups), `${label} population`);
    return entry.regionalRacialGroups.map((group) => {
      assertR09Authority(isRecord(group) && typeof group.racialGroup === "string", `${label} population assignment`);
      return group.racialGroup;
    });
  };
  const highcourtPopulation = population(highcourt, "Highcourt");
  const forestfoldPopulation = population(forestfold, "Forestfold");
  assertR09Authority(highcourt?.displayName === "Highcourt", "Highcourt Region name");
  assertR09Authority(forestfold?.displayName === "Forestfold", "Forestfold Region name");
  assertR09Authority(innerwood?.displayName === "Innerwood" && isRecord(innerwood.foundingCity) && innerwood.foundingCity.existsAtInitialFounding === false, "Innerwood initial state");
  assertR09Authority(isRecord(innerwood?.foundingCity) && isRecord(innerwood.foundingCity.worldSpecificCityNames), "Innerwood world-specific names");
  const r10Names = innerwood.foundingCity.worldSpecificCityNames as { C: string; S: string; R: string };
  assertR09Authority(r10Names.C === "Ashgarden" && r10Names.S === "Second Song" && r10Names.R === "Last Well", "Innerwood post-DJT names");

  const ascendancy = foundingRecords.find(({ siteId }) => siteId === "SITE-0401");
  assertR09Authority(!!ascendancy && ascendancy.cityDisplayName === "Ascendancy" && ascendancy.regionId === "R06", "Ascendancy identity");
  assertR09Authority(ascendancy.latitude === 20.360822 && ascendancy.longitude === -32.076454, "Ascendancy coordinates");
  assertR09Authority(ascendancy.surfaceType === "FLOATING_ISLAND", "Ascendancy surface type");

  const continentNames = continentRecords.map((entry) => entry.continentName);
  assertR09Authority(continentNames.every((name) => typeof name === "string") && continentNames.join("|") === "Raukaam|Morgenland|Valdmere", "continent names");
  assertR09Authority(initialValue.originalFoundingCityCount === 24 && isRecord(initialValue.innerwood) && initialValue.innerwood.settlementExists === false, "initial founding state");
  for (const [world, value, cityName] of [["C", concordValue, "Ashgarden"], ["S", schismValue, "Second Song"], ["R", ruinValue, "Last Well"]] as const) {
    assertR09Authority(value.settlementCityCount === 25 && isRecord(value.innerwoodFoundation) && value.innerwoodFoundation.cityName === cityName, `Innerwood ${world} state`);
  }

  return {
    authority: {
      physicalRegions: regionRecords.length,
      initialOriginalFoundingCities: 24,
      r10InitialSettlementExists: false,
      r10PostDjtNames: r10Names,
      ascendancy: { cityName: ascendancy.cityDisplayName, siteId: ascendancy.siteId, regionId: ascendancy.regionId, latitude: ascendancy.latitude, longitude: ascendancy.longitude, surfaceType: ascendancy.surfaceType },
      highcourtPopulation,
      forestfoldPopulation,
      continents: stringArray(continentNames, "R09 continent names"),
      latticeConnections: connections.length,
      poleCrossovers: 0,
      regionMappingCount: mappings.length,
      latticeIdEqualsRegionId: false,
    },
    catalog: {
      releaseId: release.releaseId,
      worldId: release.worldId,
      coordinateReferenceSystem: release.coordinateReferenceSystem,
      pointsOfInterest,
      settlementSites,
    },
    foundingCitySites: foundingRecords.map((site) => omitCopiedLatticeId(site)) as CanonicalFoundingCitySite[],
    regions,
  };
}

export async function loadAtlasRelease(root: string): Promise<AtlasCatalog> {
  return (await loadAtlasReleaseBundle(root)).catalog;
}

let releaseBundle: Promise<AtlasReleaseBundle> | undefined;

export function getAtlasReleaseBundle(): Promise<AtlasReleaseBundle> {
  releaseBundle ??= loadAtlasReleaseBundle(getAtlasEnv().EIDOLON_ATLAS_RELEASE_ROOT);
  return releaseBundle;
}

export function getAtlasCatalog(): Promise<AtlasCatalog> {
  return getAtlasReleaseBundle().then(({ catalog }) => catalog);
}

export async function getAtlasTopology(database: PrismaClient = getDatabase()): Promise<AtlasTopology> {
  const [mappings, connections] = await Promise.all([
    database.regionLatticeMapping.findMany({ orderBy: { regionId: "asc" } }),
    database.atlasConnection.findMany({ orderBy: [{ connectionType: "asc" }, { fromLatticeId: "asc" }, { toLatticeId: "asc" }] }),
  ]);
  return validateAtlasTopology({ mappings, connections });
}

export function projectAtlasCatalog(catalog: AtlasCatalog, topology: AtlasTopology): AtlasCatalogProjection {
  const validated = validateAtlasTopology(topology);
  return {
    ...catalog,
    connections: validated.connections,
    regionMappings: validated.mappings,
    pointsOfInterest: catalog.pointsOfInterest.map((point) => ({ ...point, latticeId: latticeForRegion(validated, point.regionId) })),
    settlementSites: catalog.settlementSites.map((site) => ({ ...site, latticeId: latticeForRegion(validated, site.regionId) })),
  };
}

export async function getAtlasCatalogProjection(database: PrismaClient = getDatabase()): Promise<AtlasCatalogProjection> {
  const [physicalCatalog, topology] = await Promise.all([getAtlasCatalog(), getAtlasTopology(database)]);
  return projectAtlasCatalog(physicalCatalog, topology);
}
