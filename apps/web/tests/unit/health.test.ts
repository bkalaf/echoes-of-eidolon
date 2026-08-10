import { describe, expect, it } from "vitest";

import { buildPublicHealthReport } from "../../src/server/health";

describe("public health reporting", () => {
  it("reports only verified and configured status", () => {
    const report = buildPublicHealthReport({
      authenticationAvailable: true,
      checkedAt: "2026-08-10T00:00:00.000Z",
      commerceConfigured: true,
    });

    expect(report.services).toEqual([
      expect.objectContaining({ name: "Website", status: "operational" }),
      expect.objectContaining({ name: "Authentication", status: "operational" }),
      expect.objectContaining({ name: "Game Service", status: "unmonitored" }),
      expect.objectContaining({ name: "Store", status: "configured" }),
    ]);
  });

  it("does not report authentication as operational when its check fails", () => {
    const report = buildPublicHealthReport({
      authenticationAvailable: false,
      commerceConfigured: false,
    });
    expect(report.services).toContainEqual(
      expect.objectContaining({ name: "Authentication", status: "unavailable" }),
    );
  });
});
