import type { PrismaClient } from "../../src/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  AccountSessionRequestError,
  listAccountSessions,
  revokeAllOtherSessions,
  revokeOneOtherSession,
} from "../../src/server/account-sessions";

function databaseWithDeleteResult(count: number) {
  const deleteMany = vi.fn().mockResolvedValue({ count });
  return {
    database: { session: { deleteMany } } as unknown as PrismaClient,
    deleteMany,
  };
}

describe("account other-session revocation", () => {
  it("projects session identifiers and current state without returning bearer tokens", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "session-current", token: "current-token", updatedAt: new Date(), expiresAt: new Date(), ipAddress: null, userAgent: null },
      { id: "session-other", token: "other-token", updatedAt: new Date(), expiresAt: new Date(), ipAddress: null, userAgent: null },
    ]);
    const database = { session: { findMany } } as unknown as PrismaClient;

    const sessions = await listAccountSessions({ currentSessionToken: "current-token", userId: "user-1" }, database);

    expect(sessions.map(({ sessionId, isCurrent }) => ({ sessionId, isCurrent }))).toEqual([
      { sessionId: "session-current", isCurrent: true },
      { sessionId: "session-other", isCurrent: false },
    ]);
    expect(sessions).not.toEqual(expect.arrayContaining([expect.objectContaining({ token: expect.anything() })]));
  });

  it("deletes one token only when it belongs to the authenticated user and is not current", async () => {
    const { database, deleteMany } = databaseWithDeleteResult(1);

    await revokeOneOtherSession({
      currentSessionToken: "current-token",
      sessionId: "session-other",
      userId: "user-1",
    }, database);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: "session-other",
        NOT: { token: "current-token" },
        userId: "user-1",
      },
    });
  });

  it("fails closed when the requested other token does not belong to the authenticated user", async () => {
    const { database } = databaseWithDeleteResult(0);

    await expect(revokeOneOtherSession({
      currentSessionToken: "current-token",
      sessionId: "another-users-session",
      userId: "user-1",
    }, database)).rejects.toEqual(expect.objectContaining<AccountSessionRequestError>({
      status: 404,
    }));
  });

  it("deletes every authenticated-user session except the current token", async () => {
    const { database, deleteMany } = databaseWithDeleteResult(2);

    await expect(revokeAllOtherSessions({
      currentSessionToken: "current-token",
      userId: "user-1",
    }, database)).resolves.toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        token: { not: "current-token" },
        userId: "user-1",
      },
    });
  });
});
