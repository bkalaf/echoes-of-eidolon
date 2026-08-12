import { describe, expect, it, vi } from "vitest";

import { runAuthFixtureCleanup } from "../e2e/support/auth-fixture-cleanup";

describe("auth E2E fixture cleanup", () => {
  it("quiesces browser requests before database deletion and clears tracking only after success", async () => {
    const order: string[] = [];
    await runAuthFixtureCleanup({
      hasFixtures: true,
      closeBrowserContext: async () => { order.push("context"); },
      deleteDatabaseRecords: async () => { order.push("database"); },
      clearTrackedFixtures: () => { order.push("tracking"); },
    });
    expect(order).toEqual(["context", "database", "tracking"]);
  });

  it("retains tracked fixture identities when database cleanup fails", async () => {
    const clearTrackedFixtures = vi.fn();
    await expect(runAuthFixtureCleanup({
      hasFixtures: true,
      closeBrowserContext: async () => undefined,
      deleteDatabaseRecords: async () => { throw new Error("database unavailable"); },
      clearTrackedFixtures,
    })).rejects.toThrow("database unavailable");
    expect(clearTrackedFixtures).not.toHaveBeenCalled();
  });
});
