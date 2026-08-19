import { describe, expect, it } from "vitest";

import { entityFields } from "../../src/content/entities";
import { recordDetailScreen } from "../../src/routes/admin/data/$entityKey/$recordId";

describe("registry-backed owner record detail route", () => {
  it("resolves every active registry entity without a second route whitelist", () => {
    for (const entityKey of Object.keys(entityFields).map((entity) => entity.toLowerCase())) {
      const screen = recordDetailScreen(entityKey);
      expect(screen?.path).toBe(`/admin/data/${entityKey}/sample-record`);
      expect(screen?.screenId).toMatch(/_EDIT$/);
    }
    expect(recordDetailScreen("not-a-real-entity")).toBeUndefined();
  });

  it("keeps canonical record IDs URL-safe and round-trippable", () => {
    for (const recordId of ["BRD_AARDVARK", "ID-with-hyphen", "ÉIDOLON 名"]) {
      expect(decodeURIComponent(encodeURIComponent(recordId))).toBe(recordId);
    }
  });
});
