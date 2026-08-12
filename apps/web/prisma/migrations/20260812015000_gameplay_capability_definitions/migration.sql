INSERT INTO "CapabilityDefinition" ("capabilityDefinitionId", "code", "createdAt") VALUES
  ('CAP-DEF-COMPANION-TRANSFORMATION', 'COMPANION_TRANSFORMATION_COMPLETE', CURRENT_TIMESTAMP),
  ('CAP-DEF-COMPANION-LAYETTE-GRANTED', 'COMPANION_LAYETTE_GRANTED', CURRENT_TIMESTAMP),
  ('CAP-DEF-INVENTORY-ITEM-QUANTITY', 'INVENTORY_ITEM_QUANTITY', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "CapabilityDefinitionVersion" (
  "capabilityDefinitionVersionId", "capabilityDefinitionId", "version", "pathPattern", "valueKind",
  "enumValues", "allowedReferenceEntityTypes", "allowedOperations", "monotonicPolicy", "initialBoolean",
  "description", "status", "createdAt"
) SELECT
  'CAP-VER-COMPANION-TRANSFORMATION-1', "capabilityDefinitionId", 1, 'companion/{COMPANION}/transformed', 'BOOLEAN',
  ARRAY[]::TEXT[], ARRAY[]::"EntityType"[], ARRAY['SET']::"CapabilityOperation"[], 'TRUE_ONLY', false,
  'Character-scoped irreversible completion of the authored companion Transformation trigger.', 'ACTIVE', CURRENT_TIMESTAMP
FROM "CapabilityDefinition" WHERE "code" = 'COMPANION_TRANSFORMATION_COMPLETE'
ON CONFLICT ("capabilityDefinitionId", "version") DO NOTHING;

INSERT INTO "CapabilityParameterDefinition" (
  "capabilityParameterDefinitionId", "capabilityDefinitionVersionId", "name", "kind", "entityType", "allowedValues", "ordinal"
) SELECT 'CAP-PARAM-COMPANION-TRANSFORMATION-1', "capabilityDefinitionVersionId", 'COMPANION', 'ENTITY', 'COMPANION', ARRAY[]::TEXT[], 0
FROM "CapabilityDefinitionVersion" WHERE "capabilityDefinitionVersionId" = 'CAP-VER-COMPANION-TRANSFORMATION-1'
ON CONFLICT ("capabilityDefinitionVersionId", "name") DO NOTHING;

INSERT INTO "CapabilityDefinitionVersion" (
  "capabilityDefinitionVersionId", "capabilityDefinitionId", "version", "pathPattern", "valueKind",
  "enumValues", "allowedReferenceEntityTypes", "allowedOperations", "monotonicPolicy",
  "description", "status", "createdAt"
) SELECT
  'CAP-VER-COMPANION-LAYETTE-GRANTED-1', "capabilityDefinitionId", 1, 'companion/{COMPANION}/layette', 'REFERENCE',
  ARRAY[]::TEXT[], ARRAY['LAYETTE']::"EntityType"[], ARRAY['SET']::"CapabilityOperation"[], 'NONE',
  'Character-scoped authored Layette awarded by the companion Transformation event.', 'ACTIVE', CURRENT_TIMESTAMP
FROM "CapabilityDefinition" WHERE "code" = 'COMPANION_LAYETTE_GRANTED'
ON CONFLICT ("capabilityDefinitionId", "version") DO NOTHING;

INSERT INTO "CapabilityParameterDefinition" (
  "capabilityParameterDefinitionId", "capabilityDefinitionVersionId", "name", "kind", "entityType", "allowedValues", "ordinal"
) SELECT 'CAP-PARAM-COMPANION-LAYETTE-GRANTED-1', "capabilityDefinitionVersionId", 'COMPANION', 'ENTITY', 'COMPANION', ARRAY[]::TEXT[], 0
FROM "CapabilityDefinitionVersion" WHERE "capabilityDefinitionVersionId" = 'CAP-VER-COMPANION-LAYETTE-GRANTED-1'
ON CONFLICT ("capabilityDefinitionVersionId", "name") DO NOTHING;

INSERT INTO "CapabilityDefinitionVersion" (
  "capabilityDefinitionVersionId", "capabilityDefinitionId", "version", "pathPattern", "valueKind",
  "enumValues", "allowedReferenceEntityTypes", "allowedOperations", "monotonicPolicy", "initialCounter",
  "description", "status", "createdAt"
) SELECT
  'CAP-VER-INVENTORY-ITEM-QUANTITY-1', "capabilityDefinitionId", 1, 'inventory/{ITEM}/quantity', 'COUNTER',
  ARRAY[]::TEXT[], ARRAY[]::"EntityType"[], ARRAY['SET', 'ADD', 'CLEAR']::"CapabilityOperation"[], 'NONE', 0,
  'Party-scoped positive inventory stack quantity bound to an authored Item reference.', 'ACTIVE', CURRENT_TIMESTAMP
FROM "CapabilityDefinition" WHERE "code" = 'INVENTORY_ITEM_QUANTITY'
ON CONFLICT ("capabilityDefinitionId", "version") DO NOTHING;

INSERT INTO "CapabilityParameterDefinition" (
  "capabilityParameterDefinitionId", "capabilityDefinitionVersionId", "name", "kind", "entityType", "allowedValues", "ordinal"
) SELECT 'CAP-PARAM-INVENTORY-ITEM-QUANTITY-1', "capabilityDefinitionVersionId", 'ITEM', 'ENTITY', 'ITEM', ARRAY[]::TEXT[], 0
FROM "CapabilityDefinitionVersion" WHERE "capabilityDefinitionVersionId" = 'CAP-VER-INVENTORY-ITEM-QUANTITY-1'
ON CONFLICT ("capabilityDefinitionVersionId", "name") DO NOTHING;
