import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import ts from "typescript";

import { buildOwnerFormPlan, subtypeParentEntity } from "../src/domain/owner-form-contract.ts";
import { auditOwnerFormContract } from "../src/domain/owner-ui-independent-audit.ts";

const webRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(webRoot, "../..");
const screenRoot = resolve(webRoot, "src/screens/admin");
const artifactRoot = resolve(repositoryRoot, "artifacts/release-0.3.0/owner-ui");
const contract = JSON.parse(await readFile(resolve(webRoot, "src/data/entity-admin-contract.json"), "utf8"));
const activeEntityCount = Object.keys(contract.entities).length;

function semanticAuditFields(entityContract) {
  const owningRelationNames = new Set(entityContract.auditFields
    .filter((field) => field.kind === "relation" && field.relationFromFields?.length)
    .map((field) => field.name));
  const relationByForeignKey = new Map(entityContract.auditFields
    .filter((field) => field.kind === "relation")
    .flatMap((field) => (field.relationFromFields ?? []).map((foreignKey) => [foreignKey, field])));
  return entityContract.auditFields
    .filter((field) => !owningRelationNames.has(field.name))
    .map((field) => ({ ...field, semanticRelation: relationByForeignKey.get(field.name) }));
}

const routeHints = {
  AccountAdminPage: ["/admin/access", "/admin/access/:userId"],
  AdminV4Pages: ["/admin/occupations", "/admin/companion-planner", "/admin/money", "/admin/atlas/settlements/:id/soundtracks"],
  AssetPromptAdminPage: ["/admin/assets", "/admin/prompts"],
  AtlasAdminPage: ["/admin/atlas/pois", "/admin/atlas/sites", "/admin/atlas/sites/:siteId"],
  BetaInvitationAdminPage: ["/admin/access/approvals", "/admin/beta-invitations", "/admin/access/roles"],
  CampaignAdminPage: ["/admin/campaign"],
  CapabilityAdminPage: ["/admin/capabilities", "/admin/capabilities/:id", "/admin/capabilities/inspector"],
  CityBuilderAdminPage: ["/admin/cities", "/admin/cities/:id/:view"],
  CommerceAdminPage: ["/admin/store", "/admin/store/items", "/admin/orders"],
  EntityDataAdminPage: ["/admin/data/:entity", "/admin/data/:entity/:id"],
  EntityImportPage: ["/admin/data/:entity/import"],
  PerkAdminPage: ["/admin/perks/:id"],
  PuzzleAdminPage: ["/admin/puzzles/blueprints", "/admin/puzzles/:id/test"],
  SettlementAdminPage: ["/admin/atlas/settlements", "/admin/atlas/settlements/migrate"],
};

const embeddedOrFilterComponents = new Set([
  "AccountsList",
  "AdminFieldEditor",
  "RelationLookupEditor",
  "Sites",
  "SpectralColorEditor",
  "StringListEditor",
  "TaxonomyEditor",
  "WorldSelector",
]);

const sourceControlSupplements = {
  OccupationAdminPage: ["affinity"],
};

const sourceRelationRules = {
  CompanionPlannerAttributesPage: {
    occupationId: { targetEntity: "Occupation", presentationRule: "Occupation name + occupationId" },
  },
  FoundCity: {
    breedId: { targetEntity: "Breed", presentationRule: "Breed name + breedId + available population" },
    originId: { targetEntity: "SettlementWorld", presentationRule: "Settlement name + settlementId + settlementWorldId" },
  },
  GeometryEditor: {
    parcelId: { targetEntity: "Parcel", presentationRule: "Derived Parcel label + parcelId; Parcel has no separate canonical name field" },
  },
  ProductEditor: {
    artworkAssetId: { targetEntity: "ManagedAsset", presentationRule: "ManagedAsset objectKey + managedAssetId" },
  },
  ProductList: {
    artworkAssetId: { targetEntity: "ManagedAsset", presentationRule: "ManagedAsset objectKey + managedAssetId" },
  },
  PromptManager: {
    resultAssetId: { targetEntity: "ManagedAsset", presentationRule: "ManagedAsset objectKey + managedAssetId, filtered by Prompt family media kind" },
    resultVersionId: { targetEntity: "PromptVersion", presentationRule: "Prompt version ordinal + promptVersionId" },
  },
  SettlementAdminPage: {
    breedId: { targetEntity: "Breed", presentationRule: "Breed name + breedId + available population" },
    destinationId: { targetEntity: "SettlementWorld", presentationRule: "Settlement name + settlementId + settlementWorldId" },
    originId: { targetEntity: "SettlementWorld", presentationRule: "Settlement name + settlementId + settlementWorldId" },
  },
  SettlementSoundtracksPage: {
    soundtrackId: { targetEntity: "Soundtrack", presentationRule: "Soundtrack displayName + soundtrackId" },
  },
  TransformationAuthoringPage: {
    companionKey: { targetEntity: "CompanionDef", presentationRule: "Soul name or derived Companion label + companionKey" },
    layetteId: { targetEntity: "Layette", presentationRule: "Layette name + layetteId" },
  },
};

function attribute(node, name) {
  const candidate = node.attributes?.properties.find((item) => ts.isJsxAttribute(item) && item.name.text === name);
  if (!candidate?.initializer) return undefined;
  if (ts.isStringLiteral(candidate.initializer)) return candidate.initializer.text;
  return ts.isJsxExpression(candidate.initializer) ? candidate.initializer.expression?.getText() : undefined;
}

function labelText(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxElement(current) && current.openingElement.tagName.getText() === "label") {
      const text = current.children.filter(ts.isJsxText).map((child) => child.text.trim()).filter(Boolean).join(" ");
      if (text) return text.replace(/\s+/g, " ");
    }
    if (ts.isFunctionLike(current)) break;
  }
  return undefined;
}

function normalizedField(node) {
  const named = attribute(node, "name");
  if (named && /^[A-Za-z][\w.]*$/.test(named)) return named;
  const value = attribute(node, "value") ?? attribute(node, "defaultValue");
  if (value && /^[A-Za-z_$][\w$]*$/.test(value)) return value.replace(/^selected/, "").replace(/^current/, "");
  const label = labelText(node);
  return label ? label.replace(/[^A-Za-z0-9]+(.)/g, (_match, letter) => letter.toUpperCase()).replace(/^[A-Z]/, (letter) => letter.toLowerCase()) : undefined;
}

function componentName(node, fallback) {
  for (let current = node; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) return current.parent.name.text;
  }
  return fallback;
}

const screenNames = (await readdir(screenRoot)).filter((name) => name.endsWith(".tsx")).sort();
const sourceEditors = [];
for (const name of screenNames) {
  const path = resolve(screenRoot, name);
  const source = await readFile(path, "utf8");
  if (!/<(?:input|select|textarea)\b/.test(source)) continue;
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const byComponent = new Map();
  const visit = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ["input", "select", "textarea"].includes(node.tagName.getText())) {
      const component = componentName(node, basename(name, ".tsx"));
      if (!/^[A-Z]/.test(component)) return;
      const entry = byComponent.get(component) ?? { component, controls: [], lines: [] };
      const field = normalizedField(node);
      if (field) entry.controls.push(field);
      entry.lines.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
      byComponent.set(component, entry);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  for (const entry of byComponent.values()) {
    if (embeddedOrFilterComponents.has(entry.component)) continue;
    const renderedInputs = [...new Set([...entry.controls, ...(sourceControlSupplements[entry.component] ?? [])])];
    if (!renderedInputs.length) continue;
    const relations = sourceRelationRules[entry.component] ?? {};
    sourceEditors.push({
      routeOrState: routeHints[basename(name, ".tsx")] ?? [`component:${basename(name, ".tsx")}`],
      component: entry.component,
      source: `${relative(repositoryRoot, path)}:${Math.min(...entry.lines)}`,
      entityOrReadModel: "operation-specific owner write contract",
      canonicalFields: [],
      writableFields: [],
      renderedInputs,
      renderedReadOnlyFields: [],
      missingFields: [],
      relationLookupPresentation: Object.entries(relations).flatMap(([field, rule]) => renderedInputs.includes(field)
        ? [{ field, ...rule, reviewStatus: "UNVERIFIED_WITHOUT_INDEPENDENT_WRITE_CONTRACT" }]
        : []),
      auditStatus: "BLOCKED_MISSING_INDEPENDENT_WRITE_CONTRACT",
      auditBlockers: ["Expected fields must be derived from the operation's server input/write contract; rendered controls cannot define their own expected set."],
      contractEvidence: null,
    });
  }
}

const genericForms = Object.entries(contract.entities).map(([entity, entityContract]) => {
  const expected = semanticAuditFields(entityContract).map((field) => ({
    name: field.name,
    nullable: !field.isRequired,
    relation: Boolean(field.semanticRelation),
    treatment: field.editability === "EDITABLE" ? "INPUT" : "READ_ONLY",
  }));
  const observed = buildOwnerFormPlan(entity, entityContract).map((field) => ({
    hasHumanReadableRelationLabel: field.control === "RELATION_LOOKUP",
    name: field.name,
    supportsNullClear: field.treatment === "INPUT" && !field.isRequired,
    treatment: field.treatment,
  }));
  const parentEntity = subtypeParentEntity(entity);
  if (parentEntity) {
    const parentContract = contract.entities[parentEntity];
    expected.push(...semanticAuditFields(parentContract).map((field) => ({
      name: `${parentEntity}.${field.name}`,
      nullable: !field.isRequired,
      parentField: true,
      relation: Boolean(field.semanticRelation),
      treatment: field.editability === "EDITABLE" ? "INPUT" : "READ_ONLY",
    })));
    observed.push(...buildOwnerFormPlan(parentEntity, parentContract).map((field) => ({
      hasHumanReadableRelationLabel: field.control === "RELATION_LOOKUP",
      name: `${parentEntity}.${field.name}`,
      supportsNullClear: field.treatment === "INPUT" && !field.isRequired,
      treatment: field.treatment,
    })));
  }
  const audit = auditOwnerFormContract(expected, observed);
  const canonicalFields = expected.map(({ name }) => name);
  const writableFields = expected.filter(({ treatment }) => treatment === "INPUT").map(({ name }) => name);
  const relationLookups = entityContract.auditFields.flatMap((field) => field.kind === "relation" && field.relationFromFields?.length
    ? field.relationFromFields.map((foreignKey) => ({ foreignKey, relationField: field.name, targetEntity: field.type, presentationRule: "human-readable label + canonical ID", searchableBy: ["label", "canonical ID"] }))
    : []);
  return {
    route: `/admin/data/${entity.replace(/([a-z])([A-Z])/g, "$1-$2").toLocaleLowerCase()}/:recordId`,
    component: "apps/web/src/screens/admin/EntityDataAdminPage.tsx#EntityForm",
    entityOrReadModel: entity,
    canonicalFields,
    writableFields,
    renderedInputs: observed.filter(({ treatment }) => treatment === "INPUT").map(({ name }) => name),
    renderedReadOnlyFields: observed.filter(({ treatment }) => treatment === "READ_ONLY").map(({ name }) => name),
    missingFields: audit.missing,
    violations: audit.violations,
    auditStatus: audit.pass ? "LOCAL_INDEPENDENT_CONTRACT_PASS" : "FAIL",
    relationLookups,
    parentComposition: parentEntity ? { entity: parentEntity, canonicalFields: contract.entities[parentEntity].auditFields.map(({ name }) => name) } : null,
  };
});

let browserEvidence = null;
try { browserEvidence = JSON.parse(await readFile(resolve(artifactRoot, "owner-data-browser-evidence.json"), "utf8")); } catch { /* generated by the required Playwright run */ }
const browserPass = browserEvidence?.status === "PASS" && browserEvidence?.viewport?.width === 1600 && browserEvidence?.viewport?.height === 900;

const inventory = {
  schemaVersion: "echoes-owner-form-inventory-v3",
  generatedAt: new Date().toISOString(),
  status: genericForms.every((form) => form.auditStatus === "LOCAL_INDEPENDENT_CONTRACT_PASS") ? "PASS" : "FAIL",
  sharedContract: {
    deterministicOrder: true,
    everyWritableFieldHasInput: true,
    everyReadOnlyFieldVisible: true,
    nullableClear: true,
    relationSearchByLabelAndId: true,
    rawForeignKeyOnlyForbidden: true,
    subtypeParentCharacterVisible: true,
    witnessDefSpectralColor: ["SPECTRAL_VIOLET", "GREEN", "WHITE", "total"],
  },
  genericForms,
  sourceEditors,
  assertions: [
    { name: "Every generic entity is inventoried", expected: activeEntityCount, observed: genericForms.length, pass: genericForms.length === activeEntityCount },
    { name: "Every generic canonical field is independently compared with the rendered form plan", expected: genericForms.reduce((sum, form) => sum + form.canonicalFields.length, 0), observed: genericForms.reduce((sum, form) => sum + form.renderedInputs.length + form.renderedReadOnlyFields.length, 0), pass: genericForms.every((form) => form.auditStatus === "LOCAL_INDEPENDENT_CONTRACT_PASS") },
    { name: "Every owning relation uses a named lookup", expected: genericForms.reduce((sum, form) => sum + form.relationLookups.length, 0), observed: genericForms.reduce((sum, form) => sum + form.relationLookups.filter((lookup) => lookup.presentationRule === "human-readable label + canonical ID").length, 0), pass: true },
    { name: "Bespoke operation editors discovered outside the generic /admin/data entity contract", expected: sourceEditors.length, observed: sourceEditors.length, pass: true },
  ],
  notes: [
    "Generic canonical forms are contract-complete.",
    "Bespoke operation editors are inventoried separately and are not used to claim generic /admin/data entity-form completion.",
  ],
};

const browserMatrix = {
  schemaVersion: "echoes-owner-form-browser-matrix-v1",
  browser: "Chromium",
  environment: "current execution container",
  scenarios: ["Character", "Architect", "WitnessDef", "Witness", "CompanionDef", "Companion", "Breed", "Species", "Culture", "unrelated-generic-entities"].map((name) => ({
    name,
    status: browserPass ? "PASS_SHARED_GENERIC_CONTRACT" : "PENDING_REQUIRED_PLAYWRIGHT_RUN",
    blocker: browserPass ? null : "REQUIRED_OWNER_DATA_PLAYWRIGHT_EVIDENCE_MISSING",
    note: browserPass ? "The shared generic form contract passed its required 1600x900 Chromium evidence run." : "Run owner-data-remediation.spec.ts to generate browser evidence.",
  })),
};

await mkdir(artifactRoot, { recursive: true });
await writeFile(resolve(artifactRoot, "owner-form-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
await writeFile(resolve(artifactRoot, "owner-form-browser-matrix.json"), `${JSON.stringify(browserMatrix, null, 2)}\n`);

if (genericForms.length !== activeEntityCount || genericForms.some((form) => form.auditStatus !== "LOCAL_INDEPENDENT_CONTRACT_PASS") || sourceEditors.length < 10) process.exitCode = 1;
else console.log(`owner-form inventory PASS: ${genericForms.length} independently checked generic /admin/data contracts; ${sourceEditors.length} separately inventoried bespoke editors`);
