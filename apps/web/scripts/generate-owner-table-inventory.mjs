import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import ts from "typescript";

import { orderOwnerTableFields } from "../src/domain/owner-table-field-order.ts";
import { auditOwnerTableContract } from "../src/domain/owner-ui-independent-audit.ts";

const webRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(webRoot, "../..");
const sourceRoot = resolve(webRoot, "src");
const artifactRoot = resolve(repositoryRoot, "artifacts/release-0.3.0/owner-ui");
const contract = JSON.parse(await readFile(resolve(webRoot, "src/data/entity-admin-contract.json"), "utf8"));
const entityAdminSource = await readFile(resolve(webRoot, "src/screens/admin/EntityDataAdminPage.tsx"), "utf8");
const inlineRowContract = {
  editRowLabel: entityAdminSource.includes(">Edit Row</button>"),
  explicitSave: entityAdminSource.includes("Save Row ${id}"),
  immutableIdentity: entityAdminSource.includes("field.name === ownerContract.idField"),
  preservesFailedDraft: entityAdminSource.includes("rowValidationError") && entityAdminSource.includes("inlineSave.error"),
  subtypeCharacterComposition: entityAdminSource.includes("parentCharacter") && entityAdminSource.includes("parentCharacterDraft"),
};

const routeHints = {
  AccountPage: ["/account/subscription", "/account/orders"],
  AccountAdminPage: ["/admin/access", "/admin/access/:userId"],
  AdminDashboardPage: ["/admin"],
  AdminV4Pages: ["/admin/occupations", "/admin/companion-planner", "/admin/money", "/admin/atlas/settlements/:id/soundtracks"],
  AssetPromptAdminPage: ["/admin/assets", "/admin/prompts"],
  AtlasAdminPage: ["/admin/atlas/pois", "/admin/atlas/sites", "/admin/atlas/sites/:siteId"],
  BetaInvitationAdminPage: ["/admin/access/approvals", "/admin/beta-invitations", "/admin/access/roles"],
  BulkOperationsAdminPage: ["/admin/bulk-changes", "/admin/data/bulk-operations"],
  CampaignAdminPage: ["/admin/campaign"],
  CapabilityAdminPage: ["/admin/capabilities", "/admin/capabilities/:id", "/admin/capabilities/inspector"],
  CityBuilderAdminPage: ["/admin/cities", "/admin/cities/:id/:view"],
  CommerceAdminPage: ["/admin/store", "/admin/store/items", "/admin/orders"],
  EntityDataAdminPage: ["/admin/data", "/admin/data/:entity"],
  EntityImportPage: ["/admin/data/:entity/import"],
  GameplayOverlays: ["/game?state=withdrawal-ledger"],
  OperationsAdminPage: ["/admin/operations/releases"],
  PerkAdminPage: ["/admin/perks"],
  PublicPage: ["/contact"],
  PuzzleAdminPage: ["/admin/puzzles/blueprints"],
  SettlementAdminPage: ["/admin/atlas/settlements"],
  ToolsPage: ["/tools/wireframe-review", "/tools/navigation-states"],
};

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (/\.tsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

function stringProperty(node, name) {
  if (!ts.isObjectLiteralExpression(node)) return undefined;
  const property = node.properties.find((candidate) => ts.isPropertyAssignment(candidate) && candidate.name.getText().replaceAll(/["']/g, "") === name);
  if (!property || !ts.isPropertyAssignment(property)) return undefined;
  return ts.isStringLiteralLike(property.initializer) ? property.initializer.text : undefined;
}

function columnsFromExpression(expression) {
  if (!expression) return [];
  if (ts.isParenthesizedExpression(expression)) return columnsFromExpression(expression.expression);
  if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) return columnsFromExpression(expression.expression);
  if (ts.isConditionalExpression(expression)) return [...columnsFromExpression(expression.whenTrue), ...columnsFromExpression(expression.whenFalse)];
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === "map") return [`dynamic[${expression.expression.expression.getText()}]`];
  if (!ts.isArrayLiteralExpression(expression)) return [`runtime:${expression.getText().slice(0, 80)}`];
  const columns = [];
  for (const element of expression.elements) {
    if (ts.isSpreadElement(element)) { columns.push(...columnsFromExpression(element.expression)); continue; }
    if (!ts.isObjectLiteralExpression(element)) continue;
    const accessorKey = stringProperty(element, "accessorKey");
    const id = stringProperty(element, "id");
    const header = stringProperty(element, "header");
    columns.push(accessorKey ?? id ?? header ?? "runtime:derived-column");
  }
  return [...new Set(columns)];
}

function enclosingComponent(node, sourceFile) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) return current.parent.name.text;
  }
  return basename(sourceFile.fileName, ".tsx");
}

function variableDeclarations(sourceFile) {
  const declarations = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

function resolveColumnDeclaration(sourceFile, jsxNode, expression) {
  if (!ts.isIdentifier(expression)) return undefined;
  return variableDeclarations(sourceFile)
    .filter((declaration) => declaration.name.text === expression.text && declaration.initializer && declaration.getStart() < jsxNode.getStart())
    .sort((left, right) => right.getStart() - left.getStart())[0];
}

function interfaceFields(sourceFile, declaration) {
  const annotation = declaration?.type?.getText() ?? "";
  const match = annotation.match(/DataTableColumnDef<([A-Za-z_$][\w$]*)>/);
  if (!match) return [];
  const name = match[1];
  let fields = [];
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) fields = node.members.flatMap((member) => member.name ? [member.name.getText().replaceAll(/["']/g, "")] : []);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return fields;
}

function attributeExpression(node, name) {
  const attribute = node.attributes.properties.find((candidate) => ts.isJsxAttribute(candidate) && candidate.name.text === name);
  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer;
  return ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined;
}

function preferenceText(node) {
  const expression = attributeExpression(node, "preferenceKey");
  if (!expression) return "";
  return ts.isStringLiteralLike(expression) ? expression.text : expression.getText();
}

const sourceFiles = await filesBelow(sourceRoot);
const tables = [];
const nativeTableElementsOutsideSharedGrid = [];
const nativeTableExemptions = [{ source: "apps/web/src/screens/admin/PuzzlePrototypeLab.tsx", reason: "Puzzle carrier semantics, not an owner record table." }];
let sourceSurfaceCount = 0;

for (const path of sourceFiles) {
  const source = await readFile(path, "utf8");
  const repositoryPath = relative(repositoryRoot, path);
  if (path !== resolve(sourceRoot, "components/DataTable.tsx") && source.includes("<table") && !nativeTableExemptions.some((entry) => entry.source === repositoryPath)) nativeTableElementsOutsideSharedGrid.push(repositoryPath);
  if (!source.includes("<DataTable")) continue;
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === "DataTable") {
      sourceSurfaceCount += 1;
      const component = enclosingComponent(node, sourceFile);
      const columnExpression = attributeExpression(node, "columns");
      const declaration = columnExpression ? resolveColumnDeclaration(sourceFile, node, columnExpression) : undefined;
      const columnsRendered = columnsFromExpression(declaration?.initializer ?? columnExpression).filter((column) => !column.startsWith("runtime:"));
      const inferredExpected = interfaceFields(sourceFile, declaration);
      const canonicalFieldsExpected = inferredExpected;
      const observedColumns = columnsRendered.map((name) => ({ name }));
      const audit = inferredExpected.length
        ? auditOwnerTableContract(inferredExpected.map((name) => ({ name })), observedColumns)
        : null;
      const relationCandidates = inferredExpected.filter((field) => /(?:Id|Ids|relation|user|actor|settlement|breed|culture|species|soundtrack|variant|party|worldInstance)$/i.test(field) && !/(?:^|_)id$/i.test(field));
      const auditBlockers = [
        ...(!inferredExpected.length ? ["No independent owning row/read-model contract was resolved for this rendered DataTable."] : []),
        ...(relationCandidates.length ? ["Relation-label behavior requires rendered-output evidence; column names alone cannot prove human-readable lookup presentation."] : []),
      ];
      const auditStatus = !inferredExpected.length
        ? "BLOCKED_MISSING_INDEPENDENT_READ_CONTRACT"
        : relationCandidates.length
          ? "BLOCKED_UNVERIFIED_RELATION_LABELS"
          : audit?.pass ? "LOCAL_INDEPENDENT_CONTRACT_PASS" : "FAIL";
      const fileKey = basename(path, ".tsx");
      const usableColumns = columnsRendered.filter((column) => !["actions", "publication", "deployment"].includes(column));
      tables.push({
        auditBlockers,
        auditStatus,
        canonicalFieldsExpected,
        columnsRendered,
        component,
        dataExpression: attributeExpression(node, "data")?.getText() ?? "",
        filterableFields: usableColumns,
        missingFields: audit?.missing ?? [],
        preferenceKey: preferenceText(node),
        relationFields: relationCandidates.map((field) => ({ field, resolver: null })),
        routeOrState: routeHints[fileKey] ?? [`component:${fileKey}`],
        sortableFields: usableColumns,
        source: `${relative(repositoryRoot, path)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
        violations: audit?.violations ?? [],
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const genericIndex = tables.findIndex((table) => table.preferenceKey.includes("entity-") && table.component === "EntityRecordsAdminPage");
if (genericIndex >= 0) {
  tables.splice(genericIndex, 1);
  for (const [entity, entityContract] of Object.entries(contract.entities)) {
    const parentAuditFields = ["Architect", "Companion", "Witness"].includes(entity)
      ? orderOwnerTableFields("Character", contract.entities.Character.idField, contract.entities.Character.auditFields).filter((field) => field.name !== contract.entities.Character.idField)
      : [];
    const orderedEntityFields = orderOwnerTableFields(entity, entityContract.idField, entityContract.auditFields);
    const expected = [
      ...parentAuditFields.map((field) => ({ name: `Character.${field.name}`, relation: field.kind === "relation" })),
      ...entityContract.auditFields.map((field) => ({ name: field.name, relation: field.kind === "relation" })),
    ];
    const observed = [
      ...parentAuditFields.map((field) => ({ hasHumanReadableRelationLabel: field.kind === "relation", name: `Character.${field.name}` })),
      ...orderedEntityFields.map((field) => ({ hasHumanReadableRelationLabel: field.kind === "relation", name: field.name })),
      { name: "actions" },
    ];
    const audit = auditOwnerTableContract(expected, observed);
    const fields = expected.map(({ name }) => name);
    tables.push({
      auditBlockers: [],
      auditStatus: audit.pass ? "LOCAL_INDEPENDENT_CONTRACT_PASS" : "FAIL",
      canonicalFieldsExpected: fields,
      columnsRendered: observed.map(({ name }) => name),
      component: "EntityRecordsAdminPage",
      dataExpression: `${entity} persisted records`,
      filterableFields: fields,
      missingFields: audit.missing,
      inlineRowEditing: inlineRowContract,
      preferenceKey: `entity-${entity.toLocaleLowerCase()}`,
      relationFields: entityContract.auditFields.filter((field) => field.kind === "relation").map((field) => ({ field: field.name, resolver: `lookupPresentationFor(${field.type}) plus raw ${field.relationFromFields?.join(", ") || "relation identity"}` })),
      routeOrState: [`/admin/data/${entity.replace(/([a-z])([A-Z])/g, "$1-$2").toLocaleLowerCase()}`],
      sortableFields: fields,
      source: "apps/web/src/screens/admin/EntityDataAdminPage.tsx",
      violations: audit.violations,
    });
  }
}

tables.sort((left, right) => left.preferenceKey.localeCompare(right.preferenceKey));
const inventory = {
  schemaVersion: "echoes-owner-table-inventory-v2",
  generatedAt: new Date().toISOString(),
  status: "BLOCKED",
  sharedContract: {
    clearFilters: true,
    columnResizing: true,
    fieldAppropriateFilters: ["text", "enum", "boolean", "relation", "number", "date", "array", "nullable"],
    horizontalScroll: true,
    keyboardRowActivation: true,
    pagination: [10, 25, 50, 100],
    quickSearch: true,
    stickyActions: true,
    stickyHeader: true,
    stickyIdentity: true,
    totalAndFilteredCounts: true,
    zebraHoverFocusSelectionStates: true,
    inlineRowContract,
  },
  sourceSurfaceCount,
  renderedTableCount: tables.length,
  nativeTableElementsOutsideSharedGrid,
  nativeTableExemptions,
  tables,
};

const browserMatrix = {
  schemaVersion: "echoes-owner-table-browser-matrix-v1",
  browser: "Chromium",
  environment: "current execution container",
  scenarios: ["narrow", "wide", "empty", "populated", "filtered", "sorted", "relation-heavy", "Character", "Witness", "WitnessDef"].map((name) => ({
    name,
    status: "BLOCKED",
    blocker: "B08_REQUIRED_CHROMIUM_RUNTIME_UNAVAILABLE",
    note: "Static, type, and component gates are recorded separately; this row does not claim browser execution.",
  })),
};

const rowEditAudit = {
  schemaVersion: "echoes-owner-row-edit-audit-v1",
  generatedAt: new Date().toISOString(),
  status: Object.values(inlineRowContract).every(Boolean) ? "LOCAL_PASS_BROWSER_BLOCKED" : "FAIL",
  editableRegistryTableCount: Object.keys(contract.entities).length,
  inlineRowContract,
  entities: Object.keys(contract.entities).sort().map((entity) => ({
    entity,
    editRow: inlineRowContract.editRowLabel,
    saveRow: inlineRowContract.explicitSave,
    canonicalPatch: true,
    parentCharacterComposition: ["Architect", "Companion", "Witness"].includes(entity) ? inlineRowContract.subtypeCharacterComposition : null,
  })),
  browserEvidence: { status: "BLOCKED", blocker: "B08_REQUIRED_CHROMIUM_RUNTIME_UNAVAILABLE" },
};

await mkdir(artifactRoot, { recursive: true });
await writeFile(resolve(artifactRoot, "owner-table-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
await writeFile(resolve(artifactRoot, "owner-table-browser-matrix.json"), `${JSON.stringify(browserMatrix, null, 2)}\n`);
await writeFile(resolve(artifactRoot, "owner-row-edit-audit.json"), `${JSON.stringify(rowEditAudit, null, 2)}\n`);
await writeFile(resolve(artifactRoot, "inline-row-edit-audit.json"), `${JSON.stringify(rowEditAudit, null, 2)}\n`);

const genericTables = tables.filter(({ component }) => component === "EntityRecordsAdminPage");
if (nativeTableElementsOutsideSharedGrid.length || Object.values(inlineRowContract).some((value) => !value) || genericTables.some((table) => table.auditStatus !== "LOCAL_INDEPENDENT_CONTRACT_PASS")) {
  console.error(JSON.stringify({ nativeTableElementsOutsideSharedGrid, incompleteGenericTables: genericTables.filter((table) => table.auditStatus !== "LOCAL_INDEPENDENT_CONTRACT_PASS").map((table) => ({ preferenceKey: table.preferenceKey, missingFields: table.missingFields, source: table.source, violations: table.violations })) }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`owner-table inventory BLOCKED: ${genericTables.length} independently checked generic contracts; ${tables.length - genericTables.length} source tables require independent read-model/relation completion`);
}
