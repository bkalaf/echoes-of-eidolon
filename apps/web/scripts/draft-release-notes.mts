import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

import { releaseNotesFileName, semanticVersionSchema } from "../src/domain/release-notes";
import { releaseEntryFromCommit, renderGeneratedDraft, writeGeneratedDraft } from "../src/server/release-notes-git";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const version = semanticVersionSchema.parse(argument("--version"));
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const from = argument("--from");
const range = from ? `${from}..HEAD` : "HEAD";
const output = execFileSync("git", ["-C", repositoryRoot, "log", range, "--format=%H%x1f%s%x1f%B%x1e"], { encoding: "utf8" });
const entries = output.split("\x1e").flatMap((record) => {
  const [, subject, body] = record.trim().split("\x1f");
  if (!subject || body === undefined) return [];
  const entry = releaseEntryFromCommit({ subject, body });
  return entry ? [entry] : [];
});
const fileName = releaseNotesFileName(version);
const canonicalPath = resolve(repositoryRoot, "docs/release-notes", fileName);
const draftPath = resolve(repositoryRoot, "docs/release-notes/.drafts", fileName.replace(/\.md$/, ".generated.md"));
writeGeneratedDraft({ canonicalPath, draftPath, markdown: renderGeneratedDraft(version, entries) });
process.stdout.write(`release-draft ${version} entries=${entries.length} ${draftPath}\n`);
