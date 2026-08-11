import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  assertPublicReleaseNoteContent,
  releaseAudienceSchema,
  releaseNoteCategorySchema,
  semanticVersionSchema,
  type ReleaseAudience,
  type ReleaseNoteCategory,
} from "../domain/release-notes";

const conventionalSubject = /^(feat|fix|perf|refactor|security|docs|test|build|chore)(?:\(([a-z0-9-]+)\))?!?:\s+(.+)$/;

export interface ReleaseCommit {
  body: string;
  subject: string;
}

export interface GeneratedReleaseEntry {
  audience: ReleaseAudience;
  body: string;
  category: ReleaseNoteCategory;
  title: string;
}

export function categoryForCommitType(type: string): ReleaseNoteCategory | null {
  const category = type === "feat" ? "ADDED"
    : type === "fix" ? "FIXED"
      : type === "security" ? "SECURITY"
        : ["perf", "refactor", "docs", "test", "build", "chore"].includes(type) ? "CHANGED"
          : null;
  return category ? releaseNoteCategorySchema.parse(category) : null;
}

function footerValue(body: string, name: string): string | undefined {
  const matches = [...body.matchAll(new RegExp(`^${name}:\\s*(.+)$`, "gmi"))];
  if (matches.length > 1) throw new Error(`Commit contains duplicate ${name} footers.`);
  return matches[0]?.[1]?.trim();
}

export function releaseEntryFromCommit(commit: ReleaseCommit): GeneratedReleaseEntry | null {
  const subject = conventionalSubject.exec(commit.subject);
  if (!subject) return null;
  const note = footerValue(commit.body, "Release-Note");
  if (!note || note.toLowerCase() === "none") return null;
  const audience = releaseAudienceSchema.parse(footerValue(commit.body, "Release-Audience"));
  const category = categoryForCommitType(subject[1]!);
  if (!category) return null;
  assertPublicReleaseNoteContent(note);
  const summary = subject[3]!.replace(/[.!?]+$/, "");
  const title = `${summary.charAt(0).toUpperCase()}${summary.slice(1)}`;
  assertPublicReleaseNoteContent(title);
  return { audience, body: note, category, title };
}

export function validateProspectiveCommit(commit: ReleaseCommit): void {
  const subject = conventionalSubject.exec(commit.subject);
  if (!subject || !subject[2]) throw new Error(`Commit subject does not follow <type>(<scope>): <summary>: ${commit.subject}`);
  const note = footerValue(commit.body, "Release-Note");
  if (!note) throw new Error(`Commit is missing the required Release-Note footer: ${commit.subject}`);
  if (note.toLowerCase() === "none") return;
  if (!releaseEntryFromCommit(commit)) throw new Error(`Commit has invalid release-note footers: ${commit.subject}`);
}

const categoryTitles: Record<ReleaseNoteCategory, string> = {
  ADDED: "Added",
  CHANGED: "Changed",
  FIXED: "Fixed",
  SECURITY: "Security & Privacy",
  KNOWN_ISSUE: "Known Issues",
};

export function renderGeneratedDraft(version: string, entries: GeneratedReleaseEntry[]): string {
  const parsedVersion = semanticVersionSchema.parse(version);
  const unique = [...new Map(entries.map((entry) => [entry.body, entry])).values()];
  const sections = Object.entries(categoryTitles).flatMap(([category, heading]) => {
    const categoryEntries = unique.filter((entry) => entry.category === category);
    if (categoryEntries.length === 0) return [];
    return [`## ${heading}\n\n${categoryEntries.map((entry) => `### ${entry.title}\nAudience: ${entry.audience}\n\n${entry.body}`).join("\n\n")}`];
  });
  return `---
version: ${parsedVersion}
status: DRAFT
title: Generated ${parsedVersion} review draft
summary: Generated from approved release footers for human review.
releaseDate: null
previousVersion: null
---
# Generated ${parsedVersion} review draft

${sections.join("\n\n")}
`;
}

export function writeGeneratedDraft(input: { canonicalPath: string; draftPath: string; markdown: string }): void {
  mkdirSync(dirname(input.draftPath), { recursive: true });
  writeFileSync(input.draftPath, input.markdown, { encoding: "utf8", flag: "w" });
}
