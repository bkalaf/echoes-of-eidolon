import type { PrismaClient } from "../../src/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  AccountSessionRequestError,
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
  it("rejects a fabricated one-other request for the current session before persistence", async () => {
    const { database, deleteMany } = databaseWithDeleteResult(1);

    await expect(revokeOneOtherSession({
      currentSessionToken: "current-token",
      token: "current-token",
      userId: "user-1",
    }, database)).rejects.toEqual(expect.objectContaining<AccountSessionRequestError>({
      status: 400,
    }));
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("deletes one token only when it belongs to the authenticated user and is not current", async () => {
    const { database, deleteMany } = databaseWithDeleteResult(1);

    await revokeOneOtherSession({
      currentSessionToken: "current-token",
      token: "other-token",
      userId: "user-1",
    }, database);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        NOT: { token: "current-token" },
        token: "other-token",
        userId: "user-1",
      },
    });
  });

  it("fails closed when the requested other token does not belong to the authenticated user", async () => {
    const { database } = databaseWithDeleteResult(0);

    await expect(revokeOneOtherSession({
      currentSessionToken: "current-token",
      token: "another-users-token",
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
