import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import {
  loadCanonicalReleaseNotes,
  semanticVersionSchema,
  type CanonicalReleaseCatalog,
  type ReleaseNotes,
} from "../domain/release-notes";
import { validateProspectiveCommit } from "./release-notes-git";

interface PackageManifest {
  name?: string;
  version?: string;
}

interface ReleaseGovernance {
  footerRequiredAfter: string;
  targetVersion: string;
}

export interface PublicReleaseArtifact {
  currentVersion: string;
  releases: ReleaseNotes[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function canonicalInputs(repositoryRoot: string) {
  const directory = resolve(repositoryRoot, "docs/release-notes");
  if (!existsSync(directory)) throw new Error("Canonical release-note directory is missing.");
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+_\d+_\d+\.md$/.test(entry.name))
    .map((entry) => ({ fileName: entry.name, source: readFileSync(resolve(directory, entry.name), "utf8") }));
}

export function validateReleaseState(input: { rootVersion: string; webVersion: string; releases: ReleaseNotes[] }): ReleaseNotes {
  const rootVersion = semanticVersionSchema.parse(input.rootVersion);
  const webVersion = semanticVersionSchema.parse(input.webVersion);
  if (rootVersion !== webVersion) throw new Error(`Release package version mismatch: root ${rootVersion}, web ${webVersion}.`);
  const current = input.releases.find((release) => release.version === rootVersion);
  if (!current) throw new Error(`Canonical release note is missing for ${rootVersion}.`);
  return current;
}

export function buildReleaseCatalog(repositoryRoot: string): CanonicalReleaseCatalog {
  const rootPackage = readJson<PackageManifest>(resolve(repositoryRoot, "package.json"));
  const webPackage = readJson<PackageManifest>(resolve(repositoryRoot, "apps/web/package.json"));
  const currentVersion = semanticVersionSchema.parse(rootPackage.version);
  const catalog = loadCanonicalReleaseNotes(canonicalInputs(repositoryRoot), currentVersion);
  validateReleaseState({ rootVersion: currentVersion, webVersion: webPackage.version ?? "", releases: catalog.releases });
  return catalog;
}

export function publicReleaseArtifact(repositoryRoot: string): PublicReleaseArtifact {
  const catalog = buildReleaseCatalog(repositoryRoot);
  const latestPublished = catalog.publicReleases[0];
  if (!latestPublished) throw new Error("At least one published release is required for the public release artifact.");
  return { currentVersion: latestPublished.version, releases: catalog.publicReleases };
}

export function generateReleaseArtifact(repositoryRoot: string): string {
  const target = resolve(repositoryRoot, "apps/web/src/data/public-release-notes.generated.json");
  const content = `${JSON.stringify(publicReleaseArtifact(repositoryRoot), null, 2)}\n`;
  writeFileSync(target, content, "utf8");
  return target;
}

export function assertPuzzleClientBundleSafe(assetsRoot: string) {
  if (!existsSync(assetsRoot)) throw new Error("Production client bundle is missing; run the build before the release check.");
  const files = readdirSync(assetsRoot, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
  if (files.some((fileName) => fileName.endsWith(".map"))) {
    throw new Error("Production client source maps must not be published.");
  }
  const forbidden = /\bPZB-(?:011|012|021|037)\b|canonicalSolution|decodeOffset|encodedValue|expectedSolvePath|generatorVersion|instanceChecksum|proofDigest|validationToken/;
  const leaks = files
    .filter((fileName) => fileName.endsWith(".js") && !/^PacketScreen-[A-Za-z0-9_-]+\.js$/.test(fileName))
    .filter((fileName) => forbidden.test(readFileSync(resolve(assetsRoot, fileName), "utf8")));
  if (leaks.length > 0) throw new Error(`Production client bundle exposes puzzle internals: ${leaks.join(", ")}.`);
}

export async function runReleaseCheck(repositoryRoot: string) {
  const catalog = buildReleaseCatalog(repositoryRoot);
  const governance = readJson<ReleaseGovernance>(resolve(repositoryRoot, "docs/release-governance.json"));
  if (governance.targetVersion !== catalog.current.version || !/^[0-9a-f]{40}$/.test(governance.footerRequiredAfter)) {
    throw new Error("Release governance baseline does not match the canonical current release.");
  }
  const commitOutput = execFileSync("git", ["-C", repositoryRoot, "log", `${governance.footerRequiredAfter}..HEAD`, "--format=%H%x1f%s%x1f%B%x1e"], { encoding: "utf8" });
  for (const record of commitOutput.split("\x1e")) {
    const [, subject, body] = record.trim().split("\x1f");
    if (subject && body !== undefined) validateProspectiveCommit({ subject, body });
  }
  const expected = `${JSON.stringify(publicReleaseArtifact(repositoryRoot), null, 2)}\n`;
  const artifactPath = resolve(repositoryRoot, "apps/web/src/data/public-release-notes.generated.json");
  if (!existsSync(artifactPath) || readFileSync(artifactPath, "utf8") !== expected) {
    throw new Error("Generated public release artifact has drifted from canonical Markdown.");
  }
  return {
    currentVersion: catalog.current.version,
    releaseDate: catalog.current.releaseDate,
    releaseCount: catalog.releases.length,
    publicReleaseCount: catalog.publicReleases.length,
    status: catalog.current.status,
  };
}
