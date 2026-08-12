import { resolve } from "node:path";

import { z } from "zod";

import releaseArtifact from "../data/public-release-notes.generated.json";
import { releaseNotesSchema, semanticVersionSchema, type ReleaseNotes } from "../domain/release-notes";
import { buildReleaseCatalog } from "./release-gate";

declare const __EIDOLON_BUILD_GIT_SHA__: string | null;

const publicReleaseArtifactSchema = z.object({
  currentVersion: semanticVersionSchema,
  releases: z.array(releaseNotesSchema),
}).strict();

const publicReleaseArtifact = publicReleaseArtifactSchema.parse(releaseArtifact);

export type PublicRelease = ReleaseNotes;

export async function listPublicReleases(): Promise<PublicRelease[]> {
  return publicReleaseArtifact.releases;
}

export async function findPublicRelease(version: string): Promise<PublicRelease | undefined> {
  if (!semanticVersionSchema.safeParse(version).success) return undefined;
  return publicReleaseArtifact.releases.find((release) => release.version === version);
}

export function resolveBuildGitSha(embeddedGitSha?: string | null, runtimeGitSha?: string | null) {
  for (const gitSha of [embeddedGitSha, runtimeGitSha]) {
    if (gitSha && /^[0-9a-f]{40}$/.test(gitSha)) return gitSha;
  }
  return null;
}

export function getBuildIdentity() {
  const embeddedGitSha = typeof __EIDOLON_BUILD_GIT_SHA__ === "undefined" ? null : __EIDOLON_BUILD_GIT_SHA__;
  return {
    gitSha: resolveBuildGitSha(embeddedGitSha, process.env.EIDOLON_GIT_SHA),
    version: publicReleaseArtifact.currentVersion,
  };
}

export function getPublicReleaseIndex() {
  return publicReleaseArtifact;
}

export async function listAdministrativeReleases() {
  return buildReleaseCatalog(resolve(process.cwd(), "../..")).releases;
}
