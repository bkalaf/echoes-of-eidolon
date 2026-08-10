import { describe, expect, it, vi } from "vitest";

import { applyValidatedEntityImport } from "../../src/server/entity-import";

describe("atomic entity import boundary", () => {
  it("blocks unauthorized or invalid apply before opening a transaction", async () => {
    const database = { transaction: vi.fn() };
    const insert = vi.fn();

    await expect(
      applyValidatedEntityImport({
        authorized: false,
        database,
        errors: [],
        insert,
        rows: [{ soulId: "SOUL-1", name: "One" }],
      }),
    ).rejects.toThrow("Administrative authorization is required");
    await expect(
      applyValidatedEntityImport({
        authorized: true,
        database,
        errors: ["invalid"],
        insert,
        rows: [{ soulId: "SOUL-1", name: "One" }],
      }),
    ).rejects.toThrow("validation must pass");
    expect(database.transaction).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rolls the entire batch back when an insert fails", async () => {
    const stored: string[] = [];
    const database = {
      async transaction<Result>(work: (transaction: string[]) => Promise<Result>) {
        const snapshot = [...stored];
        try {
          return await work(stored);
        } catch (error) {
          stored.splice(0, stored.length, ...snapshot);
          throw error;
        }
      },
    };

    await expect(
      applyValidatedEntityImport({
        authorized: true,
        database,
        errors: [],
        rows: [
          { soulId: "SOUL-1", name: "One" },
          { soulId: "SOUL-2", name: "Two" },
        ],
        insert: async (transaction, rows) => {
          transaction.push(String(rows[0]?.soulId));
          throw new Error("second row rejected");
        },
      }),
    ).rejects.toThrow("second row rejected");
    expect(stored).toEqual([]);
  });
});
