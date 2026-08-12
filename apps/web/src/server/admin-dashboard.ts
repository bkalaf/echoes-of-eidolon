import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { listAdministrativeReleases } from "./releases";

export interface AdminDashboardProjection {
  atlas: { connections: number; regionMappings: number };
  externalBulkApi: { activeSessions: number; state: "OFF" | "ON" };
  queues: {
    draftReleases: number;
    failedBulkOperations: number;
    outstandingPrompts: number;
    pendingInvitationRequests: number;
  };
}

export async function getAdminDashboard(database: PrismaClient = getDatabase()): Promise<AdminDashboardProjection> {
  const now = new Date();
  const [pendingInvitationRequests, outstandingPrompts, draftReleases, failedBulkOperations, activeSessions, regionMappings, connections] = await Promise.all([
    database.betaInviteRequest.count({ where: { status: "PENDING" } }),
    database.promptRecord.count({ where: { status: "OUTSTANDING" } }),
    listAdministrativeReleases().then((releases) => releases.filter((release) => release.status === "DRAFT").length),
    database.bulkOperationAudit.count({ where: { result: "FAILED" } }),
    database.externalBulkApiSession.count({ where: { lastActivityAt: { gt: new Date(now.valueOf() - 60 * 60 * 1_000) }, revokedAt: null, state: { in: ["KEYED", "KEYLESS"] } } }),
    database.regionLatticeMapping.count(),
    database.atlasConnection.count(),
  ]);
  return {
    atlas: { connections, regionMappings },
    externalBulkApi: { activeSessions, state: activeSessions > 0 ? "ON" : "OFF" },
    queues: { draftReleases, failedBulkOperations, outstandingPrompts, pendingInvitationRequests },
  };
}
