import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { getAdminDashboard } from "../../src/server/admin-dashboard";

describe("administrative dashboard projection", () => {
  it("derives every displayed count from a named persisted queue", async () => {
    const database = {
      atlasConnection: { count: vi.fn().mockResolvedValue(44) },
      betaInviteRequest: { count: vi.fn().mockResolvedValue(12) },
      bulkOperationAudit: { count: vi.fn().mockResolvedValue(2) },
      externalBulkApiSession: { count: vi.fn().mockResolvedValue(0) },
      promptRecord: { count: vi.fn().mockResolvedValue(18) },
      regionLatticeMapping: { count: vi.fn().mockResolvedValue(25) },
      release: { count: vi.fn().mockResolvedValue(1) },
    } as unknown as PrismaClient;
    const result = await getAdminDashboard(database);
    expect(result).toEqual({
      atlas: { connections: 44, regionMappings: 25 },
      externalBulkApi: { activeSessions: 0, state: "OFF" },
      queues: { draftReleases: 1, failedBulkOperations: 2, outstandingPrompts: 18, pendingInvitationRequests: 12 },
    });
    expect(database.betaInviteRequest.count).toHaveBeenCalledWith({ where: { status: "PENDING" } });
    expect(database.promptRecord.count).toHaveBeenCalledWith({ where: { status: "OUTSTANDING" } });
    expect(database.bulkOperationAudit.count).toHaveBeenCalledWith({ where: { result: "FAILED" } });
  });
});
