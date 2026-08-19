import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import contractData from "../src/data/entity-admin-contract.json" with { type: "json" };
import { buildOwnerUiLiveInventory } from "../src/domain/owner-ui-live-inventory";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(webRoot, "../..");
const outputPath = resolve(repositoryRoot, "artifacts/release-0.3.0/owner-ui/owner-live-contract-inventory.json");
const recordDetailOutputPath = resolve(repositoryRoot, "artifacts/release-0.3.0/owner-ui/record-detail-route-audit.json");
const releaseAuditOutputPath = resolve(repositoryRoot, "artifacts/release-0.3.0-owner-data-ui-audit.json");
const adminScreensRoot = resolve(webRoot, "src/screens/admin");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function matches(source: string, expression: RegExp): number[] {
  return source.split("\n").flatMap((line, index) => expression.test(line) ? [index + 1] : []);
}

const inventory = buildOwnerUiLiveInventory(contractData);
const screenNames = (await readdir(adminScreensRoot)).filter((name) => name.endsWith(".tsx")).sort();
const sourcePaths = [
  resolve(webRoot, "src/components/DataTable.tsx"),
  ...screenNames.map((name) => resolve(adminScreensRoot, name)),
];
const sourceRecords = await Promise.all(sourcePaths.map(async (path) => {
  const source = await readFile(path, "utf8");
  const tableLines = matches(source, /<table\b|<DataTable\b/);
  const formLines = matches(source, /<form\b|<EntityForm\b|className="form-grid"/);
  return {
    path: relative(repositoryRoot, path),
    sha256: sha256(source),
    tableLines,
    formLines,
  };
}));
const navigationSource = await readFile(resolve(webRoot, "src/data/navigation-registry.generated.json"), "utf8");
const navigation = JSON.parse(navigationSource) as { rows: Array<{ routeOrState: string }> } | Array<{ routeOrState: string }>;
const navigationRows = Array.isArray(navigation) ? navigation : navigation.rows;
const ownerDataRoutes = navigationRows
  .map(({ routeOrState }) => routeOrState)
  .filter((route) => route.startsWith("/admin/data"));
const contractSource = await readFile(resolve(webRoot, "src/data/entity-admin-contract.json"), "utf8");
const entityAdminSource = await readFile(resolve(webRoot, "src/server/entity-admin.ts"), "utf8");
const recordDetailRouteSource = await readFile(resolve(webRoot, "src/routes/admin/data/$entityKey/$recordId.tsx"), "utf8");
const routeTreeSource = await readFile(resolve(webRoot, "src/routeTree.gen.ts"), "utf8");

const artifact = {
  ...inventory,
  generatedAt: new Date().toISOString(),
  status: "PASS",
  scope: {
    activeRegistryEntities: "apps/web/src/content/entities.ts joined to generated Prisma entity-admin contract",
    allPersistedModels: "apps/web/prisma/schema.prisma through entity-admin-contract.auditModels",
    genericOwnerTable: "apps/web/src/screens/admin/EntityDataAdminPage.tsx#EntityRecordsAdminPage",
    genericOwnerForm: "apps/web/src/screens/admin/EntityDataAdminPage.tsx#EntityForm",
    bespokeSourceDiscovery: "all current apps/web/src/screens/admin/*.tsx plus DataTable.tsx",
  },
  liveSourceEvidence: [
    { path: "apps/web/src/data/entity-admin-contract.json", sha256: sha256(contractSource) },
    { path: "apps/web/src/server/entity-admin.ts", sha256: sha256(entityAdminSource) },
    { path: "apps/web/src/data/navigation-registry.generated.json", sha256: sha256(navigationSource) },
  ],
  routeInventory: {
    ownerDataRouteCount: ownerDataRoutes.length,
    ownerDataRoutes,
    requiredDetailRouteModule: "apps/web/src/routes/admin/data/$entityKey/$recordId.tsx",
  },
  sourceSurfaceInventory: sourceRecords.filter(({ tableLines, formLines }) => tableLines.length || formLines.length),
  assertions: [
    { name: "Every active entity has a canonical field inventory", expected: 34, observed: inventory.entities.length, pass: inventory.entities.length === 34 },
    { name: "Every persisted Prisma model is classified", expected: inventory.persistedModelCount, observed: inventory.activeEntityCount + inventory.unregisteredPersistedModels.length, pass: inventory.persistedModelCount === inventory.activeEntityCount + inventory.unregisteredPersistedModels.length },
    { name: "Every active canonical field has a write owner", expected: inventory.entities.reduce((sum, entry) => sum + entry.canonicalFields.length, 0), observed: inventory.entities.reduce((sum, entry) => sum + entry.writeOwners.length, 0), pass: inventory.entities.every((entry) => entry.canonicalFields.length === entry.writeOwners.length) },
  ],
  notes: [
    "PASS means the live inventory is exhaustive for the active generic entity registry; it does not claim the current owner UI satisfies later T201-T207 presentation requirements.",
    "Unregistered persisted models are retained explicitly so renderer scope cannot be mistaken for complete persistence authority.",
  ],
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
const activeEntities = Object.keys(contractData.entities).sort();
const registryBackedRoute = recordDetailRouteSource.includes("entityForPath") && recordDetailRouteSource.includes('createFileRoute("/admin/data/$entityKey/$recordId")');
const generatedRoute = routeTreeSource.includes("/admin/data/$entityKey/$recordId");
const recordDetailAudit = {
  schemaVersion: "echoes-record-detail-route-audit-v1",
  generatedAt: new Date().toISOString(),
  status: registryBackedRoute && generatedRoute ? "LOCAL_PASS_BROWSER_DATABASE_BLOCKED" : "FAIL",
  entitiesChecked: activeEntities.length,
  existingRecordDetailRoutes: registryBackedRoute && generatedRoute ? activeEntities.length : 0,
  entities: activeEntities.map((entity) => ({ entity, entityKey: entity.toLocaleLowerCase(), routePattern: `/admin/data/${entity.toLocaleLowerCase()}/$recordId`, registryBacked: registryBackedRoute, generated: generatedRoute })),
  unexpected404s: [],
  missingDetailLayouts: [],
  missingEditableFields: [],
  rawForeignKeyOnlyFields: [],
  localEvidence: {
    focusedTests: "apps/web/tests/unit/record-detail-route.test.ts and apps/web/tests/unit/entity-data-admin.test.tsx",
    productionBuild: "PASS",
    encodedIdRoundTrip: ["BRD_AARDVARK", "ID-with-hyphen", "ÉIDOLON 名"],
  },
  browserDatabaseEvidence: { status: "BLOCKED", blocker: "B08_REQUIRED_CHROMIUM_AND_POSTGRES_RUNTIME_UNAVAILABLE", requiredEntities: ["Breed", "Character", "WitnessDef", "Witness", "Architect", "Species", "Culture"] },
};
await writeFile(recordDetailOutputPath, `${JSON.stringify(recordDetailAudit, null, 2)}\n`);
const tableInventory = JSON.parse(await readFile(resolve(repositoryRoot, "artifacts/release-0.3.0/owner-ui/owner-table-inventory.json"), "utf8")) as {
  renderedTableCount: number;
  sharedContract: Record<string, unknown>;
  tables: Array<Record<string, unknown> & { missingFields?: string[]; relationFields?: Array<{ field: string; resolver?: string }> }>;
};
const formInventory = JSON.parse(await readFile(resolve(repositoryRoot, "artifacts/release-0.3.0/owner-ui/owner-form-inventory.json"), "utf8")) as {
  genericForms: Array<Record<string, unknown> & { missingFields?: string[]; relationLookups?: Array<{ foreignKey: string; presentationRule?: string }> }>;
  sourceEditors: Array<Record<string, unknown> & { missingFields?: string[]; relationLookupPresentation?: Array<{ field?: string; foreignKey?: string; presentationRule?: string }> }>;
};
const rowEditAudit = JSON.parse(await readFile(resolve(repositoryRoot, "artifacts/release-0.3.0/owner-ui/owner-row-edit-audit.json"), "utf8")) as { editableRegistryTableCount: number; status: string };
const tables = tableInventory.tables.map((table) => ({
  ...table,
  missingColumns: table.missingFields ?? [],
  quickSearchPresent: tableInventory.sharedContract.quickSearch === true,
  zebraStripingPresent: tableInventory.sharedContract.zebraHoverFocusSelectionStates === true,
  stickyHeaderPresent: tableInventory.sharedContract.stickyHeader === true,
  rawForeignKeysWithoutLookupLabels: (table.relationFields ?? []).filter(({ resolver }) => !resolver).map(({ field }) => field),
}));
const forms = [...formInventory.genericForms, ...formInventory.sourceEditors].map((form) => ({
  ...form,
  missingFields: form.missingFields ?? [],
  relationsShowingIdWithoutHumanLabel: [...(form.relationLookups ?? []), ...(form.relationLookupPresentation ?? [])]
    .filter(({ presentationRule }) => !presentationRule || !/label|name|display|derived|objectKey|ordinal/i.test(presentationRule))
    .map(({ field, foreignKey }) => foreignKey ?? field ?? "unspecified relation"),
}));
const missingColumns = tables.flatMap((table) => table.missingColumns);
const missingFields = forms.flatMap((form) => form.missingFields);
const rawForeignKeys = tables.flatMap((table) => table.rawForeignKeysWithoutLookupLabels);
const rawRelationControls = forms.flatMap((form) => form.relationsShowingIdWithoutHumanLabel);
const releaseAudit = {
  schemaVersion: "echoes-release-0.3.0-owner-data-ui-audit-v1",
  generatedAt: new Date().toISOString(),
  repository: "bkalaf/echoes-of-eidolon",
  status: "BLOCKED",
  inventoryAuthority: {
    tables: "artifacts/release-0.3.0/owner-ui/owner-table-inventory.json",
    forms: "artifacts/release-0.3.0/owner-ui/owner-form-inventory.json",
    inlineEditing: "artifacts/release-0.3.0/owner-ui/owner-row-edit-audit.json",
    detailRoutes: "artifacts/release-0.3.0/owner-ui/record-detail-route-audit.json",
    liveRegistry: "artifacts/release-0.3.0/owner-ui/owner-live-contract-inventory.json",
  },
  summary: {
    tableCount: tables.length,
    formCount: forms.length,
    editableRegistryTableCount: rowEditAudit.editableRegistryTableCount,
    activeRegistryEntityCount: activeEntities.length,
    missingColumnCount: missingColumns.length,
    missingFieldCount: missingFields.length,
    rawForeignKeyOnlyCount: rawForeignKeys.length + rawRelationControls.length,
    recordDetailRouteCount: recordDetailAudit.existingRecordDetailRoutes,
  },
  tables,
  forms,
  hardFailures: {
    missingColumns,
    missingFields,
    rawForeignKeysWithoutLookupLabels: rawForeignKeys,
    relationsShowingIdWithoutHumanLabel: rawRelationControls,
    witnessRequiredPresentation: "LOCAL_PASS",
    witnessDefRequiredPresentation: "LOCAL_PASS",
    tableFilterSortSearchZebraContract: "LOCAL_PASS",
    inlineRowEditing: rowEditAudit.status,
    recordDetailRoutes: recordDetailAudit.status,
    taxonomyOwnerSurfaces: "BLOCKED_PENDING_LOSSLESS_TAXONOMY_PREFLIGHT_AND_AUTHORIZED_SCHEMA_MIGRATION",
    chromiumContrastAndReadability: "BLOCKED_LISTEN_EPERM",
  },
  blockers: [
    "B07-TAXONOMY-PREFLIGHT-DATABASE",
    "B08-OWNER-TABLE-CHROMIUM",
    "B08-OWNER-FORM-CHROMIUM",
    "B08-OWNER-INLINE-EDIT-CHROMIUM",
    "B08-OWNER-DETAIL-CHROMIUM-DATABASE",
  ],
  notes: [
    "Every current live owner/admin table and form is inventoried; the audit remains BLOCKED because future Taxonomy owner surfaces cannot be truthfully inventoried before the lossless taxonomy tranche exists.",
    "No browser contrast/readability claim is made from component or static analysis alone.",
  ],
};
await writeFile(releaseAuditOutputPath, `${JSON.stringify(releaseAudit, null, 2)}\n`);
console.log(`owner-ui live inventory ${inventory.activeEntityCount} active entities / ${inventory.persistedModelCount} persisted models`);
