type AuditField = {
  editability: "EDITABLE" | "EXCLUDED";
  exclusionReason: string | null;
  isList: boolean;
  isRequired: boolean;
  kind: "enum" | "json" | "relation" | "scalar";
  name: string;
  type: string;
};

type EditableField = {
  name: string;
};

type EntityContract = {
  auditFields: AuditField[];
  delegate: string;
  fields: EditableField[];
  idField: string;
};

type GeneratedEntityAdminContract = {
  auditModels: Record<string, { fields: Array<{ name: string }> }>;
  entities: Record<string, EntityContract>;
  generatedFrom: string[];
  policy: string;
};

const collectionRouteOverrides: Record<string, string> = {
  AchievementDefinition: "achievement-definition",
  CompanionDef: "companion-def",
  InterludeSubstitution: "interlude-substitution",
  KnowledgeBaseItem: "knowledge-base-item",
  LegendaryReward: "reward",
  PersonalityExpression: "personality-expression",
  PointOfInterest: "point-of-interest",
  Source: "sources",
  TimelineEvent: "timeline-event",
  WitnessDef: "witness-def",
};

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function collectionRouteFor(entity: string): string {
  return `/admin/data/${collectionRouteOverrides[entity] ?? kebabCase(entity)}`;
}

export function buildOwnerUiLiveInventory(contractData: GeneratedEntityAdminContract) {
  const activeEntityNames = Object.keys(contractData.entities).sort();
  const persistedModelNames = Object.keys(contractData.auditModels).sort();
  const activeEntitySet = new Set(activeEntityNames);

  const entities = activeEntityNames.map((entity) => {
    const contract = contractData.entities[entity]!;
    const canonicalFields = contract.auditFields.map(({ name }) => name);
    const writableFields = contract.fields.map(({ name }) => name);
    const writableSet = new Set(writableFields);
    const entityKey = entity.toLowerCase();
    const collection = collectionRouteFor(entity);

    return {
      entity,
      delegate: contract.delegate,
      idField: contract.idField,
      canonicalFields,
      relationFields: contract.auditFields
        .filter(({ kind }) => kind === "relation")
        .map(({ name, type, isList, isRequired }) => ({ name, type, isList, isRequired })),
      routes: {
        collection,
        create: `${collection}/new`,
        detailPattern: `${collection}/$recordId`,
        apiCollection: `/api/admin/data/${entityKey}`,
        apiRecord: `/api/admin/data/${entityKey}/$recordId`,
        apiImport: `/api/admin/data/${entityKey}/import`,
      },
      table: {
        component: "apps/web/src/screens/admin/EntityDataAdminPage.tsx#EntityRecordsAdminPage",
        expectedCanonicalFields: canonicalFields,
        readOwner: `PrismaClient.${contract.delegate}.findMany`,
      },
      form: {
        component: "apps/web/src/screens/admin/EntityDataAdminPage.tsx#EntityForm",
        expectedCanonicalFields: canonicalFields,
        writableFields,
        readOnlyFields: canonicalFields.filter((field) => !writableSet.has(field)),
      },
      writeOwners: contract.auditFields.map((field) => field.editability === "EDITABLE"
        ? {
            field: field.name,
            editable: true,
            owner: "GENERIC_ENTITY_ADMIN" as const,
            persistenceOwner: `${entity}.${field.name}`,
            writePath: `normalizeEntityData -> entity validators -> PrismaClient.${contract.delegate}`,
            reason: null,
          }
        : {
            field: field.name,
            editable: false,
            owner: "WORKFLOW_OR_RELATION_OWNER" as const,
            persistenceOwner: `${entity}.${field.name}`,
            writePath: null,
            reason: field.exclusionReason,
          }),
    };
  });

  return {
    schemaVersion: "echoes-owner-ui-live-inventory-v1",
    generatedFrom: contractData.generatedFrom,
    sourcePolicy: contractData.policy,
    activeEntityCount: entities.length,
    persistedModelCount: persistedModelNames.length,
    unregisteredPersistedModels: persistedModelNames.filter((model) => !activeEntitySet.has(model)),
    entities,
  };
}
