import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";

export class AccountSessionRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AccountSessionRequestError";
  }
}

interface AccountSessionOwner {
  currentSessionToken: string;
  userId: string;
}

export async function listAccountSessions(
  input: AccountSessionOwner,
  database: PrismaClient = getDatabase(),
) {
  const sessions = await database.session.findMany({
    where: { userId: input.userId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      expiresAt: true,
      id: true,
      ipAddress: true,
      token: true,
      updatedAt: true,
      userAgent: true,
    },
  });
  return sessions.map(({ id, token, ...session }) => ({
    ...session,
    isCurrent: token === input.currentSessionToken,
    sessionId: id,
  }));
}

export async function revokeOneOtherSession(
  input: AccountSessionOwner & { sessionId: string },
  database: PrismaClient = getDatabase(),
): Promise<void> {
  const result = await database.session.deleteMany({
    where: {
      id: input.sessionId,
      userId: input.userId,
      NOT: { token: input.currentSessionToken },
    },
  });

  if (result.count !== 1) {
    throw new AccountSessionRequestError("Other session not found.", 404);
  }
}

export async function revokeAllOtherSessions(
  input: AccountSessionOwner,
  database: PrismaClient = getDatabase(),
): Promise<number> {
  const result = await database.session.deleteMany({
    where: {
      userId: input.userId,
      token: { not: input.currentSessionToken },
    },
  });
  return result.count;
}
