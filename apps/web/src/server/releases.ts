import { resolve } from "node:path";

import { z } from "zod";

import releaseArtifact from "../data/public-release-notes.generated.json";
import { releaseNotesSchema, semanticVersionSchema, type ReleaseNotes } from "../domain/release-notes";
import { buildReleaseCatalog } from "./release-gate";

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

export function getBuildIdentity() {
  const gitSha = process.env.EIDOLON_GIT_SHA;
  return {
    gitSha: gitSha && /^[0-9a-f]{40}$/.test(gitSha) ? gitSha : null,
    version: publicReleaseArtifact.currentVersion,
  };
}

export function getPublicReleaseIndex() {
  return publicReleaseArtifact;
}

export async function listAdministrativeReleases() {
  return buildReleaseCatalog(resolve(process.cwd(), "../..")).releases;
}
