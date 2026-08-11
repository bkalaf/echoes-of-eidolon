import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const semanticVersionSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
export type SemanticVersion = z.infer<typeof semanticVersionSchema>;

export const releaseNotesStatusSchema = z.enum(["DRAFT", "PUBLISHED", "SUPERSEDED"]);
export type ReleaseNotesStatus = z.infer<typeof releaseNotesStatusSchema>;
export const releaseAudienceSchema = z.enum(["PLAYERS", "OPERATORS", "BOTH"]);
export type ReleaseAudience = z.infer<typeof releaseAudienceSchema>;
export const releaseNoteCategorySchema = z.enum(["ADDED", "CHANGED", "FIXED", "SECURITY", "KNOWN_ISSUE"]);
export type ReleaseNoteCategory = z.infer<typeof releaseNoteCategorySchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Release date must be a real YYYY-MM-DD date.");

export const releaseNoteItemSchema = z.object({
  itemId: z.string().min(1),
  category: releaseNoteCategorySchema,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  audience: releaseAudienceSchema,
  routes: z.array(z.string().regex(/^\//)).optional(),
}).strict();

export type ReleaseNoteItem = z.infer<typeof releaseNoteItemSchema>;

export const releaseNotesSchema = z.object({
  version: semanticVersionSchema,
  status: releaseNotesStatusSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2_000),
  releaseDate: z.union([isoDateSchema, z.null()]),
  previousVersion: z.union([semanticVersionSchema, z.null()]),
  items: z.array(releaseNoteItemSchema).min(1),
}).strict().superRefine((release, context) => {
  if (release.status === "DRAFT" && release.releaseDate !== null) {
    context.addIssue({ code: "custom", message: "DRAFT releases must have a null releaseDate.", path: ["releaseDate"] });
  }
  if (release.status !== "DRAFT" && release.releaseDate === null) {
    context.addIssue({ code: "custom", message: `${release.status} releases must retain a valid releaseDate.`, path: ["releaseDate"] });
  }
});

export type ReleaseNotes = z.infer<typeof releaseNotesSchema>;

export const publicReleaseNoteProhibitions = Object.freeze([
  { label: "hidden branching", pattern: /\bhidden\s+branching\b/i },
  { label: "hidden world/story architecture", pattern: /\bWorldKey\b|\b(?:CONCORD|SCHISM|RUIN)\s+world\b/i },
  { label: "internal Atlas package identity", pattern: /EIDOLON_ATLAS_(?:RECON|DATASET)|NIMBUS_P3V6|\bR00[89]\b/i },
  { label: "credential-like secret", pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+|\bwhsec_[A-Za-z0-9]+/i },
  { label: "provider identifier", pattern: /\b(?:cus|pi|cs|sub|prod|price)_[A-Za-z0-9]+/i },
  { label: "private issue reference", pattern: /\b(?:private\s+)?issue\s+#\d+\b/i },
  { label: "internal filesystem path", pattern: /(?:^|\s)(?:\/home\/|\/srv\/|\/etc\/|[A-Za-z]:\\)/ },
  { label: "public TODO/FIXME", pattern: /\b(?:TODO|FIXME)\b/ },
  { label: "unsafe Markdown link", pattern: /\]\(\s*(?:javascript|data|vbscript):/i },
  { label: "unsafe raw HTML", pattern: /<\/?[a-z][^>]*>/i },
]);

export function assertPublicReleaseNoteContent(value: string): void {
  for (const prohibition of publicReleaseNoteProhibitions) {
    if (prohibition.pattern.test(value)) throw new Error(`Public release-note content contains prohibited ${prohibition.label}.`);
  }
}

function versionParts(version: string): [number, number, number] {
  const parsed = semanticVersionSchema.parse(version).split(".").map(Number);
  return [parsed[0]!, parsed[1]!, parsed[2]!];
}

export function compareSemanticVersions(left: string, right: string): number {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

export function releaseNotesFileName(version: SemanticVersion): `${string}.md` {
  return `${semanticVersionSchema.parse(version).replaceAll(".", "_")}.md`;
}

export function releaseNotesRoute(version: SemanticVersion): `/status/releases/${string}` {
  return `/status/releases/${semanticVersionSchema.parse(version)}`;
}

const categoryHeadings: Record<string, ReleaseNoteCategory> = {
  Added: "ADDED",
  Changed: "CHANGED",
  Fixed: "FIXED",
  Security: "SECURITY",
  "Security & Privacy": "SECURITY",
  "Known Issues": "KNOWN_ISSUE",
};

interface MutableItem {
  audience?: ReleaseAudience;
  body: string[];
  category: ReleaseNoteCategory;
  routes?: string[];
  title: string;
}

function parseItems(version: SemanticVersion, body: string): ReleaseNoteItem[] {
  const lines = body.replaceAll("\r\n", "\n").split("\n");
  const items: ReleaseNoteItem[] = [];
  let category: ReleaseNoteCategory | undefined;
  let current: MutableItem | undefined;

  const flush = () => {
    if (!current) return;
    if (!current.audience) throw new Error(`Release-note item "${current.title}" is missing Audience metadata.`);
    const itemBody = current.body.join("\n").trim();
    if (!itemBody) throw new Error(`Release-note item "${current.title}" has no body.`);
    const ordinal = items.filter((item) => item.category === current!.category).length + 1;
    const parsed = releaseNoteItemSchema.parse({
      itemId: `${version}:${current.category.toLowerCase()}:${ordinal}`,
      category: current.category,
      title: current.title,
      body: itemBody,
      audience: current.audience,
      ...(current.routes && current.routes.length > 0 ? { routes: current.routes } : {}),
    });
    assertPublicReleaseNoteContent(`${parsed.title}\n${parsed.body}`);
    items.push(parsed);
    current = undefined;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const section = /^##\s+(.+)$/.exec(line);
    if (section) {
      flush();
      category = categoryHeadings[section[1]!];
      if (!category) throw new Error(`Unknown release-note section: ${section[1]}`);
      continue;
    }
    const heading = /^###\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      if (!category) throw new Error("Release-note item appears before a recognized section.");
      current = { body: [], category, title: heading[1]!.trim() };
      continue;
    }
    if (!current) continue;
    const audience = /^Audience:\s*(PLAYERS|OPERATORS|BOTH)$/.exec(line);
    if (audience) {
      current.audience = releaseAudienceSchema.parse(audience[1]);
      continue;
    }
    const routes = /^Routes:\s*(.+)$/.exec(line);
    if (routes) {
      current.routes = routes[1]!.split(",").map((route) => route.trim()).filter(Boolean);
      continue;
    }
    current.body.push(rawLine);
  }
  flush();
  if (items.length === 0) throw new Error("Canonical release note has no structured release sections.");
  return items;
}

export function parseCanonicalReleaseNote(fileName: string, source: string): ReleaseNotes {
  const normalized = source.replaceAll("\r\n", "\n");
  const frontMatter = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(normalized);
  if (!frontMatter) throw new Error("Canonical release note is missing valid front matter.");
  const metadata = z.object({
    version: semanticVersionSchema,
    status: releaseNotesStatusSchema,
    title: z.string(),
    summary: z.string(),
    releaseDate: z.union([z.string(), z.null()]),
    previousVersion: z.union([semanticVersionSchema, z.null()]),
  }).strict().parse(parseYaml(frontMatter[1]!));
  const expectedFileName = releaseNotesFileName(metadata.version);
  const actualFileName = fileName.split("/").at(-1);
  if (actualFileName !== expectedFileName) {
    throw new Error(`Release-note filename ${actualFileName} does not match version ${metadata.version}.`);
  }
  assertPublicReleaseNoteContent(`${metadata.title}\n${metadata.summary}`);
  return releaseNotesSchema.parse({ ...metadata, items: parseItems(metadata.version, frontMatter[2]!) });
}

export interface CanonicalReleaseCatalog {
  current: ReleaseNotes;
  publicReleases: ReleaseNotes[];
  releases: ReleaseNotes[];
}

export function loadCanonicalReleaseNotes(
  inputs: Array<{ fileName: string; source: string }>,
  currentVersion: string,
): CanonicalReleaseCatalog {
  const version = semanticVersionSchema.parse(currentVersion);
  const releases = inputs.map((input) => parseCanonicalReleaseNote(input.fileName, input.source));
  const seen = new Set<string>();
  for (const release of releases) {
    if (seen.has(release.version)) throw new Error(`Duplicate canonical release version: ${release.version}.`);
    seen.add(release.version);
  }
  releases.sort((left, right) => compareSemanticVersions(right.version, left.version));
  const current = releases.find((release) => release.version === version);
  if (!current) throw new Error(`Canonical release note is missing for current application version ${version}.`);
  return {
    current,
    publicReleases: releases.filter((release) => release.status !== "DRAFT"),
    releases,
  };
}
