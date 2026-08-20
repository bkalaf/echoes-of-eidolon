import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(webRoot, "../..");
const artifactRoot = resolve(repositoryRoot, "artifacts/release-0.3.0");
const gatesRoot = resolve(artifactRoot, "gates");
const generatedAt = new Date().toISOString();

const dependencies: Record<string, string[]> = {
  G00: [], G01: ["G00"], G02: ["G01"], G03: ["G02"], G04: ["G02"],
  G05: ["G03", "G04"], G06: ["G03", "G05"], G07: ["G03", "G04", "G05", "G06"],
  G08: ["G02"], G09: ["G07", "G08"], G10: ["G09"], G11: ["G10"], G12: ["G11"],
};

const blockers: Record<string, Array<{ id: string; condition: string }>> = {
  G00: [{ id: "CANDIDATE-NOT-FROZEN", condition: "The remediation is an uncommitted working tree and has no immutable candidate SHA." }, { id: "RELEASE-HISTORY-OWNER-DECISION", condition: "Commit c1f6b137 violates the configured release commit-subject gate; the documented disposition requires owner approval." }],
  G01: [{ id: "G00-NOT-PASS", condition: "G00 is not PASS." }, { id: "OWNER-UI-BESPOKE-CONTRACTS", condition: "Bespoke owner tables and forms do not all have independent owning read/write contracts." }],
  G02: [{ id: "G01-NOT-PASS", condition: "G01 is not PASS." }, { id: "TAXONOMY-AUTHORITY", condition: "Live read-only taxonomy export and owner conflict decisions are unavailable." }, { id: "FOUNDING-POPULATION-AUTHORITY", condition: "Exact owner-authored founding population allocations are unavailable." }],
  G03: [{ id: "G02-NOT-PASS", condition: "G02 is not PASS." }, { id: "FOUNDING-POPULATION-AUTHORITY", condition: "The 72 exact group/species/breed population allocations and division/remainder rules are unavailable." }],
  G04: [{ id: "G02-NOT-PASS", condition: "G02 is not PASS." }, { id: "TAXONOMY-AUTHORITY", condition: "Taxonomy normalization cannot proceed without live export and owner conflict decisions." }],
  G05: [{ id: "G03-G04-NOT-PASS", condition: "G03 and G04 are not PASS." }, { id: "OWNER-UI-RENDERED-EVIDENCE", condition: "Bespoke contracts and real rendered relation/browser evidence remain incomplete." }],
  G06: [{ id: "G03-G05-NOT-PASS", condition: "G03 and G05 are not PASS." }, { id: "BROWSER-DATABASE-EVIDENCE", condition: "Required real Chromium and PostgreSQL acceptance evidence has not been run in an authorized environment." }],
  G07: [{ id: "DEPENDENCIES-NOT-PASS", condition: "G03, G04, G05, and G06 are not PASS." }, { id: "RELEASE-HISTORY-OWNER-DECISION", condition: "The direct release gate still rejects c1f6b137." }],
  G08: [{ id: "AUTHORED-PUZZLE-GAP", condition: "Only four Blueprint generators are authored production implementations; 66 are correctly classified PROTOTYPE_ONLY." }, { id: "PUZZLE-REVIEW-EVIDENCE", condition: "Named Puzzle owner, security, accessibility, and real-browser reviews are unavailable." }, { id: "G02-NOT-PASS", condition: "G02 is not PASS." }],
  G09: [{ id: "G07-G08-NOT-PASS", condition: "G07 and G08 are not PASS." }, { id: "STAGING-AUTHORIZATION", condition: "No production-shaped staging restore, migration/import, or recovery rehearsal is authorized in this repair run." }],
  G10: [{ id: "G09-NOT-PASS", condition: "G09 is not PASS." }, { id: "RELEASE-NOTE-DRAFT", condition: "The canonical release note remains DRAFT and has no release date." }],
  G11: [{ id: "G10-NOT-PASS", condition: "G10 is not PASS." }, { id: "DEPLOYMENT-NOT-AUTHORIZED", condition: "Production deployment is outside this repair authorization." }],
  G12: [{ id: "G11-NOT-PASS", condition: "G11 is not PASS." }, { id: "PUBLICATION-NOT-AUTHORIZED", condition: "Push, tag, GitHub Release, and publication are outside this repair authorization." }],
};

const artifactPaths: Partial<Record<string, string[]>> = {
  G00: ["artifacts/release-0.3.0/preflight/release-history-decision.json"],
  G01: ["artifacts/release-0.3.0/owner-ui/owner-table-inventory.json", "artifacts/release-0.3.0/owner-ui/owner-form-inventory.json"],
  G05: ["artifacts/release-0.3.0-owner-data-ui-audit.json"],
  G08: ["artifacts/release-0.3.0/puzzles/puzzle-generator-coverage.json"],
};

async function artifact(path: string) {
  const bytes = await readFile(resolve(repositoryRoot, path));
  return { path, sha256: createHash("sha256").update(bytes).digest("hex") };
}

await mkdir(gatesRoot, { recursive: true });
for (let index = 0; index <= 12; index += 1) {
  const gateId = `G${String(index).padStart(2, "0")}`;
  const status = index >= 9 ? "NOT_RUN" : "BLOCKED";
  const gateArtifacts = await Promise.all((artifactPaths[gateId] ?? []).map(artifact));
  const assertions = gateId === "G08"
    ? [{ name: "Authored production Puzzle generators", expected: 70, observed: 4, pass: false }, { name: "Prototype-only Puzzle catalog entries", expected: 0, observed: 66, pass: false }]
    : [{ name: "Immutable candidate evidence", expected: "40-character candidate SHA", observed: "UNCOMMITTED_WORKTREE", pass: false }];
  const report = {
    schemaVersion: "echoes-release-gate-report-v1",
    gateId,
    status,
    release: "0.3.0",
    commitSha: "NOT_APPLICABLE",
    environment: "existing /home/bobby/echoes-of-eidolon main checkout; uncommitted remediation working tree",
    startedAt: generatedAt,
    finishedAt: generatedAt,
    dependencies: dependencies[gateId].map((dependency) => ({ gateId: dependency, status: Number(dependency.slice(1)) >= 9 ? "NOT_RUN" : "BLOCKED" })),
    commands: [],
    assertions,
    artifacts: gateArtifacts,
    blockers: blockers[gateId],
    notes: ["This report supersedes stale base-SHA evidence. It does not claim candidate-bound execution before the repair is committed and frozen."],
  };
  await writeFile(resolve(gatesRoot, `${gateId}.json`), `${JSON.stringify(report, null, 2)}\n`);
}

console.log("generated truthful BLOCKED/NOT_RUN reports for G00-G12");
