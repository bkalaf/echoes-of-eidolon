import { describe, expect, it, vi } from "vitest";

import { applyCurrentInnService, withdrawFromCurrentBank } from "../../src/server/player-gameplay";
import type { PrismaClient } from "../../src/generated/prisma/client";

function transactionalDatabase(session: Record<string, unknown>) {
  const moneyCreate = vi.fn().mockResolvedValue({});
  const memberUpdate = vi.fn().mockResolvedValue({});
  const transaction = {
    gameSession: { findFirst: vi.fn().mockResolvedValue(session) },
    moneyTransaction: { create: moneyCreate },
    partyMember: { update: memberUpdate },
  };
  const database = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as unknown as PrismaClient;
  return { database, memberUpdate, moneyCreate };
}

const bankSession = {
  currentPointOfInterest: { services: [{ active: true, service: "BANK" }] },
  currentPointOfInterestId: "POI-BANK",
  party: {
    moneyTransactions: [{ withdrawalAmount: 30, occurredAtGameMinute: 19_000n }],
    partyId: "PARTY",
    withdrawalLimit: 100,
    worldInstance: { currentGameMinute: 20_000n, worldKey: "CONCORD" },
    worldInstanceId: "WORLD-C",
  },
};

describe("player economy services", () => {
  it("withdraws only inside the current Bank and appends an authoritative world transaction", async () => {
    const { database, moneyCreate } = transactionalDatabase(bankSession);
    await expect(withdrawFromCurrentBank("user", 40, database)).resolves.toEqual({ amount: 40, remaining: 30 });
    expect(moneyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ delta: 40, partyId: "PARTY", withdrawalAmount: 40, worldInstanceId: "WORLD-C" }) });
  });

  it("rejects an over-limit or non-Bank withdrawal without writing", async () => {
    const overLimit = transactionalDatabase(bankSession);
    await expect(withdrawFromCurrentBank("user", 71, overLimit.database)).rejects.toThrow("exceeds");
    expect(overLimit.moneyCreate).not.toHaveBeenCalled();
    const notAtBank = transactionalDatabase({ ...bankSession, currentPointOfInterest: { services: [] } });
    await expect(withdrawFromCurrentBank("user", 1, notAtBank.database)).rejects.toThrow("Bank interaction");
    expect(notAtBank.moneyCreate).not.toHaveBeenCalled();
  });

  it("charges and applies authored Rest, Morale, and Comfort inside one Inn transaction", async () => {
    const session = {
      currentPointOfInterest: { services: [{ active: true, configuration: { actions: { EAT: { comfort: 3, cost: 4, morale: 2, rest: 1 }, STAY: { comfort: 8, cost: 10, morale: 6, rest: 20 } }, maximum: 100 }, service: "INN" }] },
      currentPointOfInterestId: "POI-INN",
      party: { members: [{ characterId: "CHAR-RUIN-A", comfort: 60, morale: 50, partyId: "PARTY", rest: 90 }], moneyTransactions: [{ delta: 25 }], partyId: "PARTY", worldInstance: { currentGameMinute: 42n, worldKey: "RUIN" }, worldInstanceId: "WORLD-R" },
    };
    const { database, memberUpdate, moneyCreate } = transactionalDatabase(session);
    await expect(applyCurrentInnService("user", "STAY", database)).resolves.toEqual({ action: "STAY", cost: 10 });
    expect(moneyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ delta: -10, partyId: "PARTY", worldInstanceId: "WORLD-R" }) });
    expect(memberUpdate).toHaveBeenCalledWith({ where: { partyId_characterId: { characterId: "CHAR-RUIN-A", partyId: "PARTY" } }, data: { comfort: 68, morale: 56, rest: 100 } });
  });
});
