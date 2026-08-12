import { describe, expect, it } from "vitest";

import {
  effectiveBulkGatewayMode,
  isActionableEnvelope,
  parseBulkRequest,
} from "../../src/domain/bulk-gateway";

describe("typed ordered bulk gateway", () => {
  it("expires KEYED and KEYLESS modes after 60 minutes of endpoint inactivity", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    expect(effectiveBulkGatewayMode({ mode: "KEYED", lastActivityAt: new Date("2026-08-12T11:00:01.000Z") }, now)).toBe("KEYED");
    expect(effectiveBulkGatewayMode({ mode: "KEYLESS", lastActivityAt: new Date("2026-08-12T11:00:00.000Z") }, now)).toBe("OFF");
  });

  it("accepts only strict typed occupation envelopes and never accepts SQL-like fields", () => {
    expect(parseBulkRequest("POST", {
      version: "1",
      entity: "occupation",
      notes: "Add authored occupations",
      records: [{ key: "BREWER", name: "Brewer", attributeAffinity: ["STAMINA", "WISDOM"] }],
    }).operation).toBe("INSERT");
    expect(() => parseBulkRequest("POST", {
      version: "1",
      entity: "occupation",
      notes: "unsafe",
      sql: "drop table User",
      records: [],
    })).toThrow();
    expect(() => parseBulkRequest("PUT", {
      version: "1",
      entity: "occupation",
      notes: "unsafe",
      records: [{ match: { key: "BREWER" }, set: { arbitrary: true } }],
    })).toThrow();
  });

  it("permits only the earliest non-terminal mutation envelope to be applied or deleted", () => {
    const queue = [
      { sequence: 10n, status: "PENDING_REVIEW" as const },
      { sequence: 11n, status: "PENDING_REVIEW" as const },
    ];
    expect(isActionableEnvelope(10n, queue)).toBe(true);
    expect(isActionableEnvelope(11n, queue)).toBe(false);
    expect(isActionableEnvelope(11n, [{ sequence: 10n, status: "APPLIED" as const }, queue[1]!])).toBe(true);
  });
});
