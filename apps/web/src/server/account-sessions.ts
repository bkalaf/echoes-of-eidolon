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

export async function revokeOneOtherSession(
  input: AccountSessionOwner & { token: string },
  database: PrismaClient = getDatabase(),
): Promise<void> {
  if (input.token === input.currentSessionToken) {
    throw new AccountSessionRequestError(
      "The current session cannot be revoked by an other-session action.",
      400,
    );
  }

  const result = await database.session.deleteMany({
    where: {
      token: input.token,
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
