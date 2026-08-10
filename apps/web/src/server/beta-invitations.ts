import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { sendBetaInvitation } from "./email";

type Database = PrismaClient;

export function hashBetaInvitationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function submitBetaInviteRequest(input: {
  email: string;
  friendName: string;
  reason: string;
  requesterId: string;
}, database: Database = getDatabase()): Promise<void> {
  await database.betaInviteRequest.create({
    data: {
      id: randomUUID(),
      requesterId: input.requesterId,
      friendName: input.friendName,
      email: input.email.toLowerCase(),
      reason: input.reason,
    },
  });
}

export async function approveBetaInviteRequest(input: {
  expiresAt: Date;
  requestId: string;
}, database: Database = getDatabase()): Promise<void> {
  if (input.expiresAt.getTime() <= Date.now()) throw new Error("Invitation expiry must be in the future.");
  const request = await database.betaInviteRequest.findUnique({ where: { id: input.requestId } });
  if (!request || request.status !== "PENDING") throw new Error("A pending invitation request is required.");

  const code = randomBytes(24).toString("base64url");
  const codeHash = hashBetaInvitationCode(code);
  const invitationId = randomUUID();
  await database.$transaction(async (transaction) => {
    await transaction.betaInvitationCode.upsert({
      where: { requestId: request.id },
      create: {
        id: invitationId,
        requestId: request.id,
        recipientEmail: request.email,
        codeHash,
        expiresAt: input.expiresAt,
      },
      update: {
        id: invitationId,
        recipientEmail: request.email,
        codeHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        consumedAt: null,
        consumedByUserId: null,
      },
    });
  });

  try {
    await sendBetaInvitation({ code, expiresAt: input.expiresAt, recipient: request.email });
    await database.betaInviteRequest.update({ where: { id: request.id }, data: { status: "INVITED" } });
  } catch (error) {
    await database.$transaction([
      database.betaInvitationCode.update({ where: { requestId: request.id }, data: { revokedAt: new Date() } }),
      database.betaInviteRequest.update({ where: { id: request.id }, data: { status: "PENDING" } }),
    ]);
    throw error;
  }
}

export async function rejectBetaInviteRequest(
  requestId: string,
  database: Database = getDatabase(),
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const request = await transaction.betaInviteRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "PENDING") throw new Error("A pending invitation request is required.");
    await transaction.betaInviteRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
    await transaction.betaInvitationCode.updateMany({
      where: { requestId, revokedAt: null, consumedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function redeemBetaInvitation(input: {
  code: string;
  email: string;
  userId: string;
}, database: Database = getDatabase()): Promise<void> {
  const now = new Date();
  const codeHash = hashBetaInvitationCode(input.code);
  await database.$transaction(async (transaction) => {
    const invitation = await transaction.betaInvitationCode.findUnique({
      where: { codeHash },
      include: { request: { select: { status: true } } },
    });
    if (
      !invitation ||
      invitation.recipientEmail.toLowerCase() !== input.email.toLowerCase() ||
      invitation.request.status !== "INVITED" ||
      invitation.expiresAt <= now ||
      invitation.revokedAt ||
      invitation.consumedAt
    ) {
      throw new Error("Invitation code is invalid, expired, revoked, used, or belongs to another account.");
    }

    const consumed = await transaction.betaInvitationCode.updateMany({
      where: {
        id: invitation.id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now, consumedByUserId: input.userId },
    });
    if (consumed.count !== 1) throw new Error("Invitation code could not be consumed.");
    await transaction.user.update({ where: { id: input.userId }, data: { betaEligible: true } });
  });
}
