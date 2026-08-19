import { describe, expect, it } from "vitest";

import contractData from "../../src/data/entity-admin-contract.json";
import { buildOwnerUiLiveInventory } from "../../src/domain/owner-ui-live-inventory";

describe("owner UI live inventory", () => {
  const inventory = buildOwnerUiLiveInventory(contractData);

  it("inventories every active entity and every persisted model from live generated authority", () => {
    expect(inventory.activeEntityCount).toBe(34);
    expect(inventory.persistedModelCount).toBe(124);
    expect(inventory.entities).toHaveLength(inventory.activeEntityCount);
    expect(new Set(inventory.entities.map(({ entity }) => entity)).size).toBe(inventory.activeEntityCount);
    expect(inventory.unregisteredPersistedModels).toHaveLength(
      inventory.persistedModelCount - inventory.activeEntityCount,
    );
  });

  it("maps canonical fields, owner surfaces, routes, and write owners without omissions", () => {
    for (const entry of inventory.entities) {
      const source = contractData.entities[entry.entity as keyof typeof contractData.entities];
      expect(entry.canonicalFields, `${entry.entity} canonical fields`).toEqual(
        source.auditFields.map(({ name }) => name),
      );
      expect(entry.table.expectedCanonicalFields).toEqual(entry.canonicalFields);
      expect(entry.form.expectedCanonicalFields).toEqual(entry.canonicalFields);
      expect(entry.form.writableFields).toEqual(source.fields.map(({ name }) => name));
      expect(entry.writeOwners).toHaveLength(entry.canonicalFields.length);
      expect(entry.routes.collection).toMatch(/^\/admin\/data\//);
      expect(entry.routes.apiCollection).toBe(`/api/admin/data/${entry.entity.toLowerCase()}`);
      expect(entry.routes.apiRecord).toBe(`/api/admin/data/${entry.entity.toLowerCase()}/$recordId`);
    }
  });

  it("records explicit workflow ownership for every excluded relation or persisted field", () => {
    for (const entry of inventory.entities) {
      for (const owner of entry.writeOwners.filter(({ editable }) => !editable)) {
        expect(owner.owner, `${entry.entity}.${owner.field}`).toBe("WORKFLOW_OR_RELATION_OWNER");
        expect(owner.reason, `${entry.entity}.${owner.field}`).toBeTruthy();
      }
    }
  });
});
